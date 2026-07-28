/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FactionType, Item, Technology, Building, Faction, Unit, Vehicle, VehicleUpgrade } from './types';
import { buildBuildingName, buildFactionName, buildSoldierName } from './nameData';

export const INITIAL_FACTIONS: Record<string, Faction> = {
  'player': {
    id: 'player',
    name: buildFactionName('player'),
    type: FactionType.PLAYER,
    color: '#00ff00',
    relations: { 'police': -20, 'corps': 10, 'rivals': -50 },
    funds: 500000,
  },
  'police': {
    id: 'police',
    name: buildFactionName('police'),
    type: FactionType.POLICE,
    color: '#0000ff',
    relations: { 'player': -20 },
    funds: 1000000,
  },
  'rivals': {
    id: 'rivals',
    name: buildFactionName('rivals'),
    type: FactionType.ENEMY_GANG,
    color: '#ff0000',
    relations: { 'player': -50 },
    funds: 20000,
  },
  'corps': {
    id: 'corps',
    name: buildFactionName('corps'),
    type: FactionType.CORPORATION,
    color: '#fbbf24',
    relations: { 'player': 0, 'police': 80 },
    funds: 5000000,
  },
};

// Deterministic seeded PRNG (LCG) for procedural city generation
function makeCityRng(initialSeed: number) {
  let s = initialSeed >>> 0;
  return {
    next(): number {
      s = Math.imul(s, 1664525) + 1013904223 >>> 0;
      return s / 0x100000000;
    },
    intRange(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
  };
}

type BuildingType = 'BASE' | 'WAREHOUSE' | 'FACTORY' | 'CLUB' | 'OFFICE';
type FacilityType = 'EMPTY' | 'COMMAND' | 'LAB' | 'ARMORY' | 'INFIRMARY' | 'QUARTERS' | 'WORKSHOP' | 'POWER' | 'HYDROPONICS' | 'GARAGE';

// Weighted faction selection tables per city zone (col, row in 0-7 range)
function getZoneFaction(col: number, row: number, rng: ReturnType<typeof makeCityRng>): string {
  const roll = rng.next();
  // Player / suburbs zone (top-left quadrant)
  if (col <= 2 && row <= 2) {
    return roll < 0.55 ? 'rivals' : roll < 0.80 ? 'corps' : 'police';
  }
  // Industrial corridor (right half, upper)
  if (col >= 5 && row <= 3) {
    return roll < 0.65 ? 'corps' : roll < 0.85 ? 'rivals' : 'police';
  }
  // Government quarter (center-right, mid-lower)
  if (col >= 4 && row >= 4) {
    return roll < 0.45 ? 'police' : roll < 0.75 ? 'corps' : 'rivals';
  }
  // Underworld district (bottom-left)
  if (col <= 3 && row >= 5) {
    return roll < 0.70 ? 'rivals' : roll < 0.90 ? 'corps' : 'police';
  }
  // Central mixed zone
  return roll < 0.40 ? 'rivals' : roll < 0.70 ? 'corps' : 'police';
}

function getZoneBuildingType(factionId: string, col: number, row: number, rng: ReturnType<typeof makeCityRng>): BuildingType {
  const roll = rng.next();
  if (factionId === 'corps') {
    // Industrial/tech-heavy
    if (col >= 4) return roll < 0.45 ? 'FACTORY' : roll < 0.80 ? 'OFFICE' : 'WAREHOUSE';
    return roll < 0.35 ? 'FACTORY' : roll < 0.65 ? 'OFFICE' : roll < 0.85 ? 'WAREHOUSE' : 'CLUB';
  }
  if (factionId === 'police') {
    return roll < 0.55 ? 'OFFICE' : roll < 0.80 ? 'FACTORY' : 'WAREHOUSE';
  }
  // rivals — street-level, mixed
  if (row <= 2) return roll < 0.45 ? 'WAREHOUSE' : roll < 0.70 ? 'FACTORY' : roll < 0.88 ? 'OFFICE' : 'CLUB';
  return roll < 0.40 ? 'WAREHOUSE' : roll < 0.60 ? 'CLUB' : roll < 0.80 ? 'FACTORY' : 'OFFICE';
}

function getBuildingHealth(type: BuildingType, factionId: string, rng: ReturnType<typeof makeCityRng>): number {
  const base: Record<BuildingType, [number, number]> = {
    BASE:      [800,  1000],
    WAREHOUSE: [150,   600],
    FACTORY:   [300,  1800],
    OFFICE:    [400,  3000],
    CLUB:      [150,   450],
  };
  const [lo, hi] = base[type];
  const hp = rng.intRange(lo, hi);
  // Corp & police buildings tend to be sturdier
  const mult = factionId === 'corps' ? 1.4 : factionId === 'police' ? 1.6 : 1.0;
  return Math.round(hp * mult);
}

function getBuildingFacilities(type: BuildingType, rng: ReturnType<typeof makeCityRng>): FacilityType[] {
  const tables: Record<BuildingType, FacilityType[][]> = {
    BASE:      [['COMMAND', 'ARMORY'], ['ARMORY', 'QUARTERS'], ['COMMAND', 'ARMORY', 'INFIRMARY']],
    WAREHOUSE: [['QUARTERS'], ['WORKSHOP', 'QUARTERS'], ['GARAGE', 'QUARTERS'], ['WORKSHOP']],
    FACTORY:   [['WORKSHOP'], ['WORKSHOP', 'POWER'], ['WORKSHOP', 'POWER', 'HYDROPONICS'], ['LAB', 'POWER']],
    OFFICE:    [['COMMAND'], ['COMMAND', 'QUARTERS'], ['COMMAND', 'LAB'], ['QUARTERS', 'INFIRMARY'], ['COMMAND', 'LAB', 'ARMORY', 'POWER']],
    CLUB:      [['QUARTERS'], ['QUARTERS', 'INFIRMARY'], ['EMPTY']],
  };
  return rng.pick(tables[type]);
}

function generateProceduralBuildings(): Record<string, Building> {
  const rng = makeCityRng(0xB04D5);

  const buildings: Record<string, Building> = {};

  // Special named landmarks (always present at fixed lots)
  buildings['player-hq'] = {
    id: 'player-hq',
    name: buildBuildingName('player-hq'),
    ownerId: 'player',
    x: 1, y: 1, width: 3, height: 3,
    type: 'BASE',
    health: 1000, maxHealth: 1000,
    presetFacilities: ['COMMAND', 'LAB', 'ARMORY', 'INFIRMARY', 'QUARTERS', 'WORKSHOP'],
  };

  buildings['rival-base'] = {
    id: 'rival-base',
    name: buildBuildingName('rival-base'),
    ownerId: 'rivals',
    x: 13, y: 13, width: 3, height: 3,
    type: 'BASE',
    health: 800, maxHealth: 800,
    presetFacilities: ['ARMORY', 'QUARTERS'],
  };

  buildings['city-hall'] = {
    id: 'city-hall',
    name: buildBuildingName('city-hall'),
    ownerId: 'police',
    x: 17, y: 17, width: 3, height: 3,
    type: 'OFFICE',
    health: 5000, maxHealth: 5000,
    presetFacilities: ['COMMAND', 'ARMORY', 'INFIRMARY'],
  };

  buildings['corp-tower'] = {
    id: 'corp-tower',
    name: buildBuildingName('corp-tower'),
    ownerId: 'corps',
    x: 25, y: 17, width: 3, height: 3,
    type: 'OFFICE',
    health: 3000, maxHealth: 3000,
    presetFacilities: ['COMMAND', 'LAB', 'ARMORY', 'POWER'],
  };

  buildings['corp-lab'] = {
    id: 'corp-lab',
    name: buildBuildingName('corp-lab'),
    ownerId: 'corps',
    x: 21, y: 17, width: 3, height: 3,
    type: 'FACTORY',
    health: 2000, maxHealth: 2000,
    presetFacilities: ['LAB', 'WORKSHOP'],
  };

  buildings['police-precinct'] = {
    id: 'police-precinct',
    name: buildBuildingName('police-precinct'),
    ownerId: 'police',
    x: 29, y: 21, width: 3, height: 3,
    type: 'BASE',
    health: 2500, maxHealth: 2500,
    presetFacilities: ['COMMAND', 'ARMORY', 'INFIRMARY', 'QUARTERS'],
  };

  // Lots occupied by special buildings (x,y top-left)
  const reservedLots = new Set([
    '1,1', '13,13', '17,17', '21,17', '25,17', '29,21',
  ]);

  // Grid: 8 columns × 8 rows of 3-cell lots (lot origin = col*4+1, row*4+1)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * 4 + 1;
      const y = row * 4 + 1;
      const lotKey = `${x},${y}`;

      if (reservedLots.has(lotKey)) continue;

      // ~78% of non-reserved lots get a building — outer lots are sparser
      const edgePenalty = (col === 0 || col === 7 || row === 0 || row === 7) ? 0.20 : 0;
      if (rng.next() > 0.78 - edgePenalty) continue;

      const factionId = getZoneFaction(col, row, rng);
      const type = getZoneBuildingType(factionId, col, row, rng);
      const hp = getBuildingHealth(type, factionId, rng);
      const facilities = getBuildingFacilities(type, rng);

      const id = `b-${x}-${y}`;
      buildings[id] = {
        id,
        name: buildBuildingName(id),
        ownerId: factionId,
        x, y,
        width: 3, height: 3,
        type,
        health: hp,
        maxHealth: hp,
        presetFacilities: facilities,
      };
    }
  }

  return buildings;
}

