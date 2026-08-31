# Bohrs AI Agent Map

This file is intentionally named `AGENTS.md` so AI coding agents can discover the project layout automatically.

## Repository graph

```text
Bohrs/
├─ .github/
│  └─ workflows/
│     └─ deploy-pages.yml
├─ assets/                  # static game art and media
├─ docs/                    # design notes and docs
├─ src/
│  ├─ App.tsx               # top-level app shell, tabs, game state wiring
│  ├─ main.tsx              # app bootstrap and mount point
│  ├─ index.css             # global styling and layout
│  ├─ types.ts              # shared domain models and game types
│  ├─ data.ts               # procedural city generation, factions, buildings, units
│  ├─ nameData.ts           # procedural names for factions, buildings, and soldiers
│  ├─ travel.ts             # travel/route logic and movement helpers
│  ├─ buildingGeometry.ts   # reusable building mesh geometry for 3D scenes
│  ├─ components/
│  │  ├─ BaseManagement.tsx
│  │  ├─ CityMap.tsx        # current DOM pseudo-3D city view
│  │  ├─ ThreeCityScene.tsx # scene-based rendered city view
│  │  ├─ TacticalMission.tsx
│  │  ├─ SquadManagement.tsx
│  │  ├─ ResearchTree.tsx
│  │  ├─ Workshop.tsx
│  │  ├─ Diplomacy.tsx
│  │  ├─ VehicleManagement.tsx
│  │  └─ ...               # other UI panels and game screens
│  └─ store/
│     └─ GameContext.tsx   # canonical game state, persistence, mission logic
├─ README.md                # user-facing overview
├─ AGENT.md                 # legacy guide retained for compatibility; AGENTS.md is the canonical map
├─ package.json             # Vite scripts and dependencies
├─ tsconfig.json            # TypeScript project config
├─ vite.config.ts           # Vite config and plugins
├─ index.html               # browser entry HTML
├─ metadata.json            # app metadata / deployment metadata
├─ patch*.js / patch_*.sh   # repo maintenance / patch scripts
├─ package-lock.json        # lockfile
├─ .gitignore               # project ignores
└─ .nojekyll                # Pages hosting support
```

## Important code relationships

- `src/App.tsx` is the app entry point. It wires the main tabs and passes state into the UI panels.
- `src/store/GameContext.tsx` is the main source of truth for gameplay state, resources, squads, missions, and browser persistence.
- `src/types.ts` defines the shared domain models used by the UI and state layer.
- `src/data.ts` and `src/nameData.ts` are the procedural generation sources for the city, factions, names, and initial world data.
- `src/components/CityMap.tsx` and `src/components/ThreeCityScene.tsx` are both entry points for city rendering; the 3D scene is the future-facing path.
- `src/components/TacticalMission.tsx` contains the tactical/mission view and local voxel-like helper logic.
- `src/buildingGeometry.ts` is the shared geometry helper for 3D buildings and scene elements.
- `src/travel.ts` holds movement/travel logic used by the strategic side of the game.

## Recommended starting points for agents

When implementing a task, start in this order:

1. `src/store/GameContext.tsx` for gameplay state and persistence
2. `src/types.ts` for shared domain models
3. the relevant screen in `src/components/`
4. `src/data.ts` for procedural content or initial world data
5. `src/buildingGeometry.ts` and `src/components/ThreeCityScene.tsx` for rendering work

## Development commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Working style for this repo

- Keep features incremental and scoped.
- Prefer reusing the existing game state and UI contracts rather than large rewrites.
- Keep render code in components and world logic in `GameContext`.
- Treat the city and tactical views as two lenses over the same underlying game world when possible.

This agent map is intentionally compact and should be updated whenever the repo structure changes.
