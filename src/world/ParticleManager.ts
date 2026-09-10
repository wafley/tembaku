import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool';
import { CONFIG } from '../config';
import { Particle, Tracer } from '../types';

export class ParticleManager {
  readonly scene: THREE.Scene;

  readonly activeSparks: Particle[] = [];
  readonly activeDebris: Particle[] = [];
  readonly activeTracers: Tracer[] = [];

  private sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  private sparkMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  private sparkMatOrange = new THREE.MeshBasicMaterial({ color: 0xff7700 });
  private debrisGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

  private debrisMats = [
    new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
    new THREE.MeshBasicMaterial({ color: 0xff0055 }),
    new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
    new THREE.MeshBasicMaterial({ color: 0x112244 })
  ];

  private tracerGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 4);
  private tracerMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.95
  });

  private sparkPool!: ObjectPool<Particle>;
  private debrisPool!: ObjectPool<Particle>;
  private tracerPool!: ObjectPool<Tracer>;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.tracerGeo.rotateX(Math.PI / 2);
    this.initPools();
  }

  private initPools(): void {
    this.sparkPool = new ObjectPool<Particle>(
      () => {
        const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMatCyan);
        mesh.visible = false;
        this.scene.add(mesh);
        return {
          mesh,
          vel: new THREE.Vector3(),
          life: 0,
          maxLife: 0.5,
          gravity: -14
        };
      },
      (p) => {
        p.mesh.visible = false;
      },
      CONFIG.PARTICLES.POOL_SPARKS_COUNT
    );

    this.debrisPool = new ObjectPool<Particle>(
      () => {
        const mat = this.debrisMats[Math.floor(Math.random() * this.debrisMats.length)];
        const mesh = new THREE.Mesh(this.debrisGeo, mat);
        mesh.visible = false;
        this.scene.add(mesh);
        return {
          mesh,
          vel: new THREE.Vector3(),
          rotSpeed: new THREE.Vector3(),
          life: 0,
          maxLife: 1.0,
          gravity: -22
        };
      },
      (p) => {
        p.mesh.visible = false;
      },
      CONFIG.PARTICLES.POOL_DEBRIS_COUNT
    );

    this.tracerPool = new ObjectPool<Tracer>(
      () => {
        const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
        mesh.visible = false;
        this.scene.add(mesh);
        return {
          mesh,
          life: 0.08,
          maxLife: 0.08
        };
      },
      (t) => {
        t.mesh.visible = false;
      },
      CONFIG.PARTICLES.POOL_TRACERS_COUNT
    );
  }

  createTracer(startPos: THREE.Vector3, endPos: THREE.Vector3, color = 0x00f0ff): void {
    const distance = startPos.distanceTo(endPos);
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);

    const tracer = this.tracerPool.get();
    tracer.mesh.scale.set(1, 1, Math.max(0.1, distance));
    tracer.mesh.position.copy(midPoint);
    tracer.mesh.lookAt(endPos);
    (tracer.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    (tracer.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
    tracer.mesh.visible = true;
    tracer.life = 0.08;
    tracer.maxLife = 0.08;

    this.activeTracers.push(tracer);
  }

  createHitSparks(
    position: THREE.Vector3,
    normal = new THREE.Vector3(0, 1, 0),
    count = 10,
    color = 0x00f0ff
  ): void {
    const mat = color === 0x00f0ff ? this.sparkMatCyan : this.sparkMatOrange;

    for (let i = 0; i < count; i++) {
      const spark = this.sparkPool.get();
      spark.mesh.material = mat;
      spark.mesh.position.copy(position);
      spark.mesh.scale.set(1, 1, 1);
      spark.mesh.visible = true;

      spark.vel.set(
        (Math.random() - 0.5) * 6 + normal.x * 3,
        (Math.random() - 0.2) * 6 + normal.y * 3,
        (Math.random() - 0.5) * 6 + normal.z * 3
      );
      spark.life = 0.3 + Math.random() * 0.2;
      spark.maxLife = spark.life;
      spark.gravity = -14;

      this.activeSparks.push(spark);
    }
  }

  createExplosion(position: THREE.Vector3, count = 25): void {
    for (let i = 0; i < count; i++) {
      const debris = this.debrisPool.get();
      debris.mesh.material = this.debrisMats[Math.floor(Math.random() * this.debrisMats.length)];
      debris.mesh.position.copy(position);
      debris.mesh.scale.set(1, 1, 1);
      debris.mesh.visible = true;

      debris.vel.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.1) * 14 + 2,
        (Math.random() - 0.5) * 16
      );
      if (!debris.rotSpeed) {
        debris.rotSpeed = new THREE.Vector3();
      }
      debris.rotSpeed.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      debris.life = 0.8 + Math.random() * 0.5;
      debris.maxLife = debris.life;
      debris.gravity = -22;

      this.activeDebris.push(debris);
    }
  }

  update(delta: number): void {
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const t = this.activeTracers[i];
      t.life -= delta;
      if (t.life <= 0) {
        this.tracerPool.release(t);
        this.activeTracers.splice(i, 1);
      } else {
        (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life / t.maxLife);
      }
    }

    for (let i = this.activeSparks.length - 1; i >= 0; i--) {
      const s = this.activeSparks[i];
      s.life -= delta;
      if (s.life <= 0) {
        this.sparkPool.release(s);
        this.activeSparks.splice(i, 1);
      } else {
        s.vel.y += s.gravity * delta;
        s.mesh.position.addScaledVector(s.vel, delta);
        if (s.mesh.position.y < 0.05) {
          s.mesh.position.y = 0.05;
          s.vel.y = -s.vel.y * 0.3;
          s.vel.x *= 0.6;
          s.vel.z *= 0.6;
        }
        const scale = Math.max(0.01, s.life / s.maxLife);
        s.mesh.scale.set(scale, scale, scale);
      }
    }

    for (let i = this.activeDebris.length - 1; i >= 0; i--) {
      const d = this.activeDebris[i];
      d.life -= delta;
      if (d.life <= 0) {
        this.debrisPool.release(d);
        this.activeDebris.splice(i, 1);
      } else {
        d.vel.y += d.gravity * delta;
        d.mesh.position.addScaledVector(d.vel, delta);
        if (d.rotSpeed) {
          d.mesh.rotation.x += d.rotSpeed.x * delta;
          d.mesh.rotation.y += d.rotSpeed.y * delta;
          d.mesh.rotation.z += d.rotSpeed.z * delta;
        }
        if (d.mesh.position.y < 0.05) {
          d.mesh.position.y = 0.05;
          d.vel.y = -d.vel.y * 0.4;
          d.vel.x *= 0.7;
          d.vel.z *= 0.7;
        }
        const scale = Math.max(0.01, d.life / d.maxLife);
        d.mesh.scale.set(scale, scale, scale);
      }
    }
  }

  clear(): void {
    this.activeTracers.forEach((t) => this.tracerPool.release(t));
    this.activeSparks.forEach((s) => this.sparkPool.release(s));
    this.activeDebris.forEach((d) => this.debrisPool.release(d));
    this.activeTracers.length = 0;
    this.activeSparks.length = 0;
    this.activeDebris.length = 0;
  }
}
