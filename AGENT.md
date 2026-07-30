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

## Reusable issue descriptions for agents
Use the following templates when handing one step to an agent. Each template keeps the common context in one place and only changes the task-specific details.

### Common context for every issue
- Project: Bohrs
- Stack: React + TypeScript + Vite
- Goal: evolve the game toward a shared 3D city/combat experience with lightweight destruction and local simulation
- Keep changes small and incremental
- Prefer editing existing components and state over large rewrites
- Preserve current gameplay/UI behavior unless the task explicitly changes it

### Issue template
**Title**
- `[Scope] Short task title`

**Body**
- Summary: What the task should accomplish.
- Motivation: Why this fits the larger road map.
- Scope: What is included and what is intentionally out of scope.
- Acceptance criteria: 3–5 concrete, testable outcomes.
- Implementation notes: Relevant files or subsystems to inspect first.
- Risks / open questions: Anything uncertain or likely to need follow-up.

### Step-specific issue descriptions
Use these directly or adapt them for a specific ticket.

#### 1. Shared world model
**Title**
- `[Architecture] Add a shared world model for city and combat scenes`

**Body**
- Summary: Introduce a shared world data model that both the city and combat views can read from.
- Motivation: The current city map and tactical mission are effectively separate views; a shared world will let them show the same buildings and future destruction state.
- Scope: Add types for terrain, building metadata, damage state, interiors, and lightweight agents. Keep the change focused on types and state structure first.
- Acceptance criteria:
  - A shared world object exists in the app state layer.
  - City and combat views can both reference the same building instances.
  - The model is extensible for damage, interiors, and agents without breaking existing UI.
- Implementation notes: Inspect `src/types.ts`, `src/store/GameContext.tsx`, and the current scene components.
- Risks / open questions: Decide how much of the world should be persisted versus reconstructed from the procedural city data.

#### 2. Three.js scene wrapper
**Title**
- `[Rendering] Replace the DOM-based city map with a Three.js scene wrapper`

**Body**
- Summary: Replace the current DOM/CSS city map rendering with a canvas-based Three.js scene wrapper while keeping the existing UI shell.
- Motivation: The current city view cannot support the planned shared 3D city/combat experience or future destruction effects.
- Scope: Add a new scene component and mount it where the current city map is rendered. Keep the surrounding HUD and tabs intact.
- Acceptance criteria:
  - The city tab renders a 3D canvas.
  - The app runs without errors.
  - The existing UI remains usable around the new scene.
- Implementation notes: Inspect `src/components/CityMap.tsx` and `src/App.tsx` first.
- Risks / open questions: Decide whether to use React Three Fiber immediately or start with a lower-level Three.js integration.

#### 3. Terrain, roads, and building footprints
**Title**
- `[Rendering] Render terrain, roads, and building footprints in 3D`

**Body**
- Summary: Build a basic 3D city scene from the current procedural city data.
- Motivation: The city should look like a real place rather than a flat pseudo-3D grid.
- Scope: Add terrain, roads, and simple building footprint geometry. Keep the scene readable rather than fully detailed.
- Acceptance criteria:
  - Roads and terrain are visible in the 3D scene.
  - Building footprints appear in the correct positions.
  - The scene is visually legible from an overview camera.
- Implementation notes: Start from `src/data.ts` for building placement and `src/components/CityMap.tsx` for the current layout logic.
- Risks / open questions: Decide how much of the terrain should be generated procedurally versus manually authored.

#### 4. Building shell geometry
**Title**
- `[Rendering] Add building shell geometry and basic materials`

**Body**
- Summary: Render buildings as simple 3D shell meshes using blocky geometry and basic materials.
- Motivation: Building shells are the minimum visual step required for a believable city view.
- Scope: Add procedural shell geometry and materials for building types. Keep the implementation simple and reusable.
- Acceptance criteria:
  - Buildings appear as 3D structures.
  - Building types are visually distinguishable.
  - The geometry is generated from the building data rather than hard-coded.
- Implementation notes: Inspect the building type definitions in `src/types.ts` and `src/data.ts`.
- Risks / open questions: Decide how much visual variety is needed for the first milestone.

#### 5. Session-scoped damage state
**Title**
- `[Gameplay] Add session-scoped building damage state`

**Body**
- Summary: Add lightweight building damage state that persists during a play session.
- Motivation: This is the smallest step toward destructible city gameplay without requiring full voxel serialization.
- Scope: Add compact per-building damage values for roof, wall, and support integrity. Keep the implementation session-scoped.
- Acceptance criteria:
  - Buildings can be marked as damaged in game state.
  - Damage state is stored in a compact form.
  - Damaged buildings render differently from intact buildings.
- Implementation notes: Look at `src/types.ts` and `src/store/GameContext.tsx`.
- Risks / open questions: Decide whether to model damage as percentages or simple flags first.

#### 6. Repair flow
**Title**
- `[Gameplay] Implement building repair flow using owner resources`

**Body**
- Summary: Add a repair action for damaged buildings that uses owner resources.
- Motivation: Repair is an important part of making destruction meaningful and manageable.
- Scope: Add a simple repair mechanic that reduces damage and updates the building visuals. Keep the logic lightweight.
- Acceptance criteria:
  - A damaged building can be repaired.
  - Repair reduces damage state and updates the scene.
  - The repair flow uses the existing funds/resources model.
