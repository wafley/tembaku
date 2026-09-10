import * as THREE from 'three';
import { Capsule, PhysicsWorld } from '../physics/PhysicsWorld';
import { InputManager } from '../core/InputManager';
import { CONFIG } from '../config';
import { events } from '../core/EventBus';
import { DifficultyConfig } from '../types';

export class Player {
  readonly camera: THREE.PerspectiveCamera;
  readonly physics: PhysicsWorld;
  readonly input: InputManager;

  readonly cfg = CONFIG.PLAYER;
  maxHealth: number = this.cfg.MAX_HEALTH;
  health: number = this.cfg.MAX_HEALTH;
  isDead = false;
  isActive = false;

  readonly radius = this.cfg.RADIUS;
  readonly height = this.cfg.HEIGHT;
  readonly collider: Capsule;

  readonly position = new THREE.Vector3(0, this.height, 26);
  readonly velocity = new THREE.Vector3();
  onGround = true;
  private wasOnGround = true;
  jumpBufferTimer = 0;

  // Professional FPS Camera Orientation
  yaw = 0;
  pitch = 0;
  roll = 0;

  // Procedural Camera Dynamics
  recoilPitch = 0;
  recoilYaw = 0;
  landingDip = 0;
  bobOffsetY = 0;

  isAiming = false;
  readonly baseFov = this.cfg.BASE_FOV;
  readonly aimFov = this.cfg.AIM_FOV;

  bobTimer = 0;
  stepTimer = 0;

  lastHitTime = 0;
  tookDamageThisWave = false;
  medkitCooldown = 0;
  medkitMaxCooldown: number = this.cfg.MEDKIT_COOLDOWN;
  medkitHealAmount: number = this.cfg.MEDKIT_HEAL_AMOUNT;
  invulnTime: number = this.cfg.INVULNERABILITY_TIME;
  aimAssistFriction = 0.55;
  heartbeatTimer = 0;
  enemyManager?: any;
  aimAssistEnabled = true;

  constructor(
    camera: THREE.PerspectiveCamera,
    physicsWorld: PhysicsWorld,
    inputManager: InputManager
  ) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ'; // Essential for FPS cameras to prevent gimbal roll
    this.physics = physicsWorld;
    this.input = inputManager;

    this.collider = new Capsule(
      new THREE.Vector3(0, this.radius, 26),
      new THREE.Vector3(0, this.height - this.radius, 26),
      this.radius
    );

    events.on('weapon:recoil_kick', ({ pitch, yaw }) => {
      this.recoilPitch += pitch;
      this.recoilYaw += yaw;
    });

    events.on('difficulty:change', (diff) => {
      this.applyDifficulty(diff);
    });