export const INITIAL_BUILDINGS: Record<string, Building> = generateProceduralBuildings();

export const ITEMS: Record<string, Item> = {
  // Raw Raid Materials & Components for Workshop Manufacturing
  'mat_scrap': { id: 'mat_scrap', name: 'Scrap Metal & Alloys', type: 'MATERIAL', weight: 0.2, cost: 30, description: 'Reclaimed industrial metals and structural scrap salvaged from city warehouses and factories.' },
  'mat_circuits': { id: 'mat_circuits', name: 'Electronic Chips & Microcircuits', type: 'MATERIAL', weight: 0.1, cost: 60, description: 'Precision silicon chips, neural bus relays, and logic boards looted from offices and data hubs.' },
  'mat_weapon_parts': { id: 'mat_weapon_parts', name: 'Machined Weapon Components', type: 'MATERIAL', weight: 0.4, cost: 90, description: 'Rifled barrel sleeves, bolt carriers, and receiver housings gathered from armories and gang strongholds.' },
  'mat_chemicals': { id: 'mat_chemicals', name: 'Synth Bio-Chemicals', type: 'MATERIAL', weight: 0.2, cost: 50, description: 'Concentrated medical reagents, stimulants, and explosive precursors from biotechs and clinics.' },
  'mat_nanites': { id: 'mat_nanites', name: 'Carbon Fiber & Nanite Powder', type: 'MATERIAL', weight: 0.1, cost: 120, description: 'High-tech carbon lattice strands and micro-repair nanites harvested from corp labs and plaza vaults.' },

  // Basic Firearm & Equipment Manufacturing Recipes
  'pistol': { id: 'pistol', name: '9mm Handgun', type: 'WEAPON', weight: 2, cost: 200, damage: 25, range: 15, accuracyMod: 0.1, slotSize: 2, recipe: { 'mat_scrap': 3, 'mat_weapon_parts': 2 }, craftTime: 15 },
  'smg': { id: 'smg', name: 'Vector SMG', type: 'WEAPON', weight: 3, cost: 500, damage: 32, range: 10, accuracyMod: 0.05, slotSize: 2, recipe: { 'mat_scrap': 5, 'mat_weapon_parts': 4, 'mat_circuits': 2 }, craftTime: 25 },
  'shotgun': { id: 'shotgun', name: 'Riot Breaker', type: 'WEAPON', weight: 5, cost: 800, damage: 50, range: 6, accuracyMod: -0.1, slotSize: 3, recipe: { 'mat_scrap': 8, 'mat_weapon_parts': 5 }, craftTime: 30 },
  'rifle': { id: 'rifle', name: 'M-40 Assault Rifle', type: 'WEAPON', weight: 4, cost: 1100, damage: 45, range: 18, accuracyMod: 0.15, slotSize: 3, recipe: { 'mat_scrap': 10, 'mat_weapon_parts': 8, 'mat_circuits': 3 }, craftTime: 45 },
  'medkit': { id: 'medkit', name: 'Medi-Patch', type: 'MEDICAL', weight: 1, cost: 150, slotSize: 1, recipe: { 'mat_chemicals': 3 }, craftTime: 10 },
  'trauma_kit': { id: 'trauma_kit', name: 'Trauma Duffle Kit', type: 'MEDICAL', weight: 2, cost: 350, slotSize: 2, recipe: { 'mat_chemicals': 6, 'mat_circuits': 2 }, craftTime: 20 },
  'stim': { id: 'stim', name: 'Neuro-Stim', type: 'MEDICAL', weight: 1, cost: 200, slotSize: 1, recipe: { 'mat_chemicals': 4 }, craftTime: 15 },
  'grenade': { id: 'grenade', name: 'Flash-Bang', type: 'EXPLOSIVE', weight: 2, cost: 300, slotSize: 1, recipe: { 'mat_scrap': 4, 'mat_chemicals': 3 }, craftTime: 15 },

  // Precision & Advanced Weapons Recipes
  'polymer_carbine': { id: 'polymer_carbine', name: 'Lightweight Polymer Carbine', type: 'WEAPON', weight: 2.2, cost: 1250, damage: 38, range: 15, accuracyMod: 0.22, slotSize: 2, weightReduction: 25, description: 'Recoil-dampening polymer frame with high precision burst stabilization.', recipe: { 'mat_scrap': 8, 'mat_weapon_parts': 6, 'mat_circuits': 4, 'mat_nanites': 3 }, craftTime: 50 },
  'precision_rifle': { id: 'precision_rifle', name: 'Match-Grade Designated Marksman', type: 'WEAPON', weight: 3.5, cost: 1800, damage: 70, range: 25, accuracyMod: 0.38, slotSize: 3, description: 'Cryo-treated match-grade rifled barrel providing supreme shot accuracy.', recipe: { 'mat_scrap': 12, 'mat_weapon_parts': 10, 'mat_circuits': 5, 'mat_nanites': 2 }, craftTime: 60 },
  'plasma_smg': { id: 'plasma_smg', name: 'Plasma Arc Submachine', type: 'WEAPON', weight: 2.0, cost: 2400, damage: 58, range: 12, accuracyMod: 0.20, slotSize: 2, description: 'Superheated plasma discharge channels with minimal kinetic recoil.', recipe: { 'mat_scrap': 10, 'mat_weapon_parts': 8, 'mat_circuits': 8, 'mat_nanites': 5 }, craftTime: 75 },
  'magnetic_rail_driver': { id: 'magnetic_rail_driver', name: 'Magnetic Rail Driver', type: 'WEAPON', weight: 3.8, cost: 3800, damage: 98, range: 32, accuracyMod: 0.45, slotSize: 3, description: 'High-velocity magnetic accelerator rifle with pinpoint accuracy.', recipe: { 'mat_scrap': 15, 'mat_weapon_parts': 12, 'mat_circuits': 10, 'mat_nanites': 8 }, craftTime: 90 },

  // Armor & Gear Recipes
  'vest': { id: 'vest', name: 'Kevlar Tactical Vest', type: 'ARMOR', weight: 4, cost: 500, slotsGranted: 4, hpBonus: 20, recipe: { 'mat_scrap': 6, 'mat_nanites': 4 }, craftTime: 20 },
  'exovest': { id: 'exovest', name: 'Exo-Steel Plate', type: 'ARMOR', weight: 8, cost: 1200, slotsGranted: 6, hpBonus: 40, recipe: { 'mat_scrap': 15, 'mat_weapon_parts': 8, 'mat_nanites': 6 }, craftTime: 50 },
  'light_rig': { id: 'light_rig', name: 'Tactical Harness', type: 'ARMOR', weight: 2, cost: 350, slotsGranted: 5, hpBonus: 10, recipe: { 'mat_scrap': 4, 'mat_nanites': 3 }, craftTime: 15 },
  'graphene_rig': { id: 'graphene_rig', name: 'Graphene Weave Chest Rig', type: 'ARMOR', weight: 1.2, cost: 850, slotsGranted: 5, hpBonus: 25, weightReduction: 30, wearResistance: 25, description: 'Ultra-light atom-thin carbon lattice offering supreme weight reduction and durability.', recipe: { 'mat_scrap': 8, 'mat_nanites': 10, 'mat_circuits': 4 }, craftTime: 40 },
  'fluid_impact_vest': { id: 'fluid_impact_vest', name: 'Non-Newtonian Gel Vest', type: 'ARMOR', weight: 2.5, cost: 1100, slotsGranted: 5, hpBonus: 38, wearResistance: 35, description: 'Liquid shear-thickening fluid that instantly hardens upon kinetic impact.', recipe: { 'mat_scrap': 8, 'mat_chemicals': 6, 'mat_nanites': 6 }, craftTime: 45 },
  'titanium_carapace': { id: 'titanium_carapace', name: 'Titanium-Matrix Carapace', type: 'ARMOR', weight: 3.8, cost: 1900, slotsGranted: 6, hpBonus: 55, wearResistance: 45, weightReduction: 20, description: 'High-durability titanium metal matrix providing extreme protection and wear resistance.', recipe: { 'mat_scrap': 18, 'mat_nanites': 10, 'mat_weapon_parts': 4 }, craftTime: 65 },
  'ceramic_plate': { id: 'ceramic_plate', name: 'Ceramic Ablative Plating', type: 'ARMOR', weight: 4.8, cost: 1400, slotsGranted: 4, hpBonus: 65, wearResistance: 50, description: 'Heat-dissipating ceramic tiles engineered for max ballistic stop energy.', recipe: { 'mat_scrap': 12, 'mat_chemicals': 8, 'mat_nanites': 5 }, craftTime: 55 },
  'aerogel_liner': { id: 'aerogel_liner', name: 'Aerogel Thermal Suit', type: 'ARMOR', weight: 0.8, cost: 2200, slotsGranted: 6, hpBonus: 40, weightReduction: 50, wearResistance: 30, description: 'Ultralight aerogel insulation layer eliminating thermal signature and weight.', recipe: { 'mat_scrap': 6, 'mat_nanites': 12, 'mat_chemicals': 6 }, craftTime: 60 },
  'nanotube_exosuit': { id: 'nanotube_exosuit', name: 'Carbon Nanotube Exosuit', type: 'ARMOR', weight: 2.2, cost: 3500, slotsGranted: 8, hpBonus: 80, wearResistance: 65, weightReduction: 45, description: 'Apex nano-structured ballistic exoskeleton with integrated shock dampeners.', recipe: { 'mat_scrap': 25, 'mat_nanites': 20, 'mat_circuits': 12, 'mat_weapon_parts': 10 }, craftTime: 120 },

  // Helmets & Optics Recipes
  'helmet': { id: 'helmet', name: 'Ballistic Helmet', type: 'HEAD', weight: 2, cost: 400, slotsGranted: 2, hpBonus: 15, recipe: { 'mat_scrap': 5, 'mat_nanites': 2 }, craftTime: 15 },
  'visor': { id: 'visor', name: 'Cybernetic Visor', type: 'HEAD', weight: 1, cost: 600, slotsGranted: 1, accuracyMod: 0.15, recipe: { 'mat_scrap': 4, 'mat_circuits': 5 }, craftTime: 25 },
  'comm_band': { id: 'comm_band', name: 'Operator Comm-Band', type: 'HEAD', weight: 1, cost: 300, slotsGranted: 2, recipe: { 'mat_scrap': 3, 'mat_circuits': 3 }, craftTime: 15 },
  'smart_scope': { id: 'smart_scope', name: 'Smart-Link HUD Visor', type: 'HEAD', weight: 0.5, cost: 750, slotsGranted: 2, accuracyMod: 0.28, description: 'Targeting HUD directly pairing weapon optics with neural user vision.', recipe: { 'mat_scrap': 4, 'mat_circuits': 6, 'mat_nanites': 2 }, craftTime: 30 },
  'titanium_helmet': { id: 'titanium_helmet', name: 'Titanium Spec-Ops Helmet', type: 'HEAD', weight: 1.2, cost: 900, slotsGranted: 2, hpBonus: 32, wearResistance: 35, description: 'Hardened titanium-alloy helmet shell designed for long wear resistance.', recipe: { 'mat_scrap': 8, 'mat_nanites': 4, 'mat_weapon_parts': 3 }, craftTime: 35 },
  'gas_mask': { id: 'gas_mask', name: 'Bio-Filter Respirator', type: 'HEAD', weight: 0.6, cost: 450, slotsGranted: 2, hpBonus: 12, wearResistance: 20, recipe: { 'mat_scrap': 3, 'mat_chemicals': 4 }, craftTime: 15 },

  // Trousers & Legs Recipes
  'cargo_pants': { id: 'cargo_pants', name: 'Spec-Ops Cargo Trousers', type: 'LEGS', weight: 2, cost: 300, slotsGranted: 4, recipe: { 'mat_nanites': 4, 'mat_scrap': 2 }, craftTime: 15 },
  'holster_jeans': { id: 'holster_jeans', name: 'Combat Holster Jeans', type: 'LEGS', weight: 2, cost: 450, slotsGranted: 3, accuracyMod: 0.05, recipe: { 'mat_nanites': 5, 'mat_weapon_parts': 3 }, craftTime: 20 },
  'carbon_boots': { id: 'carbon_boots', name: 'Carbon Reinforced Greaves', type: 'LEGS', weight: 1.0, cost: 550, slotsGranted: 3, accuracyMod: 0.08, weightReduction: 20, wearResistance: 30, recipe: { 'mat_scrap': 5, 'mat_nanites': 4, 'mat_circuits': 2 }, craftTime: 20 },

  // Backpacks & Utility Loadouts Recipes
  'light_pouch': { id: 'light_pouch', name: 'Belt Utility Pouch', type: 'BACKPACK', weight: 1, cost: 200, slotsGranted: 4, recipe: { 'mat_nanites': 3, 'mat_scrap': 2 }, craftTime: 10 },
  'tactical_backpack': { id: 'tactical_backpack', name: 'Assault Rucksack', type: 'BACKPACK', weight: 3, cost: 600, slotsGranted: 8, recipe: { 'mat_nanites': 8, 'mat_scrap': 4 }, craftTime: 25 },
  'duffle_bag': { id: 'duffle_bag', name: 'Field Medic Duffle', type: 'BACKPACK', weight: 3, cost: 900, slotsGranted: 12, recipe: { 'mat_nanites': 10, 'mat_scrap': 5, 'mat_chemicals': 3 }, craftTime: 30 },
  'nano_repair_pack': { id: 'nano_repair_pack', name: 'Self-Healing Nano Pack', type: 'BACKPACK', weight: 1.8, cost: 1600, slotsGranted: 10, wearResistance: 50, weightReduction: 25, description: 'Integrated micro-repair bots extending squad equipment lifespan.', recipe: { 'mat_nanites': 12, 'mat_circuits': 8, 'mat_scrap': 6 }, craftTime: 50 },

  // Ordnance Recipes
  'cryo_grenade': { id: 'cryo_grenade', name: 'Cryo-Coolant Canister', type: 'EXPLOSIVE', weight: 1.2, cost: 380, slotSize: 1, damage: 45, recipe: { 'mat_scrap': 5, 'mat_chemicals': 6, 'mat_circuits': 3 }, craftTime: 25 },
  'emp_charge': { id: 'emp_charge', name: 'EMP Shock Ordnance', type: 'EXPLOSIVE', weight: 1.5, cost: 520, slotSize: 1, damage: 65, recipe: { 'mat_scrap': 6, 'mat_circuits': 8, 'mat_nanites': 4 }, craftTime: 30 }
};