- Implementation notes: Inspect the current game state and any existing building management UI.
- Risks / open questions: Decide whether repair should be instant or take time.

#### 7. Template destruction fallback
**Title**
- `[Persistence] Add template destruction fallback for save and continue`

**Body**
- Summary: Implement a compact destruction template system so damage can be re-applied when the game is resumed.
- Motivation: Full voxel state is too heavy to persist directly; a compact template keeps saves simple while preserving the feel of destruction.
- Scope: Save compact degradation values and reapply them when the game continues. Keep the system lightweight.
- Acceptance criteria:
  - The game can resume with a reduced damage profile.
  - A building can recover from the template state when repaired.
  - The save format remains small and simple.
- Implementation notes: Review the persistence layer in `src/store/GameContext.tsx`.
- Risks / open questions: Decide how much degradation detail should be preserved between sessions.

#### 8. Combat-mode scene switch
**Title**
- `[UI] Add a combat-mode scene with tactical UI`

**Body**
- Summary: Add a combat-focused view that uses the same building/world definitions but switches to a different UI and camera experience.
- Motivation: The city and combat experience should feel like the same world from different perspectives.
- Scope: Add a combat view mode and tactical UI. Keep the underlying world data shared.
- Acceptance criteria:
  - The game can enter a combat-style view.
  - The combat view uses the shared world data.
  - The UI changes to a tactical presentation without requiring a separate world definition.
- Implementation notes: Inspect `src/components/TacticalMission.tsx` and the app shell in `src/App.tsx`.
- Risks / open questions: Decide how much combat logic should be introduced in the first pass.

#### 9. Procedural interiors
**Title**
- `[Rendering] Add procedural interiors for active buildings`

**Body**
- Summary: Generate lightweight procedural interiors for buildings when the player enters or focuses them in combat.
- Motivation: Interiors make the combat experience more grounded and help the same building feel more alive.
- Scope: Add room layout and basic wall/floor geometry. Keep the interiors simple and procedural.
- Acceptance criteria:
  - Entering a building shows an interior scene.
  - Interiors are generated from building size/type data.
  - The interiors are lightweight and do not require manual authoring.
- Implementation notes: Start from the existing tactical mission code and the building data definitions.
- Risks / open questions: Decide how much of the interior should be generated on demand versus precomputed.

#### 10. Local civilian simulation
**Title**
- `[Simulation] Add local civilian simulation for nearby blocks`

**Body**
- Summary: Add a lightweight civilian simulation system for a small area around the player or active mission zone.
- Motivation: Civilians should feel present in the city without requiring a global simulation of the whole map.
- Scope: Spawn a small number of civilian agents near the active area and give them simple movement and idle behavior.
- Acceptance criteria:
  - Civilians appear in the local scene.
  - Their movement is simple and believable.
  - The simulation is limited to a local radius.
- Implementation notes: Investigate the current unit and faction data before adding agents.
- Risks / open questions: Decide how much behavior complexity is necessary for the first pass.

#### 11. Local vehicle simulation
**Title**
- `[Simulation] Add local vehicle simulation for nearby streets`

**Body**
- Summary: Introduce a small number of vehicle agents that move along nearby streets and react to blockages or destruction.
- Motivation: Vehicles help the city feel alive without needing a fully simulated traffic system.
- Scope: Add a few vehicles in the local area and keep them simplified.
- Acceptance criteria:
  - Vehicles appear in the local scene.
  - They can move along roads or idle.
  - Distant vehicles are not fully simulated.
- Implementation notes: Reuse the same local simulation pattern as civilians where possible.
- Risks / open questions: Decide how dynamic vehicle movement should be in the first pass.

#### 12. LOD and performance guardrails
**Title**
- `[Performance] Add LOD and performance guardrails for the 3D scene`

**Body**
- Summary: Add a basic distance-based LOD system so the scene stays responsive as more buildings and agents are added.
- Motivation: The city will eventually contain many objects, so performance must be addressed early.
- Scope: Implement simple LOD for buildings and agents and keep the logic configurable.
- Acceptance criteria:
  - Distant buildings and agents use lower-detail geometry.
  - The scene remains responsive with several buildings and agents.
  - The LOD logic is easy to extend.
- Implementation notes: Inspect the new scene component and render loop once it exists.
- Risks / open questions: Decide whether LOD should be implemented in the renderer, the scene data, or both.

#### 13. Future rendering documentation
**Title**
- `[Docs] Document the 3D architecture for future WebGPU and WGSL upgrades`

**Body**
- Summary: Add clear documentation for the new scene architecture so future work can upgrade the renderer without a rewrite.
- Motivation: A shared scene layer will make it easier to introduce advanced rendering later.
- Scope: Document the architecture and clearly note where future shader or WebGPU work can plug in.
- Acceptance criteria:
  - The architecture is documented in the repo.
  - Future render-layer upgrades have a clear integration point.
  - New contributors can understand where to extend the renderer.
- Implementation notes: Use the root guide file and extend it with any new scene conventions.
- Risks / open questions: Decide whether to mention WGSL now or keep the documentation future-facing.
