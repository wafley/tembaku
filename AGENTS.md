# AGENTS.md

> Developer and agent guidance for TEMBAKU (3D Sci-Fi FPS with Three.js, TypeScript, and Vite).

## Essential Commands

```bash
npm run check         # Typecheck (tsc --noEmit)
npm run lint          # Lint check (eslint .)
npm run lint:fix      # Auto-fix lint issues
npm run format:check  # Verify Prettier style
npm run format        # Auto-format all files
npm run build         # Full production build (tsc --noEmit && vite build)
npm run dev           # Start Vite local development server
```

Run order before committing:
`npm run format && npm run lint && npm run check && npm run build`

## Toolchain & Dependencies

- **TypeScript Version**: Kept on TS 5.x (`^5.7.3`). Do NOT upgrade to TS 7.x; `typescript-eslint` 8.x peer-dependency rejects TS 7.x.
- **Node Environment**: Node.js 18+ (ESM only, `"type": "module"` in `package.json`).
- **CSS Architecture**: Monolithic `style.css` is solely an aggregator importing modular sheets from `src/styles/` (`variables.css`, `base.css`, `overlays.css`, `hud.css`, `boss.css`, `menu.css`, `settings.css`, `mobile.css`, `responsive.css`). Edit individual sheets, not the bundle.

## Architecture & Conventions

### 1. Game Loop & High Refresh Rate

- `GameLoop.ts` runs a **fixed-timestep accumulator** at 60Hz (`CONFIG.TIMESTEP = 1/60`) for physics, movement, and collision updates (`onFixedUpdate`).
- Camera rotation, look delta consumption, and viewmodel sway MUST execute in `onRender` per display frame (`frameTime`) to guarantee 144Hz/240Hz zero-latency responsiveness.

### 2. Camera Rotation

- `camera.rotation.order` MUST always be `'YXZ'`. Three.js defaults to `'XYZ'`, which causes horizon roll and gimbal tilt when looking diagonally.

### 3. Decoupled State & Events

- **No Direct DOM Manipulation in Entities**: Entities (`Player`, `Weapon`, `EnemyDrone`, `BossEnemy`, `EnemyManager`) must NEVER query `document.getElementById` or manipulate CSS classes. They publish events via `events.emit(...)` (`src/core/EventBus.ts`).
- `UIManager.ts` subscribes to `EventBus` and is the single source of truth for DOM and HUD updates.
- Workflow is controlled by `GameStateMachine.ts` (`BOOT` -> `MENU` <-> `PLAYING` <-> `PAUSED` -> `GAMEOVER`).

### 4. Zero-Allocation Hot Loops (Object Pooling)

- Never instantiate (`new THREE.Mesh`) or destroy (`scene.add`/`scene.remove`) projectiles, particles, sparks, debris, or tracers in frame updates. Use generic `ObjectPool<T>` (`src/core/ObjectPool.ts`) and toggle visibility.

### 5. Multi-Platform Input Quirks

- **PointerLock is Desktop Only**: Do not call or synthesize `input:lock_change` on touch devices (`isTouchDevice`).
- **Dynamic Floating Joystick**: Mobile touch left of screen (< 48% width) spawns a dynamic floating joystick base at thumb touch coordinates. Right side (>= 48% width) acts as the camera look trackpad.
- **Fire Button Drag-to-Aim**: Dragging the `#touch-fire-btn` on mobile emits both fire and look delta so users can aim and shoot with a single right thumb.

### 6. Physics & Collision

- Uses official Three.js `Octree` and `Capsule` (`three/examples/jsm/math/`).
- Shared obstacle resolution and pillar steering live in `src/physics/Steering.ts`. Do not re-implement in enemy classes.

## Deployment Target

- Packaged as multi-stage Docker build (`Dockerfile`: Node 20 builder -> `nginx:alpine`).
- Docker Compose attaches to external `proxy-network` behind Cloudflare Tunnel and Nginx Proxy Manager.
- Memory limit capped at 128MB, CPU at 0.5 core.
