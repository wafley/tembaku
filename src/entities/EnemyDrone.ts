import * as THREE from 'three';
import { CONFIG } from '../config';
import { events } from '../core/EventBus';
import { Player } from './Player';
import { ParticleManager } from '../world/ParticleManager';
import type { EnemyManager } from './EnemyManager';
import { resolveEntityObstacles, steerAroundPillars } from '../physics/Steering';
import { DifficultyConfig } from '../types';

export class EnemyDrone {
  readonly scene: THREE.Scene;
  readonly player: Player;
  readonly particleManager: ParticleManager;
  readonly wave: number;
  readonly difficulty: DifficultyConfig;
  readonly onKilled?: (drone: EnemyDrone) => void;

  readonly maxHealth: number;
  health: number;
  isDead = false;
  readonly isBoss = false;
  readonly radius: number;

  readonly speed: number;
  readonly hoverHeight: number;
  hoverPhase: number;
  readonly attackDistance: number;
  strafeDir: number;
  strafeTimer = 2.0;

  readonly shootInterval: number;
  shootTimer: number;

  group!: THREE.Group;
  hitMesh!: THREE.Mesh;
  ring!: THREE.Mesh;
  barCanvas!: HTMLCanvasElement;
  barCtx!: CanvasRenderingContext2D;
  barTexture!: THREE.CanvasTexture;
  healthSprite!: THREE.Sprite;

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    player: Player,
    particleManager: ParticleManager,
    wave = 1,
    difficulty: DifficultyConfig = CONFIG.DIFFICULTIES[CONFIG.DEFAULT_DIFFICULTY],
    onKilled?: (drone: EnemyDrone) => void
  ) {
    this.scene = scene;
    this.player = player;
    this.particleManager = particleManager;
    this.wave = wave;
    this.difficulty = difficulty;
    this.onKilled = onKilled;

    const cfg = CONFIG.DRONE;
    this.maxHealth = Math.min(cfg.MAX_HEALTH, cfg.BASE_HEALTH + wave * cfg.HP_PER_WAVE);
    this.health = this.maxHealth;
    this.radius = cfg.RADIUS;

    this.speed = Math.min(
      cfg.MAX_SPEED,
      cfg.BASE_SPEED + wave * cfg.SPEED_PER_WAVE + Math.random() * 1.0
    );
    this.hoverHeight = 2.0 + Math.random() * 1.8;
    this.hoverPhase = Math.random() * Math.PI * 2;
    this.attackDistance = Math.min(22, 15 + wave * 0.3);
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;

    const baseInterval = cfg.BASE_SHOOT_INTERVAL - wave * cfg.INTERVAL_DECREASE_PER_WAVE;
    this.shootInterval = Math.max(
      cfg.MIN_SHOOT_INTERVAL,
      (baseInterval + Math.random() * 0.8) * difficulty.droneShootIntervalMult
    );
    this.shootTimer = 1.0 + Math.random() * 1.5;

    this.initMesh(position);
    this.initHealthBar();
  }

  private initMesh(position: THREE.Vector3): void {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2430,
      roughness: 0.3,
      metalness: 0.8
    });

    const glowRedMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const glowCoreMat = new THREE.MeshBasicMaterial({ color: 0xff3366 });

    const coreGeo = new THREE.IcosahedronGeometry(0.7, 1);
    this.hitMesh = new THREE.Mesh(coreGeo, metalMat);
    this.hitMesh.castShadow = true;
    this.group.add(this.hitMesh);

    const eyeGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const eye = new THREE.Mesh(eyeGeo, glowCoreMat);
    eye.position.set(0, 0, 0.45);
    this.group.add(eye);

    const ringGeo = new THREE.TorusGeometry(1.0, 0.05, 8, 24);
    this.ring = new THREE.Mesh(ringGeo, glowRedMat);
    this.group.add(this.ring);

    for (let i = 0; i < 4; i++) {
      const finGeo = new THREE.BoxGeometry(0.12, 0.4, 0.6);
      const fin = new THREE.Mesh(finGeo, metalMat);
      const angle = (i * Math.PI) / 2;
      fin.position.set(Math.cos(angle) * 0.8, 0, Math.sin(angle) * 0.8);
      fin.rotation.y = angle;
      this.group.add(fin);
    }

    this.scene.add(this.group);
  }

  private initHealthBar(): void {
    this.barCanvas = document.createElement('canvas');
    this.barCanvas.width = 128;
    this.barCanvas.height = 16;
    this.barCtx = this.barCanvas.getContext('2d')!;

    this.barTexture = new THREE.CanvasTexture(this.barCanvas);
    const barMat = new THREE.SpriteMaterial({
      map: this.barTexture,
      depthTest: false
    });

    this.healthSprite = new THREE.Sprite(barMat);
    this.healthSprite.scale.set(1.5, 0.2, 1);
    this.healthSprite.position.set(0, 1.2, 0);
    this.group.add(this.healthSprite);

    this.renderHealthBar();
  }

  private renderHealthBar(): void {
    const ctx = this.barCtx;
    ctx.clearRect(0, 0, 128, 16);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 128, 16);
    ctx.strokeStyle = '#ff0044';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 128, 16);

    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = pct > 0.3 ? '#ff0044' : '#ff4400';
    ctx.fillRect(2, 2, Math.floor(124 * pct), 12);

    this.barTexture.needsUpdate = true;
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;

    this.health -= amount;
    this.renderHealthBar();
    this.group.position.y += 0.08;

    if (this.health <= 0) {
      this.die();
    }
  }

  die(): void {
    this.isDead = true;
    events.emit('sound:explosion');
    this.particleManager.createExplosion(this.group.position, 28);
    this.scene.remove(this.group);

    if (this.onKilled) {
      this.onKilled(this);
    }
  }

  update(delta: number, enemyManager: EnemyManager): void {
    if (this.isDead) return;

    this.hoverPhase += delta * 2;
    const targetY = this.hoverHeight + Math.sin(this.hoverPhase) * 0.3;
    this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, targetY, delta * 2);

    this.ring.rotation.x += delta * 1.5;
    this.ring.rotation.y += delta * 2.5;

    const playerPos = this.player.camera.position.clone();
    this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);

    const distToPlayer = this.group.position.distanceTo(playerPos);
    const toPlayerDir = new THREE.Vector3().subVectors(playerPos, this.group.position).normalize();

    if (distToPlayer > this.attackDistance + 2) {
      this.group.position.addScaledVector(toPlayerDir, this.speed * delta);
    } else if (distToPlayer < this.attackDistance - 4) {
      this.group.position.addScaledVector(toPlayerDir, -this.speed * 0.7 * delta);
    }

    this.strafeTimer -= delta;
    if (this.strafeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeTimer = 1.8 + Math.random() * 2.2;
    }
    const right = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), toPlayerDir)
      .normalize();
    this.group.position.addScaledVector(right, this.strafeDir * (this.speed * 0.6) * delta);

    steerAroundPillars(this.group.position, this.radius, delta);
    resolveEntityObstacles(this.group.position, this.radius, this.player.physics.boxColliders);
    this.player.physics.clampToBounds(this.group.position, this.radius + 0.5);

    this.shootTimer -= delta;
    if (this.shootTimer <= 0 && distToPlayer < 38 && !this.player.isDead) {
      this.shootTimer = this.shootInterval;
      this.fireProjectile(enemyManager);
    }
  }

  private fireProjectile(enemyManager: EnemyManager): void {
    const startPos = this.group.position.clone();
    const playerPos = this.player.camera.position.clone();
    const dist = startPos.distanceTo(playerPos);

    const cfg = CONFIG.DRONE;
    const projSpeed = Math.min(
      cfg.MAX_PROJ_SPEED,
      cfg.PROJ_SPEED_BASE + this.wave * cfg.PROJ_SPEED_PER_WAVE
    );
    const timeToHit = dist / projSpeed;

    const predictedPos = playerPos.clone().addScaledVector(this.player.velocity, timeToHit * 0.85);

    const spread = Math.max(0.05, this.difficulty.droneSpread - this.wave * 0.015);
    predictedPos.x += (Math.random() - 0.5) * spread;
    predictedPos.y += (Math.random() - 0.5) * (spread * 0.7);
    predictedPos.z += (Math.random() - 0.5) * spread;

    const dir = new THREE.Vector3().subVectors(predictedPos, startPos).normalize();
    const damage = this.difficulty.droneDamage + Math.floor(this.wave / 5);

    events.emit('sound:enemy_shoot');
    enemyManager.spawnProjectile(startPos, dir, projSpeed, damage, 0xff0044);
  }

  destroy(): void {
    this.scene.remove(this.group);
  }
}
