import { CONFIG } from '../config';
import { events } from './EventBus';
import { MoveVector, LookDelta, InputActions, KeyStates } from '../types';

export class InputManager {
  readonly domElement: HTMLElement;
  readonly isTouchDevice: boolean;

  moveVector: MoveVector = { x: 0, z: 0 };
  keys: KeyStates = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };

  actions: InputActions = {
    sprint: false,
    jump: false,
    fire: false,
    ads: false,
    reload: false,
    heal: false
  };

  private lookDelta: LookDelta = { dx: 0, dy: 0 };
  isLocked = false;
  isEnabled = false;

  private isMouseDown = false;
  private prevMousePos = { x: 0, y: 0 };

  private joystickTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private fireTouchId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private prevTouchLookPos = { x: 0, y: 0 };
  private prevFireTouchPos = { x: 0, y: 0 };

  private joystickBase: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;

  desktopSensMultiplier = 1.0;
  mobileSensMultiplier = 1.0;

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;

    const savedDesktop = localStorage.getItem('tembaku_sens_desktop');
    if (savedDesktop) {
      const parsed = parseFloat(savedDesktop);
      if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 4.0) {
        this.desktopSensMultiplier = parsed;
      }
    }
    const savedMobile = localStorage.getItem('tembaku_sens_mobile');
    if (savedMobile) {
      const parsed = parseFloat(savedMobile);
      if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 4.0) {
        this.mobileSensMultiplier = parsed;
      }
    }

    this.initDesktopEvents();
    if (this.isTouchDevice) {
      this.initMobileTouchEvents();
    }
  }

  setDesktopSensitivity(val: number): void {
    this.desktopSensMultiplier = Math.max(0.1, Math.min(4.0, val));
    try {
      localStorage.setItem('tembaku_sens_desktop', String(this.desktopSensMultiplier));
    } catch {}
  }

  setMobileSensitivity(val: number): void {
    this.mobileSensMultiplier = Math.max(0.1, Math.min(4.0, val));
    try {
      localStorage.setItem('tembaku_sens_mobile', String(this.mobileSensMultiplier));
    } catch {}
  }

  setupMobileUI(): void {
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickKnob = document.getElementById('joystick-knob');
    this.bindTouchButtons();
  }

  private initDesktopEvents(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isEnabled) return;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.actions.sprint = true;
          break;
        case 'Space':
          this.actions.jump = true;
          break;
        case 'KeyR':
          this.actions.reload = true;
          break;
        case 'KeyQ':
        case 'KeyE':
          this.actions.heal = true;
          break;
      }
      this.recalculateMoveVector();
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.actions.sprint = false;
          break;
      }
      this.recalculateMoveVector();
    });

    this.domElement.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.isEnabled) return;
      if (e.button === 0) {
        this.actions.fire = true;
        this.isMouseDown = true;
        this.prevMousePos.x = e.clientX;
        this.prevMousePos.y = e.clientY;
      } else if (e.button === 2) {
        this.actions.ads = true;
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) {
        this.actions.fire = false;
        this.isMouseDown = false;
      } else if (e.button === 2) {
        this.actions.ads = false;
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isEnabled) return;
      if (this.isLocked) {
        this.lookDelta.dx += e.movementX;
        this.lookDelta.dy += e.movementY;
      } else if (this.isMouseDown && !this.isTouchDevice) {
        const dx = e.clientX - this.prevMousePos.x;
        const dy = e.clientY - this.prevMousePos.y;
        this.prevMousePos.x = e.clientX;
        this.prevMousePos.y = e.clientY;
        this.lookDelta.dx += dx;
        this.lookDelta.dy += dy;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      events.emit('input:lock_change', this.isLocked);
    });

    window.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());
  }

  private initMobileTouchEvents(): void {
    window.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (!this.isEnabled) return;
        const width = window.innerWidth;

        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          const target = touch.target as HTMLElement | null;

          // Skip touches on buttons
          if (target && target.closest && target.closest('.touch-btn, .mobile-pause-btn')) {
            continue;
          }

          // Left 48% of screen: Dynamic Floating Joystick
          if (touch.clientX < width * 0.48 && this.joystickTouchId === null) {
            this.joystickTouchId = touch.identifier;
            this.joystickCenter = { x: touch.clientX, y: touch.clientY };

            if (this.joystickBase) {
              this.joystickBase.style.left = `${touch.clientX - 45}px`;
              this.joystickBase.style.top = `${touch.clientY - 45}px`;
              this.joystickBase.classList.add('active');
            }
            this.updateJoystick(touch.clientX, touch.clientY);
            continue;
          }

          // Right 52% of screen: Camera Look Trackpad
          if (touch.clientX >= width * 0.48 && this.lookTouchId === null) {
            this.lookTouchId = touch.identifier;
            this.prevTouchLookPos.x = touch.clientX;
            this.prevTouchLookPos.y = touch.clientY;
          }
        }
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (!this.isEnabled) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];

          if (touch.identifier === this.joystickTouchId) {
            this.updateJoystick(touch.clientX, touch.clientY);
          } else if (touch.identifier === this.lookTouchId) {
            const dx = touch.clientX - this.prevTouchLookPos.x;
            const dy = touch.clientY - this.prevTouchLookPos.y;
            this.prevTouchLookPos.x = touch.clientX;
            this.prevTouchLookPos.y = touch.clientY;

            this.lookDelta.dx += dx;
            this.lookDelta.dy += dy;
          }
        }
      },
      { passive: false }
    );

    const endTouch = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.moveVector.x = 0;
          this.moveVector.z = 0;
          this.keys.forward = false;
          this.keys.backward = false;
          this.keys.left = false;
          this.keys.right = false;
          this.actions.sprint = false;

          if (this.joystickBase) {
            this.joystickBase.classList.remove('active');
            this.joystickBase.style.left = '';
            this.joystickBase.style.top = '';
          }
          if (this.joystickKnob) {
            this.joystickKnob.style.transform = 'translate(0px, 0px)';
          }
        } else if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
        } else if (touch.identifier === this.fireTouchId) {
          this.fireTouchId = null;
          this.actions.fire = false;
          const fireBtn = document.getElementById('touch-fire-btn');
          if (fireBtn) fireBtn.classList.remove('active');
        }
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);
  }

  private bindTouchButtons(): void {
    const pauseBtn = document.getElementById('mobile-pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          events.emit('game:pause');
        },
        { passive: false }
      );

      pauseBtn.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        events.emit('game:pause');
      });
    }

    const bindButton = (id: string, onDown: () => void, onUp?: () => void) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      btn.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onDown();
          btn.classList.add('active');
        },
        { passive: false }
      );

      const handleUp = (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onUp) onUp();
        btn.classList.remove('active');
      };

      btn.addEventListener('touchend', handleUp);
      btn.addEventListener('touchcancel', handleUp);
    };

    // Dedicated Fire Button with Drag-to-Aim support (solves Three-Finger Claw problem on mobile)
    const fireBtn = document.getElementById('touch-fire-btn');
    if (fireBtn) {
      fireBtn.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          this.actions.fire = true;
          fireBtn.classList.add('active');
          const touch = e.changedTouches[0];
          this.fireTouchId = touch.identifier;
          this.prevFireTouchPos.x = touch.clientX;
          this.prevFireTouchPos.y = touch.clientY;
        },
        { passive: false }
      );

      fireBtn.addEventListener(
        'touchmove',
        (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this.fireTouchId) {
              const dx = touch.clientX - this.prevFireTouchPos.x;
              const dy = touch.clientY - this.prevFireTouchPos.y;
              this.prevFireTouchPos.x = touch.clientX;
              this.prevFireTouchPos.y = touch.clientY;

              this.lookDelta.dx += dx;
              this.lookDelta.dy += dy;
            }
          }
        },
        { passive: false }
      );

      const releaseFire = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.fireTouchId) {
            this.fireTouchId = null;
            this.actions.fire = false;
            fireBtn.classList.remove('active');
          }
        }
      };

      fireBtn.addEventListener('touchend', releaseFire);
      fireBtn.addEventListener('touchcancel', releaseFire);
    }

    bindButton('touch-jump-btn', () => {
      this.actions.jump = true;
    });
    bindButton('touch-reload-btn', () => {
      this.actions.reload = true;
    });
    bindButton('touch-heal-btn', () => {
      this.actions.heal = true;
    });
    bindButton('touch-ads-btn', () => {
      this.actions.ads = !this.actions.ads;
    });
    bindButton('touch-sprint-btn', () => {
      this.actions.sprint = !this.actions.sprint;
    });
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const maxRadius = CONFIG.INPUT.JOYSTICK_RADIUS;
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const posX = Math.cos(angle) * clampedDist;
    const posY = Math.sin(angle) * clampedDist;

    if (this.joystickKnob) {
      this.joystickKnob.style.transform = `translate(${posX}px, ${posY}px)`;
    }

    const normX = posX / maxRadius;
    const normZ = posY / maxRadius;

    this.moveVector.x = normX;
    this.moveVector.z = normZ;

    this.keys.forward = normZ < -0.3;
    this.keys.backward = normZ > 0.3;
    this.keys.left = normX < -0.3;
    this.keys.right = normX > 0.3;

    if (normZ < -0.85) {
      this.actions.sprint = true;
    }
  }

  private recalculateMoveVector(): void {
    let x = 0;
    let z = 0;
    if (this.keys.forward) z -= 1;
    if (this.keys.backward) z += 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;

    const len = Math.hypot(x, z);
    if (len > 0) {
      this.moveVector.x = x / len;
      this.moveVector.z = z / len;
    } else {
      this.moveVector.x = 0;
      this.moveVector.z = 0;
    }
  }

  consumeLookDelta(fovRatio = 1.0): LookDelta {
    const baseSens = this.isTouchDevice
      ? CONFIG.INPUT.MOBILE_LOOK_SENSITIVITY * this.mobileSensMultiplier
      : CONFIG.INPUT.DESKTOP_SENSITIVITY * this.desktopSensMultiplier;

    const scaledSens = baseSens * Math.max(0.2, fovRatio);

    const delta = {
      dx: this.lookDelta.dx * scaledSens,
      dy: this.lookDelta.dy * scaledSens
    };
    this.lookDelta.dx = 0;
    this.lookDelta.dy = 0;
    return delta;
  }

  consumeAction(name: keyof InputActions): boolean {
    const val = this.actions[name];
    this.actions[name] = false;
    return val;
  }

  requestLock(): void {
    if (this.isTouchDevice) {
      this.isLocked = true;
      return;
    }
    try {
      this.domElement.requestPointerLock();
    } catch (e) {
      console.warn('PointerLock request failed:', e);
    }
  }

  unlock(): void {
    if (this.isTouchDevice) {
      this.isLocked = false;
      return;
    }
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  reset(): void {
    this.moveVector.x = 0;
    this.moveVector.z = 0;
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    this.actions.fire = false;
    this.actions.sprint = false;
    this.actions.ads = false;
    this.actions.jump = false;
    this.actions.reload = false;
    this.actions.heal = false;
    this.lookDelta.dx = 0;
    this.lookDelta.dy = 0;
    if (this.joystickKnob) {
      this.joystickKnob.style.transform = 'translate(0px, 0px)';
    }
  }
}
