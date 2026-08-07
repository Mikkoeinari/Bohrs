/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useGame } from '../store/GameContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Package, Home, Shield, Swords, Activity, FlaskConical, Heart, 
  Wrench, Hammer, Plus, Zap, ArrowLeft, Sprout, ShieldAlert,
  Coins, Trash2, ShieldCheck, AlertTriangle, Truck, Handshake, Layers, ArrowUp
} from 'lucide-react';
import SquadManagement from './SquadManagement';
import { ResearchTree } from './ResearchTree';
import Workshop from './Workshop';
import { VehicleManagement } from './VehicleManagement';
import Diplomacy from './Diplomacy';
import { ITEMS, getMarketplaceOffers } from '../data';

// Type definitions for building facilities
const FACILITY_OPTIONS = [
  { 
    type: 'COMMAND' as const, 
    name: 'Command Center', 
    cost: 3000, 
    stress: 10, 
    Icon: Home, 
    color: 'text-high-primary',
    bg: 'bg-high-primary/10',
    border: 'border-high-primary/40',
    desc: 'HQ operational command. Monitors city activity and coordinates gang security.' 
  },
  { 
    type: 'STAIRCASE' as const, 
    name: 'Staircase Access', 
    cost: 5000, 
    stress: 2, 
    Icon: Layers, 
    color: 'text-slate-300', 
    bg: 'bg-slate-300/10', 
    border: 'border-slate-300/40', 
    desc: 'Provides access to the next floor. Requires 1 per new floor built.' 
  },
  { 
    type: 'LAB' as const, 
    name: 'Tech Laboratory', 
    cost: 2500, 
    stress: 8, 
    Icon: FlaskConical, 
    color: 'text-high-warning',
    bg: 'bg-high-warning/10',
    border: 'border-high-warning/40',
    desc: 'Research lab. Speeds up technology development. Multiple labs stack research rates.' 
  },
  { 
    type: 'ARMORY' as const, 
    name: 'Tactical Armory', 
    cost: 2000, 
    stress: 5, 
    Icon: Shield, 
    color: 'text-high-success',
    bg: 'bg-high-success/10',
    border: 'border-high-success/40',
    desc: 'Store heavy gear, increase local building defense rating, and track tactical assets.' 
  },
  { 
    type: 'INFIRMARY' as const, 
    name: 'Med Infirmary', 
    cost: 3000, 
    stress: 6, 
    Icon: Activity, 
    color: 'text-high-danger',
    bg: 'bg-high-danger/10',
    border: 'border-high-danger/40',
    desc: 'Heals wounded rats. Each built bay increases healing speed for base units.' 
  },
  { 
    type: 'QUARTERS' as const, 
    name: 'Crew Quarters', 
    cost: 1500, 
    stress: 4, 
    Icon: Users, 
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/40',
    desc: 'Operatives barracks. Each quarters increases maximum hireable squad roster size by +4.' 
  },
  { 
    type: 'WORKSHOP' as const, 
    name: 'Workshop Bay', 
    cost: 2500, 
    stress: 7, 
    Icon: Swords, 
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
    border: 'border-pink-400/40',
    desc: 'Engineering bay required to manufacture modern weaponry and customized body armors.' 
  },
  { 
    type: 'POWER' as const, 
    name: 'Generator Core', 
    cost: 1800, 
    stress: 5, 
    Icon: Zap, 
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    border: 'border-teal-400/40',
    desc: 'Provides supplemental grid juice, maintaining lights and secondary life-support relays.' 
  },
  { 
    type: 'HYDROPONICS' as const, 
    name: 'Hydroponics Garden', 
    cost: 2000, 
    stress: 5, 
    Icon: Sprout, 
    color: 'text-green-500', 
    bg: 'bg-green-500/10', 
    border: 'border-green-500/40', 
    desc: 'Grow specialized crops to trade. Generates a passive income of ₮4 per minute.' 
  },
  { 
    type: 'GARAGE' as const, 
    name: 'Garage Terminal', 
    cost: 3500, 
    stress: 8, 
    Icon: Truck, 
    color: 'text-orange-400', 
    bg: 'bg-orange-400/10', 
    border: 'border-orange-400/40', 
    desc: 'Fleet management center. Purchase, upgrade, and maintain squad vehicles.' 
  }
];

