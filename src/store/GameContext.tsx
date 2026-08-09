/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, TacticalMission, UnitId, ItemId, TechId, VehicleId, Faction, Unit, ManufacturingJob, Building, GameWorld } from '../types';
import { INITIAL_FACTIONS, INITIAL_BUILDINGS, INITIAL_UNITS, ITEMS, TECH_TREE, VEHICLES, VEHICLE_UPGRADES, SOLDIER_SKILLS } from '../data';
import { buildSoldierName } from '../nameData';

const MIN_TRANSIT_TIME = 1;
const DEFAULT_WALK_SPEED = 10;
const DISTANCE_TO_TIME_MULTIPLIER = 100;
const GAME_STATE_COOKIE_NAME = 'bohrs-game-state';
const GAME_STATE_STORAGE_KEY = 'bohrs-game-state-storage';
const GAME_STATE_COOKIE_DURATION_SECONDS = 60 * 60 * 24 * 365;
const GAME_STATE_COOKIE_MARKER_VALUE = 'saved';
// Browsers commonly enforce a ~4KB cookie limit for the full cookie string.
const GAME_STATE_COOKIE_MAX_LENGTH = 4096;
const RIVAL_AI_TICK_MINUTES = 15;
const MAX_RIVAL_UNITS_PER_FACTION = 3;
const BASE_GAME_TICK_INTERVAL_MS = 3000;
const BASE_GAME_TICK_STEP_MINUTES = 5;
const TRANSIT_TICK_INTERVAL_MS = 1000;
const TRANSIT_TICK_STEP_MINUTES = 1;

function getCookieValue(cookieName: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookie = document.cookie
    .split(';')
    .map(cookiePart => cookiePart.trim())
    .find(cookiePart => cookiePart.startsWith(`${cookieName}=`));

  if (!cookie) return null;

  return cookie.substring(cookie.indexOf('=') + 1);
}

function isRecord(entry: unknown): entry is Record<string, unknown> {
  return entry !== null && typeof entry === 'object';
}

function isWorld(value: unknown): value is GameWorld {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<GameWorld>;
  return (
    typeof candidate.version === 'number' &&
    Array.isArray(candidate.terrain) &&
    isRecord(candidate.buildings) &&
    isRecord(candidate.agents)
  );
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<GameState>;

  return (
    typeof candidate.time === 'number' &&
    typeof candidate.funds === 'number' &&
    isRecord(candidate.factions) &&
    isRecord(candidate.buildings) &&
    isRecord(candidate.units) &&
    isRecord(candidate.inventory) &&
    Array.isArray(candidate.unlockedTech) &&
    candidate.unlockedTech.every((techId) => typeof techId === 'string') &&
    Array.isArray(candidate.manufacturingQueue) &&
    candidate.manufacturingQueue.every((job) => job !== null && typeof job === 'object') &&
    (candidate.world === undefined || isWorld(candidate.world))
  );
}

function getBuildingRoomCount(building: Pick<Building, 'presetFacilities' | 'width' | 'height' | 'unlockedFloors'>): number {
  const facilityCount = building.presetFacilities?.length ?? 0;
  if (facilityCount > 0) {
    return Math.max(1, Math.min(9, facilityCount));
  }

  const footprintArea = Math.max(1, (building.width || 1) * (building.height || 1));
  const floorCount = Math.max(1, building.unlockedFloors || 1);
  return Math.max(1, Math.min(9, Math.round(Math.sqrt(footprintArea) * Math.max(1, floorCount))));
}

function createInitialWorld(buildings: Record<string, Building>): GameWorld {
  const terrain: GameWorld['terrain'] = Array.from({ length: 24 }, (_, index) => ({
    id: `terrain-${index}`,
    x: index % 6,
    y: Math.floor(index / 6),
    elevation: index % 4 === 0 ? 0.2 : 0,
    type: (index % 7 === 0 ? 'ROAD' : 'GROUND') as GameWorld['terrain'][number]['type'],
  }));

  const worldBuildings = Object.values(buildings).reduce<Record<string, GameWorld['buildings'][string]>>((accumulator, building) => {
    const roomCount = getBuildingRoomCount(building);
    const healthRatio = building.maxHealth > 0 ? building.health / building.maxHealth : 1;

    accumulator[building.id] = {
      id: building.id,
      buildingId: building.id,
      name: building.name,
      ownerId: building.ownerId,
      x: building.x,
      y: building.y,
      width: building.width || 1,
      height: building.height || 1,
      type: building.type,
      health: building.health,
      maxHealth: building.maxHealth,
      unlockedFloors: building.unlockedFloors,
      presetFacilities: building.presetFacilities,
      isScouted: building.isScouted ?? false,
      intel: building.intel,
      damageState: {
        roof: Math.max(0, Math.round((1 - healthRatio) * 100)),
        wall: 0,
        support: Math.max(0, Math.round((1 - healthRatio) * 35)),
      },
      interior: {
        active: false,
        roomCount,
        seed: building.id.length % 11,
      },
    };

    return accumulator;
  }, {});

  return {
    version: 1,
    terrain,
    buildings: worldBuildings,
    agents: {},
  };
}

function hydrateGameState(state: GameState): GameState {
  const baseWorld = state.world && isWorld(state.world) ? state.world : createInitialWorld(state.buildings);
  const hydratedBuildings = Object.entries(state.buildings).reduce<Record<string, GameWorld['buildings'][string]>>((accumulator, [buildingId, building]) => {
    const existingWorldBuilding = baseWorld.buildings[buildingId];
    const healthRatio = building.maxHealth > 0 ? building.health / building.maxHealth : 1;
    const roomCount = getBuildingRoomCount(building);

    accumulator[buildingId] = {
      ...(existingWorldBuilding || {}),
      id: building.id,
      buildingId: building.id,
      name: building.name,
      ownerId: building.ownerId,
      x: building.x,
      y: building.y,
      width: building.width || 1,
      height: building.height || 1,
      type: building.type,
      health: building.health,
      maxHealth: building.maxHealth,
      unlockedFloors: building.unlockedFloors,
      presetFacilities: building.presetFacilities,
      isScouted: building.isScouted ?? false,
      intel: building.intel,
      damageState: {
        roof: existingWorldBuilding?.damageState?.roof ?? Math.max(0, Math.round((1 - healthRatio) * 100)),
        wall: existingWorldBuilding?.damageState?.wall ?? 0,
        support: existingWorldBuilding?.damageState?.support ?? Math.max(0, Math.round((1 - healthRatio) * 35)),
      },
      interior: existingWorldBuilding?.interior ?? {
        active: false,
        roomCount,
        seed: building.id.length % 11,
      },
    };

    return accumulator;
  }, {});

  return {
    ...state,
    world: {
      version: 1,
      terrain: baseWorld.terrain,
      buildings: hydratedBuildings,
      agents: baseWorld.agents,
    },
  };
}

function createInitialGameState(): GameState {
  return hydrateGameState({
    time: 0,
    funds: 1000000,
    factions: INITIAL_FACTIONS,
    buildings: INITIAL_BUILDINGS,
    units: INITIAL_UNITS,
    inventory: {
      'pistol': 3,
      'smg': 2,
      'shotgun': 1,
      'rifle': 1,
      'medkit': 12,
      'trauma_kit': 3,
      'stim': 6,
      'grenade': 6,
      'vest': 2,
      'exovest': 1,
      'helmet': 2,
      'visor': 1,
      'comm_band': 1,
      'cargo_pants': 3,
      'holster_jeans': 2,
      'light_pouch': 2,
      'tactical_backpack': 2,
      'duffle_bag': 1,
      'mat_scrap': 25,
      'mat_circuits': 15,
      'mat_weapon_parts': 12,
      'mat_chemicals': 10,
      'mat_nanites': 8,
    },
    unlockedTech: [],
    researchProgress: 0,
    manufacturingQueue: [],
    baseStructuralIntegrity: 92,
    baseSectors: [
      { id: 'sec-1', name: 'Command Center', type: 'COMMAND', level: 1, buildingId: 'player-hq' },
      { id: 'sec-2', name: 'Tech Laboratory', type: 'LAB', level: 1, buildingId: 'player-hq' },
      { id: 'sec-3', name: 'Tactical Armory', type: 'ARMORY', level: 1, buildingId: 'player-hq' },
      { id: 'sec-4', name: 'Med Infirmary', type: 'INFIRMARY', level: 1, buildingId: 'player-hq' },
      { id: 'sec-5', name: 'Crew Quarters', type: 'QUARTERS', level: 1, buildingId: 'player-hq' },
      { id: 'sec-6', name: 'Workshop Bay', type: 'WORKSHOP', level: 1, buildingId: 'player-hq' }
    ],
    vehicles: {},
    unlockedVehicles: ['scouter', 'sedan', 'van'],
    world: createInitialWorld(INITIAL_BUILDINGS),
  });
}

function readPersistedGameState(): GameState | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedState = window.localStorage.getItem(GAME_STATE_STORAGE_KEY);
    if (storedState) {
      const parsedState = JSON.parse(storedState);
      if (isGameState(parsedState)) {
        return hydrateGameState(parsedState);
      }
      console.warn('Ignoring invalid persisted game state from local storage.');
    }
  } catch (error) {
    console.warn('Unable to read saved game state from local storage.', error);
  }

  const encodedState = getCookieValue(GAME_STATE_COOKIE_NAME);
  if (!encodedState) return null;

  try {
    // Legacy saves stored only a marker value; treat that as no saved state.
    if (encodedState === GAME_STATE_COOKIE_MARKER_VALUE) return null;

    const parsedState = JSON.parse(decodeURIComponent(encodedState));
    if (!isGameState(parsedState)) {
      console.warn('Ignoring invalid persisted game state from cookie.');
      return null;
    }

    return hydrateGameState(parsedState);
  } catch (error) {
    console.warn('Unable to read saved game state from cookie.', error);
    return null;
  }
}