export const TECH_TREE: Record<string, Technology> = {
  // Tier 1
  'basic-ballistics': {
    id: 'basic-ballistics',
    name: 'Basic Ballistics',
    description: 'Rapid-fire compact submachine guns and tactical sidearm modifications.',
    cost: 60,
    requirements: [],
    unlocksItems: ['smg'],
    tier: 1,
    category: 'WEAPONS'
  },
  'smart-link-optics': {
    id: 'smart-link-optics',
    name: 'Smart-Link Optics',
    description: 'Neural HUD targeting reticles offering significant accuracy improvements.',
    cost: 70,
    requirements: [],
    unlocksItems: ['smart_scope'],
    tier: 1,
    category: 'WEAPONS'
  },
  'tactical-vests': {
    id: 'tactical-vests',
    name: 'Tactical Ballistics',
    description: 'Kevlar armor weave offering torso defense and extra webbing capacity.',
    cost: 60,
    requirements: [],
    unlocksItems: ['vest'],
    tier: 1,
    category: 'ARMOR'
  },
  'graphene-weaving': {
    id: 'graphene-weaving',
    name: 'Graphene Weave Materials',
    description: 'Atom-thin carbon lattice providing unprecedented weight reduction and structural durability.',
    cost: 80,
    requirements: [],
    unlocksItems: ['graphene_rig', 'carbon_boots'],
    tier: 1,
    category: 'ARMOR'
  },
  'field-medicine': {
    id: 'field-medicine',
    name: 'Field Medicine',
    description: 'Combat dermal patches and neuro-stimulating injectables.',
    cost: 60,
    requirements: [],
    unlocksItems: ['medkit', 'stim'],
    tier: 1,
    category: 'MEDICAL'
  },
  'bio-filtration': {
    id: 'bio-filtration',
    name: 'Bio-Hazard Filtration',
    description: 'Respiratory gas masks and environmental seal suits for toxic combat zones.',
    cost: 65,
    requirements: [],
    unlocksItems: ['gas_mask'],
    tier: 1,
    category: 'MEDICAL'
  },
  'basic-webbing': {
    id: 'basic-webbing',
    name: 'Tactical Harnesses',
    description: 'Modular belt pouches and lightweight load-bearing chest harnesses.',
    cost: 60,
    requirements: [],
    unlocksItems: ['light_pouch', 'light_rig'],
    tier: 1,
    category: 'TACTICAL'
  },

  // Tier 2
  'assault-rifles': {
    id: 'assault-rifles',
    name: 'Assault Carbines',
    description: 'Military-grade select-fire assault rifles for long-range engagements.',
    cost: 120,
    requirements: ['basic-ballistics'],
    unlocksItems: ['rifle'],
    tier: 2,
    category: 'WEAPONS'
  },
  'recoil-dampening': {
    id: 'recoil-dampening',
    name: 'Recoil-Dampening Polymers',
    description: 'Advanced polymer gunstock molds reducing felt recoil and increasing shot group accuracy.',
    cost: 130,
    requirements: ['basic-ballistics', 'smart-link-optics'],
    unlocksItems: ['polymer_carbine'],
    tier: 2,
    category: 'WEAPONS'
  },
  'match-grade-barrels': {
    id: 'match-grade-barrels',
    name: 'Match-Grade Metallurgy',
    description: 'Cryo-treated precision rifle barrels maximizing bullet velocity and extreme range accuracy.',
    cost: 150,
    requirements: ['assault-rifles', 'smart-link-optics'],
    unlocksItems: ['precision_rifle'],
    tier: 2,
    category: 'WEAPONS'
  },
  'heavy-breaching': {
    id: 'heavy-breaching',
    name: 'Heavy Breaching',
    description: 'High-impact 12-gauge tactical shotguns built for room clearing.',
    cost: 120,
    requirements: ['basic-ballistics'],
    unlocksItems: ['shotgun'],
    tier: 2,
    category: 'WEAPONS'
  },
  'reinforced-armor': {
    id: 'reinforced-armor',
    name: 'Reinforced Plating',
    description: 'Hardened ballistic helmets and multi-pocket combat cargo trousers.',
    cost: 120,
    requirements: ['tactical-vests'],
    unlocksItems: ['helmet', 'cargo_pants'],
    tier: 2,
    category: 'ARMOR'
  },
  'liquid-ballistic-gel': {
    id: 'liquid-ballistic-gel',
    name: 'Non-Newtonian Fluid Armor',
    description: 'Shear-thickening fluid gel pads that absorb shock and resist kinetic wear.',
    cost: 140,
    requirements: ['graphene-weaving'],
    unlocksItems: ['fluid_impact_vest'],
    tier: 2,
    category: 'ARMOR'
  },
  'titanium-alloys': {
    id: 'titanium-alloys',
    name: 'Titanium Matrix Alloys',
    description: 'High-strength titanium metal plating engineered for weight reduction and high wear resistance.',
    cost: 160,
    requirements: ['reinforced-armor', 'graphene-weaving'],
    unlocksItems: ['titanium_carapace', 'titanium_helmet'],
    tier: 2,
    category: 'ARMOR'
  },
  'ceramic-ablatives': {
    id: 'ceramic-ablatives',
    name: 'Ceramic Ablative Compounds',
    description: 'Heat-resistant composite tiles capable of stopping heavy armor-piercing rounds.',
    cost: 150,
    requirements: ['reinforced-armor'],
    unlocksItems: ['ceramic_plate'],
    tier: 2,
    category: 'ARMOR'
  },
  'trauma-care': {
    id: 'trauma-care',
    name: 'Advanced Trauma Care',
    description: 'Surgical trauma field packs capable of stabilizing near-fatal injuries.',
    cost: 120,
    requirements: ['field-medicine'],
    unlocksItems: ['trauma_kit'],
    tier: 2,
    category: 'MEDICAL'
  },
  'tactical-demolitions': {
    id: 'tactical-demolitions',
    name: 'Flash & Shock Ordnance',
    description: 'Disorienting tactical flashbangs to blind and shock hostile squads.',
    cost: 120,
    requirements: ['basic-ballistics', 'tactical-vests'],
    unlocksItems: ['grenade'],
    tier: 2,
    category: 'EXPLOSIVE'
  },
  'cryo-coolant-tech': {
    id: 'cryo-coolant-tech',
    name: 'Cryo-Coolant Ordnance',
    description: 'Sub-zero thermal shock charges for incapacitating hostile groups.',
    cost: 140,
    requirements: ['tactical-demolitions', 'bio-filtration'],
    unlocksItems: ['cryo_grenade'],
    tier: 2,
    category: 'EXPLOSIVE'
  },

  // Tier 3
  'plasma-arc-ignition': {
    id: 'plasma-arc-ignition',
    name: 'Plasma Arc Technology',
    description: 'Superheated energy discharge weaponry delivering lethal armor penetration with zero drop.',
    cost: 210,
    requirements: ['match-grade-barrels', 'recoil-dampening'],
    unlocksItems: ['plasma_smg'],
    tier: 3,
    category: 'WEAPONS'
  },
  'exo-frame': {
    id: 'exo-frame',
    name: 'Exo-Steel Mechanics',
    description: 'Hydraulic powered armor plates providing extreme ballistic protection.',
    cost: 200,
    requirements: ['reinforced-armor'],
    unlocksItems: ['exovest'],
    tier: 3,
    category: 'ARMOR'
  },
  'aerogel-insulation': {
    id: 'aerogel-insulation',
    name: 'Aerogel Ultra-Light Composite',
    description: 'Synthesized porous aerogel offering maximum weight reduction with superior insulation.',
    cost: 220,
    requirements: ['titanium-alloys', 'liquid-ballistic-gel'],
    unlocksItems: ['aerogel_liner'],
    tier: 3,
    category: 'ARMOR'
  },
  'cybernetic-optics': {
    id: 'cybernetic-optics',
    name: 'Cybernetic Targeting',
    description: 'Neural-linked HUD visors enhancing targeting speed and weapon accuracy.',
    cost: 200,
    requirements: ['assault-rifles'],
    unlocksItems: ['visor'],
    tier: 3,
    category: 'WEAPONS'
  },
  'heavy-rucksacks': {
    id: 'heavy-rucksacks',
    name: 'Heavy Loadout Rucks',
    description: 'High-capacity assault rucksacks and specialized field medic duffle bags.',
    cost: 180,
    requirements: ['reinforced-armor', 'basic-webbing'],
    unlocksItems: ['tactical_backpack', 'duffle_bag'],
    tier: 3,
    category: 'TACTICAL'
  },
  'self-healing-polymers': {
    id: 'self-healing-polymers',
    name: 'Self-Healing Nanopolymers',
    description: 'Automated micro-repair polymer matrix providing outstanding wear resistance and gear life.',
    cost: 230,
    requirements: ['graphene-weaving', 'heavy-rucksacks'],
    unlocksItems: ['nano_repair_pack'],
    tier: 3,
    category: 'TACTICAL'
  },
  'emp-shock-ordnance': {
    id: 'emp-shock-ordnance',
    name: 'EMP Pulse Shock Ordnance',
    description: 'High-output electromagnetic pulse charges disabling cybernetics and heavy armor.',
    cost: 210,
    requirements: ['cryo-coolant-tech', 'tactical-demolitions'],
    unlocksItems: ['emp_charge'],
    tier: 3,
    category: 'EXPLOSIVE'
  },

  // Tier 4
  'railgun-accelerators': {
    id: 'railgun-accelerators',
    name: 'Magnetic Rail Accelerators',
    description: 'Cutting-edge electromagnetic propulsion systems offering unmatched range and surgical accuracy.',
    cost: 320,
    requirements: ['plasma-arc-ignition', 'cybernetic-optics'],
    unlocksItems: ['magnetic_rail_driver'],
    tier: 4,
    category: 'WEAPONS'
  },
  'nano-composite-plating': {
    id: 'nano-composite-plating',
    name: 'Carbon Nanotube Exosuits',
    description: 'Pinnacle materials science combining massive weight reduction, maximum protection, and top wear resistance.',
    cost: 350,
    requirements: ['aerogel-insulation', 'exo-frame'],
    unlocksItems: ['nanotube_exosuit'],
    tier: 4,
    category: 'ARMOR'
  },
  'specops-integration': {
    id: 'specops-integration',
    name: 'Spec-Ops Network',
    description: 'Encrypted squad operator comm-bands and holster-integrated combat trousers.',
    cost: 280,
    requirements: ['cybernetic-optics', 'heavy-rucksacks'],
    unlocksItems: ['comm_band', 'holster_jeans'],
    tier: 4,
    category: 'TACTICAL'
  }
};

