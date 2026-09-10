import * as THREE from 'three';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { CONFIG } from '../config';
import { BoxCollider } from '../types';

export { Capsule };

export class PhysicsWorld {
  readonly octree = new Octree();
  collidableMeshes: THREE.Mesh[] = [];
  boxColliders: BoxCollider[] = [];
  readonly arenaHalfSize = CONFIG.ARENA.SIZE / 2;

  build(arenaRoot: THREE.Object3D, colliders: BoxCollider[] = []): void {
    this.octree.clear();
    this.octree.fromGraphNode(arenaRoot);
    this.boxColliders = colliders;

    this.collidableMeshes = [];
    arenaRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        this.collidableMeshes.push(child as THREE.Mesh);
      }
    });
  }

  capsuleIntersect(capsule: Capsule): any {
    return (this.octree as any).capsuleIntersect(capsule);
  }

  sphereIntersect(sphere: THREE.Sphere): any {
    return (this.octree as any).sphereIntersect(sphere);
  }

  rayIntersect(ray: THREE.Ray): any {
    return (this.octree as any).rayIntersect(ray);
  }

  clampToBounds(position: THREE.Vector3, radius = 0.5): void {
    const maxBound = this.arenaHalfSize - radius - 0.25;
    position.x = THREE.MathUtils.clamp(position.x, -maxBound, maxBound);
    position.z = THREE.MathUtils.clamp(position.z, -maxBound, maxBound);
  }
}
