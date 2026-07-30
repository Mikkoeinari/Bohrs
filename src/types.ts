/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FactionId = string;
export type BuildingId = string;
export type UnitId = string;
export type ItemId = string;
export type TechId = string;
export type VehicleId = string;

export enum FactionType {
  PLAYER = 'PLAYER',
  ENEMY_GANG = 'ENEMY_GANG',
  POLICE = 'POLICE',
  CORPORATION = 'CORPORATION',
  CIVILIAN = 'CIVILIAN',
}

export interface Faction {
  id: FactionId;
  name: string;
  type: FactionType;
  color: string;
  relations: Record<FactionId, number>; // -100 to 100
  funds: number;
  truceUntil?: number; // timestamp
  isVendetta?: boolean;
}

export interface WorldDamageState {
  roof: number;
  wall: number;
  support: number;
}

export interface WorldInteriorState {
  active: boolean;
  roomCount: number;
  seed: number;
}

export interface WorldBuildingState {
  id: string;
  buildingId: BuildingId;
  name: string;
  ownerId: FactionId;
  x: number;
  y: number;
  width: number;
  height: number;
  type: Building['type'];
  health: number;
  maxHealth: number;
  unlockedFloors?: number;
  presetFacilities?: BaseSector['type'][];
  isScouted?: boolean;
  intel?: {
    civilians: number;
    resources: number;
    hostiles: number;
  };
  damageState: WorldDamageState;
  interior: WorldInteriorState;
}

export interface WorldAgentState {
  id: string;
  kind: 'CIVILIAN' | 'VEHICLE' | 'UNIT';
  factionId: FactionId;
  buildingId?: BuildingId;
  x: number;
  y: number;
  status: 'IDLE' | 'MOVING' | 'IN_BUILDING';
}

export interface WorldTerrainTile {
  id: string;
  x: number;
  y: number;
  elevation: number;
  type: 'GROUND' | 'ROAD' | 'WATER';
}

export interface GameWorld {
  version: number;
  terrain: WorldTerrainTile[];
  buildings: Record<BuildingId, WorldBuildingState>;
  agents: Record<string, WorldAgentState>;
}

export interface Building {
  id: BuildingId;
  name: string;
  ownerId: FactionId;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'BASE' | 'WAREHOUSE' | 'FACTORY' | 'CLUB' | 'OFFICE';
  health: number;
  maxHealth: number;
  unlockedFloors?: number;
  presetFacilities?: BaseSector['type'][];
  isScouted?: boolean;
  intel?: {
    civilians: number;
    resources: number;
    hostiles: number;
  };
}

export interface Unit {
  id: UnitId;
  name: string;
  factionId: FactionId;
  level?: number;
  exp?: number;
  skillPoints?: number;
  unlockedSkills?: string[];
  stats: {
    hp: number;
    maxHp: number;
    accuracy: number;
    reactions: number;
    strength: number;
    speed: number;
    stamina: number;
    bravery: number;
  };
  equipment: {
    handLeft?: ItemId;
    handRight?: ItemId;
    armor?: ItemId;    // Chest / Vest
    head?: ItemId;     // Helmet / Visor
    legs?: ItemId;     // Pants / Trousers
    backpack?: ItemId; // Rucksack / Duffle / Pouch
    inventory: ItemId[];
  };
  location: 'BASE' | 'MISSION' | 'TRANSIT';
  currentBuildingId?: BuildingId;
}

export interface Item {
  id: ItemId;
  name: string;
  type: 'WEAPON' | 'ARMOR' | 'HEAD' | 'LEGS' | 'BACKPACK' | 'UTILITY' | 'AMMO' | 'MEDICAL' | 'EXPLOSIVE' | 'MATERIAL';
  weight: number;
  cost: number;
  damage?: number;
  range?: number;
  accuracyMod?: number;
  slotsGranted?: number; // Clothing / Gear grants inventory capacity slots (+2, +4, +8)
  slotSize?: number;     // Item consumes N slots in loadout (1 for medkits/stims, 2 for pistols/SMGs, 3 for rifles/shotguns)
  hpBonus?: number;      // Extra max HP granted by armor/helmet
  wearResistance?: number; // % bonus durability / wear resistance
  weightReduction?: number; // % or flat weight reduction for equipped gear
  description?: string;
  recipe?: Record<ItemId, number>; // Raw materials required to craft in Workshop
  craftTime?: number;    // Base crafting time in game minutes
}

export interface Technology {
  id: TechId;
  name: string;
  description: string;
  cost: number; // Research points
  requirements: TechId[];
  unlocksItems: ItemId[];
  tier?: number;
  category?: 'WEAPONS' | 'ARMOR' | 'MEDICAL' | 'TACTICAL' | 'EXPLOSIVE';
  icon?: string;
}

export interface Vehicle {
  id: VehicleId;
  name: string;
  type: 'SCOUTER' | 'SEDAN' | 'VAN' | 'APC' | 'INTERCEPTOR';
  stats: {
    speed: number;
    armor: number;
    capacity: number;
    fuelEfficiency: number;
  };
  upgrades: string[];
  status: 'READY' | 'TRANSIT' | 'REPAIRING';
  cost: number;
  currentBuildingId?: BuildingId;
}

export interface VehicleUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  statModifiers: Partial<Vehicle['stats']>;
}

export interface BaseSector {
  id: string;
  name: string;
  type: 'EMPTY' | 'COMMAND' | 'LAB' | 'ARMORY' | 'INFIRMARY' | 'QUARTERS' | 'WORKSHOP' | 'POWER' | 'HYDROPONICS' | 'GARAGE' | 'STAIRCASE';
  level: number;
  buildingId?: BuildingId;
}

export interface ActiveScout {
  id: string;
  buildingId: BuildingId;
  transitTimeRemaining: number;
  transitTimeTotal: number;
  startPosX: number;
  startPosY: number;
}

export interface ManufacturingJob {
  id: string;
  itemId: ItemId;
  count: number;
  progress: number;
  maxProgress: number;
}

export interface GameState {
  time: number; // In game minutes from start
  funds: number;
  factions: Record<FactionId, Faction>;
  buildings: Record<BuildingId, Building>;
  units: Record<UnitId, Unit>;
  inventory: Record<ItemId, number>;
  unlockedTech: TechId[];
  activeResearches?: Record<TechId, number>; // Multi-research: techId -> current progress RP
  currentResearch?: TechId; // Kept for backwards compatibility
  researchProgress: number; // Kept for backwards compatibility
  manufacturingQueue: ManufacturingJob[];
  activeMission?: TacticalMission;
  activeScouts?: ActiveScout[];
  baseSectors?: BaseSector[];
  baseStructuralIntegrity?: number; // 0 to 100
  vehicles: Record<VehicleId, Vehicle>;
  unlockedVehicles: string[];
  activeVehicleId?: VehicleId;
  world: GameWorld;
}

export interface TacticalMission {
  id: string;
  buildingId: BuildingId;
  startBuildingId?: BuildingId;
  type: 'RAID' | 'DEFEND' | 'INFILTRATE';
  units: UnitId[];
  enemyUnits: UnitId[];
  map: {
    width: number;
    height: number;
    tiles: string[][]; // tile types
  };
  turn: number;
  activeUnitId?: UnitId;
  status: 'TRANSIT' | 'IN_PROGRESS' | 'VICTORY' | 'DEFEAT' | 'RETURNING';
  transitTimeRemaining: number;
  transitTimeTotal: number;
  startPosX?: number;
  startPosY?: number;
}