function persistGameState(state: GameState): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  let didPersistToLocalStorage = false;
  const serializedState = JSON.stringify(state);

  try {
    window.localStorage.setItem(GAME_STATE_STORAGE_KEY, serializedState);
    didPersistToLocalStorage = true;
  } catch (error) {
    console.warn('Unable to persist game state in local storage; clearing the persisted save.', error);
    clearPersistedGameState();
    return false;
  }
  const encodedState = encodeURIComponent(serializedState);
  const cookieHeader = `${GAME_STATE_COOKIE_NAME}=${encodedState}; max-age=${GAME_STATE_COOKIE_DURATION_SECONDS}; path=/; SameSite=Lax`;

  try {
    if (cookieHeader.length > GAME_STATE_COOKIE_MAX_LENGTH) {
      console.warn('Unable to persist the full game state in the cookie because it exceeds the browser cookie size limit; using local storage fallback.');
      return didPersistToLocalStorage;
    }

    document.cookie = cookieHeader;
    return didPersistToLocalStorage;
  } catch (error) {
    console.warn('Unable to persist game state in the cookie.', error);
    return didPersistToLocalStorage;
  }
}

function clearPersistedGameState(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(GAME_STATE_STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to clear persisted game state from local storage.', error);
  }

  if (typeof document !== 'undefined') {
    document.cookie = `${GAME_STATE_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }
}

export function getMaxInventorySlots(unit: Unit): number {
  let baseSlots = 3; // Base belt capacity
  if (!unit || !unit.equipment) return baseSlots;

  if (unit.equipment.armor && ITEMS[unit.equipment.armor]?.slotsGranted) {
    baseSlots += ITEMS[unit.equipment.armor].slotsGranted!;
  }
  if (unit.equipment.head && ITEMS[unit.equipment.head]?.slotsGranted) {
    baseSlots += ITEMS[unit.equipment.head].slotsGranted!;
  }
  if (unit.equipment.legs && ITEMS[unit.equipment.legs]?.slotsGranted) {
    baseSlots += ITEMS[unit.equipment.legs].slotsGranted!;
  }
  if (unit.equipment.backpack && ITEMS[unit.equipment.backpack]?.slotsGranted) {
    baseSlots += ITEMS[unit.equipment.backpack].slotsGranted!;
  }
  return baseSlots;
}

export function getUsedInventorySlots(unit: Unit): number {
  if (!unit || !unit.equipment || !unit.equipment.inventory) return 0;
  return unit.equipment.inventory.reduce((sum, itemId) => {
    const item = ITEMS[itemId];
    return sum + (item?.slotSize || 1);
  }, 0);
}

export function getUnitTotalWeight(unit: Unit | any): number {
  if (!unit) return 0;
  let totalWeight = 0;

  // Equipment slots
  const eq = unit.equipment || {};
  const slots: (keyof typeof eq)[] = ['handLeft', 'handRight', 'armor', 'head', 'legs', 'backpack'];
  slots.forEach((slot) => {
    const itemId = eq[slot];
    if (typeof itemId === 'string' && ITEMS[itemId]) {
      totalWeight += ITEMS[itemId].weight || 0;
    }
  });

  // Carried inventory loadout
  const inv = eq.inventory || unit.inventory || [];
  if (Array.isArray(inv)) {
    inv.forEach((itemId: string) => {
      if (ITEMS[itemId]) {
        totalWeight += ITEMS[itemId].weight || 0;
      }
    });
  }

  return totalWeight;
}

export function getUnitCarryLimit(unit: Unit | any): number {
  const str = unit?.stats?.strength || unit?.strength || 40;
  // Strength 50 => 10 kg unencumbered limit
  return Math.max(5, Math.floor(str / 5));
}

const FACILITY_LABEL_NAMES: Record<string, string> = {
  COMMAND: 'Command Center',
  LAB: 'Tech Laboratory',
  ARMORY: 'Tactical Armory',
  INFIRMARY: 'Med Infirmary',
  QUARTERS: 'Crew Quarters',
  WORKSHOP: 'Workshop Bay',
  POWER: 'Generator Core',
  HYDROPONICS: 'Hydroponics Garden',
  GARAGE: 'Garage Terminal',
  EMPTY: 'Inactive Bay'
};

export function getInitialFacilitiesForBuilding(
  building: { name: string; type: string; presetFacilities?: string[]; width?: number; height?: number },
  slotsCount: number
): ('EMPTY' | 'COMMAND' | 'LAB' | 'ARMORY' | 'INFIRMARY' | 'QUARTERS' | 'WORKSHOP' | 'POWER' | 'HYDROPONICS' | 'GARAGE')[] {
  if (building.presetFacilities && building.presetFacilities.length > 0) {
    const result: any[] = [];
    for (let i = 0; i < slotsCount; i++) {
      result.push(building.presetFacilities[i] || 'EMPTY');
    }
    return result;
  }

  const nameLower = (building.name || '').toLowerCase();
  const typeLower = (building.type || '').toLowerCase();

  const suggested: any[] = [];

  if (nameLower.includes('lab') || nameLower.includes('biotech') || nameLower.includes('research') || nameLower.includes('science') || nameLower.includes('data')) {
    suggested.push('LAB');
    if (slotsCount >= 2) suggested.push('POWER');
    if (slotsCount >= 3) suggested.push('WORKSHOP');
  } else if (nameLower.includes('garage') || nameLower.includes('depot') || nameLower.includes('dock') || nameLower.includes('transit') || nameLower.includes('transport') || nameLower.includes('hub') || nameLower.includes('motor')) {
    suggested.push('GARAGE');
    if (slotsCount >= 2) suggested.push('WORKSHOP');
    if (slotsCount >= 3) suggested.push('EMPTY');
  } else if (nameLower.includes('fortress') || nameLower.includes('citadel') || nameLower.includes('armory') || nameLower.includes('barracks') || nameLower.includes('precinct') || nameLower.includes('police')) {
    suggested.push('ARMORY');
    if (slotsCount >= 2) suggested.push('COMMAND');
    if (slotsCount >= 3) suggested.push('INFIRMARY');
  } else if (nameLower.includes('hospital') || nameLower.includes('clinic') || nameLower.includes('infirmary') || nameLower.includes('med')) {
    suggested.push('INFIRMARY');
    if (slotsCount >= 2) suggested.push('LAB');
    if (slotsCount >= 3) suggested.push('EMPTY');
  } else if (nameLower.includes('hydro') || nameLower.includes('farm') || nameLower.includes('garden') || nameLower.includes('botanic')) {
    suggested.push('HYDROPONICS');
    if (slotsCount >= 2) suggested.push('POWER');
    if (slotsCount >= 3) suggested.push('EMPTY');
  } else if (nameLower.includes('power') || nameLower.includes('generator') || nameLower.includes('sub-level') || nameLower.includes('reactor')) {
    suggested.push('POWER');
    if (slotsCount >= 2) suggested.push('WORKSHOP');
    if (slotsCount >= 3) suggested.push('EMPTY');
  } else if (typeLower === 'factory' || nameLower.includes('factory') || nameLower.includes('industrial') || nameLower.includes('plant')) {
    suggested.push('WORKSHOP');
    if (slotsCount >= 2) suggested.push('POWER');
    if (slotsCount >= 3) suggested.push('EMPTY');
  } else if (nameLower.includes('apartment') || nameLower.includes('block') || nameLower.includes('tower') || nameLower.includes('slum') || nameLower.includes('housing')) {
    suggested.push('QUARTERS');
    if (slotsCount >= 2) suggested.push('EMPTY');
    if (slotsCount >= 3) suggested.push('EMPTY');
  } else if (typeLower === 'office' || nameLower.includes('plaza') || nameLower.includes('mall') || nameLower.includes('center')) {
    suggested.push('COMMAND');
    if (slotsCount >= 2) suggested.push('QUARTERS');
    if (slotsCount >= 3) suggested.push('EMPTY');
  } else {
    suggested.push('WORKSHOP');
    if (slotsCount >= 2) suggested.push('EMPTY');
    if (slotsCount >= 3) suggested.push('EMPTY');
  }

  const finalTypes: any[] = [];
  for (let i = 0; i < slotsCount; i++) {
    finalTypes.push(suggested[i] || 'EMPTY');
  }
  return finalTypes;
}

export function getUnitEncumbrance(unit: Unit | any): {
  totalWeight: number;
  carryLimit: number;
  excessWeight: number;
  speedPenaltyPercent: number;
  movementApCost: number;
} {
  const totalWeight = getUnitTotalWeight(unit);
  const carryLimit = getUnitCarryLimit(unit);
  const excessWeight = Math.max(0, totalWeight - carryLimit);

  // Every 2 kg over strength limit adds +1 AP per tile step (Base movement cost = 2 AP/tile)
  const movementApCost = 2 + Math.floor(excessWeight / 2);
  const speedPenaltyPercent = Math.min(75, Math.round((excessWeight / carryLimit) * 50));

  return {
    totalWeight,
    carryLimit,
    excessWeight,
    speedPenaltyPercent,
    movementApCost,
  };
}

function createRivalUnit(unitId: string, factionId: string, baseBuildingId: string): Unit {
  const factionProfile = factionId === 'corps'
    ? {
        weapon: 'plasma_smg' as ItemId,
        armor: 'nanotube_exosuit' as ItemId,
        head: 'smart_scope' as ItemId,
        legs: 'carbon_boots' as ItemId,
        backpack: 'nano_repair_pack' as ItemId,
        stats: { hp: 90, maxHp: 90, accuracy: 82, reactions: 74, strength: 72, speed: 65, stamina: 72, bravery: 78 },
      }
    : factionId === 'police'
      ? {
          weapon: 'rifle' as ItemId,
          armor: 'ceramic_plate' as ItemId,
          head: 'titanium_helmet' as ItemId,
          legs: 'cargo_pants' as ItemId,
          backpack: 'tactical_backpack' as ItemId,
          stats: { hp: 78, maxHp: 78, accuracy: 76, reactions: 64, strength: 68, speed: 48, stamina: 64, bravery: 72 },
        }
      : {
          weapon: 'smg' as ItemId,
          armor: 'vest' as ItemId,
          head: 'comm_band' as ItemId,
          legs: 'holster_jeans' as ItemId,
          backpack: 'light_pouch' as ItemId,
          stats: { hp: 64, maxHp: 64, accuracy: 58, reactions: 50, strength: 56, speed: 56, stamina: 58, bravery: 68 },
        };

  return {
    id: unitId,
    name: buildSoldierName(unitId),
    factionId,
    stats: factionProfile.stats,
    equipment: {
      handRight: factionProfile.weapon,
      armor: factionProfile.armor,
      head: factionProfile.head,
      legs: factionProfile.legs,
      backpack: factionProfile.backpack,
      inventory: ['medkit', 'stim', 'grenade'],
    },
    location: 'BASE',
    currentBuildingId: baseBuildingId,
  };
}

function applyRivalAi(state: GameState): GameState {
  const nextState: GameState = {
    ...state,
    factions: { ...state.factions },
    buildings: { ...state.buildings },
    units: { ...state.units },
    baseSectors: state.baseSectors ? [...state.baseSectors] : state.baseSectors,
  };

  const factionIds = Object.keys(nextState.factions).filter((factionId) => factionId !== 'player');

  factionIds.forEach((factionId) => {
    const faction = nextState.factions[factionId];
    if (!faction) return;

    const ownedBuildings = Object.values(nextState.buildings).filter((building) => building.ownerId === factionId);
    const baseBuilding = ownedBuildings.find((building) => building.type === 'BASE') ?? ownedBuildings[0];
    const factionFunds = Math.max(0, faction.funds || 0);
    const income = ownedBuildings.reduce((sum, building) => {
      if (building.type === 'BASE') return sum + 650;
      if (building.type === 'OFFICE') return sum + 400;
      if (building.type === 'FACTORY') return sum + 300;
      if (building.type === 'WAREHOUSE') return sum + 180;
      return sum + 120;
    }, 0);

    nextState.factions[factionId] = {
      ...faction,
      funds: factionFunds + income,
    };

    if (baseBuilding) {
      const damagedBuildings = ownedBuildings.filter((building) => building.health < building.maxHealth);
      const repairTarget = damagedBuildings.sort((a, b) => (b.maxHealth - b.health) - (a.maxHealth - a.health))[0];
      if (repairTarget) {
        const missingHealth = repairTarget.maxHealth - repairTarget.health;
        const repairCost = Math.max(500, Math.round(missingHealth * 0.08));
        const currentFactionFunds = nextState.factions[factionId].funds;
        if (currentFactionFunds >= repairCost) {
          const repairedAmount = Math.max(150, Math.round(missingHealth * 0.35));
          nextState.buildings[repairTarget.id] = {
            ...repairTarget,
            health: Math.min(repairTarget.maxHealth, repairTarget.health + repairedAmount),
          };
          nextState.factions[factionId] = {
            ...nextState.factions[factionId],
            funds: currentFactionFunds - repairCost,
          };
        }
      }
    }

    const factionUnitCount = Object.values(nextState.units).filter((unit) => unit.factionId === factionId).length;
    const recruitThreshold = factionId === 'corps' ? 8000 : factionId === 'police' ? 6000 : 3000;
    const canRecruit = nextState.factions[factionId].funds >= recruitThreshold;
    if (canRecruit && factionUnitCount < MAX_RIVAL_UNITS_PER_FACTION && baseBuilding) {
      const unitId = `${factionId}-unit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      nextState.units[unitId] = createRivalUnit(unitId, factionId, baseBuilding.id);
      nextState.factions[factionId] = {
        ...nextState.factions[factionId],
        funds: nextState.factions[factionId].funds - recruitThreshold,
      };
    }

    const attackChance = factionId === 'corps' ? 0.45 : factionId === 'police' ? 0.35 : 0.3;
    if (Math.random() < attackChance) {
      const hostileTargets = Object.values(nextState.buildings)
        .filter((building) => building.ownerId !== factionId)
        .sort((a, b) => {
          const aValue = a.type === 'BASE' ? 18 : a.type === 'OFFICE' ? 14 : a.type === 'FACTORY' ? 11 : a.type === 'WAREHOUSE' ? 8 : 6;
          const bValue = b.type === 'BASE' ? 18 : b.type === 'OFFICE' ? 14 : b.type === 'FACTORY' ? 11 : b.type === 'WAREHOUSE' ? 8 : 6;
          return bValue - aValue;
        });

      const target = hostileTargets[0];
      if (target) {
        const factionRelation = nextState.factions[factionId].relations[target.ownerId] ?? 0;
        const relationFactor = Math.max(0.25, 1 - (factionRelation + 100) / 200);
        const activeTruce = Boolean(faction.truceUntil && nextState.time < faction.truceUntil);
        const targetIsPlayer = target.ownerId === 'player';
        if (!activeTruce && (targetIsPlayer || factionRelation < 0)) {
          const successChance = targetIsPlayer
            ? 0.35 * relationFactor * (faction.isVendetta ? 1.35 : 1)
            : 0.2 * relationFactor;
          if (Math.random() < successChance) {
            nextState.buildings[target.id] = {
              ...target,
              ownerId: factionId,
              health: target.maxHealth,
            };
            nextState.baseSectors = (nextState.baseSectors || []).filter((sector) => sector.buildingId !== target.id);
            nextState.factions[factionId] = {
              ...nextState.factions[factionId],
              funds: Math.max(0, nextState.factions[factionId].funds - Math.round(target.maxHealth * 0.02)),
            };
          }
        }
      }
    }
  });

  return nextState;
}

