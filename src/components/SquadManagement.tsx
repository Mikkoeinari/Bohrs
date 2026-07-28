import React, { useState } from 'react';
import { useGame, getMaxInventorySlots, getUsedInventorySlots, getUnitTotalWeight, getUnitCarryLimit, getUnitEncumbrance } from '../store/GameContext';
import { ITEMS, SOLDIER_SKILLS } from '../data';
import { Unit, ItemId } from '../types';
import { buildSoldierName } from '../nameData';
import { 
  Users, UserPlus, Shield, Crosshair, Zap, 
  Flame, ShieldAlert, Trash2, Coins, Heart, Sparkles, Package,
  Shirt, HardHat, Footprints, Briefcase, PlusCircle, Syringe, Layers, ArrowRightLeft, AlertCircle, Scale, Gauge
} from 'lucide-react';

interface GeneratedRecruit {
  id: string;
  name: string;
  stats: Unit['stats'];
  cost: number;
}

export default function SquadManagement() {
  const { state, equipItem, hireUnit, manageUnitInventory, upgradeUnitSkill, trainUnitAttribute, learnUnitSkill, setUnitBase } = useGame();
  const playerUnits = (Object.values(state.units) as Unit[]).filter(u => u.factionId === 'player');

  function getRankTitle(level: number) {
    if (level >= 6) return 'Apex Predator';
    if (level === 5) return 'Master Commando';
    if (level === 4) return 'Elite Enforcer';
    if (level === 3) return 'Veteran Merc';
    if (level === 2) return 'Operative';
    return 'Rookie Runner';
  }
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    playerUnits.length > 0 ? playerUnits[0].id : null
  );
  const [activeTab, setActiveTab] = useState<'LOADOUT' | 'SKILLS'>('LOADOUT');

  const quartersSectors = state.baseSectors?.filter(s => s.type === 'QUARTERS') ?? [];
  const totalQuartersLevel = quartersSectors.reduce((sum, s) => sum + s.level, 0);
  const maxCrewCapacity = Math.max(4, totalQuartersLevel * 4); 

  // Keep track of available recruits for hire in this session
  const [recruits, setRecruits] = useState<GeneratedRecruit[]>(() => {
    return Array.from({ length: 3 }).map((_, idx) => generateRandomRecruit(idx));
  });

  function generateRandomRecruit(index: number): GeneratedRecruit {
    const name = buildSoldierName(`recruit-${Date.now()}-${index}-${Math.random()}`);
    const hp = Math.floor(Math.random() * 41) + 50; // 50 to 90
    const accuracy = Math.floor(Math.random() * 31) + 45; // 45 to 75
    const reactions = Math.floor(Math.random() * 31) + 30; // 30 to 60
    const strength = Math.floor(Math.random() * 51) + 35; // 35 to 85
    const speed = Math.floor(Math.random() * 41) + 30; // 30 to 70
    const stamina = Math.floor(Math.random() * 41) + 30; // 30 to 70
    const bravery = Math.floor(Math.random() * 41) + 50; // 50 to 90

    const totalStats = hp + accuracy + reactions + strength + speed + stamina + bravery;
    const cost = Math.floor(totalStats * 5.5 + Math.random() * 500);

    return {
      id: `recruit-${Date.now()}-${index}`,
      name,
      stats: { hp, maxHp: hp, accuracy, reactions, strength, speed, stamina, bravery },
      cost,
    };
  }

  const selectedUnit = state.units[selectedUnitId || ''] as Unit | undefined;

  const handleHire = (recruit: GeneratedRecruit) => {
    if (state.funds < recruit.cost) return;
    hireUnit(recruit.name, recruit.stats, recruit.cost);
    setRecruits(prev => prev.filter(r => r.id !== recruit.id).concat(generateRandomRecruit(Date.now())));
    if (!selectedUnitId) {
      setSelectedUnitId(recruit.id);
    }
  };

  // Modular clothing & items filters
  const availableWeapons = Object.entries(state.inventory)
    .filter(([itemId, count]) => (count as number) > 0 && ITEMS[itemId]?.type === 'WEAPON')
    .map(([itemId]) => ITEMS[itemId]);

  const availableArmors = Object.entries(state.inventory)
    .filter(([itemId, count]) => (count as number) > 0 && ITEMS[itemId]?.type === 'ARMOR')
    .map(([itemId]) => ITEMS[itemId]);

  const availableHeads = Object.entries(state.inventory)
    .filter(([itemId, count]) => (count as number) > 0 && ITEMS[itemId]?.type === 'HEAD')
    .map(([itemId]) => ITEMS[itemId]);

  const availableLegs = Object.entries(state.inventory)
    .filter(([itemId, count]) => (count as number) > 0 && ITEMS[itemId]?.type === 'LEGS')
    .map(([itemId]) => ITEMS[itemId]);

  const availableBackpacks = Object.entries(state.inventory)
    .filter(([itemId, count]) => (count as number) > 0 && ITEMS[itemId]?.type === 'BACKPACK')
    .map(([itemId]) => ITEMS[itemId]);

  const availableLoadoutItems = Object.entries(state.inventory)
    .filter(([itemId, count]) => (count as number) > 0 && ITEMS[itemId] && ITEMS[itemId].type !== 'HEAD' && ITEMS[itemId].type !== 'LEGS' && ITEMS[itemId].type !== 'BACKPACK' && ITEMS[itemId].type !== 'ARMOR')
    .map(([itemId]) => ITEMS[itemId]);

  // Quick loadout actions
  const handleFillWithMedkits = (unit: Unit) => {
    let currentUsed = getUsedInventorySlots(unit);
    const maxSlots = getMaxInventorySlots(unit);
    let medkitStock = state.inventory['medkit'] || 0;

    while (medkitStock > 0 && currentUsed + 1 <= maxSlots) {
      manageUnitInventory(unit.id, 'medkit', 'ADD');
      currentUsed += 1;
      medkitStock -= 1;
    }
  };

  const handleClearLoadout = (unit: Unit) => {
    const inv = [...(unit.equipment.inventory || [])];
    inv.forEach(itemId => {
      manageUnitInventory(unit.id, itemId, 'REMOVE');
    });
  };

  return (
    <div className="h-full flex flex-col md:grid md:grid-cols-12 gap-2 p-1 md:p-2 overflow-y-auto md:overflow-hidden bg-high-bg no-scrollbar">
      
      {/* Left Column: Roster & Recruitment Terminal */}
      <div className="flex flex-col gap-2 md:col-span-3 md:overflow-hidden">
        {/* Roster Section */}
        <section className="flex-1 flex flex-col min-h-0 bg-high-sidebar border border-high-border p-2 md:p-3 rounded-sm shadow-sm">
          <div className="text-[11px] text-high-dim font-black uppercase border-b border-high-border pb-2 mb-3 flex justify-between items-center tracking-[0.2em]">
            <span className="flex items-center gap-1.5 text-glow-blue"><Users size={14} className="text-high-primary" /> Squad Roster ({playerUnits.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-[300px] md:max-h-none pr-1">
            {playerUnits.map((unit) => {
              const isSelected = selectedUnitId === unit.id;
              const maxSlots = getMaxInventorySlots(unit);
              const usedSlots = getUsedInventorySlots(unit);
              return (
                <button
                  key={unit.id}
                  onClick={() => setSelectedUnitId(unit.id)}
                  className={`w-full text-left p-2.5 border-2 transition-all duration-150 flex justify-between items-center rounded-sm ${
                    isSelected 
                      ? 'bg-blue-900/20 border-high-primary shadow-[0_0_15px_rgba(96,165,250,0.2)]' 
                      : 'bg-high-card border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="font-black text-[11px] uppercase text-white flex items-center gap-1.5 flex-wrap">
                      <span className={isSelected ? 'text-glow-blue text-high-primary' : ''}>{unit.name}</span>
                      <span className="text-[8px] bg-amber-950/60 border border-amber-500/50 text-amber-300 px-1 py-0.5 font-mono rounded font-black">
                        LVL {unit.level || 1}
                      </span>
                      {Boolean(unit.skillPoints && unit.skillPoints > 0) && (
                        <span className="text-[8px] bg-yellow-500 text-black px-1 py-0.5 font-mono rounded font-black animate-bounce">
                          +{unit.skillPoints} PT
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 font-black uppercase flex flex-wrap gap-2 mt-1">
                      <span className={unit.stats.hp < unit.stats.maxHp ? 'text-high-danger' : 'text-high-success'}>HP: {unit.stats.hp}/{unit.stats.maxHp}</span>
                      <span className="text-blue-300">LOADOUT: {usedSlots}/{maxSlots} SL</span>
                      <span className={getUnitTotalWeight(unit) > getUnitCarryLimit(unit) ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                        WT: {getUnitTotalWeight(unit)}/{getUnitCarryLimit(unit)}KG
                      </span>
                      <span className="text-slate-500 w-full text-[8px] truncate">
                        BASE: {state.buildings[unit.currentBuildingId || 'player-hq']?.name || 'HQ Depot'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Recruitment Section */}
        <section className="h-56 md:h-64 bg-high-sidebar border border-high-border p-2 md:p-3 flex flex-col shrink-0 rounded-sm shadow-sm">
          <div className="text-[11px] text-high-dim font-black uppercase border-b border-high-border pb-2 mb-2 flex justify-between items-center tracking-[0.2em]">
            <span className="flex items-center gap-1.5 text-glow-green"><UserPlus size={14} className="text-high-success" /> Merc Agency</span>
            <span className="text-[9px] text-slate-500 font-mono font-black">
              {playerUnits.length >= maxCrewCapacity ? 'MAX' : `CAP ${playerUnits.length}/${maxCrewCapacity}`}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {recruits.map((recruit) => (
              <div 
                key={recruit.id} 
                className="p-2.5 bg-high-card border-2 border-slate-800 flex justify-between items-center gap-2 hover:border-high-success/60 transition-all rounded-sm shadow-sm group"
              >
                <div>
                  <span className="text-[10px] font-black text-white uppercase tracking-tight group-hover:text-glow-green">{recruit.name}</span>
                  <div className="flex gap-2 text-[8px] font-mono text-slate-500 font-black uppercase mt-0.5">
                    <span className="text-high-success">HP: {recruit.stats.hp}</span>
                    <span>ACC: {recruit.stats.accuracy}%</span>
                  </div>
                </div>
                <button
                  onClick={() => handleHire(recruit)}
                  disabled={state.funds < recruit.cost || playerUnits.length >= maxCrewCapacity}
                  className="px-2.5 py-1.5 bg-green-900/30 hover:bg-green-800/40 disabled:bg-slate-900 disabled:text-slate-600 border border-high-success/50 disabled:border-slate-800 text-high-success text-[9px] font-black uppercase transition-all flex items-center gap-1 rounded-xs"
                >
                  <Coins size={10} /> ₮{recruit.cost}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Center Column: Modular Clothing, Gear & Webbing Loadout Terminal */}
      <div className="flex flex-col gap-2 md:col-span-6 md:overflow-hidden">
        {selectedUnit ? (
          <section className="flex-1 flex flex-col min-h-0 bg-high-sidebar border border-high-border p-2 md:p-3 rounded-sm shadow-md overflow-y-auto custom-scrollbar">
            {/* Header with Unit Info */}
            <div className="text-[11px] text-high-dim font-black uppercase border-b border-high-border pb-2 mb-3 flex items-center justify-between tracking-[0.2em] flex-wrap gap-2">
              <span className="flex items-center gap-2 text-white text-glow-blue">
                <span className="w-2.5 h-2.5 bg-high-primary rounded-full animate-pulse"></span>
                Operative Webbing File: {selectedUnit.name}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">Stationed at:</span>
                  <select
                    value={selectedUnit.currentBuildingId || 'player-hq'}
                    onChange={(e) => setUnitBase(selectedUnit.id, e.target.value)}
                    disabled={selectedUnit.location !== 'BASE'}
                    className="bg-slate-900 text-white font-mono text-[9px] px-1 py-0.5 outline-none border border-slate-700 rounded-sm disabled:opacity-50"
                  >
                    {(Object.values(state.buildings) as any[]).filter(b => b.ownerId === 'player').map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <span className="text-[9px] font-mono text-amber-300 font-black bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">
                  LVL {selectedUnit.level || 1} {getRankTitle(selectedUnit.level || 1).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Tab Switches */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setActiveTab('LOADOUT')}
                className={`py-2 px-3 border text-center font-mono font-black text-[10px] uppercase tracking-wider rounded-xs transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'LOADOUT'
                    ? 'bg-blue-950/40 border-high-primary text-high-primary text-glow-blue shadow-[0_0_10px_rgba(96,165,250,0.15)]'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Shirt size={14} /> Gear & Webbing Loadout
              </button>
              <button
                onClick={() => setActiveTab('SKILLS')}
                className={`py-2 px-3 border text-center font-mono font-black text-[10px] uppercase tracking-wider rounded-xs transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'SKILLS'
                    ? 'bg-yellow-950/40 border-yellow-500 text-yellow-400 text-glow-yellow shadow-[0_0_10px_rgba(234,179,8,0.15)]'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Sparkles size={14} className={selectedUnit.skillPoints && selectedUnit.skillPoints > 0 ? "text-yellow-400 animate-pulse" : ""} />
                Tactical Skill Tree
                {Boolean(selectedUnit.skillPoints && selectedUnit.skillPoints > 0) && (
                  <span className="ml-1 bg-yellow-500 text-black font-black font-mono text-[8px] px-1 py-0.5 rounded animate-bounce">
                    {selectedUnit.skillPoints} PT
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'SKILLS' ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                
                {/* Available Skill Points Indicator */}
                <div className="p-3 bg-slate-950 border-2 border-slate-800 rounded-sm flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase text-white tracking-wide">
                      OPERATIVE PROGRESSION TERMINAL
                    </div>
                    <div className="text-[9px] font-mono text-slate-300 uppercase mt-0.5">
                      Earn skill points by completing tactical combat operations and leveling up.
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded">
                    <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">AVAILABLE POINTS:</span>
                    <span className={`text-sm font-mono font-black ${selectedUnit.skillPoints && selectedUnit.skillPoints > 0 ? 'text-yellow-400 animate-pulse text-glow-yellow' : 'text-slate-400'}`}>
                      {selectedUnit.skillPoints || 0} SP
                    </span>
                  </div>
                </div>

                {/* 1. Core Attribute Training Grid */}
                <div>
                  <div className="text-[10px] text-high-primary font-black uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5 border-b border-high-border pb-1">
                    <Layers size={13} /> Spend Skill Points to Train Core Attributes (+1 SP Each)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {[
                      { key: 'accuracy', label: 'Tactical Accuracy', baseVal: selectedUnit.stats.accuracy, bonusDesc: '+5% Firearm Precision (Max 100%)', icon: <Crosshair size={13} className="text-red-400" /> },
                      { key: 'hp', label: 'Physical Vitality', baseVal: selectedUnit.stats.maxHp, bonusDesc: '+15 Max Health Pool', icon: <Heart size={13} className="text-emerald-400" /> },
                      { key: 'speed', label: 'Reflex Speed', baseVal: selectedUnit.stats.speed, bonusDesc: '+5 Speed (Reduces AP weight penalty)', icon: <Gauge size={13} className="text-cyan-400" /> },
                      { key: 'reactions', label: 'Combat Reactions', baseVal: selectedUnit.stats.reactions, bonusDesc: '+5 Reaction Shot Chance', icon: <Zap size={13} className="text-yellow-400" /> },
                      { key: 'strength', label: 'Physical Strength', baseVal: selectedUnit.stats.strength, bonusDesc: '+5 Strength (Increases carry limit)', icon: <Scale size={13} className="text-purple-400" /> },
                      { key: 'stamina', label: 'Endurance Stamina', baseVal: selectedUnit.stats.stamina, bonusDesc: '+5 Stamina Pool', icon: <Footprints size={13} className="text-orange-400" /> },
                      { key: 'bravery', label: 'Combat Bravery', baseVal: selectedUnit.stats.bravery, bonusDesc: '+5 Bravery Rating (Resists panic)', icon: <Flame size={13} className="text-pink-400" /> },
                    ].map(attr => {
                      const hasPoints = (selectedUnit.skillPoints || 0) > 0;
                      const isMaxAcc = attr.key === 'accuracy' && attr.baseVal >= 100;

                      return (
                        <div key={attr.key} className="p-2 bg-high-card border border-slate-800 rounded-sm flex flex-col justify-between hover:border-slate-700 transition-colors">
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-1 mb-1">
                            <span className="text-[10px] font-black text-white uppercase flex items-center gap-1.5">
                              {attr.icon} {attr.label}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-cyan-400">
                              {attr.baseVal}
                            </span>
                          </div>
                          <div className="text-[8px] text-slate-300 font-mono mb-1.5 leading-tight">
                            {attr.bonusDesc}
                          </div>
                          <button
                            onClick={() => trainUnitAttribute(selectedUnit.id, attr.key as any)}
                            disabled={!hasPoints || isMaxAcc}
                            className={`w-full py-1 text-center font-mono font-bold text-[8px] uppercase tracking-wider border rounded-xs transition-all ${
                              hasPoints && !isMaxAcc
                                ? 'bg-cyan-900/20 hover:bg-cyan-800/40 border-cyan-500/50 text-cyan-300'
                                : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            {isMaxAcc ? 'MAXED' : 'TRAIN (+1 SP)'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Specialized Tactical Class Tree */}
                <div>
                  <div className="text-[10px] text-high-primary font-black uppercase tracking-[0.15em] mb-2.5 flex items-center gap-1.5 border-b border-high-border pb-1">
                    <Sparkles size={13} /> Elite Tactical Perks & Traits Tree
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(['ASSAULT', 'GUARDIAN', 'INFILTRATOR'] as const).map(branch => {
                      // Get all skills for this branch, sorted by tier
                      const branchSkills = Object.values(SOLDIER_SKILLS).filter(s => s.branch === branch);
                      branchSkills.sort((a, b) => a.tier - b.tier);

                      const branchColorMap = {
                        ASSAULT: { border: 'border-red-900/50', headerBg: 'bg-red-950/40', text: 'text-red-400', glow: 'text-glow-red' },
                        GUARDIAN: { border: 'border-emerald-900/50', headerBg: 'bg-emerald-950/40', text: 'text-emerald-400', glow: 'text-glow-emerald' },
                        INFILTRATOR: { border: 'border-cyan-900/50', headerBg: 'bg-cyan-950/40', text: 'text-cyan-400', glow: 'text-glow-cyan' },
                      };

                      const colors = branchColorMap[branch];

                      return (
                        <div key={branch} className={`border ${colors.border} rounded-sm bg-slate-950/40 flex flex-col overflow-hidden`}>
                          {/* Branch Header */}
                          <div className={`p-2 ${colors.headerBg} border-b ${colors.border} text-center`}>
                            <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${colors.text} ${colors.glow}`}>
                              {branch} BRANCH
                            </span>
                          </div>

                          {/* Skills Stack in this branch */}
                          <div className="p-2 space-y-2.5">
                            {branchSkills.map(skill => {
                              const unlockedList = selectedUnit.unlockedSkills || [];
                              const isUnlocked = unlockedList.includes(skill.id);
                              
                              // Requirements check
                              const meetsReqs = skill.requirements.every(req => unlockedList.includes(req));
                              const hasPoints = (selectedUnit.skillPoints || 0) >= skill.cost;
                              const isAvailable = meetsReqs && hasPoints && !isUnlocked;

                              return (
                                <div 
                                  key={skill.id} 
                                  className={`p-2 border rounded-sm transition-all relative ${
                                    isUnlocked 
                                      ? 'bg-slate-900 border-yellow-500/60 shadow-[0_0_8px_rgba(234,179,8,0.1)]' 
                                      : isAvailable 
                                        ? 'bg-slate-950 border-slate-700 hover:border-slate-500' 
                                        : 'bg-slate-950 border-slate-900 opacity-60'
                                  }`}
                                >
                                  {/* Tier & Cost Tag */}
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[7px] font-mono font-bold text-slate-300 uppercase">
                                      TIER {skill.tier}
                                    </span>
                                    <span className={`text-[7px] font-mono font-bold px-1 py-0.5 rounded ${
                                      isUnlocked 
                                        ? 'bg-yellow-950/40 text-yellow-300 border border-yellow-500/30' 
                                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                                    }`}>
                                      {skill.cost} SP COST
                                    </span>
                                  </div>

                                  {/* Skill Name */}
                                  <div className="text-[9px] font-black text-white uppercase tracking-tight flex items-center justify-between">
                                    <span>{skill.name}</span>
                                    {isUnlocked && <span className="text-[8px] font-bold text-yellow-400">UNLOCKED</span>}
                                  </div>

                                  {/* Description */}
                                  <div className="text-[8px] text-slate-200 font-mono mt-1 leading-normal">
                                    {skill.description}
                                  </div>

                                  {/* Requirements warnings if locked */}
                                  {!isUnlocked && skill.requirements.length > 0 && (
                                    <div className="mt-1.5 text-[7px] font-mono uppercase text-slate-500 flex flex-wrap gap-1 items-center">
                                      <span>REQUIRES:</span>
                                      {skill.requirements.map(reqId => {
                                        const reqSkill = SOLDIER_SKILLS[reqId];
                                        const reqMet = unlockedList.includes(reqId);
                                        return (
                                          <span key={reqId} className={reqMet ? 'text-emerald-400' : 'text-red-400 font-bold'}>
                                            {reqSkill?.name || reqId}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Action Button */}
                                  {!isUnlocked && (
                                    <button
                                      onClick={() => learnUnitSkill(selectedUnit.id, skill.id)}
                                      disabled={!isAvailable}
                                      className={`w-full mt-2 py-1 text-center font-mono font-bold text-[8px] uppercase tracking-wider border rounded-xs transition-all ${
                                        isAvailable
                                          ? 'bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-black border-yellow-500/50'
                                          : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed'
                                      }`}
                                    >
                                      {!meetsReqs ? 'LOCKED (REQS)' : !hasPoints ? 'LOCKED (NEED SP)' : 'UNLOCK PERK'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <>
                {/* Modular Loadout Slot Capacity & Weight Encumbrance Bars */}
                {(() => {
                  const maxSlots = getMaxInventorySlots(selectedUnit);
                  const usedSlots = getUsedInventorySlots(selectedUnit);
                  const slotPercent = Math.min(100, Math.round((usedSlots / maxSlots) * 100));

                  const encumbrance = getUnitEncumbrance(selectedUnit);
                  const weightPercent = Math.min(100, Math.round((encumbrance.totalWeight / (encumbrance.carryLimit * 2)) * 100));

                  return (
                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {/* Slot Capacity Meter */}
                      <div className="p-3 bg-slate-950 border-2 border-slate-800 rounded-sm shadow-inner flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-mono font-black uppercase mb-1.5">
                            <span className="flex items-center gap-1.5 text-white">
                              <Layers size={13} className="text-high-primary" /> Webbing Slots
                            </span>
                            <span className={`text-[11px] font-bold ${usedSlots >= maxSlots ? 'text-high-danger' : usedSlots > maxSlots * 0.75 ? 'text-amber-400' : 'text-high-success'}`}>
                              {usedSlots} / {maxSlots} SLOTS
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${usedSlots >= maxSlots ? 'bg-high-danger' : usedSlots > maxSlots * 0.75 ? 'bg-amber-400' : 'bg-high-primary'}`}
                              style={{ width: `${slotPercent}%` }}
                            />
                          </div>
                        </div>
                        {/* Slot Source Breakdown */}
                        <div className="flex flex-wrap gap-1 mt-2 text-[8px] font-mono font-bold uppercase">
                          <span className="bg-slate-900 border border-slate-800 px-1 py-0.5 text-slate-400 rounded">Base Belt: +3</span>
                          {selectedUnit.equipment.armor && (
                            <span className="bg-emerald-950/60 border border-emerald-500/40 px-1 py-0.5 text-emerald-300 rounded">
                              Chest: +{ITEMS[selectedUnit.equipment.armor]?.slotsGranted || 0}
                            </span>
                          )}
                          {selectedUnit.equipment.backpack && (
                            <span className="bg-amber-950/60 border border-amber-500/40 px-1 py-0.5 text-amber-300 rounded">
                              Rucksack: +{ITEMS[selectedUnit.equipment.backpack]?.slotsGranted || 0}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Weight & Movement Encumbrance Meter */}
                      <div className="p-3 bg-slate-950 border-2 border-slate-800 rounded-sm shadow-inner flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-mono font-black uppercase mb-1.5">
                            <span className="flex items-center gap-1.5 text-white">
                              <Scale size={13} className="text-amber-400" /> Gear Weight & Load
                            </span>
                            <span className={`text-[11px] font-bold ${encumbrance.excessWeight > 0 ? 'text-amber-400' : 'text-high-success'}`}>
                              {encumbrance.totalWeight} KG / {encumbrance.carryLimit} KG LIMIT
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${encumbrance.excessWeight > 6 ? 'bg-high-danger' : encumbrance.excessWeight > 0 ? 'bg-amber-400' : 'bg-high-success'}`}
                              style={{ width: `${weightPercent}%` }}
                            />
                          </div>
                        </div>
                        {/* Encumbrance & Movement Cost Impact */}
                        <div className="flex flex-wrap items-center justify-between gap-1 mt-2 text-[8px] font-mono font-bold uppercase">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Gauge size={10} className="text-cyan-400" /> Movement AP Cost:
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-black border ${
                            encumbrance.excessWeight === 0 
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                              : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                          }`}>
                            {encumbrance.movementApCost} AP / TILE {encumbrance.excessWeight > 0 ? `(+${Math.floor(encumbrance.excessWeight / 2)} AP HEAVY PENALTY)` : '(LIGHT)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Modular Clothing & Equipment Grid (Head, Chest, Legs, Backpack, Hands) */}
                <div className="mb-4">
                  <div className="text-[10px] text-high-primary font-black uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5 border-b border-high-border pb-1">
                    <Shirt size={13} /> Worn Clothing & Gear Rig (Grants Webbing Slots)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    
                    {/* 1. HEADGEAR */}
                    <ClothingSlotCard
                      title="Headgear"
                      icon={<HardHat size={14} className="text-blue-400" />}
                      equippedItemId={selectedUnit.equipment.head}
                      availableItems={availableHeads}
                      onEquip={(itemId) => equipItem(selectedUnit.id, itemId, 'head')}
                      onUnequip={() => equipItem(selectedUnit.id, undefined, 'head')}
                      unit={selectedUnit}
                      inventory={state.inventory}
                    />

                    {/* 2. CHEST / ARMOR VEST */}
                    <ClothingSlotCard
                      title="Chest / Vest"
                      icon={<Shield size={14} className="text-emerald-400" />}
                      equippedItemId={selectedUnit.equipment.armor}
                      availableItems={availableArmors}
                      onEquip={(itemId) => equipItem(selectedUnit.id, itemId, 'armor')}
                      onUnequip={() => equipItem(selectedUnit.id, undefined, 'armor')}
                      unit={selectedUnit}
                      inventory={state.inventory}
                    />

                    {/* 3. TROUSERS / LEGS */}
                    <ClothingSlotCard
                      title="Legs / Trousers"
                      icon={<Footprints size={14} className="text-purple-400" />}
                      equippedItemId={selectedUnit.equipment.legs}
                      availableItems={availableLegs}
                      onEquip={(itemId) => equipItem(selectedUnit.id, itemId, 'legs')}
                      onUnequip={() => equipItem(selectedUnit.id, undefined, 'legs')}
                      unit={selectedUnit}
                      inventory={state.inventory}
                    />

                    {/* 4. BACKPACK / WEBBING */}
                    <ClothingSlotCard
                      title="Backpack / Rucksack"
                      icon={<Briefcase size={14} className="text-amber-400" />}
                      equippedItemId={selectedUnit.equipment.backpack}
                      availableItems={availableBackpacks}
                      onEquip={(itemId) => equipItem(selectedUnit.id, itemId, 'backpack')}
                      onUnequip={() => equipItem(selectedUnit.id, undefined, 'backpack')}
                      unit={selectedUnit}
                      inventory={state.inventory}
                    />

                    {/* 5. PRIMARY WEAPON (Right Hand) */}
                    <ClothingSlotCard
                      title="Primary Armament"
                      icon={<Crosshair size={14} className="text-red-400" />}
                      equippedItemId={selectedUnit.equipment.handRight}
                      availableItems={availableWeapons}
                      onEquip={(itemId) => equipItem(selectedUnit.id, itemId, 'handRight')}
                      onUnequip={() => equipItem(selectedUnit.id, undefined, 'handRight')}
                      unit={selectedUnit}
                      inventory={state.inventory}
                    />

                    {/* 6. OFFHAND / AUXILIARY (Left Hand) */}
                    <ClothingSlotCard
                      title="Auxiliary Armament"
                      icon={<Zap size={14} className="text-cyan-400" />}
                      equippedItemId={selectedUnit.equipment.handLeft}
                      availableItems={availableWeapons}
                      onEquip={(itemId) => equipItem(selectedUnit.id, itemId, 'handLeft')}
                      onUnequip={() => equipItem(selectedUnit.id, undefined, 'handLeft')}
                      unit={selectedUnit}
                      inventory={state.inventory}
                    />

                  </div>
                </div>

                {/* Modular Carried Loadout Rack */}
                <div>
                  <div className="flex justify-between items-center text-[10px] text-high-primary font-black uppercase tracking-[0.15em] mb-2 border-b border-high-border pb-1">
                    <span className="flex items-center gap-1.5"><Package size={13} /> Carried Loadout Items (Consumes Capacity Slots)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFillWithMedkits(selectedUnit)}
                        className="px-2 py-0.5 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/60 text-emerald-300 text-[8px] font-mono font-bold uppercase rounded-xs flex items-center gap-1"
                      >
                        <Syringe size={10} /> Pack Medkits
                      </button>
                      <button
                        onClick={() => handleClearLoadout(selectedUnit)}
                        className="px-2 py-0.5 bg-red-900/40 hover:bg-red-800/60 border border-red-500/60 text-red-300 text-[8px] font-mono font-bold uppercase rounded-xs flex items-center gap-1"
                      >
                        <Trash2 size={10} /> Unload All
                      </button>
                    </div>
                  </div>

                  {/* Grid of Currently Carried Loadout Items */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {selectedUnit.equipment.inventory && selectedUnit.equipment.inventory.length > 0 ? (
                      selectedUnit.equipment.inventory.map((itemId, idx) => {
                        const item = ITEMS[itemId];
                        const slotSize = item?.slotSize || 1;
                        return (
                          <div key={`${itemId}-${idx}`} className="p-2 bg-high-card border border-slate-800 rounded-sm flex justify-between items-center">
                            <div>
                              <div className="text-[10px] text-white font-bold uppercase">{item?.name || itemId}</div>
                              <div className="text-[8px] text-slate-500 font-mono uppercase flex gap-2 mt-0.5">
                                <span>{item?.type}</span>
                                <span className="text-amber-400 font-bold">[{slotSize} SL]</span>
                                <span className="text-slate-300 font-bold">[{item?.weight || 1} KG]</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => manageUnitInventory(selectedUnit.id, itemId, 'REMOVE')}
                              className="px-2 py-1 bg-red-950/60 hover:bg-red-800 border border-red-800/80 text-red-300 text-[8px] font-mono font-bold uppercase rounded-xs"
                            >
                              UNSTASH
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[9px] font-mono text-slate-600 italic bg-black/20 p-3 text-center rounded border border-dashed border-slate-800 col-span-2">
                        No loadout items packed in webbing slots. Select items from Base Storage below.
                      </div>
                    )}
                  </div>

                  {/* Add Loadout Items from Base Storage */}
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-sm">
                    <div className="text-[9px] font-mono font-black text-slate-400 uppercase mb-2">Pack Items from Base Storage into Loadout:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                      {availableLoadoutItems.length > 0 ? (
                        availableLoadoutItems.map(item => {
                          const count = state.inventory[item.id] || 0;
                          const slotSize = item.slotSize || 1;
                          const maxSlots = getMaxInventorySlots(selectedUnit);
                          const usedSlots = getUsedInventorySlots(selectedUnit);
                          const canFit = usedSlots + slotSize <= maxSlots;

                          return (
                            <div key={item.id} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-xs">
                              <div>
                                <div className="text-[9px] text-white font-bold uppercase">{item.name}</div>
                                <div className="text-[8px] text-slate-500 font-mono">
                                  STOCK: x{count} | <span className="text-amber-400">COST: {slotSize} SL</span>
                                </div>
                              </div>
                              <button
                                onClick={() => manageUnitInventory(selectedUnit.id, item.id, 'ADD')}
                                disabled={!canFit}
                                className="px-2 py-1 bg-high-primary/20 hover:bg-high-primary disabled:opacity-30 disabled:hover:bg-high-primary/20 border border-high-primary/50 text-high-primary hover:text-white text-[8px] font-mono font-black uppercase rounded-xs"
                              >
                                + PACK
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[8px] text-slate-600 italic font-mono col-span-2 p-2">No suitable supplies or weapons in base storage.</div>
                      )}
                    </div>
                  </div>

                </div>

              </>
            )}
          </section>
        ) : (
          <section className="flex-1 bg-high-sidebar border-2 border-dashed border-slate-700 p-5 flex flex-col items-center justify-center text-center rounded-sm shadow-inner">
            <ShieldAlert size={48} className="text-slate-400 opacity-70 mb-4" />
            <span className="text-[12px] font-mono text-slate-200 font-black uppercase tracking-[0.3em]">No operative selected.</span>
            <span className="text-[10px] font-mono text-slate-300 font-bold uppercase mt-3 tracking-widest">Select a runner from the roster.</span>
          </section>
        )}
      </div>

      {/* Right Column: Base Vault Storage */}
      <div className="flex flex-col gap-2 md:col-span-3 md:overflow-hidden">
        <section className="flex-1 flex flex-col min-h-0 bg-high-sidebar border border-high-border p-2 md:p-3 rounded-sm shadow-md">
          <div className="text-[11px] text-high-dim font-black uppercase border-b border-high-border pb-3 mb-3 flex items-center justify-between tracking-[0.2em]">
            <span className="flex items-center gap-2 text-white">
              <Package size={14} className="text-high-primary" /> Base Vault
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {Object.entries(state.inventory).length > 0 ? (
              Object.entries(state.inventory).map(([itemId, count]) => {
                const item = ITEMS[itemId];
                if (!item || (count as number) <= 0) return null;
                const slotGranted = item.slotsGranted;
                const slotSize = item.slotSize || 1;

                return (
                  <div key={itemId} className="p-2.5 bg-high-card border border-slate-800 rounded-sm flex justify-between items-center group hover:border-slate-600 transition-colors">
                    <div>
                      <div className="text-[10px] font-black text-white uppercase group-hover:text-high-primary transition-colors">{item.name}</div>
                      <div className="text-[8px] font-mono text-slate-300 uppercase flex flex-wrap gap-2">
                        <span>{item.type}</span>
                        <span className="text-amber-300 font-bold">{item.weight || 1} KG</span>
                        {slotGranted ? (
                          <span className="text-emerald-400 font-bold">+{slotGranted} SLOTS</span>
                        ) : (
                          <span className="text-amber-400 font-bold">{slotSize} SL SIZE</span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono font-black text-high-primary bg-blue-900/10 px-2 py-0.5 border border-blue-900/30 rounded">
                      x{count}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-80 py-10">
                <Package size={32} className="mb-2" />
                <span className="text-[9px] font-mono uppercase font-black text-slate-300">Vault Empty</span>
              </div>
            )}
          </div>
          
          <div className="mt-3 pt-2 border-t border-slate-800">
            <div className="flex justify-between text-[9px] font-mono font-black uppercase text-slate-300">
              <span>Total Vault Assets:</span>
              <span className="text-white">{Object.values(state.inventory).reduce((a, b) => (a as number) + (b as number), 0)} Units</span>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}

// Sub-component for individual Clothing & Gear Slot Cards
interface ClothingSlotCardProps {
  title: string;
  icon: React.ReactNode;
  equippedItemId?: string;
  availableItems: any[];
  onEquip: (itemId: string) => void;
  onUnequip: () => void;
  unit: Unit;
  inventory: Record<string, number>;
}

function ClothingSlotCard({
  title,
  icon,
  equippedItemId,
  availableItems,
  onEquip,
  onUnequip,
  unit,
  inventory
}: ClothingSlotCardProps) {
  const item = equippedItemId ? ITEMS[equippedItemId] : null;

  return (
    <div className="p-2.5 bg-high-card border border-slate-800 rounded-sm flex flex-col justify-between gap-1.5 shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 font-black uppercase tracking-wider">
        <span className="flex items-center gap-1.5">{icon} {title}</span>
        {equippedItemId && (
          <button 
            onClick={onUnequip}
            className="text-[8px] font-mono font-black text-red-400 hover:text-white bg-red-950/60 hover:bg-red-800 px-1.5 py-0.5 rounded-xs border border-red-800/60"
          >
            REMOVE
          </button>
        )}
      </div>

      {item ? (
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-xs">
          <span className="text-[10px] font-black text-white uppercase">{item.name}</span>
          <div className="flex gap-1 text-[8px] font-mono font-bold flex-wrap justify-end">
            <span className="bg-amber-950/80 text-amber-300 border border-amber-600/40 px-1.5 py-0.5 rounded">
              {item.weight || 1} KG
            </span>
            {item.slotsGranted && (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                +{item.slotsGranted} SLOTS
              </span>
            )}
            {item.damage && (
              <span className="bg-red-950 text-red-300 border border-red-800/60 px-1.5 py-0.5 rounded">
                PWR: {item.damage}
              </span>
            )}
            {item.hpBonus && (
              <span className="bg-blue-950 text-blue-300 border border-blue-800/60 px-1.5 py-0.5 rounded">
                +{item.hpBonus} HP
              </span>
            )}
          </div>
        </div>
      ) : (
        <div>
          {availableItems.length > 0 ? (
            <select
              onChange={(e) => {
                if (e.target.value) onEquip(e.target.value);
              }}
              defaultValue=""
              className="w-full bg-slate-900 border border-slate-800 p-1.5 text-[9px] text-white font-mono uppercase rounded-xs cursor-pointer focus:outline-none focus:border-high-primary"
            >
              <option value="" disabled>Equip {title}...</option>
              {availableItems.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.weight || 1} kg) {i.slotsGranted ? `(+${i.slotsGranted} Slots)` : ''} (x{inventory[i.id]})
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[8px] font-mono text-slate-300 italic bg-black/20 p-1.5 text-center rounded border border-dashed border-slate-700">
              Empty (None in Vault)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
