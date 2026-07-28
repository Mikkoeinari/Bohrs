/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NameCategory = 'factions' | 'buildings' | 'soldiers';

export interface NameSet {
  prefixes: string[];
  suffixes: string[];
}

export const NAME_SETS: Record<NameCategory, NameSet> = {
  factions: {
    prefixes: ['Ashen', 'Obsidian', 'Pale', 'Vesper', 'Cinder', 'Morrow', 'Sable', 'Gloam', 'Ruin', 'Noctis', 'Dread', 'Acheron'],
    suffixes: ['Doctrine', 'Mandate', 'Covenant', 'Archive', 'Reign', 'Pact', 'Veil', 'Aegis', 'Tomb', 'Null', 'Vortex', 'Hollow'],
  },
  buildings: {
    prefixes: ['Blackened', 'Glass', 'Iron', 'Frost', 'Ruin', 'Vault', 'Silt', 'Carbon', 'Lumen', 'Ember', 'Gallows', 'Mire'],
    suffixes: ['Spire', 'Foundry', 'Archive', 'Shelter', 'Bastion', 'Chasm', 'Vault', 'Station', 'Asylum', 'Lattice', 'Monolith', 'Harbor'],
  },
  soldiers: {
    prefixes: ['Rook', 'Mire', 'Sable', 'Kestrel', 'Vex', 'Draeven', 'Brass', 'Sorrow', 'Dusk', 'Raze', 'Gale', 'Thorne'],
    suffixes: ['Rook', 'Vex', 'Kade', 'Morrow', 'Cipher', 'Ash', 'Null', 'Talon', 'Rune', 'Shade', 'Vane', 'Harrow'],
  },
};

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function buildNameFromSeed(category: NameCategory, seed: string): string {
  const set = NAME_SETS[category];
  const prefixIndex = hashSeed(seed) % set.prefixes.length;
  const suffixIndex = (hashSeed(`${seed}:suffix`) + prefixIndex) % set.suffixes.length;
  return `${set.prefixes[prefixIndex]} ${set.suffixes[suffixIndex]}`;
}

export function buildFactionName(seed: string): string {
  return `The ${buildNameFromSeed('factions', seed)}`;
}

export function buildBuildingName(seed: string): string {
  return buildNameFromSeed('buildings', seed);
}

export function buildSoldierName(seed: string): string {
  return buildNameFromSeed('soldiers', seed);
}