interface GameContextType {
  state: GameState;
  isGameStarted: boolean;
  hasSavedGame: boolean;
  continueGame: () => void;
  startNewGame: () => void;
  advanceTime: (minutes: number) => void;
  startMission: (mission: TacticalMission) => void;
  startScout: (buildingId: string) => void;
  cancelMission: () => void;
  cancelScout: (scoutId: string) => void;
  finishMission: (victory: boolean, lootItems?: Record<ItemId, number>, extraFunds?: number, updatedUnitHps?: Record<string, number>, capturedSector?: boolean, unitKills?: Record<string, number>) => void;
  buyItem: (itemId: ItemId, count: number, unitCostOverride?: number) => void;
  startResearch: (techId: TechId) => void;
  cancelResearch: (techId?: TechId) => void;
  setUnitBase: (unitId: string, buildingId: string) => void;
  startManufacturing: (itemId: ItemId, count?: number) => void;
  cancelManufacturing: (jobId: string) => void;
  salvageItem: (itemId: ItemId, count?: number) => void;
  equipItem: (unitId: string, itemId: string | undefined, slot: 'handLeft' | 'handRight' | 'armor' | 'head' | 'legs' | 'backpack') => void;
  manageUnitInventory: (unitId: string, itemId: ItemId, action: 'ADD' | 'REMOVE') => void;
  hireUnit: (name: string, stats: { hp: number; maxHp: number; accuracy: number; reactions: number; strength: number; speed: number; stamina: number; bravery: number }, cost: number) => void;
  upgradeUnitSkill: (unitId: string, skillType: 'accuracy' | 'movement' | 'hp') => void;
  trainUnitAttribute: (unitId: string, attribute: 'hp' | 'accuracy' | 'reactions' | 'strength' | 'speed' | 'stamina' | 'bravery') => void;
  learnUnitSkill: (unitId: string, skillId: string) => void;
  expandBase: (buildingId?: string) => void;
  buildNewFloor: (buildingId?: string) => void;
  repairBase: (cost: number, buildingId?: string) => void;
  buildFacility: (index: number, type: 'EMPTY' | 'COMMAND' | 'LAB' | 'ARMORY' | 'INFIRMARY' | 'QUARTERS' | 'WORKSHOP' | 'POWER' | 'HYDROPONICS' | 'GARAGE' | 'STAIRCASE') => void;
  deconstructFacility: (index: number) => void;
  buyVehicle: (vehicleId: string) => void;
  upgradeVehicle: (instanceId: string, upgradeId: string) => void;
  setActiveVehicle: (instanceId: string | undefined) => void;
  setVehicleBase: (vehicleId: string, buildingId: string) => void;
  negotiateTruce: (factionId: string, cost: number, duration: number) => void;
  declareVendetta: (factionId: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(createInitialGameState);
  const activeMissionRef = useRef(state.activeMission);
  const activeScoutsRef = useRef(state.activeScouts);
  const hydratedState = useMemo(() => hydrateGameState(state), [state]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(() => readPersistedGameState() !== null);

  const startNewGame = useCallback(() => {
    clearPersistedGameState();
    setHasSavedGame(false);
    setState(createInitialGameState());
    setIsGameStarted(true);
  }, []);

  const continueGame = useCallback(() => {
    const persistedState = readPersistedGameState();
    if (!persistedState) return;

    setState(persistedState);
    setIsGameStarted(true);
  }, []);

  useEffect(() => {
    activeMissionRef.current = state.activeMission;
    activeScoutsRef.current = state.activeScouts;
  }, [state.activeMission, state.activeScouts]);

  useEffect(() => {
    if (!isGameStarted) return;

    const didPersist = persistGameState(hydratedState);
    setHasSavedGame(didPersist);
  }, [hydratedState, isGameStarted]);

  const advanceTime = useCallback((minutes: number) => {
    setState(prev => {
      let newState = { ...prev, time: prev.time + minutes };
      
      // Handle Multi-Project Research in Tech Labs
      const countLabs = newState.baseSectors?.filter(s => s.type === 'LAB').length ?? 1;
      const activeResearchesMap = { ...(newState.activeResearches || {}) };
      
      if (Object.keys(activeResearchesMap).length === 0 && newState.currentResearch) {
        activeResearchesMap[newState.currentResearch] = newState.researchProgress || 0;
      }

      const activeTechIds = Object.keys(activeResearchesMap);
      if (activeTechIds.length > 0) {
        const newUnlocked = [...newState.unlockedTech];
        const updatedActiveMap: Record<string, number> = {};

        activeTechIds.forEach(tId => {
          const tech = TECH_TREE[tId];
          if (!tech) return;

          const targetCost = tech.cost || 100;
          const currentProgress = activeResearchesMap[tId] || 0;
          const newProgress = currentProgress + (minutes * 0.1);

          if (newProgress >= targetCost) {
            if (!newUnlocked.includes(tId as any)) {
              newUnlocked.push(tId as any);
            }
          } else {
            updatedActiveMap[tId] = newProgress;
          }
        });

        newState.unlockedTech = newUnlocked;
        newState.activeResearches = updatedActiveMap;
        const remainingTechs = Object.keys(updatedActiveMap);
        newState.currentResearch = remainingTechs[0] as any || undefined;
        newState.researchProgress = remainingTechs[0] ? updatedActiveMap[remainingTechs[0]] : 0;
      }

      // Handle Concurrent Weapon & Equipment Manufacturing in Workshop
      const countWorkshops = newState.baseSectors?.filter(s => s.type === 'WORKSHOP').length ?? 1;
      const maxWorkshopSlots = Math.max(1, countWorkshops);

      if (newState.manufacturingQueue && newState.manufacturingQueue.length > 0) {
        const queue = [...newState.manufacturingQueue];
        const newInventory = { ...newState.inventory };
        const remainingQueue: typeof queue = [];

        for (let i = 0; i < queue.length; i++) {
          const job = queue[i];
          if (i < maxWorkshopSlots) {
            const newProgress = job.progress + minutes;
            if (newProgress >= job.maxProgress) {
              newInventory[job.itemId] = (newInventory[job.itemId] || 0) + (job.count || 1);
            } else {
              remainingQueue.push({ ...job, progress: newProgress });
            }
          } else {
            remainingQueue.push(job);
          }
        }

        newState.manufacturingQueue = remainingQueue;
        newState.inventory = newInventory;
      }

      // Handle Hydroponics passive generation
      const hydroponicsCount = newState.baseSectors?.filter(s => s.type === 'HYDROPONICS').length ?? 0;
      if (hydroponicsCount > 0) {
        newState.funds += hydroponicsCount * Math.floor(minutes * 4); // ₮4 per minute per hydroponics bay (₮120/hr)
      }

      // Slowly heal wounded player units residing at BASE (in the Infirmary)
      const updatedUnits = { ...newState.units };
      let updated = false;

      const infirmaryCount = newState.baseSectors?.filter(s => s.type === 'INFIRMARY').length ?? 1;

      if (infirmaryCount > 0) {
        Object.keys(updatedUnits).forEach(unitId => {
          const unit = updatedUnits[unitId];
          if (unit.factionId === 'player' && unit.location === 'BASE' && unit.stats.hp < unit.stats.maxHp) {
            // Heal rate scales with number of Infirmaries
            const baseHealRate = Math.max(1, Math.floor(minutes / 5));
            const healAmount = baseHealRate * infirmaryCount;
            const newHp = Math.min(unit.stats.maxHp, unit.stats.hp + healAmount);
            if (newHp !== unit.stats.hp) {
              updatedUnits[unitId] = {
                ...unit,
                stats: {
                  ...unit.stats,
                  hp: newHp
                }
              };
              updated = true;
            }
          }
        });
      }

      if (updated) {
        newState.units = updatedUnits;
      }

      // Rival faction AI: every 15 minutes of game time they fund, recruit, repair, and attack.
      if (newState.time > 0 && newState.time % RIVAL_AI_TICK_MINUTES === 0) {
        newState = applyRivalAi(newState);
      }

      return newState;
    });
  }, []);

  // Advance the shared simulation state on the existing cadence.
  useEffect(() => {
    if (state.activeMission && state.activeMission.status !== 'TRANSIT' && state.activeMission.status !== 'RETURNING') return;
    const interval = setInterval(() => {
      advanceTime(BASE_GAME_TICK_STEP_MINUTES);
    }, BASE_GAME_TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state.activeMission, advanceTime]);

  // Update transit progress separately so troop movement and progress bars feel continuous.
  useEffect(() => {
    const interval = setInterval(() => {
      const hasTransitMission = Boolean(activeMissionRef.current && (activeMissionRef.current.status === 'TRANSIT' || activeMissionRef.current.status === 'RETURNING'));
      const hasActiveScouts = Boolean(activeScoutsRef.current && activeScoutsRef.current.length > 0);
      if (!hasTransitMission && !hasActiveScouts) return;

      setState(prev => {
        let nextState = prev;
        const scoutIntelById = new Map<string, { civilians: number; hostiles: number; resources: number }>();
        (prev.activeScouts ?? []).forEach((scout) => {
          if (scout.transitTimeRemaining <= TRANSIT_TICK_STEP_MINUTES) {
            const seed = `${scout.buildingId}-${scout.id}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            scoutIntelById.set(scout.id, {
              civilians: seed % 20,
              hostiles: (seed % 12) + 3,
              resources: (seed % 600) + 200,
            });
          }
        });

        if (prev.activeMission && (prev.activeMission.status === 'TRANSIT' || prev.activeMission.status === 'RETURNING')) {
          const remaining = prev.activeMission.transitTimeRemaining - TRANSIT_TICK_STEP_MINUTES;
          if (remaining <= 0) {
            if (prev.activeMission.status === 'RETURNING') {
              const updatedUnits = { ...prev.units };
              const returnBuildingId = prev.activeMission.startBuildingId || 'player-hq';
              prev.activeMission.units.forEach(uId => {
                if (updatedUnits[uId]) {
                  updatedUnits[uId] = { ...updatedUnits[uId], location: 'BASE', currentBuildingId: returnBuildingId };
                }
              });
              nextState = {
                ...prev,
                units: updatedUnits,
                activeMission: undefined
              };
            } else {
              const updatedUnits = { ...prev.units };
              prev.activeMission.units.forEach(uId => {
                if (updatedUnits[uId]) {
                  updatedUnits[uId] = { ...updatedUnits[uId], location: 'MISSION' };
                }
              });
              nextState = {
                ...prev,
                units: updatedUnits,
                activeMission: {
                  ...prev.activeMission,
                  status: 'IN_PROGRESS',
                  transitTimeRemaining: 0
                }
              };
            }
          } else {
            nextState = {
              ...prev,
              activeMission: {
                ...prev.activeMission,
                transitTimeRemaining: remaining
              }
            };
          }
        }

        if (nextState.activeScouts && nextState.activeScouts.length > 0) {
          const updatedScouts = [...nextState.activeScouts];
          let didUpdateScouts = false;

          for (let index = updatedScouts.length - 1; index >= 0; index -= 1) {
            const scout = updatedScouts[index];
            if (!scout) continue;
            const nextRemaining = scout.transitTimeRemaining - TRANSIT_TICK_STEP_MINUTES;
            if (nextRemaining <= 0) {
              const buildingId = scout.buildingId;
              const building = nextState.buildings[buildingId];
              if (building) {
                const intel = scoutIntelById.get(scout.id) || {
                  civilians: 0,
                  hostiles: 3,
                  resources: 200,
                };
                nextState = {
                  ...nextState,
                  buildings: {
                    ...nextState.buildings,
                    [buildingId]: {
                      ...building,
                      isScouted: true,
                      intel: building.intel || intel
                    }
                  }
                };
              }
              updatedScouts.splice(index, 1);
              didUpdateScouts = true;
            } else {
              updatedScouts[index] = {
                ...scout,
                transitTimeRemaining: nextRemaining
              };
              didUpdateScouts = true;
            }
          }

          if (didUpdateScouts) {
            nextState = {
              ...nextState,
              activeScouts: updatedScouts
            };
          }
        }

        return nextState;
      });
    }, TRANSIT_TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const startMission = useCallback((mission: TacticalMission) => {
    setState(prev => {
      const startBuilding = mission.startBuildingId ? prev.buildings[mission.startBuildingId] : prev.buildings['player-hq'];
      const hq = prev.buildings['player-hq'];
      const target = prev.buildings[mission.buildingId];
      if (!target) return prev;

      let startX = startBuilding?.x ?? hq?.x ?? 0;
      let startY = startBuilding?.y ?? hq?.y ?? 0;

      // If already in transit or on mission, start from current/last location
      if (prev.activeMission) {
        const currentTarget = prev.buildings[prev.activeMission.buildingId];
        if (prev.activeMission.status === 'TRANSIT' || prev.activeMission.status === 'RETURNING') {
          // Approximate current position based on transit progress
          const currentStartBuilding = prev.activeMission.startBuildingId ? prev.buildings[prev.activeMission.startBuildingId] : hq;
          const from = prev.activeMission.status === 'RETURNING' ? currentTarget : currentStartBuilding;
          const to = prev.activeMission.status === 'RETURNING' ? currentStartBuilding : currentTarget;
          
          if (from && to) {
            const progress = 1 - (prev.activeMission.transitTimeRemaining / prev.activeMission.transitTimeTotal);
            startX = from.x + (to.x - from.x) * progress;
            startY = from.y + (to.y - from.y) * progress;
          } else if (currentTarget) {
            startX = currentTarget.x;
            startY = currentTarget.y;
          }
        } else {
          startX = currentTarget?.x ?? 0;
          startY = currentTarget?.y ?? 0;
        }
      }

      const distance = Math.sqrt(Math.pow(startX - target.x, 2) + Math.pow(startY - target.y, 2));
      let activeVehicle = prev.activeVehicleId ? prev.vehicles[prev.activeVehicleId] : null;
      if (activeVehicle && (activeVehicle.currentBuildingId || 'player-hq') !== mission.startBuildingId) {
        activeVehicle = null;
      }
      let travelSpeed = 10; // 10 is foot speed
      
      if (activeVehicle) {
        travelSpeed = activeVehicle.stats.speed;
      }
      
      const transitTime = Math.round((distance * 100) / travelSpeed);

      // Update unit locations
      const updatedUnits = { ...prev.units };
      mission.units.forEach(uId => {
        if (updatedUnits[uId]) {
          updatedUnits[uId] = { ...updatedUnits[uId], location: 'TRANSIT' };
        }
      });

      return {
        ...prev,
        units: updatedUnits,
        activeMission: {
          ...mission,
          status: 'TRANSIT',
          transitTimeRemaining: transitTime,
          transitTimeTotal: transitTime,
          startPosX: startX,
          startPosY: startY
        }
      };
    });
  }, []);

  const startScout = useCallback((buildingId: string) => {
    setState(prev => {
      const b = prev.buildings[buildingId];
      if (!b || b.isScouted) return prev;
      
      const area = (b.width || 1) * (b.height || 1);
      const cost = area * 100;
      
      if (prev.funds < cost) return prev;

      const hq = prev.buildings['player-hq'];
      const startX = hq?.x ?? 0;
      const startY = hq?.y ?? 0;
      const distance = Math.sqrt(Math.pow(startX - b.x, 2) + Math.pow(startY - b.y, 2));
      
      const travelSpeed = 30; // 3x foot speed (only on foot)
      const transitTime = Math.round((distance * 100) / travelSpeed);

      return {
        ...prev,
        funds: prev.funds - cost,
        activeScouts: [
          ...(prev.activeScouts || []),
          { 
            id: `scout-${Date.now()}`, 
            buildingId, 
            transitTimeRemaining: transitTime, 
            transitTimeTotal: transitTime,
            startPosX: startX,
            startPosY: startY
          }
        ]
      };
    });
  }, []);

  const cancelMission = useCallback(() => {
    setState(prev => {
      const activeMission = prev.activeMission;
      if (!activeMission) return prev;

      const updatedUnits = { ...prev.units };
      const playerBuilding = Object.values(prev.buildings as Record<string, Building>).find((building: Building) => building.ownerId === 'player');
      const fallbackBuildingId = activeMission.startBuildingId && prev.buildings[activeMission.startBuildingId]
        ? activeMission.startBuildingId
        : (playerBuilding?.id || 'player-hq');

      let startPosX = activeMission.startPosX;
      let startPosY = activeMission.startPosY;
      const targetBuilding = prev.buildings[activeMission.buildingId];
      const startBuilding = fallbackBuildingId ? prev.buildings[fallbackBuildingId] : prev.buildings['player-hq'];

      if (typeof startPosX === 'number' && typeof startPosY === 'number' && targetBuilding) {
        const totalTransitTime = activeMission.transitTimeTotal > 0 ? activeMission.transitTimeTotal : MIN_TRANSIT_TIME;
        const progress = activeMission.transitTimeRemaining <= 0 ? 1 : 1 - (activeMission.transitTimeRemaining / totalTransitTime);
        startPosX = startPosX + (targetBuilding.x - startPosX) * progress;
        startPosY = startPosY + (targetBuilding.y - startPosY) * progress;
      } else if (startBuilding) {
        startPosX = startBuilding.x;
        startPosY = startBuilding.y;
      }

      let activeVehicle = prev.activeVehicleId ? prev.vehicles[prev.activeVehicleId] : null;
      const vehicleBaseBuildingId = activeVehicle?.currentBuildingId || fallbackBuildingId;
      if (activeVehicle && vehicleBaseBuildingId !== activeMission.startBuildingId) {
        activeVehicle = null;
      }
      const travelSpeed = activeVehicle ? activeVehicle.stats.speed : DEFAULT_WALK_SPEED;
      const currentPosX = typeof startPosX === 'number' ? startPosX : (startBuilding?.x ?? prev.buildings['player-hq']?.x ?? 0);
      const currentPosY = typeof startPosY === 'number' ? startPosY : (startBuilding?.y ?? prev.buildings['player-hq']?.y ?? 0);
      const homeX = startBuilding?.x ?? prev.buildings['player-hq']?.x ?? 0;
      const homeY = startBuilding?.y ?? prev.buildings['player-hq']?.y ?? 0;
      const deltaX = currentPosX - homeX;
      const deltaY = currentPosY - homeY;
      const returnDistance = Math.hypot(deltaX, deltaY);
      const returnTransitTime = Math.max(MIN_TRANSIT_TIME, Math.round((returnDistance * DISTANCE_TO_TIME_MULTIPLIER) / travelSpeed));

      activeMission.units.forEach(uId => {
        if (updatedUnits[uId]) {
          updatedUnits[uId] = {
            ...updatedUnits[uId],
            location: 'TRANSIT',
            currentBuildingId: undefined
          };
        }
      });

      return {
        ...prev,
        units: updatedUnits,
        activeMission: {
          ...activeMission,
          status: 'RETURNING',
          transitTimeRemaining: returnTransitTime,
          transitTimeTotal: returnTransitTime,
          startPosX,
          startPosY
        }
      };
    });
  }, []);

  const cancelScout = useCallback((scoutId: string) => {
    setState(prev => ({
      ...prev,
      activeScouts: (prev.activeScouts || []).filter(scout => scout.id !== scoutId)
    }));
  }, []);

  const finishMission = useCallback((victory: boolean, lootItems?: Record<ItemId, number>, extraFunds?: number, updatedUnitHps?: Record<string, number>, capturedSector?: boolean, unitKills?: Record<string, number>) => {
    setState(prev => {
      if (!prev.activeMission) return prev;

      // Update unit healths
      const updatedUnits = { ...prev.units };
      
      // Award XP for completion and kills
      prev.activeMission.units.forEach(uId => {
        if (updatedUnits[uId]) {
          const kills = (unitKills && unitKills[uId]) || 0;
          const xpGained = (victory ? 150 : 30) + (kills * 50); // 150 for win, 30 for retreat, 50 per kill
          
          let unit = updatedUnits[uId];
          let currentExp = (unit.exp || 0) + xpGained;
          let currentLevel = unit.level || 1;
          let currentSkillPoints = unit.skillPoints || 0;
          
          let expNeeded = currentLevel * 150;
          while (currentExp >= expNeeded) {
            currentExp -= expNeeded;
            currentLevel += 1;
            currentSkillPoints += 1; // Gain +1 assignable skill point per level
            
            // Baseline stat increases upon level up
            const stats = { ...unit.stats };
            stats.maxHp += 10;
            stats.hp = Math.min(stats.hp + 10, stats.maxHp);
            stats.accuracy += 3;
            stats.reactions += 2;
            stats.strength += 2;
            stats.speed += 3; // Boosts speed & movement range
            
            unit = { ...unit, stats };
            expNeeded = currentLevel * 150;
          }
          
          updatedUnits[uId] = {
            ...unit,
            exp: currentExp,
            level: currentLevel,
            skillPoints: currentSkillPoints
          };
        }
      });

      if (updatedUnitHps) {
        Object.entries(updatedUnitHps).forEach(([unitId, hp]) => {
          if (updatedUnits[unitId]) {
            updatedUnits[unitId] = {
              ...updatedUnits[unitId],
              stats: {
                ...updatedUnits[unitId].stats,
                hp: hp
              }
            };
          }
        });
      }

      // Handle loot and funds
      const newInventory = { ...prev.inventory };
      let newFunds = prev.funds;

      if (victory) {
        newFunds += 2000 + (extraFunds || 0); // Base reward + extra loot credits
        
        // Add looted items to inventory
        if (lootItems) {
          Object.entries(lootItems).forEach(([itemId, count]) => {
            if (count > 0) {
              newInventory[itemId] = (newInventory[itemId] || 0) + count;
            }
          });
        }

        // Award raided raw materials from raid target
        newInventory['mat_scrap'] = (newInventory['mat_scrap'] || 0) + Math.floor(Math.random() * 8 + 5);
        newInventory['mat_circuits'] = (newInventory['mat_circuits'] || 0) + Math.floor(Math.random() * 5 + 3);
        newInventory['mat_weapon_parts'] = (newInventory['mat_weapon_parts'] || 0) + Math.floor(Math.random() * 4 + 2);
        if (Math.random() > 0.4) {
          newInventory['mat_chemicals'] = (newInventory['mat_chemicals'] || 0) + Math.floor(Math.random() * 3 + 2);
        }
      }

      // Handle Sector Capture & Opening Slots in Conquered Building
      let newBuildings = prev.buildings;
      let newSectors = prev.baseSectors ? [...prev.baseSectors] : [];

      if (capturedSector && victory) {
        const buildingId = prev.activeMission.buildingId;
        const targetBuilding = newBuildings[buildingId];

        if (targetBuilding) {
          const wasPlayerOwned = targetBuilding.ownerId === 'player';

          newBuildings = {
            ...newBuildings,
            [buildingId]: {
              ...targetBuilding,
              ownerId: 'player',
              health: targetBuilding.maxHealth
            }
          };

          if (!wasPlayerOwned) {
            // Conquering new buildings opens pre-equipped slots in those buildings!
            const buildingArea = (targetBuilding.width || 1) * (targetBuilding.height || 1);
            const slotsToOpen = buildingArea >= 6 ? 3 : buildingArea >= 3 ? 2 : 1;
            const facilityTypes = getInitialFacilitiesForBuilding(targetBuilding, slotsToOpen);

            for (let s = 1; s <= slotsToOpen; s++) {
              const facType = facilityTypes[s - 1] || 'EMPTY';
              const labelName = facType === 'EMPTY'
                ? `Bay ${s}`
                : FACILITY_LABEL_NAMES[facType] || facType;

              newSectors.push({
                id: `sec-${buildingId}-${Date.now()}-${s}`,
                name: `${targetBuilding.name} - ${labelName}`,
                type: facType,
                level: 1,
                buildingId: buildingId
              });
            }
          }
        }
      }

      // Instead of instant return, start RETURNING transit
      const hq = prev.buildings['player-hq'];
      const startBuilding = prev.activeMission.startBuildingId ? prev.buildings[prev.activeMission.startBuildingId] : hq;
      const target = prev.buildings[prev.activeMission.buildingId];
      let transitTime = 10;
      if (startBuilding && target) {
        const distance = Math.sqrt(Math.pow(startBuilding.x - target.x, 2) + Math.pow(startBuilding.y - target.y, 2));
        let activeVehicle = prev.activeVehicleId ? prev.vehicles[prev.activeVehicleId] : null;
        if (activeVehicle && (activeVehicle.currentBuildingId || 'player-hq') !== prev.activeMission.startBuildingId) {
          activeVehicle = null;
        }
        const travelSpeed = activeVehicle ? activeVehicle.stats.speed : 10;
        transitTime = Math.round((distance * 100) / travelSpeed);
      }

      // Set units back to TRANSIT for return trip
      prev.activeMission.units.forEach(uId => {
        if (updatedUnits[uId]) {
          updatedUnits[uId] = { ...updatedUnits[uId], location: 'TRANSIT' };
        }
      });

      return {
        ...prev,
        units: updatedUnits,
        inventory: newInventory,
        funds: newFunds,
        buildings: newBuildings,
        baseSectors: newSectors,
        activeMission: {
          ...prev.activeMission,
          status: 'RETURNING',
          transitTimeRemaining: transitTime,
          transitTimeTotal: transitTime,
          startPosX: target?.x,
          startPosY: target?.y
        }
      };
    });
  }, []);

  const buyItem = useCallback((itemId: ItemId, count: number, unitCostOverride?: number) => {
    setState(prev => {
      const item = ITEMS[itemId];
      const unitCost = unitCostOverride ?? item.cost;
      const totalCost = unitCost * count;
      if (prev.funds >= totalCost) {
        return {
          ...prev,
          funds: prev.funds - totalCost,
          inventory: {
            ...prev.inventory,
            [itemId]: (prev.inventory[itemId] || 0) + count
          }
        };
      }
      return prev;
    });
  }, []);

  const startResearch = useCallback((techId: TechId) => {
    setState(prev => {
      const activeMap = { ...(prev.activeResearches || {}) };
      if (activeMap[techId] === undefined) {
        activeMap[techId] = 0;
      }
      return {
        ...prev,
        activeResearches: activeMap,
        currentResearch: techId,
        researchProgress: activeMap[techId]
      };
    });
  }, []);

  const cancelResearch = useCallback((techId?: TechId) => {
    setState(prev => {
      const activeMap = { ...(prev.activeResearches || {}) };
      if (techId) {
        delete activeMap[techId];
      } else if (prev.currentResearch) {
        delete activeMap[prev.currentResearch];
      } else {
        const keys = Object.keys(activeMap);
        if (keys.length > 0) delete activeMap[keys[0]];
      }
      const remainingKeys = Object.keys(activeMap);
      return {
        ...prev,
        activeResearches: activeMap,
        currentResearch: remainingKeys[0] as TechId || undefined,
        researchProgress: remainingKeys[0] ? activeMap[remainingKeys[0]] : 0
      };
    });
  }, []);

  const startManufacturing = useCallback((itemId: ItemId, count: number = 1) => {
    setState(prev => {
      const item = ITEMS[itemId];
      if (!item || !item.recipe) return prev;

      const newInventory = { ...prev.inventory };
      let hasMaterials = true;
      for (const [matId, reqAmount] of Object.entries(item.recipe)) {
        const totalReq = (reqAmount || 0) * count;
        if ((newInventory[matId as ItemId] || 0) < totalReq) {
          hasMaterials = false;
          break;
        }
      }

      if (!hasMaterials) {
        alert("Insufficient raw materials in stash to begin manufacturing!");
        return prev;
      }

      for (const [matId, reqAmount] of Object.entries(item.recipe)) {
        const totalReq = (reqAmount || 0) * count;
        newInventory[matId as ItemId] = (newInventory[matId as ItemId] || 0) - totalReq;
      }

      const craftTime = item.craftTime || 30;
      const newJob: ManufacturingJob = {
        id: `mfg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        itemId,
        count,
        progress: 0,
        maxProgress: craftTime * count
      };

      return {
        ...prev,
        inventory: newInventory,
        manufacturingQueue: [...(prev.manufacturingQueue || []), newJob]
      };
    });
  }, []);

  const cancelManufacturing = useCallback((jobId: string) => {
    setState(prev => {
      const queue = prev.manufacturingQueue || [];
      const job = queue.find(j => j.id === jobId);
      if (!job) return prev;

      const newInventory = { ...prev.inventory };
      const item = ITEMS[job.itemId];
      if (item && item.recipe) {
        for (const [matId, reqAmount] of Object.entries(item.recipe)) {
          const totalReq = (reqAmount || 0) * job.count;
          const refund = Math.floor(totalReq * 0.8);
          newInventory[matId as ItemId] = (newInventory[matId as ItemId] || 0) + refund;
        }
      }

      return {
        ...prev,
        inventory: newInventory,
        manufacturingQueue: queue.filter(j => j.id !== jobId)
      };
    });
  }, []);

  const salvageItem = useCallback((itemId: ItemId, count: number = 1) => {
    setState(prev => {
      const currentQty = prev.inventory[itemId] || 0;
      if (currentQty < count) return prev;

      const newInventory = { ...prev.inventory };
      newInventory[itemId] = currentQty - count;
      if (newInventory[itemId] <= 0) {
        delete newInventory[itemId];
      }

      const item = ITEMS[itemId];
      if (item && item.recipe) {
        for (const [matId, reqAmount] of Object.entries(item.recipe)) {
          const yieldAmount = Math.max(1, Math.floor((reqAmount || 1) * count * 0.6));
          newInventory[matId as ItemId] = (newInventory[matId as ItemId] || 0) + yieldAmount;
        }
      } else {
        const scrapYield = Math.max(1, Math.floor((item?.cost || 100) / 150)) * count;
        newInventory['mat_scrap'] = (newInventory['mat_scrap'] || 0) + scrapYield;
      }

      return {
        ...prev,
        inventory: newInventory
      };
    });
  }, []);

  const equipItem = useCallback((unitId: string, itemId: string | undefined, slot: 'handLeft' | 'handRight' | 'armor' | 'head' | 'legs' | 'backpack') => {
    setState(prev => {
      const unit = prev.units[unitId];
      if (!unit) return prev;

      const newEquipment = { ...unit.equipment };
      const oldItemId = newEquipment[slot];

      // Build target equipment to verify capacity constraint
      const targetEquipment = { ...newEquipment };
      if (itemId) {
        targetEquipment[slot] = itemId as any;
      } else {
        delete targetEquipment[slot];
      }

      // Check capacity constraint if changing clothing gear
      const tempUnit = { ...unit, equipment: targetEquipment };
      const newMaxSlots = getMaxInventorySlots(tempUnit);
      const currentUsedSlots = getUsedInventorySlots(unit);

      // If unequipping/replacing gear reduces max capacity below current loadout usage, block action
      if (currentUsedSlots > newMaxSlots) {
        return prev;
      }

      const newInventory = { ...prev.inventory };

      // Return old item to stash if any
      if (oldItemId) {
        newInventory[oldItemId] = (newInventory[oldItemId] || 0) + 1;
      }

      // Take new item from stash if any
      if (itemId) {
        if (!newInventory[itemId] || newInventory[itemId] <= 0) {
          return prev; // Not enough in base stash
        }
        newInventory[itemId] -= 1;
        if (newInventory[itemId] === 0) {
          delete newInventory[itemId];
        }
        newEquipment[slot] = itemId as any;
      } else {
        delete newEquipment[slot];
      }

      return {
        ...prev,
        inventory: newInventory,
        units: {
          ...prev.units,
          [unitId]: {
            ...unit,
            equipment: newEquipment
          }
        }
      };
    });
  }, []);

  const manageUnitInventory = useCallback((unitId: string, itemId: ItemId, action: 'ADD' | 'REMOVE') => {
    setState(prev => {
      const unit = prev.units[unitId];
      if (!unit) return prev;

      const newInventory = { ...prev.inventory };
      const unitInventory = [...(unit.equipment.inventory || [])];

      if (action === 'ADD') {
        if (!newInventory[itemId] || newInventory[itemId] <= 0) return prev;

        const maxSlots = getMaxInventorySlots(unit);
        const usedSlots = getUsedInventorySlots(unit);
        const itemSize = ITEMS[itemId]?.slotSize || 1;

        if (usedSlots + itemSize > maxSlots) {
          return prev; // Exceeds loadout capacity!
        }

        newInventory[itemId] -= 1;
        if (newInventory[itemId] === 0) delete newInventory[itemId];
        unitInventory.push(itemId);
      } else {
        const index = unitInventory.indexOf(itemId);
        if (index === -1) return prev;
        unitInventory.splice(index, 1);
        newInventory[itemId] = (newInventory[itemId] || 0) + 1;
      }

      return {
        ...prev,
        inventory: newInventory,
        units: {
          ...prev.units,
          [unitId]: {
            ...unit,
            equipment: {
              ...unit.equipment,
              inventory: unitInventory
            }
          }
        }
      };
    });
  }, []);

  const setUnitBase = useCallback((unitId: string, buildingId: string) => {
    setState(prev => {
      const unit = prev.units[unitId];
      if (!unit || unit.location !== 'BASE') return prev;
      return {
        ...prev,
        units: {
          ...prev.units,
          [unitId]: {
            ...unit,
            currentBuildingId: buildingId
          }
        }
      };
    });
  }, []);

  const hireUnit = useCallback((name: string, stats: any, cost: number) => {
    setState(prev => {
      if (prev.funds < cost) return prev;
      
      // Limit squad size to Crew Quarters built!
      const quartersSectors = prev.baseSectors?.filter(s => s.type === 'QUARTERS') ?? [];
      const totalQuartersLevel = quartersSectors.reduce((sum, s) => sum + s.level, 0);
      const maxCrewCapacity = Math.max(4, totalQuartersLevel * 4); 
      
      const playerUnitsCount = Object.values(prev.units).filter((u: any) => u.factionId === 'player').length;
      if (playerUnitsCount >= maxCrewCapacity) return prev;

      const newUnitId = `u_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newUnit = {
        id: newUnitId,
        name,
        factionId: 'player',
        stats,
        equipment: { inventory: [] },
        location: 'BASE' as const,
        currentBuildingId: 'player-hq'
      };

      return {
        ...prev,
        funds: prev.funds - cost,
        units: {
          ...prev.units,
          [newUnitId]: newUnit
        }
      };
    });
  }, []);

  const buildNewFloor = useCallback((buildingId: string = 'player-hq') => {
    setState(prev => {
      const cost = 20000;
      if (prev.funds < cost) return prev;
      
      const buildingsCopy = { ...prev.buildings };
      if (buildingsCopy[buildingId]) {
        buildingsCopy[buildingId] = {
          ...buildingsCopy[buildingId],
          unlockedFloors: (buildingsCopy[buildingId].unlockedFloors || 1) + 1
        };
        return {
          ...prev,
          funds: prev.funds - cost,
          buildings: buildingsCopy
        };
      }
      return prev;
    });
  }, []);

  const expandBase = useCallback((buildingId: string = 'player-hq') => {
    setState(prev => {
      const currentSectors = prev.baseSectors ?? [];
      const cost = 4000;
      if (prev.funds < cost) return prev;

      const newSectorIndex = currentSectors.length + 1;
      const newSector = {
        id: `sec-${Date.now()}-${newSectorIndex}`,
        name: `Cleared Room ${newSectorIndex}`,
        type: 'EMPTY' as const,
        level: 1,
        buildingId: buildingId !== 'player-hq' ? buildingId : undefined
      };

      const buildingsCopy = { ...prev.buildings };
      let newHqIntegrity = prev.baseStructuralIntegrity ?? 100;

      if (buildingsCopy[buildingId]) {
        const b = buildingsCopy[buildingId];
        const buildingSectorsCount = currentSectors.filter(s => (s.buildingId || 'player-hq') === buildingId).length;
        
        const damage = Math.round(b.maxHealth * 0.12);
        const newHealth = Math.max(10, b.health - damage);
        
        // Base structure max health accumulation
        const newMaxHealth = (b.maxHealth || (buildingId === 'player-hq' ? 1000 : 500)) + 150;

        buildingsCopy[buildingId] = {
          ...b,
          health: newHealth,
          maxHealth: newMaxHealth
        };

        if (buildingId === 'player-hq') {
          newHqIntegrity = Math.round((newHealth / newMaxHealth) * 100);
        }
      }

      return {
        ...prev,
        funds: prev.funds - cost,
        baseStructuralIntegrity: newHqIntegrity,
        baseSectors: [...currentSectors, newSector],
        buildings: buildingsCopy
      };
    });
  }, []);

  const repairBase = useCallback((cost: number, buildingId: string = 'player-hq') => {
    setState(prev => {
      if (prev.funds < cost) return prev;
      
      const targetBuilding = prev.buildings[buildingId];
      if (!targetBuilding) return prev;

      // ₮10 per 10 points (1%) of health repaired. Max health can be > 1000.
      // Wait, 1% integrity is maxHealth / 100.
      const repairAmountHealth = (targetBuilding.maxHealth / 100) * Math.floor(cost / 10);
      const newHealth = Math.min(targetBuilding.maxHealth, targetBuilding.health + repairAmountHealth);

      // If repairing HQ, keep baseStructuralIntegrity in sync
      const newIntegrity = buildingId === 'player-hq' 
        ? Math.round((newHealth / targetBuilding.maxHealth) * 100) 
        : prev.baseStructuralIntegrity;

      const buildingsCopy = { ...prev.buildings };
      buildingsCopy[buildingId] = {
        ...targetBuilding,
        health: newHealth
      };

      return {
        ...prev,
        funds: prev.funds - cost,
        baseStructuralIntegrity: newIntegrity,
        buildings: buildingsCopy
      };
    });
  }, []);

  const buildFacility = useCallback((index: number, type: 'EMPTY' | 'COMMAND' | 'LAB' | 'ARMORY' | 'INFIRMARY' | 'QUARTERS' | 'WORKSHOP' | 'POWER' | 'HYDROPONICS' | 'GARAGE' | 'STAIRCASE') => {
    setState(prev => {
      const currentSectors = prev.baseSectors ? [...prev.baseSectors] : [];
      if (index < 0 || index >= currentSectors.length) return prev;
      
      const configs: Record<string, { cost: number; name: string; stress: number }> = {
        COMMAND: { cost: 3000, name: 'Command Center', stress: 10 },
        LAB: { cost: 2500, name: 'Tech Laboratory', stress: 8 },
        ARMORY: { cost: 2000, name: 'Tactical Armory', stress: 5 },
        INFIRMARY: { cost: 3000, name: 'Med Infirmary', stress: 6 },
        QUARTERS: { cost: 1500, name: 'Crew Quarters', stress: 4 },
        WORKSHOP: { cost: 2500, name: 'Workshop Bay', stress: 7 },
        POWER: { cost: 1800, name: 'Generator Core', stress: 5 },
        HYDROPONICS: { cost: 2000, name: 'Hydroponics Garden', stress: 5 },
        GARAGE: { cost: 3500, name: 'Garage Terminal', stress: 8 },
        STAIRCASE: { cost: 5000, name: 'Staircase Access', stress: 2 },
        EMPTY: { cost: 0, name: `Cleared Room ${index + 1}`, stress: 0 }
      };

      const targetSector = currentSectors[index];
      const parentBuilding = targetSector.buildingId ? prev.buildings[targetSector.buildingId] : null;
      const defaultEmptyName = parentBuilding ? `${parentBuilding.name} - Bay` : `Cleared Room ${index + 1}`;

      const cfg = configs[type];
      if (!cfg || prev.funds < cfg.cost) return prev;

      currentSectors[index] = {
        ...targetSector,
        type,
        name: type === 'EMPTY' ? defaultEmptyName : cfg.name,
        level: 1
      };

      const currentIntegrity = prev.baseStructuralIntegrity ?? 100;
      const newIntegrity = Math.max(10, currentIntegrity - cfg.stress);

      const buildingsCopy = { ...prev.buildings };
      if (buildingsCopy['player-hq']) {
        buildingsCopy['player-hq'] = {
          ...buildingsCopy['player-hq'],
          health: Math.round(newIntegrity * 10)
        };
      }

      return {
        ...prev,
        funds: prev.funds - cfg.cost,
        baseStructuralIntegrity: newIntegrity,
        baseSectors: currentSectors,
        buildings: buildingsCopy
      };
    });
  }, []);

  const deconstructFacility = useCallback((index: number) => {
    setState(prev => {
      const currentSectors = prev.baseSectors ? [...prev.baseSectors] : [];
      if (index < 0 || index >= currentSectors.length) return prev;

      const cost = 500;
      if (prev.funds < cost) return prev;

      const targetSector = currentSectors[index];
      const parentBuilding = targetSector.buildingId ? prev.buildings[targetSector.buildingId] : null;
      const defaultEmptyName = parentBuilding ? `${parentBuilding.name} - Bay` : `Cleared Room ${index + 1}`;

      currentSectors[index] = {
        ...targetSector,
        type: 'EMPTY' as const,
        name: defaultEmptyName,
        level: 1
      };

      // Deconstructing relieves structural stress, restoring 6% structural integrity
      const currentIntegrity = prev.baseStructuralIntegrity ?? 100;
      const newIntegrity = Math.min(100, currentIntegrity + 6);

      const buildingsCopy = { ...prev.buildings };
      if (buildingsCopy['player-hq']) {
        buildingsCopy['player-hq'] = {
          ...buildingsCopy['player-hq'],
          health: Math.round(newIntegrity * 10)
        };
      }

      return {
        ...prev,
        funds: prev.funds - cost,
        baseStructuralIntegrity: newIntegrity,
        baseSectors: currentSectors,
        buildings: buildingsCopy
      };
    });
  }, []);

  const buyVehicle = useCallback((vehicleId: string) => {
    setState(prev => {
      const template = VEHICLES[vehicleId];
      if (!template || prev.funds < template.cost) return prev;
      
      const instanceId = `veh_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newVehicle = { ...template, id: instanceId };
      
      return {
        ...prev,
        funds: prev.funds - template.cost,
        vehicles: {
          ...prev.vehicles,
          [instanceId]: newVehicle
        }
      };
    });
  }, []);

  const upgradeVehicle = useCallback((instanceId: string, upgradeId: string) => {
    setState(prev => {
      const vehicle = prev.vehicles[instanceId];
      const upgrade = VEHICLE_UPGRADES[upgradeId];
      if (!vehicle || !upgrade || prev.funds < upgrade.cost) return prev;
      if (vehicle.upgrades.includes(upgradeId)) return prev;

      const updatedStats = { ...vehicle.stats };
      if (upgrade.statModifiers.speed) updatedStats.speed += upgrade.statModifiers.speed;
      if (upgrade.statModifiers.armor) updatedStats.armor += upgrade.statModifiers.armor;
      if (upgrade.statModifiers.capacity) updatedStats.capacity += upgrade.statModifiers.capacity;
      if (upgrade.statModifiers.fuelEfficiency) updatedStats.fuelEfficiency += upgrade.statModifiers.fuelEfficiency;

      return {
        ...prev,
        funds: prev.funds - upgrade.cost,
        vehicles: {
          ...prev.vehicles,
          [instanceId]: {
            ...vehicle,
            stats: updatedStats,
            upgrades: [...vehicle.upgrades, upgradeId]
          }
        }
      };
    });
  }, []);

  const setActiveVehicle = useCallback((instanceId: string | undefined) => {
    setState(prev => ({ ...prev, activeVehicleId: instanceId }));
  }, []);

  const setVehicleBase = useCallback((vehicleId: string, buildingId: string) => {
    setState(prev => {
      const vehicle = prev.vehicles[vehicleId];
      if (!vehicle || vehicle.status !== 'READY') return prev;
      return {
        ...prev,
        vehicles: {
          ...prev.vehicles,
          [vehicleId]: {
            ...vehicle,
            currentBuildingId: buildingId
          }
        }
      };
    });
  }, []);

  const negotiateTruce = useCallback((factionId: string, cost: number, duration: number) => {
    setState(prev => {
      if (prev.funds < cost) return prev;
      const faction = prev.factions[factionId];
      if (!faction) return prev;

      return {
        ...prev,
        funds: prev.funds - cost,
        factions: {
          ...prev.factions,
          [factionId]: {
            ...faction,
            relations: { ...faction.relations, player: 20 }, // Set to neutral-friendly
            truceUntil: prev.time + duration,
            isVendetta: false
          },
          player: {
            ...prev.factions.player,
            relations: { ...prev.factions.player.relations, [factionId]: 20 }
          }
        }
      };
    });
  }, []);

  const declareVendetta = useCallback((factionId: string) => {
    setState(prev => {
      const faction = prev.factions[factionId];
      if (!faction) return prev;

      return {
        ...prev,
        factions: {
          ...prev.factions,
          [factionId]: {
            ...faction,
            relations: { ...faction.relations, player: -100 },
            isVendetta: true,
            truceUntil: undefined
          },
          player: {
            ...prev.factions.player,
            relations: { ...prev.factions.player.relations, [factionId]: -100 }
          }
        }
      };
    });
  }, []);

  const upgradeUnitSkill = useCallback((unitId: string, skillType: 'accuracy' | 'movement' | 'hp') => {
    setState(prev => {
      const unit = prev.units[unitId];
      if (!unit || !unit.skillPoints || unit.skillPoints <= 0) return prev;

      const newStats = { ...unit.stats };
      if (skillType === 'accuracy') {
        newStats.accuracy = Math.min(100, newStats.accuracy + 5);
      } else if (skillType === 'movement') {
        newStats.speed += 5;
      } else if (skillType === 'hp') {
        newStats.maxHp += 10;
        newStats.hp = Math.min(newStats.hp + 10, newStats.maxHp);
      }

      return {
        ...prev,
        units: {
          ...prev.units,
          [unitId]: {
            ...unit,
            skillPoints: unit.skillPoints - 1,
            stats: newStats
          }
        }
      };
    });
  }, []);

  const trainUnitAttribute = useCallback((unitId: string, attribute: 'hp' | 'accuracy' | 'reactions' | 'strength' | 'speed' | 'stamina' | 'bravery') => {
    setState(prev => {
      const unit = prev.units[unitId];
      if (!unit || !unit.skillPoints || unit.skillPoints <= 0) return prev;

      const newStats = { ...unit.stats };
      if (attribute === 'hp') {
        newStats.maxHp += 15;
        newStats.hp = Math.min(newStats.hp + 15, newStats.maxHp);
      } else if (attribute === 'accuracy') {
        newStats.accuracy = Math.min(100, newStats.accuracy + 5);
      } else if (attribute === 'reactions') {
        newStats.reactions = Math.min(100, newStats.reactions + 5);
      } else if (attribute === 'strength') {
        newStats.strength = Math.min(100, newStats.strength + 5);
      } else if (attribute === 'speed') {
        newStats.speed = Math.min(100, newStats.speed + 5);
      } else if (attribute === 'stamina') {
        newStats.stamina = Math.min(100, newStats.stamina + 5);
      } else if (attribute === 'bravery') {
        newStats.bravery = Math.min(100, newStats.bravery + 5);
      }

      return {
        ...prev,
        units: {
          ...prev.units,
          [unitId]: {
            ...unit,
            skillPoints: unit.skillPoints - 1,
            stats: newStats
          }
        }
      };
    });
  }, []);

  const learnUnitSkill = useCallback((unitId: string, skillId: string) => {
    setState(prev => {
      const unit = prev.units[unitId];
      if (!unit) return prev;

      const skill = SOLDIER_SKILLS[skillId];
      if (!skill) return prev;

      const currentPoints = unit.skillPoints || 0;
      if (currentPoints < skill.cost) return prev;

      const unlocked = unit.unlockedSkills || [];
      if (unlocked.includes(skillId)) return prev;

      const meetsReqs = skill.requirements.every(req => unlocked.includes(req));
      if (!meetsReqs) return prev;

      const newUnlocked = [...unlocked, skillId];
      const newStats = { ...unit.stats };

      if (skill.statModifiers) {
        Object.entries(skill.statModifiers).forEach(([statKey, modVal]) => {
          if (statKey === 'hp') {
            newStats.hp = Math.min(newStats.hp + (modVal as number), newStats.maxHp);
          } else if (statKey === 'maxHp') {
            newStats.maxHp += (modVal as number);
            newStats.hp = Math.min(newStats.hp + (modVal as number), newStats.maxHp);
          } else {
            // @ts-ignore
            newStats[statKey] = Math.min(100, (newStats[statKey] || 0) + (modVal as number));
          }
        });
      }

      return {
        ...prev,
        units: {
          ...prev.units,
          [unitId]: {
            ...unit,
            skillPoints: currentPoints - skill.cost,
            unlockedSkills: newUnlocked,
            stats: newStats
          }
        }
      };
    });
  }, []);

  return (
    <GameContext.Provider value={{ 
      state: hydratedState,
      isGameStarted,
      hasSavedGame,
      continueGame,
      startNewGame,
      advanceTime, startMission, startScout, cancelMission, cancelScout, finishMission, buyItem, startResearch, cancelResearch, setUnitBase,
      startManufacturing, cancelManufacturing, salvageItem, equipItem, hireUnit,
      upgradeUnitSkill, trainUnitAttribute, learnUnitSkill, expandBase, buildNewFloor, repairBase, buildFacility, deconstructFacility,
      buyVehicle, upgradeVehicle, setActiveVehicle, setVehicleBase, manageUnitInventory,
      negotiateTruce, declareVendetta
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
};
