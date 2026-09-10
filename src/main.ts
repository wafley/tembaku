import * as THREE from 'three';
import { CONFIG } from './config';
import { events } from './core/EventBus';
import { GameStateMachine } from './core/GameStateMachine';
import { InputManager } from './core/InputManager';
import { GameLoop } from './core/GameLoop';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { UIManager } from './ui/UIManager';
import { Arena } from './world/Arena';
import { ParticleManager } from './world/ParticleManager';
import { Player } from './entities/Player';
import { Weapon } from './entities/Weapon';
import { EnemyManager } from './entities/EnemyManager';
import { sound } from './audio/SoundManager';

export class GameEngine {
  readonly container: HTMLElement;
  readonly fsm: GameStateMachine;
  readonly ui: UIManager;
  readonly input: InputManager;
  readonly physics: PhysicsWorld;

  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;

  arena!: Arena;
  particleManager!: ParticleManager;
  player!: Player;
  weapon!: Weapon;
  enemyManager!: EnemyManager;
  loop!: GameLoop;

  constructor() {
    this.container = document.getElementById('game-container')!;
    this.fsm = new GameStateMachine();
    this.ui = new UIManager();

    this.initScene();
    this.physics = new PhysicsWorld();
    this.arena = new Arena(this.scene);
    this.physics.build(this.arena.root, this.arena.colliders);

    this.particleManager = new ParticleManager(this.scene);
    this.input = new InputManager(this.renderer.domElement);

    this.ui.setMobileMode(this.input.isTouchDevice);
    if (this.input.isTouchDevice) {
      this.input.setupMobileUI();
    }

    this.initEntities();
    this.ui.initLobbyAndModals(sound, this.input, this.player);
    this.initGameLoop();
    this.initEvents();

    // Transition from BOOT to MENU
    this.fsm.transitionTo('MENU');
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.ARENA.FOG_COLOR);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.PLAYER.BASE_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;

    const dpr = isTouch
      ? Math.min(window.devicePixelRatio, 1.25)
      : Math.min(window.devicePixelRatio, 2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);
  }

  private initEntities(): void {
    this.player = new Player(this.camera, this.physics, this.input);
    this.scene.add(this.camera);

    this.enemyManager = new EnemyManager(this.scene, this.player, this.particleManager);
    this.player.setEnemyManager(this.enemyManager);
    this.weapon = new Weapon(
      this.camera,
      this.scene,
      this.player,
      this.particleManager,
      this.enemyManager
    );
  }

  private initGameLoop(): void {
    this.loop = new GameLoop({
      onFixedUpdate: (fixedDelta: number) => {
        if (!this.fsm.is('PLAYING') || this.player.isDead) return;
        this.player.update(fixedDelta);
        this.weapon.update(fixedDelta);
        this.enemyManager.update(fixedDelta);
      },
      onRender: (_alpha: number, frameTime: number) => {
        if (this.fsm.is('PLAYING') && !this.player.isDead) {
          this.player.updateCamera(frameTime);
          this.weapon.updateViewmodel(frameTime);

          const camFwd = new THREE.Vector3();
          this.camera.getWorldDirection(camFwd);
          const camRt = new THREE.Vector3(-camFwd.z, 0, camFwd.x).normalize();
          this.ui.updateThreatIndicators(
            this.camera.position,
            camFwd,
            camRt,
            this.enemyManager.enemies
          );
        }
        this.particleManager.update(frameTime);
        this.renderer.render(this.scene, this.camera);
      }
    });

    this.loop.start();
  }

  private initEvents(): void {
    window.addEventListener('resize', () => this.onWindowResize());

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startOrResume();
      });
      startBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startOrResume();
      });
    }

    const menuOverlay = document.getElementById('menu-overlay');
    if (menuOverlay) {
      menuOverlay.addEventListener('click', () => {
        if (this.fsm.is('MENU') || this.fsm.is('PAUSED')) {
          this.startOrResume();
        }
      });
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restartGame();
      });
      restartBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.restartGame();
      });
    }

    this.container.addEventListener('click', () => {
      if (
        this.fsm.is('PLAYING') &&
        !this.player.isDead &&
        !this.input.isLocked &&
        !this.input.isTouchDevice
      ) {
        this.input.requestLock();
      }
    });

    events.on('input:lock_change', (isLocked) => {
      if (this.input.isTouchDevice) return; // Desktop PointerLock only
      if (isLocked) {
        if (this.fsm.is('MENU') || this.fsm.is('PAUSED')) {
          this.startOrResume();
        }
      } else {
        if (this.fsm.is('PLAYING') && !this.player.isDead) {
          this.fsm.transitionTo('PAUSED');
        }
      }
    });

    events.on('game:pause', () => {
      if (this.fsm.is('PLAYING')) {
        this.fsm.transitionTo('PAUSED');
      }
    });

    events.on('player:dead', () => {
      this.fsm.transitionTo('GAMEOVER');
      events.emit('game:over', {
        score: this.enemyManager.score,
        kills: this.enemyManager.kills,
        wave: this.enemyManager.wave
      });
    });
  }

  startOrResume(): void {
    sound.init();
    sound.resume();

    if (this.input.isTouchDevice && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    const isNewGame = this.fsm.is('MENU');
    const isPaused = this.fsm.is('PAUSED');

    this.player.isActive = true;
    this.input.isEnabled = true;
    this.input.requestLock();

    if (isNewGame) {
      this.fsm.transitionTo('PLAYING');
      this.enemyManager.startNewGame();
    } else if (isPaused) {
      this.fsm.transitionTo('PLAYING');
    }
  }

  restartGame(): void {
    this.player.reset();
    this.weapon.reset();
    this.particleManager.clear();
    this.fsm.transitionTo('PLAYING');
    this.enemyManager.startNewGame();
    this.startOrResume();
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.ui.checkOrientation();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