export const VEHICLES: Record<string, Vehicle> = {
  'scouter': {
    id: 'scouter',
    name: 'Black Cycle',
    type: 'SCOUTER',
    stats: { speed: 100, armor: 5, capacity: 1, fuelEfficiency: 1.5 },
    upgrades: [],
    status: 'READY',
    cost: 1500
  },
  'sedan': {
    id: 'sedan',
    name: 'Midnight Cruiser',
    type: 'SEDAN',
    stats: { speed: 70, armor: 15, capacity: 4, fuelEfficiency: 1.0 },
    upgrades: [],
    status: 'READY',
    cost: 5000
  },
  'van': {
    id: 'van',
    name: 'Bullboxer Van',
    type: 'VAN',
    stats: { speed: 50, armor: 25, capacity: 8, fuelEfficiency: 0.7 },
    upgrades: [],
    status: 'READY',
    cost: 8000
  }
};

export const VEHICLE_UPGRADES: Record<string, VehicleUpgrade> = {
  'turbo': { id: 'turbo', name: 'Nitro Injection', description: 'Increases top speed by 20%.', cost: 2000, statModifiers: { speed: 20 } },
  'plating': { id: 'plating', name: 'Reinforced Hull', description: 'Increases armor rating.', cost: 1500, statModifiers: { armor: 10 } },
  'storage': { id: 'storage', name: 'Extra Seating', description: 'Adds 2 more squad slots.', cost: 1200, statModifiers: { capacity: 2 } }
};

