import * as THREE from 'three';
import { events } from '../../core/EventBus';
import type { EnemyManager } from '../EnemyManager';
import type { Player } from '../Player';
import type { BossModel } from './BossModel';

export interface AttackConfig {
  projSpeedSpread: number;
  damageSpread: number;
  projSpeedBarrage: number;
  damageBarrage: number;
  damageMortar: number;
}

export class BossAttacks {
  static fireFiveWaySpread(
    model: BossModel,
    player: Player,
    enemyManager: EnemyManager,
    cfg: AttackConfig
  ): void {
    const startPos = model.group.position.clone();
    const playerPos = player.camera.position.clone();
    const dist = startPos.distanceTo(playerPos);
    const timeToHit = dist / cfg.projSpeedSpread;

    const predictedPos = playerPos.clone().addScaledVector(player.velocity, timeToHit * 0.85);
    const centerDir = new THREE.Vector3().subVectors(predictedPos, startPos).normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, centerDir).normalize();

    events.emit('sound:boss_shoot');

    // 5-way spread fan: -18°, -9°, 0°, +9°, +18°
    const spreadOffsets = [-0.28, -0.14, 0, 0.14, 0.28];
    for (let i = 0; i < spreadOffsets.length; i++) {
      const dir = centerDir.clone().addScaledVector(right, spreadOffsets[i]).normalize();
      enemyManager.spawnProjectile(startPos, dir, cfg.projSpeedSpread, cfg.damageSpread, 0xff0044);
    }
  }

  static fireLaserBarrage(
    model: BossModel,
    player: Player,
    enemyManager: EnemyManager,
    cfg: AttackConfig,
    isEnraged: boolean,
    isDeadFn: () => boolean
  ): void {
    let shotsFired = 0;
    const maxShots = isEnraged ? 9 : 6;
    const cadence = isEnraged ? 90 : 120;

    const interval = setInterval(() => {
      if (isDeadFn() || player.isDead || shotsFired >= maxShots) {
        clearInterval(interval);
        return;
      }
      shotsFired++;
      const origin =
        shotsFired % 2 === 0
          ? model.leftCannon.getWorldPosition(new THREE.Vector3())
          : model.rightCannon.getWorldPosition(new THREE.Vector3());

      const playerPos = player.camera.position.clone();
      const dir = new THREE.Vector3().subVectors(playerPos, origin).normalize();

      events.emit('sound:enemy_shoot');
      enemyManager.spawnProjectile(origin, dir, cfg.projSpeedBarrage, cfg.damageBarrage, 0xff5500);
    }, cadence);
  }

  static fireOrbitalMortar(
    model: BossModel,
    player: Player,
    enemyManager: EnemyManager,
    damageMortar: number,
    isDeadFn: () => boolean
  ): void {
    events.emit('sound:boss_warning');
    const startPos = model.group.position.clone().add(new THREE.Vector3(0, 2, 0));
    const targetGround = player.position.clone();

    const spreadPoints = [
      targetGround.clone(),
      targetGround.clone().add(new THREE.Vector3(4, 0, 3)),
      targetGround.clone().add(new THREE.Vector3(-4, 0, -3))
    ];

    for (let i = 0; i < spreadPoints.length; i++) {
      setTimeout(() => {
        if (isDeadFn()) return;
        const dir = new THREE.Vector3().subVectors(spreadPoints[i], startPos).normalize();
        enemyManager.spawnProjectile(startPos, dir, 28.0, damageMortar, 0xff7700);
      }, i * 200);
    }
  }
}