export default function BaseManagement() {
  const { 
   state, expandBase, buildNewFloor, repairBase, buildFacility, deconstructFacility, equipItem, buyItem 
  } = useGame();

  const [activeBaseView, setActiveBaseView] = useState<'GRID' | 'STAFF' | 'RESEARCH' | 'INFIRMARY' | 'COMMAND' | 'GARAGE' | 'DIPLOMACY' | 'ARMORY'>('GRID');
  const [selectedSectorIdx, setSelectedSectorIdx] = useState<number | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('player-hq');
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);
  const [armoryTab, setArmoryTab] = useState<'INVENTORY' | 'LOADOUTS'>('INVENTORY');
  const [selectedArmoryCategory, setSelectedArmoryCategory] = useState<string>('ALL');
  const [selectedUnitIdForEquip, setSelectedUnitIdForEquip] = useState<string | null>(null);

  const baseSectors = state.baseSectors ?? [];
  const hqSectorsCount = baseSectors.filter(s => !s.buildingId || s.buildingId === 'player-hq').length;
  const conqueredSectorsCount = baseSectors.filter(s => s.buildingId && s.buildingId !== 'player-hq').length;
  
  const playerHQ = state.buildings['player-hq'] || { name: 'HQ Depot', health: 1000, maxHealth: 1000 };
  let targetBuildingIdForStats = selectedBuildingId;
  
  const targetBuildingObj = state.buildings[targetBuildingIdForStats] || playerHQ;
  const integrity = Math.round((targetBuildingObj.health / targetBuildingObj.maxHealth) * 100) || 100;
  
  const currentBuildingSectors = baseSectors.filter(s => (s.buildingId || 'player-hq') === targetBuildingIdForStats);
  const currentFloors = targetBuildingObj.unlockedFloors || 1;
  const maxRooms = currentFloors * 9;
  const needsNewFloor = currentBuildingSectors.length >= maxRooms;
  
  const currentFloorStartIndex = (currentFloors - 1) * 9;
  const currentFloorSectors = currentBuildingSectors.slice(currentFloorStartIndex, currentFloorStartIndex + 9);
  const hasStaircase = currentFloorSectors.some(s => s.type === 'STAIRCASE');

  const playerUnits = Object.values(state.units).filter(u => (u as any).factionId === 'player' && ((u as any).currentBuildingId || 'player-hq') === targetBuildingIdForStats);
  const woundedUnits = playerUnits.filter((u: any) => u.stats.hp < u.stats.maxHp);

  // Dynamic statistics calculations based on constructed sectors
  const labsCount = currentBuildingSectors.filter(s => s.type === 'LAB').length;
  const quartersCount = currentBuildingSectors.filter(s => s.type === 'QUARTERS').length;
  const infirmaryCount = currentBuildingSectors.filter(s => s.type === 'INFIRMARY').length;
  const hydroCount = currentBuildingSectors.filter(s => s.type === 'HYDROPONICS').length;
  const armoryCount = currentBuildingSectors.filter(s => s.type === 'ARMORY').length;
  const generatorCount = currentBuildingSectors.filter(s => s.type === 'POWER').length;

  const maxCrewCap = Math.max(2, quartersCount * 4);
  const passiveIncomeRate = hydroCount * 480; // per hour (₮4 * 60)

  // Navigate to corresponding view from facility click
  const handleSectorClick = (sector: any, idx: number) => {
    setSelectedSectorIdx(idx);
    setBuildMenuOpen(false);
    if (sector.type !== 'EMPTY') {
      handleEnterFacility(sector.type);
    }
  };

  const handleEnterFacility = (type: string) => {
    if (type === 'LAB') {
      setActiveBaseView('RESEARCH');
    } else if (type === 'WORKSHOP') {
      setActiveBaseView('WORKSHOP');
    } else if (type === 'QUARTERS') {
      setActiveBaseView('STAFF');
    } else if (type === 'INFIRMARY') {
      setActiveBaseView('INFIRMARY');
    } else if (type === 'COMMAND') {
      setActiveBaseView('COMMAND');
    } else if (type === 'GARAGE') {
      setActiveBaseView('GARAGE');
    } else if (type === 'ARMORY') {
      setActiveBaseView('ARMORY');
    }
  };

  const selectedSector = selectedSectorIdx !== null ? baseSectors[selectedSectorIdx] : null;

  // Render sub-view with consistent back button
  if (activeBaseView === 'STAFF') {
    return (
      <div className="h-full flex flex-col p-1 md:p-2 bg-high-bg overflow-hidden">
        <div className="bg-high-header border border-high-border px-3 py-2 flex items-center justify-between font-mono shrink-0 mb-1.5 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              id="back-to-hq-staff"
              onClick={() => setActiveBaseView('GRID')} 
              className="flex items-center gap-2 text-[11px] text-high-primary hover:text-white transition-all font-black uppercase tracking-[0.15em] group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-glow-blue">HQ Grid Terminal</span>
            </button>
            {selectedSectorIdx !== null && (
              <button
                id="demolish-facility-staff"
                onClick={() => {
                  deconstructFacility(selectedSectorIdx);
                  setActiveBaseView('GRID');
                  setSelectedSectorIdx(null);
                }}
                className="flex items-center gap-2 text-[10px] text-high-danger hover:bg-high-danger hover:text-white transition-all font-black uppercase px-3 py-1 rounded-sm border border-high-danger/40 bg-high-danger/5 shadow-sm"
              >
                <Trash2 size={12} /> Demolish (-₮500)
              </button>
            )}
          </div>
          <span className="text-[11px] text-high-dim font-black tracking-[0.2em] uppercase hidden sm:block">Crew Barracks Console</span>
        </div>
        <div className="flex-1 min-h-0">
          <SquadManagement />
        </div>
      </div>
    );
  }

  if (activeBaseView === 'RESEARCH') {
    return (
      <div className="h-full flex flex-col p-1 md:p-2 bg-high-bg overflow-hidden">
        <div className="bg-high-header border border-high-border px-3 py-2 flex items-center justify-between font-mono shrink-0 mb-1.5 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              id="back-to-hq-labs"
              onClick={() => setActiveBaseView('GRID')} 
              className="flex items-center gap-2 text-[11px] text-high-primary hover:text-white transition-all font-black uppercase tracking-[0.15em] group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-glow-blue">HQ Grid Terminal</span>
            </button>
            {selectedSectorIdx !== null && (
              <button
                id="demolish-facility-labs"
                onClick={() => {
                  deconstructFacility(selectedSectorIdx);
                  setActiveBaseView('GRID');
                  setSelectedSectorIdx(null);
                }}
                className="flex items-center gap-2 text-[10px] text-high-danger hover:bg-high-danger hover:text-white transition-all font-black uppercase px-3 py-1 rounded-sm border border-high-danger/40 bg-high-danger/5 shadow-sm"
              >
                <Trash2 size={12} /> Demolish (-₮500)
              </button>
            )}
          </div>
          <span className="text-[11px] text-high-warning font-black tracking-[0.2em] uppercase hidden sm:block text-glow-orange">Technical Operations Lab</span>
        </div>
        <div className="flex-1 min-h-0">
          <ResearchTree />
        </div>
      </div>
    );
  }

  if (activeBaseView === 'WORKSHOP') {
    return (
      <div className="h-full min-h-0 flex flex-col p-1 md:p-2 bg-high-bg overflow-hidden">
        <div className="bg-high-header border border-high-border px-3 py-2 flex items-center justify-between font-mono shrink-0 mb-1.5 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              id="back-to-hq-workshop"
              onClick={() => setActiveBaseView('GRID')} 
              className="flex items-center gap-2 text-[11px] text-high-primary hover:text-white transition-all font-black uppercase tracking-[0.15em] group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-glow-blue">HQ Grid Terminal</span>
            </button>
            {selectedSectorIdx !== null && (
              <button
                id="demolish-facility-workshop"
                onClick={() => {
                  deconstructFacility(selectedSectorIdx);
                  setActiveBaseView('GRID');
                  setSelectedSectorIdx(null);
                }}
                className="flex items-center gap-2 text-[10px] text-high-danger hover:bg-high-danger hover:text-white transition-all font-black uppercase px-3 py-1 rounded-sm border border-high-danger/40 bg-high-danger/5 shadow-sm"
              >
                <Trash2 size={12} /> Demolish (-₮500)
              </button>
            )}
          </div>
          <span className="text-[11px] text-pink-400 font-black tracking-[0.2em] uppercase hidden sm:block text-glow-pink">Armaments Workshop Bay</span>
        </div>
        <div className="flex-1 min-h-0">
          <Workshop />
        </div>
      </div>
    );
  }

  if (activeBaseView === 'INFIRMARY') {
    return (
      <div className="h-full flex flex-col p-1 md:p-2 bg-high-bg overflow-hidden">
        <div className="bg-high-header border border-high-border px-3 py-2 flex items-center justify-between font-mono shrink-0 mb-1.5 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              id="back-to-hq-infirmary"
              onClick={() => setActiveBaseView('GRID')} 
              className="flex items-center gap-2 text-[11px] text-high-primary hover:text-white transition-all font-black uppercase tracking-[0.15em] group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-glow-blue">HQ Grid Terminal</span>
            </button>
            {selectedSectorIdx !== null && (
              <button
                id="demolish-facility-infirmary"
                onClick={() => {
                  deconstructFacility(selectedSectorIdx);
                  setActiveBaseView('GRID');
                  setSelectedSectorIdx(null);
                }}
                className="flex items-center gap-2 text-[10px] text-high-danger hover:bg-high-danger hover:text-white transition-all font-black uppercase px-3 py-1 rounded-sm border border-high-danger/40 bg-high-danger/5 shadow-sm"
              >
                <Trash2 size={12} /> Demolish (-₮500)
              </button>
            )}
          </div>
          <span className="text-[11px] text-high-danger font-black tracking-[0.2em] uppercase hidden sm:block text-glow-red">Bio-Recovery Monitors</span>
        </div>

        <div className="flex-1 bg-high-sidebar border border-high-border p-4 overflow-y-auto custom-scrollbar rounded-sm shadow-md">
          <div className="flex items-center gap-3 mb-6 border-b border-high-border pb-4">
            <div className="w-10 h-10 bg-high-danger/10 border-2 border-high-danger/40 flex items-center justify-center rounded-sm">
              <Activity className="text-high-danger text-glow-red" size={20} />
            </div>
            <div>
              <h2 className="text-[14px] font-black uppercase text-white tracking-tight">Nano-Regen Wards</h2>
              <p className="text-[10px] text-high-dim font-black uppercase tracking-widest mt-0.5">Active Bays: {infirmaryCount} | Efficiency Rate: {infirmaryCount}x Base</p>
            </div>
          </div>

          <div className="space-y-3">
            {woundedUnits.length > 0 ? (
              woundedUnits.map((patient: any) => (
                <div key={patient.id} className="p-4 bg-high-card border-2 border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-high-danger/40 transition-all rounded-sm shadow-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-white font-black text-[12px] uppercase tracking-tight group-hover:text-glow-red transition-colors">{patient.name}</span>
                      <span className="text-[8px] bg-red-950/40 border border-high-danger/60 text-high-danger px-2 py-0.5 rounded-sm font-mono font-black tracking-widest animate-pulse">REGENERATING...</span>
                    </div>
                    <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <div className="bg-high-danger h-full rounded-full shadow-[0_0_10px_rgba(248,113,113,0.4)]" style={{ width: `${(patient.stats.hp / patient.stats.maxHp) * 100}%` }} />
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 mt-2 font-black uppercase flex gap-4 tracking-widest">
                      <span>Vitals: {patient.stats.hp} / {patient.stats.maxHp} HP</span>
                      <span className="text-high-success">Recovery: +{infirmaryCount} HP / Interval</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (state.funds >= 400) {
                        state.funds -= 400;
                        patient.stats.hp = Math.min(patient.stats.maxHp, patient.stats.hp + 25);
                        setActiveBaseView('INFIRMARY');
                      }
                    }}
                    disabled={state.funds < 400}
                    className="px-5 py-2.5 text-[10px] font-black uppercase border-2 transition-all shrink-0 rounded-sm shadow-sm active:scale-95 tracking-widest
                      disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800
                      enabled:bg-high-danger/10 enabled:border-high-danger/60 enabled:text-high-danger enabled:hover:bg-high-danger enabled:hover:text-white"
                  >
                    Flash Heal (-₮400)
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-slate-700 rounded-sm">
                <div className="text-slate-300 font-black uppercase text-[12px] tracking-[0.3em] mb-2">No Casualties Detected</div>
                <div className="text-slate-400 font-mono text-[9px] uppercase tracking-widest">All operatives reported in optimal combat condition.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeBaseView === 'COMMAND') {
    return (
      <div className="h-full flex flex-col p-1 md:p-2 bg-high-bg overflow-hidden">
        <div className="bg-high-header border border-high-border px-3 py-2 flex items-center justify-between font-mono shrink-0 mb-1.5 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              id="back-to-hq-command"
              onClick={() => setActiveBaseView('GRID')} 
              className="flex items-center gap-2 text-[11px] text-high-primary hover:text-white transition-all font-black uppercase tracking-[0.15em] group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-glow-blue">HQ Grid Terminal</span>
            </button>
            {selectedSectorIdx !== null && (
              <button
                id="demolish-facility-command"
                onClick={() => {
                  deconstructFacility(selectedSectorIdx);
                  setActiveBaseView('GRID');
                  setSelectedSectorIdx(null);
                }}
                className="flex items-center gap-2 text-[10px] text-high-danger hover:bg-high-danger hover:text-white transition-all font-black uppercase px-3 py-1 rounded-sm border border-high-danger/40 bg-high-danger/5 shadow-sm"
              >
                <Trash2 size={12} /> Demolish (-₮500)
              </button>
            )}
          </div>
          <span className="text-[11px] text-high-primary font-black tracking-[0.2em] uppercase hidden sm:block text-glow-blue">Tactical Operations Command</span>
        </div>

        <div className="flex-1 bg-high-sidebar border border-high-border p-4 overflow-y-auto custom-scrollbar flex flex-col rounded-sm shadow-md">
          <div className="flex items-center gap-3 mb-6 border-b border-high-border pb-4">
            <div className="w-10 h-10 bg-high-primary/10 border-2 border-high-primary/40 flex items-center justify-center rounded-sm">
              <Home className="text-high-primary text-glow-blue" size={20} />
            </div>
            <div>
              <h2 className="text-[14px] font-black uppercase text-white tracking-tight">Central Ops & Intel</h2>
              <p className="text-[10px] text-high-dim font-black uppercase tracking-widest mt-0.5">Security Level: MAXIMUM | Command Grid: ACTIVE</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            <div className="p-4 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm hover:border-high-primary/40 transition-all group">
              <div>
                <h3 className="text-[12px] font-black text-white uppercase mb-2 tracking-tight group-hover:text-glow-blue transition-colors">Signal Sabotage</h3>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  Broadcast corrupted data packets to city enforcement nodes. Resets heat levels and obscures gang signatures in the police mainframe.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    if (state.funds >= 300) {
                      state.funds -= 300;
                      const policeFaction = state.factions['police'];
                      if (policeFaction) {
                        policeFaction.relations['player'] = Math.min(100, (policeFaction.relations['player'] || 0) + 10);
                      }
                      setActiveBaseView('COMMAND');
                    }
                  }}
                  disabled={state.funds < 300}
                  className="w-full py-3 text-[10px] font-black uppercase border-2 transition-all rounded-sm shadow-sm active:scale-95 tracking-[0.2em]
                    disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800
                    enabled:bg-high-primary/10 enabled:border-high-primary/60 enabled:text-high-primary enabled:hover:bg-high-primary enabled:hover:text-white"
                >
                  Sabotage Mainframe (-₮300)
                </button>
              </div>
            </div>

            <div className="p-4 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm hover:border-high-success/40 transition-all group">
              <div>
                <h3 className="text-[12px] font-black text-white uppercase mb-2 tracking-tight group-hover:text-glow-green transition-colors">Gang Decoy Fleet</h3>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  Deploy autonomous decoy drones to rival territories. Confuses enemy intelligence and creates openings for squad maneuvers.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    if (state.funds >= 400) {
                      state.funds -= 400;
                      const rivalFaction = state.factions['rivals'];
                      if (rivalFaction) {
                        rivalFaction.relations['player'] = Math.min(100, (rivalFaction.relations['player'] || 0) + 8);
                      }
                      setActiveBaseView('COMMAND');
                    }
                  }}
                  disabled={state.funds < 400}
                  className="w-full py-3 text-[10px] font-black uppercase border-2 transition-all rounded-sm shadow-sm active:scale-95 tracking-[0.2em]
                    disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800
                    enabled:bg-high-success/10 enabled:border-high-success/60 enabled:text-high-success enabled:hover:bg-high-success enabled:hover:text-white"
                >
                  Deploy Decoys (-₮400)
                </button>
              </div>
            </div>

            {/* Diplomacy Access */}
            <div className="p-4 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm hover:border-high-primary/40 transition-all group md:col-span-2">
              <div>
                <h3 className="text-[12px] font-black text-white uppercase mb-2 tracking-tight group-hover:text-glow-blue transition-colors">Diplomatic Outreach</h3>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  Access the city's diplomatic channels to negotiate truces, declare formal vendettas, and monitor current standing with major factions.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setActiveBaseView('DIPLOMACY')}
                  className="w-full py-3 text-[10px] font-black uppercase border-2 transition-all rounded-sm shadow-sm active:scale-95 tracking-[0.2em]
                    bg-high-primary/10 border-high-primary/60 text-high-primary hover:bg-high-primary hover:text-white flex items-center justify-center gap-2"
                >
                  <Handshake size={14} /> Open Diplomacy Bureau
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeBaseView === 'GARAGE') {
    return (
      <div className="h-full flex flex-col p-1 md:p-2 bg-high-bg overflow-hidden">
        <div className="bg-high-header border border-high-border px-3 py-2 flex items-center justify-between font-mono shrink-0 mb-1.5 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveBaseView('GRID')} 
              className="flex items-center gap-2 text-[11px] text-high-primary hover:text-white transition-all font-black uppercase tracking-[0.15em] group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-glow-blue">HQ Grid Terminal</span>
            </button>
            {selectedSectorIdx !== null && (
              <button
                onClick={() => {
                  deconstructFacility(selectedSectorIdx);
                  setActiveBaseView('GRID');
                  setSelectedSectorIdx(null);
                }}
                className="flex items-center gap-2 text-[10px] text-high-danger hover:bg-high-danger hover:text-white transition-all font-black uppercase px-3 py-1 rounded-sm border border-high-danger/40 bg-high-danger/5 shadow-sm"
              >
                <Trash2 size={12} /> Demolish (-₮500)
              </button>
            )}
          </div>
          <span className="text-[11px] text-orange-400 font-black tracking-[0.2em] uppercase hidden sm:block text-glow-orange">Motor Fleet Management</span>
        </div>
        <div className="flex-1 min-h-0">
          <VehicleManagement />
        </div>
      </div>
    );
  }

  if (activeBaseView === 'DIPLOMACY') {
    return (
      <div className="h-full flex flex-col p-1 md:p-2 bg-high-bg overflow-hidden">
        <div className="bg-high-header border border-high-border px-3 py-2 flex items-center justify-between font-mono shrink-0 mb-1.5 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveBaseView('COMMAND')} 
              className="flex items-center gap-2 text-[11px] text-high-primary hover:text-white transition-all font-black uppercase tracking-[0.15em] group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-glow-blue">Command Operations</span>
            </button>
          </div>
          <span className="text-[11px] text-high-primary font-black tracking-[0.2em] uppercase hidden sm:block text-glow-blue">Foreign Affairs & Diplomacy</span>
        </div>
        <div className="flex-1 min-h-0">
          <Diplomacy />
        </div>
      </div>
    );
  }

  const marketplaceOffers = useMemo(() => (
    activeBaseView === 'ARMORY' ? getMarketplaceOffers(state.factions, state.time) : []
  ), [activeBaseView, state.factions, state.time]);

  if (activeBaseView === 'ARMORY') {
    const inventoryItems = Object.entries(state.inventory || {})
      .map(([id, count]) => {
        const item = (ITEMS as any)[id] || { id, name: id, type: 'MISC', cost: 100 };
        return { ...item, id, count: Number(count) };
      })
      .filter(item => item.count > 0);

    const filteredItems = inventoryItems.filter(item => {
      const typeStr = String(item.type);
      if (selectedArmoryCategory === 'ALL') return true;
      if (selectedArmoryCategory === 'WEAPONS') return typeStr === 'WEAPON' || typeStr === 'EXOTIC_WEAPON';
      if (selectedArmoryCategory === 'ARMOR') return typeStr === 'ARMOR';
      if (selectedArmoryCategory === 'HEAD') return typeStr === 'HEAD';
      if (selectedArmoryCategory === 'LEGS') return typeStr === 'LEGS';
      if (selectedArmoryCategory === 'BACKPACK') return typeStr === 'CONTAINER' || typeStr === 'BACKPACK';
      if (selectedArmoryCategory === 'AMMO') return typeStr === 'AMMO';
      return typeStr === selectedArmoryCategory;
    });

    return (
      <div className="h-full flex flex-col p-1 md:p-2 bg-high-bg overflow-hidden">
        {/* Top Navigation Bar */}
        <div className="bg-high-header border border-high-border px-3 py-2 flex items-center justify-between font-mono shrink-0 mb-1.5 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              id="back-to-hq-armory"
              onClick={() => setActiveBaseView('GRID')} 
              className="flex items-center gap-2 text-[11px] text-high-primary hover:text-white transition-all font-black uppercase tracking-[0.15em] group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> <span className="text-glow-blue">HQ Grid Terminal</span>
            </button>
            {selectedSectorIdx !== null && (
              <button
                id="demolish-facility-armory"
                onClick={() => {
                  deconstructFacility(selectedSectorIdx);
                  setActiveBaseView('GRID');
                  setSelectedSectorIdx(null);
                }}
                className="flex items-center gap-2 text-[10px] text-high-danger hover:bg-high-danger hover:text-white transition-all font-black uppercase px-3 py-1 rounded-sm border border-high-danger/40 bg-high-danger/5 shadow-sm"
              >
                <Trash2 size={12} /> Demolish (-₮500)
              </button>
            )}
          </div>
          <span className="text-[11px] text-emerald-400 font-black tracking-[0.2em] uppercase hidden sm:block text-glow-green">Tactical Armory & Central Vault</span>
        </div>

        {/* Armory Header Banner */}
        <div className="bg-high-sidebar border border-high-border p-3 rounded-sm mb-2 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-sm flex items-center justify-center">
              <Shield size={22} className="text-emerald-400 text-glow-green" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[14px] font-black uppercase text-white tracking-tight">Tactical Armory & Munitions Vault</h1>
                <span className="text-[9px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-sm font-mono font-black tracking-wider uppercase">
                  {armoryCount} {armoryCount === 1 ? 'ARMORY BAY' : 'ARMORY BAYS'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">
                Centralized storage for squad armaments, ballistic vests, tactical gear, and combat munitions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-sm text-right">
              <div className="text-[8px] text-slate-500 font-mono font-bold uppercase">Base Security Rating</div>
              <div className="text-xs font-mono font-black text-emerald-400">+{armoryCount * 25} DEFENSE BONUS</div>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="mb-2 shrink-0 rounded-sm border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono font-black uppercase tracking-[0.25em] text-amber-300">Market Pulse</div>
              <div className="text-[9px] text-slate-400">Faction science filters the stock, while black-market leaks expose advanced weapons with a delay.</div>
            </div>
            <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[9px] font-mono font-black uppercase text-amber-300">
              {marketplaceOffers.length} live offers
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {marketplaceOffers.slice(0, 6).map((offer) => {
              const item = ITEMS[offer.itemId];
              return (
                <div key={offer.id} className="rounded-sm border border-slate-800 bg-high-card/80 p-2.5">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-black uppercase text-white">{item?.name || offer.itemId}</div>
                      <div className="text-[8px] font-mono uppercase tracking-[0.2em]" style={{ color: offer.sourceColor }}>
                        {offer.sourceLabel}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-emerald-300">₮{offer.cost.toLocaleString()}</div>
                      <div className="text-[8px] font-mono uppercase text-slate-500">tier {offer.tier}</div>
                    </div>
                  </div>
                  <div className="mb-2 text-[8.5px] leading-relaxed text-slate-400">{offer.description}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[8px] font-mono uppercase text-slate-500">
                      {offer.kind === 'BLACK_MARKET' ? 'Black market leak' : offer.kind === 'WORLD' ? 'General world stock' : 'Faction stock'}
                    </div>
                    <button
                      onClick={() => buyItem(offer.itemId, 1, offer.cost)}
                      className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[8px] font-mono font-black uppercase text-emerald-300 transition-all hover:bg-emerald-500/20"
                    >
                      Acquire
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 shrink-0 border-b border-high-border pb-1">
          <button
            onClick={() => setArmoryTab('INVENTORY')}
            className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase rounded-sm border transition-all ${
              armoryTab === 'INVENTORY'
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Vault Inventory ({inventoryItems.length} Types)
          </button>
          <button
            onClick={() => setArmoryTab('LOADOUTS')}
            className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase rounded-sm border transition-all ${
              armoryTab === 'LOADOUTS'
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Operative Loadouts Matrix ({playerUnits.length} Units)
          </button>
        </div>

        {/* Content Body */}
        {armoryTab === 'INVENTORY' ? (
          <div className="flex-1 min-h-0 flex flex-col bg-high-sidebar border border-high-border p-3 rounded-sm overflow-hidden">
            {/* Category Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2 shrink-0 border-b border-slate-800">
              {['ALL', 'WEAPONS', 'ARMOR', 'HEAD', 'LEGS', 'BACKPACK', 'AMMO'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedArmoryCategory(cat)}
                  className={`px-2.5 py-1 text-[9px] font-mono font-black uppercase rounded-sm border transition-all whitespace-nowrap ${
                    selectedArmoryCategory === cat
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Item Catalog Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
              {filteredItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {filteredItems.map((item: any) => (
                    <div key={item.id} className="bg-high-card border border-slate-800 hover:border-slate-700 p-3 rounded-sm flex flex-col justify-between shadow-sm">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-black text-xs text-white uppercase">{item.name}</span>
                          <span className="text-[9px] font-mono font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.5 rounded-sm">
                            x{item.count}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-cyan-400 uppercase font-bold mb-1">
                          TYPE: {item.type}
                        </div>
                        <p className="text-[9.5px] text-slate-400 line-clamp-2 italic mb-2">
                          {item.description || 'Standard tactical equipment.'}
                        </p>
                        
                        {/* Stats badges */}
                        <div className="flex flex-wrap gap-1 text-[8.5px] font-mono font-bold text-slate-300 mb-2">
                          {item.damage && <span className="bg-rose-950/60 border border-rose-800/60 text-rose-300 px-1 py-0.5 rounded">DMG: {item.damage}</span>}
                          {item.range && <span className="bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 px-1 py-0.5 rounded">RNG: {item.range}</span>}
                          {item.armorVal && <span className="bg-blue-950/60 border border-blue-800/60 text-blue-300 px-1 py-0.5 rounded">ARMOR: +{item.armorVal}</span>}
                          {item.weight && <span className="bg-slate-800 border border-slate-700 text-slate-300 px-1 py-0.5 rounded">WT: {item.weight}KG</span>}
                        </div>
                      </div>

                      {/* Equip onto Unit Dropdown */}
                      <div className="pt-2 border-t border-slate-800 flex flex-col gap-1">
                        <span className="text-[8px] font-mono uppercase text-slate-500 font-bold">Issue to Operative:</span>
                        <select
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const targetUnit = playerUnits.find((u: any) => u.id === e.target.value) as any;
                            if (targetUnit) {
                              const slot = item.type === 'WEAPON' || item.type === 'EXOTIC_WEAPON' ? 'weapon'
                                : item.type === 'ARMOR' ? 'armor'
                                : item.type === 'HEAD' ? 'head'
                                : item.type === 'LEGS' ? 'legs'
                                : item.type === 'CONTAINER' || item.type === 'BACKPACK' ? 'backpack'
                                : 'weapon';
                              equipItem?.(targetUnit.id, slot, item.id);
                            }
                            e.target.value = '';
                          }}
                          className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[9px] font-mono font-bold p-1 rounded-sm uppercase focus:border-cyan-400 outline-none"
                        >
                          <option value="">-- SELECT OPERATIVE --</option>
                          {playerUnits.map((unit: any) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.name} ({unit.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-sm">
                  <Package size={28} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-[11px] font-mono font-black uppercase text-slate-400">
                    No items found matching the selected filter category
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Operative Loadouts Matrix */
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 bg-high-sidebar border border-high-border rounded-sm">
            <div className="space-y-3">
              {playerUnits.map((unit: any) => {
                const weapon = unit.equipment?.weapon ? ITEMS[unit.equipment.weapon] : null;
                const armor = unit.equipment?.armor ? ITEMS[unit.equipment.armor] : null;
                const head = unit.equipment?.head ? ITEMS[unit.equipment.head] : null;
                const legs = unit.equipment?.legs ? ITEMS[unit.equipment.legs] : null;
                const backpack = unit.equipment?.backpack ? ITEMS[unit.equipment.backpack] : null;

                return (
                  <div key={unit.id} className="p-3 bg-high-card border border-slate-800 rounded-sm flex flex-col md:flex-row justify-between gap-3 hover:border-slate-700 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-sm flex items-center justify-center font-mono font-black text-cyan-400 text-xs uppercase">
                        {unit.role?.[0] || 'O'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-white uppercase">{unit.name}</span>
                          <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                            {unit.role}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 font-bold mt-0.5 flex gap-3">
                          <span>HP: {unit.stats?.hp}/{unit.stats?.maxHp}</span>
                          <span>LEVEL: {unit.stats?.level || 1}</span>
                        </div>
                      </div>
                    </div>

                    {/* Equipment Slots Grid */}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded text-[8.5px] font-mono">
                        <div className="text-slate-500 font-bold uppercase text-[7.5px]">WEAPON</div>
                        <div className="text-cyan-300 font-black truncate">{weapon?.name || 'NONE'}</div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded text-[8.5px] font-mono">
                        <div className="text-slate-500 font-bold uppercase text-[7.5px]">BODY ARMOR</div>
                        <div className="text-blue-300 font-black truncate">{armor?.name || 'NONE'}</div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded text-[8.5px] font-mono">
                        <div className="text-slate-500 font-bold uppercase text-[7.5px]">HELMET</div>
                        <div className="text-amber-300 font-black truncate">{head?.name || 'NONE'}</div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded text-[8.5px] font-mono">
                        <div className="text-slate-500 font-bold uppercase text-[7.5px]">BOOTS / LEGS</div>
                        <div className="text-emerald-300 font-black truncate">{legs?.name || 'NONE'}</div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded text-[8.5px] font-mono">
                        <div className="text-slate-500 font-bold uppercase text-[7.5px]">BACKPACK</div>
                        <div className="text-purple-300 font-black truncate">{backpack?.name || 'NONE'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:grid md:grid-cols-12 gap-2 p-1 md:p-2 overflow-y-auto md:overflow-hidden bg-high-bg no-scrollbar">
      
      {/* LEFT AREA: Grid Layout & Support Beams */}
      <div className="flex flex-col gap-2 md:col-span-8 md:overflow-hidden md:h-full">
        
        {/* Base Grid Section */}
        <section className="flex-1 flex flex-col min-h-0 bg-high-sidebar border border-high-border p-2 md:p-4 rounded-sm shadow-md">
          <div className="text-[11px] text-high-dim font-black uppercase border-b border-high-border pb-3 mb-3 flex flex-wrap items-center justify-between gap-2 shrink-0 tracking-[0.2em]">
            <span className="text-white flex items-center gap-2.5 text-glow-blue">
              <Hammer size={16} className="text-high-primary" /> FACILITY GRID TERMINAL v2.5
            </span>
            <div className="flex gap-3 items-center text-[9px] font-mono">
              <span className="text-blue-400 font-bold">HQ: {hqSectorsCount}</span>
              <span className="text-emerald-400 font-bold">CONQUERED: {conqueredSectorsCount}</span>
              <span className="text-slate-400 font-black">TOTAL: {baseSectors.length}</span>
              <div className="flex gap-2 items-center ml-1">
                <div className="w-3 h-3 bg-high-success rounded-full shadow-[0_0_10px_rgba(74,222,128,0.6)] animate-pulse"></div>
                <div className={`w-3 h-3 rounded-full transition-all duration-300 ${integrity < 40 ? 'bg-high-danger animate-ping shadow-[0_0_15px_rgba(248,113,113,1)]' : integrity < 70 ? 'bg-high-warning shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-slate-800 border border-slate-600'}`}></div>
              </div>
            </div>
          </div>

          {/* Building Selector */}
          <div className="flex gap-1.5 mb-3">
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                setSelectedBuildingId(e.target.value);
                setSelectedSectorIdx(null); // Reset sector selection on building change
              }}
              className="w-full bg-slate-900 text-slate-200 border border-slate-700 py-1.5 px-3 text-[10px] font-mono font-bold uppercase rounded-sm cursor-pointer"
            >
              <option value="player-hq">Subway HQ</option>
              {Object.values(state.buildings)
                .filter((b: any) => b.id !== 'player-hq' && b.ownerId === 'player')
                .map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
          </div>

          <div className="flex-1 bg-black/40 border-2 border-slate-800 relative overflow-y-auto p-3 md:p-4 min-h-[220px] custom-scrollbar rounded-sm shadow-inner">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 w-full">
              {baseSectors
                .map((sector, originalIdx) => ({ ...sector, originalIdx }))
                .filter(s => (s.buildingId || 'player-hq') === selectedBuildingId)
                .map((sector) => {
                const i = sector.originalIdx;
                const isSelected = selectedSectorIdx === i;
                const isWoundedPatients = sector.type === 'INFIRMARY' && woundedUnits.length > 0;
                
                const isConquered = sector.buildingId && sector.buildingId !== 'player-hq';
                const parentBuilding = isConquered ? state.buildings[sector.buildingId!] : null;

                const matchedOption = FACILITY_OPTIONS.find(opt => opt.type === sector.type);
                const Icon = matchedOption?.Icon || Package;
                const color = matchedOption?.color || 'text-slate-600';
                const bg = isSelected ? 'bg-blue-900/20' : matchedOption?.bg || 'bg-slate-900/40';
                const border = isSelected 
                  ? 'border-high-primary shadow-[0_0_15px_rgba(96,165,250,0.3)]' 
                  : isWoundedPatients 
                    ? 'border-high-danger/60 bg-red-900/10' 
                    : isConquered
                      ? 'border-emerald-800/60 hover:border-emerald-500/80'
                      : 'border-slate-800 hover:border-slate-600';

                return (
                  <button 
                    key={sector.id}
                    id={`sector-grid-item-${i}`}
                    onClick={() => handleSectorClick(sector, i)}
                    className={`h-28 md:h-32 text-left p-3 border-2 ${bg} ${border} transition-all duration-200 flex flex-col justify-between group overflow-hidden rounded-sm relative`}
                  >
                    {/* Visual Glitch/Scanline effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"></div>
                    
                    <div className="flex justify-between items-start w-full relative z-10 gap-1">
                      <Icon size={18} className={`${color} ${isWoundedPatients ? 'animate-pulse' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'} transition-all shrink-0`} />
                      <span className={`text-[7.5px] font-mono font-black uppercase tracking-tight px-1.5 py-0.5 rounded border truncate ${isConquered ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-[0_0_6px_rgba(16,185,129,0.2)]' : 'bg-blue-950/60 text-blue-300 border-blue-800/40'}`}>
                        {isConquered ? `★ ${parentBuilding?.name || 'CONQUERED'}` : `SEC-0${i+1}`}
                      </span>
                    </div>

                    <div className="relative z-10">
                      <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-tight group-hover:text-white transition-colors truncate">{sector.name}</h4>
                      <p className="text-[8px] font-mono text-slate-500 font-black uppercase mt-1 tracking-widest flex items-center gap-1.5">
                        {sector.type === 'EMPTY' && (
                          <span className="text-high-dim flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity"><Plus size={10} /> INACTIVE SLOT</span>
                        )}
                        {sector.type === 'QUARTERS' && (
                          <span className="text-purple-400">LOAD: {playerUnits.length}/{maxCrewCap}</span>
                        )}
                        {sector.type === 'LAB' && (
                          <span className="text-high-warning">ANALYSIS: +10%</span>
                        )}
                        {sector.type === 'INFIRMARY' && (
                          isWoundedPatients ? (
                            <span className="text-high-danger font-black animate-pulse text-glow-red">{woundedUnits.length} CRITICAL</span>
                          ) : (
                            <span className="text-slate-600">STASIS IDLE</span>
                          )
                        )}
                        {sector.type === 'HYDROPONICS' && (
                          <span className="text-high-success">YIELD: +₮240</span>
                        )}
                        {sector.type === 'POWER' && (
                          <span className="text-teal-400">GRID: NOMINAL</span>
                        )}
                        {sector.type === 'ARMORY' && (
                          <span className="text-high-success">DEF: SECURED</span>
                        )}
                        {sector.type === 'COMMAND' && (
                          <span className="text-high-primary">RADAR: ACTIVE</span>
                        )}
                        {sector.type === 'GARAGE' && (
                          <span className="text-orange-400">FLEET: READY</span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Structural Integrity & Expand Base Control Panel */}
        <section className="bg-high-sidebar border border-high-border p-3 md:p-4 rounded-sm shadow-md shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Structural Integrity Metric */}
            <div className="p-3 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm group hover:border-slate-700 transition-colors">
              <div>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Structural Hull Integrity</div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-[20px] font-mono font-black ${integrity < 40 ? 'text-high-danger text-glow-red animate-pulse' : integrity < 70 ? 'text-high-warning text-glow-orange' : 'text-high-success text-glow-green'}`}>
                    {integrity}%
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 font-bold uppercase">Strength Rating</span>
                </div>
              </div>
              
              <div className="w-full bg-black/40 h-2 mt-3 rounded-full overflow-hidden p-0.5 border border-slate-900">
                <div 
                  className={`h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${integrity < 40 ? 'bg-high-danger shadow-[0_0_8px_rgba(248,113,113,0.4)]' : integrity < 70 ? 'bg-high-warning shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'bg-high-success shadow-[0_0_8px_rgba(74,222,128,0.3)]'}`} 
                  style={{ width: `${integrity}%` }} 
                />
              </div>
            </div>

            {/* Reinforce supports */}
            <div className="p-3 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm group hover:border-slate-700 transition-colors">
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 block">Hull Maintenance</span>
                <p className="text-[10px] text-slate-400 font-bold leading-tight">Authorize structural repairs to the facility foundations.</p>
              </div>
              <button
                id="reinforce-supports-btn"
                disabled={state.funds < 1000 || integrity >= 100}
                onClick={() => repairBase(1000, targetBuildingIdForStats)}
                className="w-full py-2 text-[10px] font-black uppercase transition-all mt-3 tracking-[0.15em] border-2 rounded-sm shadow-sm active:scale-95
                  disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800
                  enabled:bg-high-success/10 enabled:border-high-success/60 enabled:text-high-success enabled:hover:bg-high-success enabled:hover:text-white"
              >
                REINFORCE (-₮1,000)
              </button>
            </div>

            {/* Clear / Expand base */}
            <div className="p-3 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm group hover:border-slate-700 transition-colors">
              {needsNewFloor ? (
                <>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 block">Build New Floor</span>
                    <p className="text-[10px] text-slate-400 font-bold leading-tight">Floor is full. Build a new floor (requires a Staircase facility).</p>
                  </div>
                  <button
                    id="build-floor-btn"
                    disabled={state.funds < 20000 || !hasStaircase}
                    onClick={() => {
                      buildNewFloor(targetBuildingIdForStats);
                    }}
                    className="w-full py-2 text-[10px] font-black uppercase transition-all mt-3 tracking-[0.15em] border-2 rounded-sm shadow-sm active:scale-95
                      disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800
                      enabled:bg-amber-500/10 enabled:border-amber-500/60 enabled:text-amber-500 enabled:hover:bg-amber-500 enabled:hover:text-white"
                  >
                    BUILD FLOOR (-₮20,000)
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 block">Clear Room</span>
                    <p className="text-[10px] text-slate-400 font-bold leading-tight">Clear space to create new facility slots.</p>
                  </div>
                  <button
                    id="excavate-sector-btn"
                    disabled={state.funds < 4000}
                    onClick={() => {
                      expandBase(targetBuildingIdForStats);
                    }}
                    className="w-full py-2 text-[10px] font-black uppercase transition-all mt-3 tracking-[0.15em] border-2 rounded-sm shadow-sm active:scale-95
                      disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800
                      enabled:bg-high-primary/10 enabled:border-high-primary/60 enabled:text-high-primary enabled:hover:bg-high-primary enabled:hover:text-white"
                  >
                    CLEAR ROOM (-₮4,000)
                  </button>
                </>
              )}
            </div>

          </div>
        </section>

      </div>

      {/* RIGHT AREA: Sector Inspector / Build Facility Panel */}
      <div className="flex flex-col gap-2 md:col-span-4 md:overflow-hidden md:h-full">
        
        {/* Active Inspection Screen */}
        <section className="flex-1 bg-high-sidebar border border-high-border p-3 md:p-4 flex flex-col min-h-0 rounded-sm shadow-md">
          <div className="text-[11px] text-high-dim font-black uppercase border-b border-high-border pb-3 mb-4 flex justify-between shrink-0 tracking-[0.2em]">
            <span>Sector Inspection</span>
            <span className="text-high-primary text-glow-blue animate-pulse">RADAR.v4</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
            {selectedSectorIdx !== null && selectedSector ? (
              <div className="space-y-4">
                <div className="p-4 bg-high-card border-2 border-slate-800 rounded-sm shadow-sm relative overflow-hidden group">
                  {/* Decorative background element */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-high-primary/5 -mr-12 -mt-12 rounded-full blur-2xl"></div>
                  
                  <div className="text-[9px] font-mono text-slate-500 font-black uppercase tracking-[0.2em] mb-1">MODULE: GRID SECTOR 0{selectedSectorIdx + 1}</div>
                  <h3 className="text-[16px] font-black text-white uppercase tracking-tight group-hover:text-glow-blue transition-colors">{selectedSector.name}</h3>
                  <div className="mt-2.5">
                    <span className="text-[9px] font-mono font-black px-3 py-1 rounded-sm bg-slate-800 border border-slate-700 text-high-primary uppercase tracking-widest shadow-sm">
                      {selectedSector.type} UNIT
                    </span>
                  </div>

                  {selectedSector.type !== 'EMPTY' && (
                    <div className="mt-6 flex flex-col gap-2 pt-4 border-t border-slate-800">
                      <button
                        onClick={() => handleEnterFacility(selectedSector.type)}
                        className="w-full py-3 bg-high-primary/10 border-2 border-high-primary/60 text-high-primary text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 rounded-sm shadow-sm hover:bg-high-primary hover:text-white active:scale-95 tracking-[0.15em]"
                      >
                        <Zap size={14} /> Open Facility Console
                      </button>
                      <button
                        id="demolish-facility-btn"
                        onClick={() => {
                          deconstructFacility(selectedSectorIdx);
                          setSelectedSectorIdx(null);
                        }}
                        className="w-full py-2.5 bg-high-danger/5 border-2 border-high-danger/40 text-high-danger text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 rounded-sm shadow-sm hover:bg-high-danger hover:text-white active:scale-95 tracking-[0.1em]"
                      >
                        <Trash2 size={12} /> Demolish Module (-₮500)
                      </button>
                    </div>
                  )}
                </div>

                {/* If selected sector is EMPTY, show build options! */}
                {selectedSector.type === 'EMPTY' && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-high-warning uppercase tracking-[0.15em] flex items-center gap-2 border-b border-high-border pb-3 text-glow-orange">
                      <Plus size={14} /> Available Facility Modules
                    </div>
                    
                    <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                      {FACILITY_OPTIONS.map((opt) => {
                        const canAfford = state.funds >= opt.cost;
                        return (
                          <div 
                            key={opt.type} 
                            className={`p-3.5 border-2 transition-all rounded-sm shadow-sm group ${
                              canAfford 
                                ? 'bg-high-card border-slate-800 hover:border-high-primary/40' 
                                : 'bg-slate-900 border-slate-900 opacity-40 grayscale pointer-events-none'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1.5">
                              <div className="flex items-center gap-2.5 font-black text-[12px] text-white uppercase tracking-tight group-hover:text-glow-blue transition-colors">
                                <opt.Icon size={14} className={opt.color} />
                                <span>{opt.name}</span>
                              </div>
                              <span className={`text-[11px] font-mono font-black ${canAfford ? 'text-high-success text-glow-green' : 'text-high-danger'}`}>
                                ₮{opt.cost.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 font-bold leading-snug mb-3">{opt.desc}</p>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                              <span className="text-[8px] font-mono text-high-danger font-black uppercase tracking-tighter">STRESS: -{opt.stress}% INTEG</span>
                              <button
                                id={`build-btn-${opt.type}`}
                                disabled={!canAfford}
                                onClick={() => {
                                  buildFacility(selectedSectorIdx, opt.type);
                                  setSelectedSectorIdx(null);
                                }}
                                className="px-5 py-2 text-[10px] font-black uppercase border-2 transition-all rounded-sm shadow-sm active:scale-95 tracking-widest
                                  bg-high-warning/10 border-high-warning/60 text-high-warning hover:bg-high-warning hover:text-white"
                              >
                                Deploy
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-700 rounded-sm">
                <Wrench size={40} className="mb-4 text-slate-400 opacity-60" />
                <p className="text-[12px] uppercase tracking-[0.3em] text-slate-200 font-black mb-2">No Active Sensor Feed</p>
                <p className="text-[10px] text-slate-300 font-mono uppercase tracking-widest leading-relaxed">Select a grid sector to initialize modular deployment or inspection.</p>
              </div>
            )}
          </div>
        </section>

        {/* Dynamic Base Operations Overview */}
        <section className="h-48 bg-high-sidebar border border-high-border p-3 md:p-4 flex flex-col shrink-0 rounded-sm shadow-md">
          <div className="text-[11px] text-high-dim font-black uppercase border-b border-high-border pb-3 mb-4 tracking-[0.2em]">
            Operational Intelligence
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2">
            <div className="p-2 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm hover:border-slate-700 transition-colors">
              <span className="text-slate-400 uppercase text-[8px] font-black tracking-widest">Research Rate</span>
              <div className="text-white font-black text-[12px] mt-1 flex items-center justify-between">
                <span>{100 + labsCount * 100}%</span>
                <span className="text-high-warning text-[9px] font-mono">v{labsCount}</span>
              </div>
            </div>
            
            <div className="p-2 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm hover:border-slate-700 transition-colors">
              <span className="text-slate-400 uppercase text-[8px] font-black tracking-widest">Crew Payload</span>
              <div className="text-white font-black text-[12px] mt-1 flex items-center justify-between">
                <span>{playerUnits.length}/{maxCrewCap}</span>
                <span className="text-purple-400 text-[9px] font-mono">v{quartersCount}</span>
              </div>
            </div>

            <div className="p-2 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm hover:border-slate-700 transition-colors">
              <span className="text-slate-400 uppercase text-[8px] font-black tracking-widest">Passive Income</span>
              <div className={`font-black text-[12px] mt-1 flex items-center justify-between ${hydroCount > 0 ? 'text-high-success' : 'text-slate-300'}`}>
                <span>₮{passiveIncomeRate}/hr</span>
                <span className="text-high-success text-[9px] font-mono">v{hydroCount}</span>
              </div>
            </div>

            <div className="p-2 bg-high-card border-2 border-slate-800 flex flex-col justify-between rounded-sm shadow-sm hover:border-slate-700 transition-colors">
              <span className="text-slate-400 uppercase text-[8px] font-black tracking-widest">Med Efficiency</span>
              <div className={`font-black text-[12px] mt-1 flex items-center justify-between ${infirmaryCount > 0 ? 'text-high-danger' : 'text-slate-300'}`}>
                <span>{infirmaryCount > 0 ? `${infirmaryCount}x` : 'N/A'}</span>
                <span className="text-high-danger text-[9px] font-mono">v{infirmaryCount}</span>
              </div>
            </div>
          </div>
        </section>

      </div>

    </div>
  );
}