export const INITIAL_UNITS: Record<string, Unit> = {
  'u1': {
    id: 'u1',
    name: buildSoldierName('u1'),
    factionId: 'player',
    stats: { hp: 50, maxHp: 50, accuracy: 65, reactions: 45, strength: 40, speed: 60, stamina: 50, bravery: 70 },
    equipment: { 
      handRight: 'pistol', 
      armor: 'vest', 
      head: 'comm_band',
      legs: 'cargo_pants', 
      backpack: 'light_pouch', 
      inventory: ['medkit', 'medkit', 'medkit', 'grenade', 'stim'] 
    },
    location: 'BASE',
    currentBuildingId: 'player-hq',
  },
  'u2': {
    id: 'u2',
    name: buildSoldierName('u2'),
    factionId: 'player',
    stats: { hp: 80, maxHp: 80, accuracy: 45, reactions: 30, strength: 80, speed: 30, stamina: 40, bravery: 90 },
    equipment: { 
      handRight: 'shotgun', 
      armor: 'exovest', 
      head: 'helmet', 
      legs: 'cargo_pants', 
      backpack: 'tactical_backpack', 
      inventory: ['medkit', 'medkit', 'medkit', 'stim', 'grenade'] 
    },
    location: 'BASE',
    currentBuildingId: 'player-hq',
  },
};

