import * as THREE from 'three';
import { CONFIG } from '../config';
import { events } from '../core/EventBus';
import { Player } from './Player';
import { ParticleManager } from '../world/ParticleManager';
import type { EnemyManager } from './EnemyManager';
import { resolveEntityObstacles, steerAroundPillars } from '../physics/Steering';
import { BossModel } from './boss/BossModel';
import { BossAttacks, AttackConfig } from './boss/BossAttacks';
import { DifficultyConfig } from '../types';

export class BossEnemy {
  readonly scene: THREE.Scene;
  readonly player: Player;
  readonly particleManager: ParticleManager;
  readonly wave: number;
  readonly difficulty: DifficultyConfig;
  readonly onKilled?: (boss: BossEnemy) => void;

  readonly isBoss = true;
  readonly name: string;
  readonly maxHealth: number;
  health: number;
  isDead = false;
  readonly radius: number;

  speed: number;
  readonly hoverHeight: number;
  hoverPhase = 0;
  readonly attackDistance: number;

  // Attack Timers
  mainAttackInterval: number;
  mainAttackTimer = 1.8;
  barrageInterval: number;
  barrageTimer = 4.5;
  mortarInterval: number;
  mortarTimer = 6.0;

  readonly attackConfig: AttackConfig;
  readonly escortCount: number;

  // Multi-phase state
  phase: 1 | 2 | 3 = 1;
  private summonedPhase2 = false;
  private hitCountForDodge = 0;
  private dodgeTimer = 0;
  private dodgeVelocity = new THREE.Vector3();

  // Navigation & High-Speed Repositioning
  private strafeDir = Math.random() < 0.5 ? 1 : -1;
  private strafeTimer = 2.5;
  private repositionTimer = 3.5;
  private boostVelocity = new THREE.Vector3();
  private boostTimer = 0;

  readonly model: BossModel;

  // Compatibility getters for hit detection & position
  get group(): THREE.Group {
    return this.model.group;
  }

  get hitMesh(): THREE.Mesh {
    return this.model.hitMesh;
  }

