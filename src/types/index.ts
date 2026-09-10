import * as THREE from 'three';

export interface MoveVector {
  x: number;
  z: number;
}

export interface LookDelta {
  dx: number;
  dy: number;
}

export interface InputActions {
  sprint: boolean;
  jump: boolean;
  fire: boolean;
  ads: boolean;
  reload: boolean;
  heal: boolean;
}

export interface KeyStates {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export interface BoxCollider {
  box: THREE.Box3;
  mesh?: THREE.Mesh;
  isWall?: boolean;
}

export interface Projectile {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  dir: THREE.Vector3;
  speed: number;
  damage: number;
  life: number;
}

export interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotSpeed?: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface Tracer {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export type DifficultyLevel = 'RECRUIT' | 'OPERATIVE' | 'VETERAN';

export interface DifficultyConfig {
  id: DifficultyLevel;
  name: string;
  tagline: string;
  scoreMultiplier: number;
  playerHp: number;
  medkitCooldown: number;
  medkitHeal: number;
  invulnTime: number;
  droneDamage: number;
  droneShootIntervalMult: number;
  droneSpread: number;
  bossHp: number;
  bossSpeed: number;
  bossAttackIntervalMult: number;
  aimAssistFriction: number;
}