export interface SoldierSkillNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  requirements: string[];
  tier: number;
  branch: 'ASSAULT' | 'GUARDIAN' | 'INFILTRATOR';
  statModifiers?: {
    hp?: number;
    maxHp?: number;
    accuracy?: number;
    reactions?: number;
    strength?: number;
    speed?: number;
    stamina?: number;
    bravery?: number;
  };
}

export const SOLDIER_SKILLS: Record<string, SoldierSkillNode> = {
  // --- ASSAULT BRANCH ---
  'point_blank': {
    id: 'point_blank',
    name: 'Point Blank Precision',
    description: 'Increases baseline accuracy (+8%) through intensive tactical training.',
    cost: 1,
    requirements: [],
    tier: 1,
    branch: 'ASSAULT',
    statModifiers: { accuracy: 8 }
  },
  'run_and_gun': {
    id: 'run_and_gun',
    name: 'Run & Gun',
    description: 'Increases speed (+5) and stamina (+5). Special Trait: Enables shooting after high-velocity movement on missions.',
    cost: 1,
    requirements: ['point_blank'],
    tier: 2,
    branch: 'ASSAULT',
    statModifiers: { speed: 5, stamina: 5 }
  },
  'double_tap': {
    id: 'double_tap',
    name: 'Double Tap Trigger',
    description: 'Increases strength (+5) and reactions (+5). Special Trait: Adds a 35% chance to trigger an additional fire burst.',
    cost: 2,
    requirements: ['run_and_gun'],
    tier: 3,
    branch: 'ASSAULT',
    statModifiers: { reactions: 5, strength: 5 }
  },
  'deadeye': {
    id: 'deadeye',
    name: 'Deadeye Criticals',
    description: 'Special Trait: Firearm shots gain a 25% chance to score a Critical Strike, dealing 100% bonus damage.',
    cost: 2,
    requirements: ['double_tap'],
    tier: 4,
    branch: 'ASSAULT',
    statModifiers: { accuracy: 5, bravery: 10 }
  },

  // --- GUARDIAN BRANCH ---
  'fortify': {
    id: 'fortify',
    name: 'Fortify Vitals',
    description: 'Increases maximum health pool (+15 Max HP) and strength (+5).',
    cost: 1,
    requirements: [],
    tier: 1,
    branch: 'GUARDIAN',
    statModifiers: { maxHp: 15, hp: 15, strength: 5 }
  },
  'plated_rigging': {
    id: 'plated_rigging',
    name: 'Plated Rigging',
    description: 'Special Trait: Reduces all incoming damage on tactical missions by 15% through heavy armor optimization.',
    cost: 1,
    requirements: ['fortify'],
    tier: 2,
    branch: 'GUARDIAN',
    statModifiers: { maxHp: 10, hp: 10 }
  },
  'field_medic': {
    id: 'field_medic',
    name: 'Field Medic Specialist',
    description: 'Special Trait: Using medkits heals squadmates and self for 45 HP instead of 25 HP.',
    cost: 2,
    requirements: ['plated_rigging'],
    tier: 3,
    branch: 'GUARDIAN',
    statModifiers: { speed: 5, reactions: 5 }
  },
  'ironclad': {
    id: 'ironclad',
    name: 'Ironclad Bastion',
    description: 'Special Trait: Maximizes defense, reducing all incoming damage by an additional 15% (30% total reduction).',
    cost: 2,
    requirements: ['field_medic'],
    tier: 4,
    branch: 'GUARDIAN',
    statModifiers: { maxHp: 20, hp: 20, bravery: 15 }
  },

  // --- INFILTRATOR BRANCH ---
  'adrenaline_surge': {
    id: 'adrenaline_surge',
    name: 'Adrenaline Synth',
    description: 'Increases combat reactions (+8) and movement speed (+5).',
    cost: 1,
    requirements: [],
    tier: 1,
    branch: 'INFILTRATOR',
    statModifiers: { reactions: 8, speed: 5 }
  },
  'ghost_step': {
    id: 'ghost_step',
    name: 'Ghost Step',
    description: 'Special Trait: Enhances evasion. Increases reaction-shot avoidance and reduces movement noise.',
    cost: 1,
    requirements: ['adrenaline_surge'],
    tier: 2,
    branch: 'INFILTRATOR',
    statModifiers: { speed: 5, stamina: 8 }
  },
  'shadow_strike': {
    id: 'shadow_strike',
    name: 'Shadow Strike',
    description: 'Special Trait: Increases shot precision, dealing 50% extra sneak-attack damage to targets.',
    cost: 2,
    requirements: ['ghost_step'],
    tier: 3,
    branch: 'INFILTRATOR',
    statModifiers: { accuracy: 8, reactions: 5 }
  },
  'time_dilation': {
    id: 'time_dilation',
    name: 'Time Dilation Injector',
    description: 'Special Trait: Grants +4 starting Action Points (AP) on every tactical mission for lightning initiative.',
    cost: 2,
    requirements: ['shadow_strike'],
    tier: 4,
    branch: 'INFILTRATOR',
    statModifiers: { speed: 10, bravery: 10 }
  }
};
