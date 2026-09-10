# TEMBAKU

> Fast-paced, procedural 3D Sci-Fi FPS running in the browser. Built with Three.js, TypeScript, and Vite.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r170+-black?logo=three.js)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Highlights

- **100% Procedural & Ultra-Lightweight**: Zero external 3D models, textures, or heavy audio assets to download. Instant sub-second load times.
- **Pure Web Audio Synthesizer**: All gunfire, impacts, footsteps, reloads, and boss warnings are synthesized in real-time using the native Web Audio API.
- **Dynamic Gunplay & Kinematics**:
  - Raycast ballistic weapon system with procedural recoil kick, recovery spring, and viewmodel sway.
  - Smooth Aim-Down-Sights (ADS) camera lerping with focal-length-scaled sensitivity.
  - Jump buffering, ground momentum, landing impact compression, and strafe banking (YXZ Euler camera).
- **Three.js Octree + Capsule Physics**:
  - Built-in spatial partitioning and swept-capsule character controller.
  - Smooth slope climbing and sliding along walls without clipping or tunneling.
- **Wave Survival & Titan Raid Boss AI**:
  - Endless scaling aerial drone swarms with predictive pathing.
  - Multi-phase Titan-class boss battle (`NEXUS TITAN-X`) featuring continuous circle-strafing, dynamic altitude sweeps, rocket booster repositioning, kinetic energy shields, weakpoint targeting, and orbital plasma mortars.
- **Cross-Platform Input (Desktop & Mobile)**:
  - Pointer Lock API for desktop mouse + keyboard.
  - Dynamic Floating Virtual Joystick on the left screen half for mobile.
  - Dual-action Touchpad Fire-Aiming on mobile (drag fire button to aim and shoot simultaneously).
  - Mobile aim assist (friction & soft magnetism) and generous bullet magnetism.
  - In-game pause button (`⏸`) and adaptive sensitivity settings with persistence.
- **Reactive Sci-Fi HUD**: Off-screen threat edge radar chevrons, dynamic damage vignettes, low-HP heartbeat pulsations, and ammo status warnings.
- **Zero Garbage Collection Lag**: Generic `<T>` object pooling for projectiles, particles, sparks, debris, and bullet tracers.

---

## Controls

### Desktop

| Action                          | Key / Input                              |
| :------------------------------ | :--------------------------------------- |
| **Move**                        | `W` `A` `S` `D` / Arrow Keys             |
| **Look / Aim**                  | `Mouse Movement` (Pointer Lock)          |
| **Primary Fire**                | `Left Mouse Button` (Hold for auto-fire) |
| **Aim Down Sights (ADS)**       | `Right Mouse Button` (Hold)              |
| **Sprint**                      | `Shift` (Hold)                           |
| **Jump**                        | `Space`                                  |
| **Reload**                      | `R` (or automatic on empty clip)         |
| **Deploy Medkit (Nanite Stim)** | `Q` or `E`                               |
| **Pause / Menu**                | `Escape`                                 |

### Mobile (Touch)

- **Left Screen Half**: Dynamic Floating Virtual Joystick (drag up past 85% to sprint).
- **Right Screen Half**: Camera Look Trackpad.
- **Fire Button**: Tap or hold to shoot; drag on fire button to aim while firing.
- **Action Cluster**: Compact buttons for ADS, Jump, Reload, Medkit, and Sprint.
- **Top Right Button (`⏸`)**: In-Game Pause & Settings Menu.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.0.0 or higher recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/wafley/tembaku.git
   cd tembaku
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start development server:

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173` in your browser.

4. Type check:

   ```bash
   npm run check
   ```

5. Build production bundle:

   ```bash
   npm run build
   ```

---

## Architecture & Code Structure

```text
tembaku/
├── index.html                  # Viewport, HUD overlays, canvas mounts
├── style.css                   # Aggregator importing modular CSS
├── src/
│   ├── main.ts                 # Bootstrap & GameEngine orchestrator
│   ├── config.ts               # Strongly typed central configuration
│   ├── types/
│   │   ├── index.ts            # Input, particle, projectile & collider types
│   │   ├── events.ts           # Strongly typed EventMap definition
│   │   └── state.ts            # GameState union & transition events
│   ├── core/
│   │   ├── EventBus.ts         # Type-safe decoupled publish/subscribe event bus
│   │   ├── GameStateMachine.ts # Deterministic workflow manager (BOOT, MENU, PLAYING, PAUSED, GAMEOVER)
│   │   ├── GameLoop.ts         # 60Hz fixed-timestep physics accumulator + high-refresh rendering
│   │   ├── InputManager.ts     # Unified Desktop (WASD/Mouse) & Mobile (Floating Joystick/Touch)
│   │   └── ObjectPool.ts       # Generic <T> memory-efficient object pooling
│   ├── physics/
│   │   ├── PhysicsWorld.ts     # Three.js Octree + Capsule character controller
│   │   └── Steering.ts         # Obstacle avoidance & pillar collision resolution
│   ├── entities/
│   │   ├── Player.ts           # First-person controller, YXZ Euler camera, aim assist, health
│   │   ├── Weapon.ts           # Ballistics, bullet magnetism, procedural recoil, viewmodel sway
│   │   ├── EnemyDrone.ts       # Drone AI, hovering, strafing, predictive lead shooting
│   │   ├── BossEnemy.ts        # Nexus Titan controller, multi-phase logic, agile navigation
│   │   ├── EnemyManager.ts     # Wave progression, boss scheduler, projectile pool
│   │   └── boss/
│   │       ├── BossModel.ts    # Titan 3D meshes (core, cannons, sensor eye, kinetic shield, rings)
│   │       └── BossAttacks.ts  # 5-way spread fan, laser railgun barrage, orbital mortar
│   ├── world/
│   │   ├── Arena.ts            # Cyberpunk arena geometry, procedural canvas textures, lighting
│   │   └── ParticleManager.ts  # Pooled sparks, debris shards, and bullet tracers
│   ├── audio/
│   │   └── SoundManager.ts     # Real-time Web Audio synthesizer
│   ├── ui/
│   │   └── UIManager.ts        # Reactive HUD, radar chevrons, menus, mobile touch adaptivity
│   └── styles/
│       ├── variables.css       # Theme tokens, colors, neon variables
│       ├── base.css            # Resets, typography, canvas positioning
│       ├── overlays.css        # Damage, heal, critical heartbeat, boss vignette, edge radar
│       ├── hud.css             # HUD stats, health, ammo, crosshair, combat warnings
│       ├── boss.css            # Boss health bar & Titan danger tags
│       ├── menu.css            # Start, pause, gameover cards, stats summary, cyber buttons
│       ├── settings.css        # Sensitivity settings panel & cyber sliders
│       ├── mobile.css          # Floating joystick, action cluster, mobile pause button
│       └── responsive.css      # Mobile landscape & viewport height adaptations
```

---

## Tech Stack

- **Rendering**: [Three.js](https://threejs.org/) (WebGL)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Audio**: Web Audio API (procedural synthesis)
- **Input**: Pointer Lock API, Multi-touch Touch Events API
- **Physics**: Three.js Octree + Capsule Collision

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/awesome-feature`).
3. Commit your changes (`git commit -m 'feat: add awesome feature'`).
4. Push to the branch (`git push origin feature/awesome-feature`).
5. Open a Pull Request.

Please verify that `npm run check` and `npm run build` pass before submitting PRs.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
