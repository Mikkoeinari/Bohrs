# Bohrs Agent Guide

## Purpose
This repository is a browser-based dystopian strategy game called Bohrs. The current experience is a React/Vite app with:
- a city map view
- base management
- tactical missions
- procedural city generation
- persisted game state in the browser

The long-term goal is to evolve this into a more advanced, browser-native city/combat experience with a shared 3D world, session-scoped destruction, local civilian/vehicle simulation, and optional future WebGPU/WGSL rendering upgrades.

## Current project goals
The next major implementation direction is:
1. Replace the current DOM-based city rendering with a real 3D scene.
2. Make city view and combat view share the same underlying world data.
3. Add lightweight, session-scoped destruction and repair.
4. Add local civilian and vehicle simulation for nearby blocks.
5. Keep the implementation practical for a web app and avoid over-committing to a full engine migration too early.

## Recommended implementation approach
For the near term, prefer a web-native path that stays in the existing stack:
- React + TypeScript
- Vite
- Three.js + React Three Fiber for the scene layer
- optional Drei and postprocessing later
- WGSL/WebGPU only if needed after the base scene is working

Do not start with a full engine migration unless the scope is explicitly broadened.

## Repository structure
Key entry points and files:
- `src/App.tsx` — app shell, tab switching, top-level game UI
- `src/components/CityMap.tsx` — current city map view and camera interactions
- `src/components/TacticalMission.tsx` — tactical mission UI and voxel-like interior prototype
- `src/components/BaseManagement.tsx` — base management UI
- `src/components/SquadManagement.tsx` — squad management UI
- `src/store/GameContext.tsx` — game state, persistence, mission logic
- `src/types.ts` — core state and domain models
- `src/data.ts` — procedural city generation, faction data, initial buildings, initial units
- `src/nameData.ts` — procedural names for factions, buildings, and soldiers
- `package.json` — scripts and dependencies

## Important implementation notes
- The current city view is still a DOM/CSS-based pseudo-3D scene. It is good for UI prototyping, but it is not yet a real 3D world.
- The tactical mission view already contains a small voxel-style helper, but it is local and not yet connected to the city scene.
- The current game state is persisted in browser storage through `GameContext`, which is fine for small game state, but a larger 3D world will need a more structured persistence model later.
- The data layer already has procedural building placement logic, which is a strong basis for a shared 3D city world.

## Suggested workflow for agents
When implementing a new feature or task:
1. Start from the existing React component and state layer.
2. Keep changes surgical and avoid rewriting unrelated systems.
3. Prefer adding state and rendering hooks in a way that can be reused by both city and combat views.
4. If a task touches rendering, first check whether it should be implemented as a shared scene layer rather than a one-off component.
5. Keep the game logic in `GameContext` and the rendering logic in components.

## Development commands
Install dependencies:
```bash
npm install
```

Run the dev server:
```bash
npm run dev
```

Build the app:
```bash
npm run build
```

Typecheck:
```bash
npm run lint
```

## Recommended next milestones
The implementation should be broken into small, agent-sized steps:
1. Add a shared world model for city and combat scenes.
2. Replace the DOM-based city map with a Three.js scene wrapper.
3. Render terrain, roads, and building footprints in 3D.
4. Add building shell geometry and simple materials.
5. Add session-scoped building damage and repair.
6. Add a combat-mode scene with tactical UI.
7. Add procedural interiors for active buildings.
8. Add local civilian and vehicle simulation for nearby blocks.
9. Add LOD and performance guardrails.

## Guidance for future work
- Prefer incremental implementation over large rewrites.
- Keep scene data and gameplay state separated where possible.
- Long-term rendering upgrades should fit into a scene layer that can later support WebGPU/WGSL without a full rewrite.
- If a task becomes too large, split it into smaller tickets around one deliverable at a time.
