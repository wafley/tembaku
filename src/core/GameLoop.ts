import * as THREE from 'three';
import { CONFIG } from '../config';

export interface GameLoopOptions {
  onFixedUpdate: (fixedDelta: number) => void;
  onRender: (alpha: number, frameTime: number) => void;
}

export class GameLoop {
  private onFixedUpdate: (fixedDelta: number) => void;
  private onRender: (alpha: number, frameTime: number) => void;

  private clock = new THREE.Clock();
  private fixedDelta = CONFIG.TIMESTEP;
  private maxSubSteps = CONFIG.MAX_SUB_STEPS;
  private accumulator = 0;
  private isRunning = false;
  private rafId: number | null = null;

  constructor(options: GameLoopOptions) {
    this.onFixedUpdate = options.onFixedUpdate;
    this.onRender = options.onRender;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.accumulator = 0;
    this.tick();
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    this.rafId = requestAnimationFrame(this.tick);

    const frameTime = Math.min(this.clock.getDelta(), 0.1);
    this.accumulator += frameTime;

    let subSteps = 0;
    while (this.accumulator >= this.fixedDelta && subSteps < this.maxSubSteps) {
      this.onFixedUpdate(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
      subSteps++;
    }

    if (subSteps >= this.maxSubSteps) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / this.fixedDelta;
    this.onRender(alpha, frameTime);
  };
}
