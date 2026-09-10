import * as THREE from 'three';

export class BossModel {
  readonly group: THREE.Group = new THREE.Group();
  hitMesh!: THREE.Mesh;
  eyeMesh!: THREE.Mesh;
  eyeLight!: THREE.PointLight;
  leftCannon!: THREE.Mesh;
  rightCannon!: THREE.Mesh;
  ring1!: THREE.Mesh;
  ring2!: THREE.Mesh;
  shieldMesh!: THREE.Mesh;

  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.group.position.copy(position);
    this.initMeshes();
    scene.add(this.group);
  }

  private initMeshes(): void {
    const darkArmor = new THREE.MeshStandardMaterial({
      color: 0x121722,
      metalness: 0.9,
      roughness: 0.25
    });

    const crimsonTrim = new THREE.MeshStandardMaterial({
      color: 0x880022,
      metalness: 0.8,
      roughness: 0.4
    });

    const neonRed = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const neonOrange = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0088cc,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.9,
      wireframe: false
    });

    // 1. Armored Core
    const coreGeo = new THREE.CylinderGeometry(2.0, 2.5, 1.8, 8);
    this.hitMesh = new THREE.Mesh(coreGeo, darkArmor);
    this.hitMesh.castShadow = true;
    this.group.add(this.hitMesh);

    // 2. Weak Point: Central Sensor Eye
    const eyeGeo = new THREE.SphereGeometry(0.75, 16, 16);
    this.eyeMesh = new THREE.Mesh(eyeGeo, neonRed);
    this.eyeMesh.position.set(0, 0, 1.8);
    this.eyeMesh.userData.isWeakPoint = true;
    this.group.add(this.eyeMesh);

    this.eyeLight = new THREE.PointLight(0xff0033, 10, 16);
    this.eyeLight.position.set(0, 0, 2.2);
    this.group.add(this.eyeLight);

    // 3. Kinetic Energy Shield (Activates in Phase 2)
    const shieldGeo = new THREE.SphereGeometry(3.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6);
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.rotation.x = Math.PI / 2;
    this.shieldMesh.position.set(0, 0, 0.4);
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    // 4. Heavy Cannons
    const cannonGeo = new THREE.BoxGeometry(0.55, 0.55, 3.4);
    this.leftCannon = new THREE.Mesh(cannonGeo, crimsonTrim);
    this.leftCannon.position.set(-2.4, -0.2, 0.6);
    this.group.add(this.leftCannon);

    this.rightCannon = new THREE.Mesh(cannonGeo, crimsonTrim);
    this.rightCannon.position.set(2.4, -0.2, 0.6);
    this.group.add(this.rightCannon);

    // 5. Plasma Rings
    const ringGeo1 = new THREE.TorusGeometry(3.1, 0.1, 8, 32);
    this.ring1 = new THREE.Mesh(ringGeo1, neonRed);
    this.group.add(this.ring1);

    const ringGeo2 = new THREE.TorusGeometry(3.5, 0.08, 8, 32);
    this.ring2 = new THREE.Mesh(ringGeo2, neonOrange);
    this.group.add(this.ring2);

    // 6. Armor Wings
    for (let i = 0; i < 4; i++) {
      const shieldWingGeo = new THREE.BoxGeometry(0.25, 1.6, 2.0);
      const shieldWing = new THREE.Mesh(shieldWingGeo, darkArmor);
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      shieldWing.position.set(Math.cos(angle) * 2.8, 0, Math.sin(angle) * 2.8);
      shieldWing.rotation.y = angle;
      this.group.add(shieldWing);
    }
  }

  setEnragedVisuals(): void {
    (this.eyeMesh.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);
    this.eyeLight.color.setHex(0xff0000);
    this.eyeLight.intensity = 22;
  }

  updateAnimations(delta: number, spinMultiplier: number, hoverPhase: number): void {
    this.ring1.rotation.x += delta * 1.2 * spinMultiplier;
    this.ring1.rotation.y += delta * 1.8 * spinMultiplier;
    this.ring2.rotation.x -= delta * 1.5 * spinMultiplier;
    this.ring2.rotation.z += delta * 1.0 * spinMultiplier;

    if (this.shieldMesh.visible) {
      this.shieldMesh.rotation.z += delta * 0.8;
      (this.shieldMesh.material as THREE.MeshStandardMaterial).opacity =
        0.28 + Math.sin(hoverPhase * 2) * 0.12;
    }
  }
}
