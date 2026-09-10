import * as THREE from 'three';
import { CONFIG } from '../config';
import { events } from '../core/EventBus';
import { Player } from './Player';
import { ParticleManager } from '../world/ParticleManager';
import type { EnemyManager } from './EnemyManager';

export class Weapon {
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  readonly player: Player;
  readonly particleManager: ParticleManager;
  enemyManager?: EnemyManager;

  readonly cfg = CONFIG.WEAPON;
  readonly damage = this.cfg.DAMAGE;
  readonly fireRate = this.cfg.FIRE_RATE;
  fireTimer = 0;
  readonly maxAmmo: number = this.cfg.MAX_AMMO;
  currentAmmo: number = this.cfg.MAX_AMMO;
  isReloading = false;
  readonly reloadDuration = this.cfg.RELOAD_DURATION;
  reloadTimer = 0;

  // Viewmodel Recoil and Sway
  recoilZ = 0;
  recoilRotX = 0;
  swayX = 0;
  swayY = 0;

  readonly hipPos = new THREE.Vector3(this.cfg.HIP_POS.x, this.cfg.HIP_POS.y, this.cfg.HIP_POS.z);
  readonly adsPos = new THREE.Vector3(this.cfg.ADS_POS.x, this.cfg.ADS_POS.y, this.cfg.ADS_POS.z);
  readonly currentPos = this.hipPos.clone();

  readonly raycaster = new THREE.Raycaster();
  muzzlePoint = new THREE.Vector3();

