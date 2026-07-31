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

const usedNamesByCategory = new Map<NameCategory, Set<string>>();

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildBaseName(category: NameCategory, seed: string): string {
  const set = NAME_SETS[category];
  if (category === 'soldiers') {
    const prefixIndex = hashSeed(seed) % set.prefixes.length;
    const suffixIndex = hashSeed(`${seed}:suffix`) % set.suffixes.length;
    return `${set.prefixes[prefixIndex]} ${set.suffixes[suffixIndex]}`;
  }

  const prefixIndex = hashSeed(seed) % set.prefixes.length;
  const suffixIndex = (hashSeed(`${seed}:suffix`) + prefixIndex) % set.suffixes.length;
  return `${set.prefixes[prefixIndex]} ${set.suffixes[suffixIndex]}`;
}

function applyIntentionalTypo(name: string, seed: string): string {
  const typoRoll = hashSeed(`${seed}:typo`) % 10;
  if (typoRoll !== 0) {
    return name;
  }

  const typoRules: Array<{ from: string; to: string[] }> = [
    { from: 'c', to: ['k', 's'] },
    { from: 'k', to: ['c'] },
    { from: 's', to: ['c'] },
    { from: 'w', to: ['v'] },
    { from: 'v', to: ['w'] },
    { from: 'i', to: ['y'] },
    { from: 'y', to: ['i'] },
    { from: 'o', to: ['u'] },
    { from: 'u', to: ['o'] },
  ];

  const chars = name.split('');
  const rule = typoRules[hashSeed(`${seed}:typo-rule`) % typoRules.length];
  const positions = chars.reduce<number[]>((matches, char, index) => {
    if (char.toLowerCase() === rule.from) {
      matches.push(index);
    }
    return matches;
  }, []);

  if (positions.length === 0) {
    return name;
  }

  const positionIndex = (hashSeed(`${seed}:typo-position`) + hashSeed(seed)) % positions.length;
  const charIndex = positions[positionIndex];
  const replacement = rule.to[(hashSeed(`${seed}:typo-replacement`) + charIndex) % rule.to.length];
  const isUpperCase = chars[charIndex] === chars[charIndex].toUpperCase();
  chars[charIndex] = isUpperCase ? replacement.toUpperCase() : replacement;
  return chars.join('');
}

function getUsedNames(category: NameCategory): Set<string> {
  const existingNames = usedNamesByCategory.get(category);
  if (existingNames) {
    return existingNames;
  }

  const freshNames = new Set<string>();
  usedNamesByCategory.set(category, freshNames);
  return freshNames;
}

function buildUniqueName(category: NameCategory, seed: string): string {
  const usedNames = getUsedNames(category);

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const attemptSeed = attempt === 0 ? seed : `${seed}:${attempt}`;
    const candidate = applyIntentionalTypo(buildBaseName(category, attemptSeed), attemptSeed);
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }

  let fallbackName = buildBaseName(category, `${seed}:fallback`);
  let suffixNumber = 2;
  while (usedNames.has(fallbackName)) {
    fallbackName = `${buildBaseName(category, `${seed}:fallback:${suffixNumber}`)} ${suffixNumber}`;
    suffixNumber += 1;
  }

  usedNames.add(fallbackName);
  return fallbackName;
}

export function buildNameFromSeed(category: NameCategory, seed: string): string {
  return buildBaseName(category, seed);
}

export function buildFactionName(seed: string): string {
  return `The ${buildUniqueName('factions', seed)}`;
}

export function buildBuildingName(seed: string): string {
  return buildUniqueName('buildings', seed);
}

export function buildSoldierName(seed: string): string {
  return buildUniqueName('soldiers', seed);
}
