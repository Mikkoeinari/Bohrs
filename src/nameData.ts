/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NameCategory = 'factions' | 'buildings' | 'soldiers';

export interface NameSet {
  prefixes: string[];
  suffixes: string[];
  surnames?: string[];
}

export const NAME_SETS: Record<NameCategory, NameSet> = {
  factions: {
    prefixes: [
      'Ashen', 'Obsidian', 'Pale', 'Vesper', 'Cinder', 'Morrow', 'Sable', 'Gloam',
      'Ruin', 'Noctis', 'Dread', 'Acheron', 'Umbral', 'Wraith', 'Hollow', 'Apex',
      'Crimson', 'Basalt', 'Ferrous', 'Leaden', 'Veiled', 'Fractured', 'Iron', 'Storm',
      'Void', 'Silent', 'Shattered', 'Bleak', 'Requiem', 'Malice', 'Broken', 'Spectral',
    ],
    suffixes: [
      'Doctrine', 'Mandate', 'Covenant', 'Archive', 'Reign', 'Pact', 'Veil', 'Aegis',
      'Tomb', 'Null', 'Vortex', 'Hollow', 'Syndicate', 'Compact', 'Dominion', 'Charter',
      'Front', 'Bureau', 'Cabal', 'Nexus', 'Order', 'Protocol', 'Accord', 'Directive',
      'Enclave', 'Cartel', 'Circuit', 'Assembly', 'Conclave', 'Mechanism', 'Tribunal', 'Faction',
    ],
  },
  buildings: {
    prefixes: [
      'Blackened', 'Glass', 'Iron', 'Frost', 'Ruin', 'Vault', 'Silt', 'Carbon',
      'Lumen', 'Ember', 'Gallows', 'Mire', 'Ashen', 'Ferro', 'Slag', 'Cipher',
      'Dusk', 'Hollow', 'Obsidian', 'Pallid', 'Scorch', 'Vex', 'Cobalt', 'Amber',
      'Rusted', 'Corroded', 'Darkened', 'Smelt', 'Gilded', 'Cracked', 'Leaden', 'Chrome',
    ],
    suffixes: [
      'Spire', 'Foundry', 'Archive', 'Shelter', 'Bastion', 'Chasm', 'Vault', 'Station',
      'Asylum', 'Lattice', 'Monolith', 'Harbor', 'Depot', 'Citadel', 'Sanctum', 'Plex',
      'Tower', 'Block', 'Terminal', 'Hub', 'Compound', 'Annex', 'Facility', 'Complex',
      'Warehouse', 'Precinct', 'Relay', 'Exchange', 'Conduit', 'Barracks', 'Enclave', 'Sector',
    ],
  },
  soldiers: {
    prefixes: [
      'Rook', 'Mire', 'Sable', 'Kestrel', 'Vex', 'Draeven', 'Brass', 'Sorrow',
      'Dusk', 'Raze', 'Gale', 'Thorne', 'Echo', 'Cinder', 'Flint', 'Rime',
      'Cobalt', 'Forge', 'Drift', 'Storm', 'Keen', 'Rust', 'Blaze', 'Ash',
      'Pyre', 'Holt', 'Vance', 'Arlen', 'Mira', 'Cael', 'Zara', 'Dane',
    ],
    suffixes: [
      'Rook', 'Vex', 'Kade', 'Morrow', 'Cipher', 'Ash', 'Null', 'Talon',
      'Rune', 'Shade', 'Vane', 'Harrow', 'Cross', 'Drake', 'Flynn', 'Graves',
      'Holt', 'Knox', 'Marsh', 'Nash', 'Pierce', 'Quinn', 'Raine', 'Steele',
      'Thorne', 'Vale', 'Wyatt', 'York', 'Zane', 'Cole', 'Dray', 'Fenn',
    ],
    surnames: [
      'Ashford', 'Blackwood', 'Carver', 'Drake', 'Ellison', 'Falkner', 'Graves', 'Holloway',
      'Ironside', 'Jansen', 'Kellar', 'Larkin', 'Mercer', 'Novak', 'Orwell', 'Payne',
      'Quade', 'Raines', 'Sterling', 'Talbot', 'Underhill', 'Voss', 'Whitmore', 'Xander',
      'Yates', 'Zarak', 'Brennan', 'Calloway', 'Donovan', 'Erikson', 'Ferrara', 'Garland',
      'Huxley', 'Ingram', 'Jacobs', 'Krauss', 'Lennox', 'Maddox', 'Nolan', 'Owens',
    ],
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
  const set = NAME_SETS['soldiers'];
  const prefixIndex = hashSeed(seed) % set.prefixes.length;
  const suffixIndex = hashSeed(`${seed}:suffix`) % set.suffixes.length;
  const surname = suffixIndex + 1;
  return `${set.prefixes[prefixIndex]} ${surname}`;
}
