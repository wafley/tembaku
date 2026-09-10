import * as THREE from 'three';
import { CONFIG } from '../config';
import { BoxCollider } from '../types';

export class Arena {
  readonly scene: THREE.Scene;
  readonly root: THREE.Group = new THREE.Group();
  readonly colliders: BoxCollider[] = [];
  readonly lights: THREE.PointLight[] = [];
  readonly size: number = CONFIG.ARENA.SIZE;
  readonly wallHeight: number = CONFIG.ARENA.WALL_HEIGHT;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.root);

    this.init();
  }

  private init(): void {
    this.setupLighting();
    this.createFloor();
    this.createWalls();
    this.createObstacles();
    this.createCentralPlatform();
  }

  private setupLighting(): void {
    this.scene.fog = new THREE.FogExp2(CONFIG.ARENA.FOG_COLOR, CONFIG.ARENA.FOG_DENSITY);

    const ambient = new THREE.AmbientLight(
      CONFIG.ARENA.AMBIENT_COLOR,
      CONFIG.ARENA.AMBIENT_INTENSITY
    );
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(
      CONFIG.ARENA.DIR_LIGHT_COLOR,
      CONFIG.ARENA.DIR_LIGHT_INTENSITY
    );
    dirLight.position.set(25, 45, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 120;
    const d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const lightConfigs = [
      { pos: [-25, 5, -25] as const, color: 0x00f0ff, intensity: 45 },
      { pos: [25, 5, -25] as const, color: 0xff0055, intensity: 45 },
      { pos: [-25, 5, 25] as const, color: 0xffaa00, intensity: 45 },
      { pos: [25, 5, 25] as const, color: 0x00f0ff, intensity: 45 },
      { pos: [0, 8, 0] as const, color: 0x00f0ff, intensity: 60 }
    ];

    lightConfigs.forEach((cfg) => {
      const pl = new THREE.PointLight(cfg.color, cfg.intensity, 25, 1.8);
      pl.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      this.scene.add(pl);
      this.lights.push(pl);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 12, 12),
        new THREE.MeshBasicMaterial({ color: cfg.color })
      );
      marker.position.copy(pl.position);
      this.scene.add(marker);
    });
  }

  private createFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0c111d';
    ctx.fillRect(0, 0, 1024, 1024);

    const tileSize = 128;
    ctx.strokeStyle = '#182844';
    ctx.lineWidth = 4;
    for (let x = 0; x <= 1024; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#131e33';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#00f0ff';
    for (let x = 0; x <= 1024; x += tileSize) {
      for (let y = 0; y <= 1024; y += tileSize) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    return texture;
  }

  private createWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#101626';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#1f2b45';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 492);

    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(20, 240, 472, 8);

    ctx.fillStyle = '#ffaa00';
    for (let i = 0; i < 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 512);
      ctx.lineTo(i + 16, 512);
      ctx.lineTo(i + 32, 480);
      ctx.lineTo(i + 16, 480);
      ctx.closePath();
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 2);
    return texture;
  }

  private createFloor(): void {
    const floorTexture = this.createFloorTexture();
    const floorGeo = new THREE.PlaneGeometry(this.size, this.size);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.5,
      metalness: 0.6
    });

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);
  }

  private createWalls(): void {
    const wallTexture = this.createWallTexture();
    const half = this.size / 2;
    const h = this.wallHeight;

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.6,
      metalness: 0.4
    });

    const wallConfigs = [
      { size: [this.size + 4, h, 2] as const, pos: [0, h / 2, -half - 1] as const },
      { size: [this.size + 4, h, 2] as const, pos: [0, h / 2, half + 1] as const },
      { size: [2, h, this.size + 4] as const, pos: [-half - 1, h / 2, 0] as const },
      { size: [2, h, this.size + 4] as const, pos: [half + 1, h / 2, 0] as const }
    ];

    wallConfigs.forEach((cfg) => {
      const geo = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);

      const halfW = cfg.size[0] / 2;
      const halfD = cfg.size[2] / 2;
      const box = new THREE.Box3(
        new THREE.Vector3(cfg.pos[0] - halfW, 0, cfg.pos[2] - halfD),
        new THREE.Vector3(cfg.pos[0] + halfW, h, cfg.pos[2] + halfD)
      );
      this.colliders.push({ box, mesh, isWall: true });
    });
  }

  private createObstacles(): void {
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1a243a,
      roughness: 0.4,
      metalness: 0.7
    });

    const glowTrimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x24324f,
      roughness: 0.5,
      metalness: 0.5
    });

    const pillarLocations: [number, number][] = [
      [-16, -16],
      [16, -16],
      [-16, 16],
      [16, 16]
    ];

    pillarLocations.forEach(([x, z]) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const pillarGeo = new THREE.BoxGeometry(3, this.wallHeight, 3);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.y = this.wallHeight / 2;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      group.add(pillar);

      const trimGeo = new THREE.BoxGeometry(3.08, 0.3, 3.08);
      const trim1 = new THREE.Mesh(trimGeo, glowTrimMat);
      trim1.position.y = 2.5;
      const trim2 = new THREE.Mesh(trimGeo, glowTrimMat);
      trim2.position.y = 5.5;
      group.add(trim1, trim2);

      this.root.add(group);

      const box = new THREE.Box3(
        new THREE.Vector3(x - 1.5, 0, z - 1.5),
        new THREE.Vector3(x + 1.5, this.wallHeight, z + 1.5)
      );
      this.colliders.push({ box, mesh: pillar });
    });

    const coverLayouts = [
      { size: [4.5, 1.8, 1.2] as const, pos: [0, 0.9, -15] as const, rot: 0 },
      { size: [4.5, 1.8, 1.2] as const, pos: [0, 0.9, 15] as const, rot: 0 },
      { size: [1.2, 1.8, 4.5] as const, pos: [-15, 0.9, 0] as const, rot: 0 },
      { size: [1.2, 1.8, 4.5] as const, pos: [15, 0.9, 0] as const, rot: 0 },
      { size: [3.5, 1.6, 1.2] as const, pos: [-24, 0.8, -12] as const, rot: 0 },
      { size: [3.5, 1.6, 1.2] as const, pos: [24, 0.8, -12] as const, rot: 0 },
      { size: [3.5, 1.6, 1.2] as const, pos: [-24, 0.8, 12] as const, rot: 0 },
      { size: [3.5, 1.6, 1.2] as const, pos: [24, 0.8, 12] as const, rot: 0 }
    ];

    coverLayouts.forEach((cfg) => {
      const geo = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
      const mesh = new THREE.Mesh(geo, crateMat);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      mesh.rotation.y = cfg.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const edgeGeo = new THREE.BoxGeometry(cfg.size[0] * 0.9, 0.1, 0.1);
      const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.y = cfg.size[1] / 2 + 0.05;
      mesh.add(edge);

      this.root.add(mesh);

      const halfW = cfg.size[0] / 2;
      const halfD = cfg.size[2] / 2;
      const box = new THREE.Box3(
        new THREE.Vector3(cfg.pos[0] - halfW, 0, cfg.pos[2] - halfD),
        new THREE.Vector3(cfg.pos[0] + halfW, cfg.size[1], cfg.pos[2] + halfD)
      );
      this.colliders.push({ box, mesh });
    });
  }

  private createCentralPlatform(): void {
    const daisGeo = new THREE.CylinderGeometry(5.5, 6, 0.8, 16);
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0x141f33,
      roughness: 0.4,
      metalness: 0.8
    });
    const dais = new THREE.Mesh(daisGeo, daisMat);
    dais.position.set(0, 0.4, 0);
    dais.castShadow = true;
    dais.receiveShadow = true;

    const rimGeo = new THREE.TorusGeometry(5.6, 0.08, 8, 32);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.8;
    dais.add(rim);

    this.root.add(dais);
  }
}
