/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGame } from '../store/GameContext';
import { ITEMS, TECH_TREE } from '../data';
import { ItemId } from '../types';
import { 
  Swords, Hammer, Shield, Cpu, Flame, Sparkles, AlertTriangle, 
  CheckCircle2, Clock, Trash2, ArrowRight, RotateCcw, Box, Wrench, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MATERIAL_KEYS = ['mat_scrap', 'mat_circuits', 'mat_weapon_parts', 'mat_chemicals', 'mat_nanites'];

export default function Workshop() {
  const { state, startManufacturing, cancelManufacturing, salvageItem } = useGame();
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'WEAPON' | 'ARMOR' | 'HEAD_LEGS' | 'PACK_UTILITY' | 'MEDICAL_EXPLOSIVE'>('ALL');
  const [showSalvageModal, setShowSalvageModal] = useState(false);
  const [salvageTarget, setSalvageTarget] = useState<ItemId | null>(null);
  const [salvageQty, setSalvageQty] = useState<number>(1);

  const [showMaterials, setShowMaterials] = useState(true);
  const [showQueues, setShowQueues] = useState(true);

  // Calculate active workshop capacity across all player-controlled buildings
  const countWorkshops = state.baseSectors?.filter(s => s.type === 'WORKSHOP').length ?? 1;
  const maxSlots = Math.max(1, countWorkshops);
  const activeQueue = state.manufacturingQueue || [];

  // Filter catalog items that have recipes
  const craftableItems = Object.values(ITEMS).filter(item => item.recipe && item.type !== 'MATERIAL');

  const filteredItems = craftableItems.filter(item => {
    if (selectedCategory === 'WEAPON') return item.type === 'WEAPON';
    if (selectedCategory === 'ARMOR') return item.type === 'ARMOR';
    if (selectedCategory === 'HEAD_LEGS') return item.type === 'HEAD' || item.type === 'LEGS';
    if (selectedCategory === 'PACK_UTILITY') return item.type === 'BACKPACK' || item.type === 'UTILITY';
    if (selectedCategory === 'MEDICAL_EXPLOSIVE') return item.type === 'MEDICAL' || item.type === 'EXPLOSIVE';
    return true;
  });

  const formatMinutes = (totalMins: number) => {
    const mins = Math.max(0, Math.ceil(totalMins));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  };

  const getMaterialsOwned = (matId: string) => state.inventory[matId] || 0;

  const canAffordRecipe = (recipe: Record<string, number>, qty: number = 1) => {
    return Object.entries(recipe).every(([matId, req]) => (state.inventory[matId] || 0) >= req * qty);
  };

  const isTechUnlocked = (itemId: ItemId) => {
    const reqTech = Object.values(TECH_TREE).find(tech => tech.unlocksItems.includes(itemId));
    if (!reqTech) return true; // Default unlocked if no specific tech requirement
    return state.unlockedTech.includes(reqTech.id);
  };

  const getRequiredTechName = (itemId: ItemId) => {
    const reqTech = Object.values(TECH_TREE).find(tech => tech.unlocksItems.includes(itemId));
    return reqTech ? reqTech.name : null;
  };

  // Inventory items eligible for salvage
  const salvageableInventory = Object.entries(state.inventory).filter(([itemId, count]: [string, any]) => {
    const item = ITEMS[itemId as ItemId];
    return item && Number(count) > 0 && item.type !== 'MATERIAL';
  });

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar touch-pan-y p-2 md:p-3 bg-high-bg text-high-text font-sans relative flex flex-col gap-3">
      {/* Header Bar */}
      <div className="bg-high-header border border-high-border p-3 rounded-sm shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-500/10 border-2 border-pink-500/40 rounded-sm flex items-center justify-center">
            <Swords size={22} className="text-pink-400 text-glow-pink" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[14px] font-black uppercase text-white tracking-tight">Armaments Workshop Bay</h1>
              <span className="text-[9px] bg-pink-950/60 border border-pink-500/40 text-pink-400 px-2 py-0.5 rounded-sm font-mono font-black tracking-wider uppercase">
                {countWorkshops} {countWorkshops === 1 ? 'WORKSHOP BAY' : 'WORKSHOP BAYS'} BUILT
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">
              Fabricate advanced firearms, ballistic plating, and ordnance using raw materials gathered from raids.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSalvageModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-2 border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-white rounded-sm font-mono text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 shrink-0"
        >
          <RotateCcw size={14} className="text-amber-400" /> Dismantle Extra Gear
        </button>
      </div>

      {/* Raw Materials Bar Header + Grid */}
      <div className="bg-high-card border border-slate-800 p-2 rounded-sm shadow-sm">
        <div className="flex items-center justify-between cursor-pointer py-1" onClick={() => setShowMaterials(!showMaterials)}>
          <div className="flex items-center gap-2">
            <Box size={14} className="text-pink-400" />
            <span className="text-[10px] font-mono font-black uppercase text-slate-300 tracking-wider">
              RAW MATERIAL STASH
            </span>
          </div>
          <button className="text-slate-400 hover:text-white flex items-center gap-1 text-[9px] font-mono font-bold uppercase">
            {showMaterials ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showMaterials && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 pt-2 border-t border-slate-800/80">
            {MATERIAL_KEYS.map(matId => {
              const mat = ITEMS[matId];
              const owned = state.inventory[matId] || 0;
              return (
                <div key={matId} className="p-2 bg-slate-900/80 border border-slate-800 rounded-sm flex items-center justify-between hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Box size={14} className="text-pink-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider truncate">{mat?.name || matId}</div>
                      <div className="text-[11px] font-mono font-black text-white">{owned.toLocaleString()} units</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Production Queues Panel */}
      <div className="bg-high-sidebar border border-high-border p-3 rounded-sm shadow-md">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowQueues(!showQueues)}>
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-pink-400 animate-pulse" />
            <h2 className="text-[11px] font-mono font-black text-white uppercase tracking-widest">
              ACTIVE MANUFACTURING LINES ({activeQueue.length} / {maxSlots} SLOTS)
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-slate-400 uppercase font-bold hidden sm:inline">
              Capacity: {maxSlots} Item{maxSlots > 1 ? 's' : ''}
            </span>
            <button className="text-slate-400 hover:text-white flex items-center gap-1 text-[9px] font-mono font-bold uppercase">
              {showQueues ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {showQueues && (
          <div className="mt-3">
            {activeQueue.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto custom-scrollbar touch-pan-y pr-1">
                {activeQueue.map((job, idx) => {
                  const item = ITEMS[job.itemId];
                  const isActiveSlot = idx < maxSlots;
                  const remainingMins = Math.max(0, (job.maxProgress - job.progress) / (isActiveSlot ? 1 : 0.0001));
                  const percent = Math.min(100, Math.floor((job.progress / job.maxProgress) * 100));

                  return (
                    <div key={job.id} className={`p-2.5 rounded-sm border-2 ${isActiveSlot ? 'bg-high-card border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.15)]' : 'bg-slate-900/80 border-slate-800 opacity-80'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${isActiveSlot ? 'bg-pink-950 text-pink-400 border border-pink-500/40 animate-pulse' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                            {isActiveSlot ? 'IN PRODUCTION' : 'QUEUED'}
                          </span>
                          <span className="text-[11px] font-black text-white uppercase tracking-tight">{job.count}x {item?.name || job.itemId}</span>
                        </div>

                        <button
                          onClick={() => cancelManufacturing(job.id)}
                          className="text-[9px] text-high-danger hover:text-white font-mono font-black uppercase flex items-center gap-1 hover:underline tracking-wider"
                          title="Abort job & refund raw materials"
                        >
                          <Trash2 size={12} /> Abort
                        </button>
                      </div>

                      <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden border border-slate-800 mb-1.5 p-0.5">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${isActiveSlot ? 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.6)]' : 'bg-slate-600'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 font-bold">
                        <span>{percent}% Complete</span>
                        <span>{isActiveSlot ? formatMinutes(remainingMins) : 'Waiting for slot'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-3 text-center border border-dashed border-slate-800 rounded-sm bg-slate-900/40">
                <p className="text-[10px] font-mono text-slate-400 uppercase font-black tracking-widest">
                  WORKSHOP LINES IDLE — SELECT AN ITEM FROM THE CATALOG BELOW TO BEGIN MANUFACTURING
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Catalog Filter Buttons (Sticky for easy browsing) */}
      <div 
        className="sticky top-0 z-20 bg-high-bg/95 backdrop-blur-md py-1.5 border-b border-slate-800/80 flex gap-1.5 overflow-x-auto custom-scrollbar touch-pan-x"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {[
          { id: 'ALL', label: 'ALL SCHEMATICS' },
          { id: 'WEAPON', label: 'FIREARMS & CANNONS' },
          { id: 'ARMOR', label: 'BODY ARMOR & RIGS' },
          { id: 'HEAD_LEGS', label: 'HELMETS & GREAVES' },
          { id: 'PACK_UTILITY', label: 'BACKPACKS & GEAR' },
          { id: 'MEDICAL_EXPLOSIVE', label: 'MEDICAL & ORDNANCE' },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id as any)}
            className={`px-3 py-1.5 text-[10px] font-mono font-black tracking-wider uppercase border rounded-sm transition-all whitespace-nowrap ${
              selectedCategory === cat.id
                ? 'bg-pink-500/20 text-white border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Schematics Grid */}
      <div className="w-full pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map(item => {
            const unlocked = isTechUnlocked(item.id);
            const reqTechName = getRequiredTechName(item.id);
            const recipe = item.recipe || {};
            const afford1 = canAffordRecipe(recipe, 1);
            const afford3 = canAffordRecipe(recipe, 3);
            const ownedCount = state.inventory[item.id] || 0;

            return (
              <div 
                key={item.id} 
                className={`p-3.5 bg-high-card border-2 rounded-sm flex flex-col justify-between transition-all group ${
                  unlocked 
                    ? 'border-slate-800 hover:border-pink-500/40 shadow-sm' 
                    : 'border-slate-900 bg-slate-950/60 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-[12px] font-black text-white uppercase tracking-tight group-hover:text-glow-pink transition-colors">
                        {item.name}
                      </h3>
                      <div className="flex gap-2 items-center mt-0.5">
                        <span className="text-[8px] font-mono font-black text-pink-400 bg-pink-950/60 border border-pink-500/30 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                          {item.type}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 font-bold uppercase flex items-center gap-1">
                          <Clock size={10} /> {formatMinutes(item.craftTime || 30)}
                        </span>
                      </div>
                    </div>
                    {ownedCount > 0 && (
                      <span className="text-[9px] font-mono font-black bg-slate-800 border border-slate-700 text-white px-2 py-0.5 rounded-sm shrink-0">
                        {ownedCount} IN STASH
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-[9.5px] text-slate-400 font-bold leading-relaxed mb-3">
                      {item.description}
                    </p>
                  )}

                  {/* Specs summary */}
                  <div className="grid grid-cols-2 gap-1.5 mb-3 bg-black/40 p-2 rounded-sm border border-slate-800/80 font-mono text-[9px]">
                    {item.damage && <div className="text-slate-300 font-bold">DMG: <span className="text-pink-400 font-black">{item.damage}</span></div>}
                    {item.range && <div className="text-slate-300 font-bold">RNG: <span className="text-white font-black">{item.range}m</span></div>}
                    {item.hpBonus && <div className="text-slate-300 font-bold">HP: <span className="text-high-success font-black">+{item.hpBonus}</span></div>}
                    {item.slotsGranted && <div className="text-slate-300 font-bold">CAP: <span className="text-high-primary font-black">+{item.slotsGranted} Slots</span></div>}
                    {item.weightReduction && <div className="text-slate-300 font-bold">WT RED: <span className="text-amber-400 font-black">-{item.weightReduction}%</span></div>}
                  </div>

                  {/* Material Requirements Checklist */}
                  <div className="mb-3 space-y-1">
                    <div className="text-[9px] font-mono text-slate-400 font-black uppercase tracking-wider mb-1">
                      REQUIRED COMPONENTS:
                    </div>
                    {Object.entries(recipe).map(([matId, reqQty]) => {
                      const matObj = ITEMS[matId];
                      const owned = getMaterialsOwned(matId);
                      const hasEnough = owned >= reqQty;

                      return (
                        <div key={matId} className="flex items-center justify-between text-[9.5px] font-mono p-1 rounded-sm bg-slate-900/60 border border-slate-800">
                          <span className="text-slate-300 font-bold truncate max-w-[140px]">{matObj?.name || matId}</span>
                          <span className={`font-black ${hasEnough ? 'text-high-success' : 'text-high-danger'}`}>
                            {owned} / {reqQty}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Crafting Action */}
                <div className="pt-2 border-t border-slate-800">
                  {unlocked ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startManufacturing(item.id, 1)}
                        disabled={!afford1}
                        className="flex-1 py-2 text-[10px] font-mono font-black uppercase border-2 rounded-sm transition-all shadow-sm active:scale-95 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 bg-pink-500/20 border-pink-500/60 text-white hover:bg-pink-500 hover:text-white"
                      >
                        Manufacture (1x)
                      </button>
                      <button
                        onClick={() => startManufacturing(item.id, 3)}
                        disabled={!afford3}
                        className="px-3 py-2 text-[10px] font-mono font-black uppercase border-2 rounded-sm transition-all shadow-sm active:scale-95 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800 bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                        title="Manufacture batch of 3"
                      >
                        3x
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 bg-red-950/40 border border-high-danger/40 rounded-sm text-center">
                      <span className="text-[9px] font-mono font-black text-high-danger uppercase tracking-wider block">
                        SCHEMATIC LOCKED
                      </span>
                      <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest mt-0.5 block">
                        Requires Lab Tech: {reqTechName || 'Advanced Research'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dismantle / Salvage Modal */}
      {showSalvageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-high-sidebar border-2 border-amber-500/60 p-4 rounded-sm max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="text-amber-400" size={18} />
                <h2 className="text-[13px] font-mono font-black text-white uppercase tracking-tight">
                  SALVAGE & RECYCLE EQUIPMENT
                </h2>
              </div>
              <button 
                onClick={() => setShowSalvageModal(false)}
                className="text-slate-400 hover:text-white font-mono font-black text-[12px]"
              >
                ✕
              </button>
            </div>

            <p className="text-[10px] text-slate-300 font-bold mb-3 leading-relaxed">
              Dismantle spare weapons, armors, and gear from your stash to reclaim raw materials for workshop manufacturing.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 mb-4">
              {salvageableInventory.length > 0 ? (
                salvageableInventory.map(([itemId, qty]) => {
                  const item = ITEMS[itemId];
                  if (!item) return null;

                  return (
                    <div key={itemId} className="p-2 bg-high-card border border-slate-800 rounded-sm flex justify-between items-center gap-3">
                      <div>
                        <div className="text-[11px] font-black text-white uppercase">{item.name}</div>
                        <div className="text-[9px] font-mono text-slate-400 font-bold">Stash: {qty} owned</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => salvageItem(item.id, 1)}
                          className="px-3 py-1 bg-amber-500/20 border border-amber-500/60 text-amber-300 hover:bg-amber-500 hover:text-white text-[9.5px] font-mono font-black uppercase rounded-sm transition-all"
                        >
                          Salvage 1
                        </button>
                        {Number(qty) >= 3 && (
                          <button
                            onClick={() => salvageItem(item.id, Math.min(3, Number(qty)))}
                            className="px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[9.5px] font-mono font-black uppercase rounded-sm transition-all"
                          >
                            All ({Number(qty)})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[10px] font-mono text-slate-500 uppercase font-bold border border-dashed border-slate-800 rounded-sm">
                  No extra equipment in stash to dismantle.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowSalvageModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-mono font-black uppercase rounded-sm tracking-wider"
              >
                Close Salvage Station
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
