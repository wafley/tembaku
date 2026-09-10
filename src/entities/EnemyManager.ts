import * as THREE from 'three';
import { EnemyDrone } from './EnemyDrone';
import { BossEnemy } from './BossEnemy';
import { ObjectPool } from '../core/ObjectPool';
import { events } from '../core/EventBus';
import { CONFIG } from '../config';
import { Player } from './Player';
import { ParticleManager } from '../world/ParticleManager';
import { Projectile, DifficultyConfig } from '../types';

const _projRay = new THREE.Ray();
const _tempBox = new THREE.Box3();
const _tempHit = new THREE.Vector3();

export class EnemyManager {
  readonly scene: THREE.Scene;
  readonly player: Player;
  readonly particleManager: ParticleManager;

  readonly enemies: (EnemyDrone | BossEnemy)[] = [];
  readonly activeProjectiles: Projectile[] = [];

  wave = 1;
  kills = 0;
  score = 0;
  difficulty: DifficultyConfig = CONFIG.DIFFICULTIES[CONFIG.DEFAULT_DIFFICULTY];

  readonly bossWavesSet = new Set<number>();
  currentCycle = 1;

  private projGeo = new THREE.SphereGeometry(0.18, 8, 8);
  private projMatRed = new THREE.MeshBasicMaterial({ color: 0xff0044 });
  private projMatOrange = new THREE.MeshBasicMaterial({ color: 0xff5500 });

  private projectilePool!: ObjectPool<Projectile>;

  constructor(scene: THREE.Scene, player: Player, particleManager: ParticleManager) {
    this.scene = scene;
    this.player = player;
    this.particleManager = particleManager;

    events.on('difficulty:change', (diff) => {
      this.difficulty = diff;
    });

    this.initProjectilePool();
  }

  private initProjectilePool(): void {
    this.projectilePool = new ObjectPool<Projectile>(
      () => {
        const mesh = new THREE.Mesh(this.projGeo, this.projMatRed);
        const light = new THREE.PointLight(0xff0044, 3, 5);
        mesh.add(light);
        mesh.visible = false;
        this.scene.add(mesh);
        return {
          mesh,
          light,
          dir: new THREE.Vector3(),
          speed: 36.0,
          damage: 4,
          life: 0
        };
      },
      (p) => {
        p.mesh.visible = false;
      },
      60
    );
  }

  getDroneCount(wave: number): number {
    if (wave <= 5) {
      return 2 + wave;
    } else if (wave <= 15) {
      return 5 + (wave - 5) * 2;
    } else {
      return 25 + (wave - 15) * 3;
    }
  }

  generateBracketBossWaves(cycle: number): number[] {
    const startWave = (cycle - 1) * 10 + 1;
    const endWave = cycle * 10;
    const candidates: number[] = [];
    for (let w = startWave; w <= endWave; w++) {
      candidates.push(w);
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = temp;
    }

    const picked = [candidates[0], candidates[1]];
    picked.forEach((w) => this.bossWavesSet.add(w));
    return picked;
  }

  startNewGame(): void {
    this.clearAll();
    this.wave = 1;
    this.kills = 0;
    this.score = 0;
    this.bossWavesSet.clear();
    this.currentCycle = 1;
    this.generateBracketBossWaves(1);
    this.updateStats();
    this.startWave(this.wave);
  }

  startWave(waveNumber: number): void {
    this.wave = waveNumber;
    if (this.player) {
      this.player.tookDamageThisWave = false;
    }
    this.updateStats();

    const bracket = Math.floor((this.wave - 1) / 10) + 1;
    if (bracket > this.currentCycle) {
      this.currentCycle = bracket;
      this.generateBracketBossWaves(this.currentCycle);
    }

    const isBossWave = this.bossWavesSet.has(this.wave);
    if (isBossWave) {
      this.startBossWave();
    } else {
      this.startStandardWave();
    }
  }