  get eyeMesh(): THREE.Mesh {
    return this.model.eyeMesh;
  }

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    player: Player,
    particleManager: ParticleManager,
    wave: number,
    difficulty: DifficultyConfig = CONFIG.DIFFICULTIES[CONFIG.DEFAULT_DIFFICULTY],
    onKilled?: (boss: BossEnemy) => void
  ) {
    this.scene = scene;
    this.player = player;
    this.particleManager = particleManager;
    this.wave = wave;
    this.difficulty = difficulty;
    this.onKilled = onKilled;

    const cfg = CONFIG.BOSS;
    this.name = cfg.NAME;
    this.maxHealth = difficulty.bossHp + wave * cfg.HP_PER_WAVE;
    this.health = this.maxHealth;
    this.radius = cfg.RADIUS;

    this.speed = difficulty.bossSpeed;
    this.hoverHeight = cfg.HOVER_HEIGHT;
    this.attackDistance = cfg.ATTACK_DISTANCE;

    this.mainAttackInterval = cfg.SPREAD_INTERVAL_BASE * difficulty.bossAttackIntervalMult;
    this.barrageInterval = cfg.BARRAGE_INTERVAL_BASE * difficulty.bossAttackIntervalMult;
    this.mortarInterval = cfg.MORTAR_INTERVAL_BASE * difficulty.bossAttackIntervalMult;

    this.attackConfig = {
      damageSpread: cfg.DAMAGE_SPREAD + Math.floor(wave / 4),
      damageBarrage: cfg.DAMAGE_BARRAGE + Math.floor(wave / 4),
      damageMortar: cfg.DAMAGE_MORTAR + Math.floor(wave / 4),
      projSpeedSpread: cfg.PROJ_SPEED_SPREAD,
      projSpeedBarrage: cfg.PROJ_SPEED_BARRAGE
    };
    this.escortCount = 3 + Math.floor(wave / 8);

    this.model = new BossModel(this.scene, position);

    events.emit('boss:spawn', {
      name: this.name,
      health: this.health,
      maxHealth: this.maxHealth
    });
  }

  takeDamage(amount: number, isWeakPoint = false): void {
    if (this.isDead) return;

    let effectiveDamage = amount;

    // Phase 2 Shield mechanic
    if (this.phase === 2 && this.model.shieldMesh.visible) {
      if (isWeakPoint) {
        effectiveDamage = amount * 1.5;
        this.particleManager.createHitSparks(
          this.group.position,
          new THREE.Vector3(0, 1, 0),
          14,
          0xffea00
        );
      } else {
        effectiveDamage = amount * 0.35;
        this.particleManager.createHitSparks(
          this.group.position,
          new THREE.Vector3(0, 1, 0),
          6,
          0x00f0ff
        );
      }
    } else if (isWeakPoint) {
      effectiveDamage = amount * 1.4;
      this.particleManager.createHitSparks(
        this.group.position,
        new THREE.Vector3(0, 1, 0),
        14,
        0xffea00
      );
    }

    this.health -= effectiveDamage;
    events.emit('boss:health', { current: this.health, max: this.maxHealth });

    // Dodge after repeated hits
    this.hitCountForDodge++;
    if (this.hitCountForDodge >= 4 && this.dodgeTimer <= 0) {
      this.hitCountForDodge = 0;
      this.triggerThrusterDodge();
    }

    this.checkPhaseTransitions();

    if (this.health <= 0) {
      this.die();
    }
  }

  private triggerThrusterDodge(): void {
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.dodgeTimer = 0.45;
    const right = new THREE.Vector3();
    this.group.getWorldDirection(right);
    right.cross(new THREE.Vector3(0, 1, 0)).normalize();
    this.dodgeVelocity.copy(right).multiplyScalar(dir * 18);

    this.particleManager.createHitSparks(this.group.position, right.clone().negate(), 15, 0xff5500);
    events.emit('sound:boss_shoot');
  }

  private checkPhaseTransitions(): void {
    const pct = this.health / this.maxHealth;

    // Phase 2: Shield & Reinforcements
    if (pct <= 0.7 && this.phase === 1) {
      this.phase = 2;
      this.model.shieldMesh.visible = true;
      events.emit('wave:banner', {
        text: '⚠️ PERINGATAN: NEXUS TITAN MENGAKTIFKAN KINETIC SHIELD ⚠️',
        isFlawless: false,
        duration: 3000
      });
      events.emit('sound:boss_warning');
    }

    // Phase 3: Berserk Overdrive
    if (pct <= 0.3 && this.phase !== 3) {
      this.phase = 3;
      this.model.shieldMesh.visible = false;
      this.particleManager.createExplosion(this.group.position, 35);
      this.model.setEnragedVisuals();
      this.speed = CONFIG.BOSS.MAX_SPEED;

      this.mainAttackInterval = 1.0;
      this.barrageInterval = 2.4;
      this.mortarInterval = 3.6;

      events.emit('wave:banner', {
        text: '🔥 BERSIAPLAH: NEXUS TITAN MASUK MODE BERSERK OVERDRIVE! 🔥',
        isFlawless: false,
        duration: 3500
      });
      events.emit('sound:boss_warning');
    }
  }

  die(): void {
    this.isDead = true;

    events.emit('sound:explosion');
    this.particleManager.createExplosion(this.group.position, 60);

    setTimeout(() => {
      events.emit('sound:explosion');
      this.particleManager.createExplosion(
        this.group.position.clone().add(new THREE.Vector3(1.2, 0.8, 0)),
        45
      );
    }, 220);

    setTimeout(() => {
      events.emit('sound:explosion');
      this.particleManager.createExplosion(
        this.group.position.clone().add(new THREE.Vector3(-1.2, -0.6, 0.5)),
        45
      );
    }, 450);

    setTimeout(() => {
      events.emit('sound:explosion');
      this.particleManager.createExplosion(this.group.position, 70);
    }, 700);

    events.emit('boss:defeated');
    this.scene.remove(this.group);

    if (this.onKilled) {
      this.onKilled(this);
    }
  }

  update(delta: number, enemyManager: EnemyManager): void {
    if (this.isDead) return;

    // 1. Dynamic Hover & Altitude Undulation
    this.hoverPhase += delta * (this.phase === 3 ? 2.2 : 1.6);
    const verticalAmplitude = this.phase === 3 ? 1.6 : 1.1;
    const targetY = this.hoverHeight + Math.sin(this.hoverPhase) * verticalAmplitude;
    this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, targetY, delta * 3);

    // 2. Model Visual Animations
    const spinMultiplier = this.phase === 3 ? 3.2 : this.phase === 2 ? 1.8 : 1.0;
    this.model.updateAnimations(delta, spinMultiplier, this.hoverPhase);

    // 3. Face Player
    const playerPos = this.player.camera.position.clone();
    this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);

    // 4. Dodge thruster decay
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= delta;
      this.group.position.addScaledVector(this.dodgeVelocity, delta);
      this.dodgeVelocity.multiplyScalar(Math.max(0, 1 - delta * 6));
    }

    // 5. Periodic Jet Repositioning (Tactical Flank Surges)
    this.repositionTimer -= delta;
    if (this.repositionTimer <= 0) {
      this.repositionTimer =
        this.phase === 3 ? 2.0 + Math.random() * 1.4 : 3.2 + Math.random() * 1.8;
      const right = new THREE.Vector3();
      this.group.getWorldDirection(right);
      right.cross(new THREE.Vector3(0, 1, 0)).normalize();

      const surgeDir = Math.random() < 0.5 ? 1 : -1;
      const surgeForce = this.phase === 3 ? 20.0 : 14.0;
      this.boostVelocity.copy(right).multiplyScalar(surgeDir * surgeForce);
      this.boostTimer = 0.4;

      this.particleManager.createHitSparks(
        this.group.position,
        right.clone().negate(),
        18,
        0xff5500
      );
      events.emit('sound:boss_shoot');
    }

    if (this.boostTimer > 0) {
      this.boostTimer -= delta;
      this.group.position.addScaledVector(this.boostVelocity, delta);
      this.boostVelocity.multiplyScalar(Math.max(0, 1 - delta * 5));
    }

    // 6. Circle Strafing & Stalking
    this.strafeTimer -= delta;
    if (this.strafeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeTimer = 1.8 + Math.random() * 2.2;
    }

    const distToPlayer = this.group.position.distanceTo(playerPos);
    const toPlayerDir = new THREE.Vector3().subVectors(playerPos, this.group.position).normalize();
    const rightVec = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), toPlayerDir)
      .normalize();

    const lateralSpeed = this.speed * (this.phase === 3 ? 1.25 : 0.95);
    this.group.position.addScaledVector(rightVec, this.strafeDir * lateralSpeed * delta);

    if (distToPlayer > this.attackDistance + 1.5) {
      this.group.position.addScaledVector(toPlayerDir, this.speed * delta);
    } else if (distToPlayer < this.attackDistance - 2.5) {
      this.group.position.addScaledVector(toPlayerDir, -this.speed * 0.75 * delta);
    }

    steerAroundPillars(this.group.position, this.radius, delta);
    resolveEntityObstacles(this.group.position, this.radius, this.player.physics.boxColliders);
    this.player.physics.clampToBounds(this.group.position, this.radius + 0.8);

    // 7. Summon Escorts
    if (this.phase === 2 && !this.summonedPhase2) {
      this.summonedPhase2 = true;
      enemyManager.spawnReinforcements(this.escortCount);
    }

    // 8. Attack Execution
    this.mainAttackTimer -= delta;
    if (this.mainAttackTimer <= 0 && !this.player.isDead) {
      this.mainAttackTimer = this.mainAttackInterval;
      BossAttacks.fireFiveWaySpread(this.model, this.player, enemyManager, this.attackConfig);
    }

    this.barrageTimer -= delta;
    if (this.barrageTimer <= 0 && !this.player.isDead) {
      this.barrageTimer = this.barrageInterval;
      BossAttacks.fireLaserBarrage(
        this.model,
        this.player,
        enemyManager,
        this.attackConfig,
        this.phase === 3,
        () => this.isDead
      );
    }

    if (this.phase === 3) {
      this.mortarTimer -= delta;
      if (this.mortarTimer <= 0 && !this.player.isDead) {
        this.mortarTimer = this.mortarInterval;
        BossAttacks.fireOrbitalMortar(
          this.model,
          this.player,
          enemyManager,
          this.attackConfig.damageMortar,
          () => this.isDead
        );
      }
    }
  }

  destroy(): void {
    events.emit('boss:defeated');
    this.scene.remove(this.group);
  }
}