  gunGroup!: THREE.Group;
  flashLight!: THREE.PointLight;
  flashMesh!: THREE.Mesh;

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    player: Player,
    particleManager: ParticleManager,
    enemyManager?: EnemyManager
  ) {
    this.camera = camera;
    this.scene = scene;
    this.player = player;
    this.particleManager = particleManager;
    this.enemyManager = enemyManager;

    this.initModel();
    this.updateAmmoUI();
  }

  private initModel(): void {
    this.gunGroup = new THREE.Group();

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x181e28,
      metalness: 0.85,
      roughness: 0.3
    });

    const highlightMat = new THREE.MeshStandardMaterial({
      color: 0x303d54,
      metalness: 0.9,
      roughness: 0.2
    });

    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const bodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.38);
    const body = new THREE.Mesh(bodyGeo, darkMetal);
    this.gunGroup.add(body);

    const railGeo = new THREE.BoxGeometry(0.06, 0.04, 0.42);
    const rail = new THREE.Mesh(railGeo, highlightMat);
    rail.position.set(0, 0.07, -0.02);
    this.gunGroup.add(rail);

    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, highlightMat);
    barrel.position.set(0, 0.04, -0.28);
    this.gunGroup.add(barrel);

    const brakeGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.06, 8);
    brakeGeo.rotateX(Math.PI / 2);
    const brake = new THREE.Mesh(brakeGeo, darkMetal);
    brake.position.set(0, 0.04, -0.39);
    this.gunGroup.add(brake);

    const coreGeo = new THREE.BoxGeometry(0.04, 0.03, 0.15);
    const core = new THREE.Mesh(coreGeo, cyanGlow);
    core.position.set(0, 0.02, -0.05);
    this.gunGroup.add(core);

    const sightBaseGeo = new THREE.BoxGeometry(0.04, 0.05, 0.08);
    const sightBase = new THREE.Mesh(sightBaseGeo, darkMetal);
    sightBase.position.set(0, 0.11, 0.02);
    this.gunGroup.add(sightBase);

    const lensGeo = new THREE.RingGeometry(0.012, 0.018, 16);
    const lens = new THREE.Mesh(lensGeo, cyanGlow);
    lens.position.set(0, 0.13, 0.02);
    this.gunGroup.add(lens);

    const magGeo = new THREE.BoxGeometry(0.05, 0.16, 0.08);
    magGeo.rotateX(0.2);
    const mag = new THREE.Mesh(magGeo, highlightMat);
    mag.position.set(0, -0.1, 0.05);
    this.gunGroup.add(mag);

    const gripGeo = new THREE.BoxGeometry(0.055, 0.14, 0.07);
    gripGeo.rotateX(-0.35);
    const grip = new THREE.Mesh(gripGeo, darkMetal);
    grip.position.set(0, -0.1, 0.14);
    this.gunGroup.add(grip);

    this.flashLight = new THREE.PointLight(0x00f0ff, 0, 8);
    this.flashLight.position.set(0, 0.04, -0.45);
    this.gunGroup.add(this.flashLight);

    const flashGeo = new THREE.OctahedronGeometry(0.08);
    this.flashMesh = new THREE.Mesh(
      flashGeo,
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0
      })
    );
    this.flashMesh.position.set(0, 0.04, -0.45);
    this.gunGroup.add(this.flashMesh);

    this.gunGroup.position.copy(this.hipPos);
    this.camera.add(this.gunGroup);
  }

  reload(): void {
    if (this.isReloading || this.currentAmmo >= this.maxAmmo) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
    events.emit('weapon:reload_start');
    events.emit('sound:reload');
  }

  shoot(): void {
    if (this.isReloading) return;

    if (this.currentAmmo <= 0) {
      events.emit('sound:empty');
      events.emit('sound:empty_warning');
      events.emit('weapon:ammo', { current: 0, max: this.maxAmmo, empty: true });
      return;
    }

    if (this.fireTimer > 0) return;

    this.currentAmmo--;
    this.fireTimer = this.fireRate;
    this.updateAmmoUI();

    events.emit('sound:shoot');

    // Gun kickback recoil
    this.recoilZ = this.cfg.RECOIL_Z;
    this.recoilRotX = this.cfg.RECOIL_ROT_X;

    // Procedural camera recoil punch
    events.emit('weapon:recoil_kick', {
      pitch: CONFIG.CAMERA.RECOIL_PITCH_KICK,
      yaw: (Math.random() - 0.5) * CONFIG.CAMERA.RECOIL_YAW_KICK
    });

    this.flashLight.intensity = 15;
    (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 1;
    setTimeout(() => {
      this.flashLight.intensity = 0;
      (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }, 45);

    const muzzleLocal = new THREE.Vector3(
      this.cfg.MUZZLE_OFFSET.x,
      this.cfg.MUZZLE_OFFSET.y,
      this.cfg.MUZZLE_OFFSET.z
    );
    this.muzzlePoint = this.gunGroup.localToWorld(muzzleLocal.clone());

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const collidableMeshes: THREE.Object3D[] = [];
    if (this.player.physics && this.player.physics.collidableMeshes) {
      collidableMeshes.push(...this.player.physics.collidableMeshes);
    }

    const enemyMap = new Map<THREE.Object3D, any>();
    if (this.enemyManager && this.enemyManager.enemies) {
      this.enemyManager.enemies.forEach((enemy) => {
        if (!enemy.isDead) {
          if (enemy.hitMesh) {
            collidableMeshes.push(enemy.hitMesh);
            enemyMap.set(enemy.hitMesh, enemy);
          }
          if ((enemy as any).eyeMesh) {
            collidableMeshes.push((enemy as any).eyeMesh);
            enemyMap.set((enemy as any).eyeMesh, enemy);
          }
        }
      });
    }

    const intersects = this.raycaster.intersectObjects(collidableMeshes, false);
    let endPoint = this.camera.position
      .clone()
      .add(this.raycaster.ray.direction.clone().multiplyScalar(this.cfg.MAX_DISTANCE));

    let hitEnemy: any = null;
    let hitPoint: THREE.Vector3 | null = null;
    let hitNormal: THREE.Vector3 | null = null;
    let isWeakPointHit = false;

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint = hit.point;
      hitNormal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);
      const enemy = enemyMap.get(hit.object);
      if (enemy) {
        hitEnemy = enemy;
        if (hit.object.userData && hit.object.userData.isWeakPoint) {
          isWeakPointHit = true;
        }
      }
    }

    // Mobile Bullet Magnetism: If direct click slightly missed on mobile, check generous proximity radius
    if (
      !hitEnemy &&
      this.player.input.isTouchDevice &&
      this.enemyManager &&
      this.enemyManager.enemies
    ) {
      const ray = this.raycaster.ray;
      let maxAllowedDist = hitPoint
        ? this.camera.position.distanceTo(hitPoint)
        : this.cfg.MAX_DISTANCE;

      for (let i = 0; i < this.enemyManager.enemies.length; i++) {
        const enemy = this.enemyManager.enemies[i];
        if (enemy.isDead || !enemy.group) continue;

        const enemyPos = enemy.group.position;
        const distFromRay = ray.distanceToPoint(enemyPos);
        const distAlongRay = ray.origin.distanceTo(enemyPos);

        const magnetRadius = enemy.radius * 1.7;

        if (distFromRay <= magnetRadius && distAlongRay < maxAllowedDist && distAlongRay > 1.2) {
          maxAllowedDist = distAlongRay;
          hitEnemy = enemy;
          hitPoint = enemyPos.clone();
          hitNormal = ray.direction.clone().negate();
        }
      }
    }

    if (hitPoint) {
      endPoint = hitPoint;
      if (hitEnemy) {
        hitEnemy.takeDamage(this.damage, isWeakPointHit);
        const sparkColor = isWeakPointHit ? 0xffea00 : hitEnemy.isBoss ? 0xff0033 : 0xff0055;
        this.particleManager.createHitSparks(
          hitPoint,
          hitNormal || new THREE.Vector3(0, 1, 0),
          isWeakPointHit ? 14 : 10,
          sparkColor
        );
        events.emit('weapon:hit_enemy');
        events.emit('sound:hit_enemy');
      } else {
        this.particleManager.createHitSparks(
          hitPoint,
          hitNormal || new THREE.Vector3(0, 1, 0),
          8,
          0x00f0ff
        );
      }
    }

    this.particleManager.createTracer(this.muzzlePoint, endPoint);
  }

  updateAmmoUI(): void {
    events.emit('weapon:ammo', {
      current: this.currentAmmo,
      max: this.maxAmmo,
      empty: this.currentAmmo === 0
    });
  }

  reset(): void {
    this.currentAmmo = this.maxAmmo;
    this.isReloading = false;
    this.fireTimer = 0;
    this.recoilZ = 0;
    this.recoilRotX = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.updateAmmoUI();
  }

  /**
   * Viewmodel procedural sway and high-frequency render animations
   */
  updateViewmodel(frameTime: number): void {
    const targetPos = this.player.isAiming ? this.adsPos : this.hipPos;
    this.currentPos.lerp(targetPos, frameTime * 14);

    // Spring back recoil
    this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, frameTime * 18);
    this.recoilRotX = THREE.MathUtils.lerp(this.recoilRotX, 0, frameTime * 18);

    // Viewmodel sway based on player movement and strafe
    const swayScale = this.player.isAiming ? 0.2 : 1.0;
    const targetSwayX = -this.player.input.moveVector.x * CONFIG.CAMERA.SWAY_AMOUNT * swayScale;
    const targetSwayY = this.player.onGround ? this.player.bobOffsetY * 0.5 * swayScale : 0;

    this.swayX = THREE.MathUtils.lerp(this.swayX, targetSwayX, frameTime * CONFIG.CAMERA.SWAY_LERP);
    this.swayY = THREE.MathUtils.lerp(this.swayY, targetSwayY, frameTime * CONFIG.CAMERA.SWAY_LERP);

    // Reload dipping animation
    let reloadDip = 0;
    if (this.isReloading) {
      reloadDip = Math.sin((1 - this.reloadTimer / this.reloadDuration) * Math.PI) * 0.15;
    }

    this.gunGroup.position.set(
      this.currentPos.x + this.swayX,
      this.currentPos.y + this.swayY - reloadDip,
      this.currentPos.z + this.recoilZ
    );

    this.gunGroup.rotation.set(this.recoilRotX, -this.swayX * 0.8, this.swayX * 1.2);
  }

  /**
   * Fixed logic update (firing & reload countdown)
   */
  update(delta: number): void {
    if (this.fireTimer > 0) {
      this.fireTimer -= delta;
    }

    if (this.player.input.consumeAction('reload')) {
      this.reload();
    }

    if (
      this.player.input.actions.fire &&
      this.fireTimer <= 0 &&
      this.player.isActive &&
      !this.player.isDead
    ) {
      this.shoot();
    }

    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.currentAmmo = this.maxAmmo;
        this.updateAmmoUI();
        events.emit('weapon:reload_done');
      }
    }
  }
}
