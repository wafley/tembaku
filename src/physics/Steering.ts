import * as THREE from 'three';
import { BoxCollider } from '../types';

export const PILLAR_COORDS: readonly [number, number][] = [
  [-16, -16],
  [16, -16],
  [-16, 16],
  [16, 16]
];

export function resolveEntityObstacles(
  pos: THREE.Vector3,
  radius: number,
  colliders: BoxCollider[]
): void {
  if (!colliders) return;
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i].box;
    const minY = pos.y - radius;
    const maxY = pos.y + radius;
    if (maxY < box.min.y || minY > box.max.y) continue;

    const cx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
    const cz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }
  }
}

export function steerAroundPillars(pos: THREE.Vector3, radius: number, delta: number): void {
  const safeDist = radius + 2.2;
  for (let i = 0; i < PILLAR_COORDS.length; i++) {
    const px = PILLAR_COORDS[i][0];
    const pz = PILLAR_COORDS[i][1];
    const dx = pos.x - px;
    const dz = pos.z - pz;
    const d = Math.hypot(dx, dz);
    if (d < safeDist && d > 0.001) {
      const force = (safeDist - d) * 7.0 * delta;
      pos.x += (dx / d) * force;
      pos.z += (dz / d) * force;
    }
  }
}