  startStandardWave(): void {
    events.emit('wave:banner', {
      text: `WAVE ${this.wave} DETECTED`,
      isFlawless: false,
      duration: 2400
    });
    events.emit('sound:wave_alert');

    const count = this.getDroneCount(this.wave);
    const halfArena = CONFIG.ARENA.SIZE / 2 - 8;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 20 + Math.random() * (halfArena - 20);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const drone = new EnemyDrone(
        this.scene,
        new THREE.Vector3(x, 2.5, z),
        this.player,
        this.particleManager,
        this.wave,
        this.difficulty,
        (killed) => this.onEnemyKilled(killed)
      );
      this.enemies.push(drone);
    }
  }

  startBossWave(): void {
    events.emit('sound:boss_warning');
    events.emit('wave:banner', {
      text: '⚠️ PERINGATAN: PERTEMPURAN BOSS DIMULAI ⚠️',
      isFlawless: false,
      duration: 3500
    });

    const boss = new BossEnemy(
      this.scene,
      new THREE.Vector3(0, 4.0, -22),
      this.player,
      this.particleManager,
      this.wave,
      this.difficulty,
      (killed) => this.onEnemyKilled(killed)
    );
    this.enemies.push(boss);

    const escortCount = 2 + Math.floor(this.wave / 10);
    this.spawnReinforcements(escortCount);
  }

  spawnReinforcements(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (i === 0 ? -14 : 14) + (Math.random() - 0.5) * 4;
      const z = -18 + (Math.random() - 0.5) * 4;
      const drone = new EnemyDrone(
        this.scene,
        new THREE.Vector3(x, 3.0, z),
        this.player,
        this.particleManager,
        this.wave,
        this.difficulty,
        (killed) => this.onEnemyKilled(killed)
      );
      this.enemies.push(drone);
    }
  }

  onEnemyKilled(enemy: EnemyDrone | BossEnemy): void {
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }

    this.kills++;
    if (enemy.isBoss) {
      const baseScore = 2500 + this.wave * 200;
      const bossScore = Math.round(baseScore * this.difficulty.scoreMultiplier);
      this.score += bossScore;
      events.emit('wave:banner', {
        text: `🏆 BOSS TITAN DIHANCURKAN! (+${bossScore} PTS)`,
        isFlawless: false,
        duration: 3000
      });
    } else {
      this.score += Math.round(100 * this.wave * this.difficulty.scoreMultiplier);
    }
    this.updateStats();

    if (this.enemies.length === 0) {
      if (this.player && !this.player.tookDamageThisWave && !this.player.isDead) {
        const flawlessBonus = Math.round(500 * this.wave * this.difficulty.scoreMultiplier);
        this.score += flawlessBonus;
        this.updateStats();
        events.emit('sound:flawless');
        events.emit('wave:banner', {
          text: `✨ FLAWLESS WAVE! +${flawlessBonus} BONUS PTS ✨`,
          isFlawless: true,
          duration: 2400
        });
      }

      setTimeout(() => {
        if (!this.player.isDead) {
          this.startWave(this.wave + 1);
        }
      }, 1800);
    }
  }

  spawnProjectile(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed = 36.0,
    damage = 4,
    colorHex = 0xff0044
  ): void {
    const p = this.projectilePool.get();
    p.mesh.position.copy(origin);
    p.mesh.material = colorHex === 0xff5500 ? this.projMatOrange : this.projMatRed;
    p.light.color.setHex(colorHex);
    p.mesh.visible = true;

    p.dir.copy(direction);
    p.speed = speed;
    p.damage = damage;
    p.life = 4.0;

    this.activeProjectiles.push(p);
  }

  updateProjectiles(delta: number): void {
    const playerPos = this.player.camera.position;
    const colliders = this.player.physics.boxColliders;

    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.life -= delta;

      const oldPos = p.mesh.position.clone();
      const stepDist = p.speed * delta;
      const newPos = oldPos.clone().addScaledVector(p.dir, stepDist);

      _projRay.origin.copy(oldPos);
      _projRay.direction.copy(p.dir);

      let hitObstacle = false;
      let hitPoint: THREE.Vector3 | null = null;
      let nearestDist = stepDist;

      if (colliders) {
        for (let c = 0; c < colliders.length; c++) {
          _tempBox.copy(colliders[c].box).expandByScalar(0.2);
          if (_projRay.intersectBox(_tempBox, _tempHit)) {
            const d = oldPos.distanceTo(_tempHit);
            if (d <= nearestDist) {
              nearestDist = d;
              hitPoint = _tempHit.clone();
              hitObstacle = true;
            }
          } else if (_tempBox.containsPoint(newPos) || _tempBox.containsPoint(oldPos)) {
            hitObstacle = true;
            hitPoint = newPos.clone();
            nearestDist = 0;
          }
        }
      }

      const distToPlayer = oldPos.distanceTo(playerPos);
      const isPlayerHit = distToPlayer < 1.1 && (!hitObstacle || distToPlayer < nearestDist);

      if (isPlayerHit) {
        this.player.takeDamage(p.damage || 4);
        this.particleManager.createHitSparks(p.mesh.position, p.dir.clone().negate(), 8, 0xff0044);
        this.projectilePool.release(p);
        this.activeProjectiles.splice(i, 1);
        continue;
      }

      if (hitObstacle) {
        this.particleManager.createHitSparks(
          hitPoint || newPos,
          p.dir.clone().negate(),
          8,
          0xff0044
        );
        this.projectilePool.release(p);
        this.activeProjectiles.splice(i, 1);
        continue;
      }

      if (
        p.life <= 0 ||
        newPos.y <= 0.1 ||
        Math.abs(newPos.x) > 39.5 ||
        Math.abs(newPos.z) > 39.5
      ) {
        this.particleManager.createHitSparks(newPos, new THREE.Vector3(0, 1, 0), 6, 0xff0044);
        this.projectilePool.release(p);
        this.activeProjectiles.splice(i, 1);
        continue;
      }

      p.mesh.position.copy(newPos);
    }
  }

  updateStats(): void {
    events.emit('stats:update', {
      score: this.score,
      wave: this.wave,
      kills: this.kills
    });
  }

  update(delta: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].update(delta, this);
    }
    this.updateProjectiles(delta);
  }

  clearAll(): void {
    events.emit('boss:defeated');
    this.enemies.forEach((e) => e.destroy());
    this.enemies.length = 0;
    this.activeProjectiles.forEach((p) => this.projectilePool.release(p));
    this.activeProjectiles.length = 0;
  }
}