    this.reset();
  }

  applyDifficulty(diff: DifficultyConfig): void {
    this.maxHealth = diff.playerHp;
    this.health = Math.min(this.health, this.maxHealth);
    this.medkitMaxCooldown = diff.medkitCooldown;
    this.medkitHealAmount = diff.medkitHeal;
    this.invulnTime = diff.invulnTime;
    this.aimAssistFriction = diff.aimAssistFriction;
    events.emit('player:health', { current: this.health, max: this.maxHealth });
    events.emit('player:medkit', {
      ready: this.medkitCooldown <= 0,
      cooldown: this.medkitCooldown
    });
  }

  reset(): void {
    this.health = this.maxHealth;
    this.isDead = false;
    this.isActive = true;
    this.velocity.set(0, 0, 0);

    this.position.set(0, this.height, 26);
    this.collider.start.set(0, this.radius, 26);
    this.collider.end.set(0, this.height - this.radius, 26);

    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.landingDip = 0;
    this.bobOffsetY = 0;
    this.onGround = true;
    this.wasOnGround = true;

    this.camera.position.copy(this.position);
    this.camera.rotation.set(0, 0, 0, 'YXZ');

    this.jumpBufferTimer = 0;
    this.medkitCooldown = 0;
    this.lastHitTime = 0;
    this.heartbeatTimer = 0;
    this.tookDamageThisWave = false;
    this.isAiming = false;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();

    events.emit('player:health', { current: this.health, max: this.maxHealth });
    events.emit('player:medkit', { ready: true, cooldown: 0 });
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;

    const now = performance.now();
    if (now - this.lastHitTime < this.invulnTime) {
      return;
    }
    this.lastHitTime = now;
    this.tookDamageThisWave = true;

    this.health = Math.max(0, this.health - amount);
    events.emit('player:health', { current: this.health, max: this.maxHealth });
    events.emit('player:damage', { amount, health: this.health });
    events.emit('sound:player_hit');

    if (this.health <= 0) {
      this.die();
    }
  }

  useMedkit(): void {
    if (this.isDead || !this.isActive) return;
    if (this.medkitCooldown > 0 || this.health >= this.maxHealth) return;

    this.health = Math.min(this.maxHealth, this.health + this.medkitHealAmount);
    this.medkitCooldown = this.medkitMaxCooldown;

    events.emit('player:health', { current: this.health, max: this.maxHealth });
    events.emit('player:heal', { amount: this.medkitHealAmount, health: this.health });
    events.emit('player:medkit', { ready: false, cooldown: this.medkitCooldown });
    events.emit('sound:heal');
  }

  die(): void {
    this.isDead = true;
    this.isActive = false;
    this.input.unlock();
    events.emit('player:dead');
  }

  setEnemyManager(em: any): void {
    this.enemyManager = em;
  }

  /**
   * Professional FPS Camera Update:
   * Runs per render frame (e.g. 144Hz/240Hz) for zero-latency look,
   * focal-length-scaled ADS sensitivity, strafe banking roll, recoil punch, and landing dips.
   */
  updateCamera(frameTime: number): void {
    if (this.isDead || !this.isActive) return;

    // 1. Focal-length scaled sensitivity (ADS precision)
    const fovRatio = this.camera.fov / this.baseFov;
    let { dx, dy } = this.input.consumeLookDelta(fovRatio);

    // Mobile Aim Assist (Target Friction & Magnetism)
    if (
      this.aimAssistEnabled &&
      this.input.isTouchDevice &&
      this.enemyManager &&
      this.enemyManager.enemies
    ) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);

      let bestEnemy: any = null;
      let bestDot = 0.93; // within ~21 degrees cone of vision
      let bestDir: THREE.Vector3 | null = null;

      for (let i = 0; i < this.enemyManager.enemies.length; i++) {
        const enemy = this.enemyManager.enemies[i];
        if (enemy.isDead || !enemy.group) continue;

        const toEnemy = enemy.group.position.clone().sub(this.camera.position);
        const dist = toEnemy.length();
        if (dist > 45) continue;

        toEnemy.normalize();
        const dot = camDir.dot(toEnemy);
        if (dot > bestDot) {
          bestDot = dot;
          bestEnemy = enemy;
          bestDir = toEnemy;
        }
      }

      if (bestEnemy && bestDir) {
        // Aim Friction from difficulty preset
        dx *= this.aimAssistFriction;
        dy *= this.aimAssistFriction;

        // Aim Magnetism: subtle soft gravitational pull towards target center
        const targetYaw = Math.atan2(-bestDir.x, -bestDir.z);
        const targetPitch = Math.asin(THREE.MathUtils.clamp(bestDir.y, -1, 1));

        let yawDiff = (targetYaw - this.yaw) % (Math.PI * 2);
        if (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        if (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

        const pitchDiff = targetPitch - this.pitch;
        const pullFactor = 1.4 * frameTime;

        this.yaw += yawDiff * pullFactor;
        this.pitch += pitchDiff * pullFactor;
      }
    }

    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy,
      CONFIG.CAMERA.PITCH_MIN,
      CONFIG.CAMERA.PITCH_MAX
    );

    // 2. Procedural Camera Recoil Punch Recovery
    this.recoilPitch = THREE.MathUtils.lerp(
      this.recoilPitch,
      0,
      frameTime * CONFIG.CAMERA.RECOIL_RECOVERY_SPEED
    );
    this.recoilYaw = THREE.MathUtils.lerp(
      this.recoilYaw,
      0,
      frameTime * CONFIG.CAMERA.RECOIL_RECOVERY_SPEED
    );

    // 3. Dynamic Strafe Banking / Camera Roll (Leaning into strafes)
    const targetRoll = -this.input.moveVector.x * CONFIG.CAMERA.STRAFE_ROLL_MAX;
    this.roll = THREE.MathUtils.lerp(
      this.roll,
      targetRoll,
      frameTime * CONFIG.CAMERA.STRAFE_ROLL_SPEED
    );

    // 4. Landing Impact Recovery (Spring compression)
    this.landingDip = THREE.MathUtils.lerp(
      this.landingDip,
      0,
      frameTime * CONFIG.CAMERA.LANDING_DIP_RECOVERY
    );

    // 5. Apply complete orientation in strict YXZ order
    this.camera.rotation.set(
      this.pitch + this.recoilPitch,
      this.yaw + this.recoilYaw,
      this.roll,
      'YXZ'
    );

    // 6. Sync camera position with physical position + bobbing + landing dip
    this.camera.position.set(
      this.position.x,
      this.position.y + this.bobOffsetY - this.landingDip,
      this.position.z
    );
  }

  /**
   * Physics & Movement fixed update (deterministic 60Hz)
   */
  update(delta: number): void {
    if (this.isDead || !this.isActive) return;

    if (this.input.consumeAction('heal')) {
      this.useMedkit();
    }

    if (this.medkitCooldown > 0) {
      this.medkitCooldown = Math.max(0, this.medkitCooldown - delta);
      const ready = this.medkitCooldown <= 0;
      events.emit('player:medkit', { ready, cooldown: this.medkitCooldown });
    }

    if (this.health <= 30) {
      this.heartbeatTimer += delta;
      if (this.heartbeatTimer >= 0.85) {
        events.emit('sound:heartbeat');
        this.heartbeatTimer = 0;
      }
    } else {
      this.heartbeatTimer = 0;
    }

    this.isAiming = this.input.actions.ads;
    const targetFov = this.isAiming ? this.aimFov : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 14);
      this.camera.updateProjectionMatrix();
    }

    if (this.input.consumeAction('jump')) {
      this.jumpBufferTimer = this.cfg.JUMP_BUFFER_TIME;
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
      if (this.onGround) {
        this.velocity.y = this.cfg.JUMP_FORCE;
        this.onGround = false;
        this.jumpBufferTimer = 0;
        this.landingDip = -0.04; // subtle upward pop on jump
        events.emit('sound:jump');
      }
    }

    const currentSpeed =
      this.input.actions.sprint && !this.isAiming ? this.cfg.SPRINT_SPEED : this.cfg.WALK_SPEED;

    // Movement direction derived directly from Yaw angle
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    const move = this.input.moveVector;
    const moveVector = new THREE.Vector3();
    if (move.x !== 0 || move.z !== 0) {
      moveVector.x = rightX * move.x - forwardX * move.z;
      moveVector.z = rightZ * move.x - forwardZ * move.z;
      if (moveVector.lengthSq() > 0) {
        moveVector.normalize();
      }
    }

    const targetVelX = moveVector.x * currentSpeed;
    const targetVelZ = moveVector.z * currentSpeed;
    const lerpRate = this.onGround ? this.cfg.GROUND_LERP : this.cfg.AIR_CONTROL_LERP;

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, lerpRate * delta);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, lerpRate * delta);

    this.velocity.y -= this.cfg.GRAVITY * delta;

    const deltaPos = this.velocity.clone().multiplyScalar(delta);
    this.collider.translate(deltaPos);

    const result = this.physics.capsuleIntersect(this.collider);
    this.onGround = false;

    if (result) {
      this.onGround = result.normal.y >= 0.15;

      if (!this.onGround) {
        this.velocity.addScaledVector(result.normal, -result.normal.dot(this.velocity));
      } else {
        // Just landed from air
        if (!this.wasOnGround) {
          const impact = Math.min(
            CONFIG.CAMERA.LANDING_DIP_MAX,
            Math.abs(this.velocity.y) * 0.008 + 0.02
          );
          this.landingDip = impact;
        }
        this.velocity.y = 0;
      }

      if (result.depth >= 1e-10) {
        this.collider.translate(result.normal.multiplyScalar(result.depth));
      }
    }

    if (this.collider.start.y < this.radius) {
      const correction = this.radius - this.collider.start.y;
      this.collider.translate(new THREE.Vector3(0, correction, 0));
      this.velocity.y = 0;
      this.onGround = true;
    }

    this.wasOnGround = this.onGround;

    this.physics.clampToBounds(this.collider.start, this.radius);
    this.physics.clampToBounds(this.collider.end, this.radius);

    this.position.copy(this.collider.end);

    // Visual Head Bobbing
    const isMoving = (move.x !== 0 || move.z !== 0) && this.onGround;
    if (isMoving) {
      const stepFreq = this.input.actions.sprint ? 14 : 9;
      this.bobTimer += delta * stepFreq;
      const bobAmount = this.isAiming ? 0.015 : this.input.actions.sprint ? 0.055 : 0.032;
      this.bobOffsetY = Math.sin(this.bobTimer) * bobAmount;

      this.stepTimer += delta;
      const stepInterval = this.input.actions.sprint ? 0.26 : 0.38;
      if (this.stepTimer >= stepInterval) {
        events.emit('sound:footstep');
        this.stepTimer = 0;
      }
    } else {
      this.bobTimer = 0;
      this.stepTimer = 0;
      this.bobOffsetY = THREE.MathUtils.lerp(this.bobOffsetY, 0, delta * 12);
    }
  }
}
