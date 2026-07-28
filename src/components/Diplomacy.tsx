/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useGame } from '../store/GameContext';
import { motion } from 'motion/react';
import { Shield, Skull, Handshake, Info, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { FactionType, Faction } from '../types';

export default function Diplomacy() {
  const { state, negotiateTruce, declareVendetta } = useGame();
  
  const factions = (Object.values(state.factions) as Faction[]).filter(f => f.id !== 'player');
  const playerRelations = state.factions.player?.relations || {};

  const getRelationStatus = (value: number) => {
    if (value <= -80) return { label: 'VENDETTA', color: 'text-high-danger', glow: 'text-glow-red' };
    if (value <= -20) return { label: 'HOSTILE', color: 'text-orange-500', glow: 'text-glow-orange' };
    if (value < 20) return { label: 'NEUTRAL', color: 'text-high-dim', glow: '' };
    if (value < 80) return { label: 'FRIENDLY', color: 'text-high-success', glow: 'text-glow-green' };
    return { label: 'ALLIED / TRUCE', color: 'text-high-primary', glow: 'text-glow-blue' };
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4 bg-high-sidebar border border-high-border rounded-sm shadow-md overflow-hidden">
      <div className="flex items-center gap-3 border-b border-high-border pb-4">
        <div className="w-10 h-10 bg-high-primary/10 border-2 border-high-primary/40 flex items-center justify-center rounded-sm">
          <Handshake className="text-high-primary text-glow-blue" size={20} />
        </div>
        <div>
          <h2 className="text-[14px] font-black uppercase text-white tracking-tight">Diplomatic Relations Bureau</h2>
          <p className="text-[10px] text-high-dim font-black uppercase tracking-widest mt-0.5">Manage external contacts and gang politics</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
        {factions.map(faction => {
          const relationValue = playerRelations[faction.id] || 0;
          const status = getRelationStatus(relationValue);
          const isTruce = faction.truceUntil && state.time < faction.truceUntil;
          const isVendetta = faction.isVendetta;
          
          // Calculate impact
          const relationFactor = 1 - (relationValue + 100) / 200;
          const vendettaMultiplier = isVendetta ? 1.5 : 1.0;
          const raidIntensity = Math.round((0.5 + relationFactor) * vendettaMultiplier * 100);

          return (
            <motion.div 
              key={faction.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-high-card border-2 border-slate-800 rounded-sm shadow-sm group hover:border-high-primary/30 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: faction.color }} />
                    <h3 className="text-[13px] font-black text-white uppercase tracking-tight">{faction.name}</h3>
                    <span className="text-[9px] text-slate-500 font-mono font-black uppercase tracking-widest border border-slate-800 px-2 py-0.5 rounded-sm">
                      {faction.type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 max-w-xs">
                      <div className="flex justify-between text-[9px] font-black uppercase mb-1.5 tracking-widest">
                        <span className={status.color}>{status.label}</span>
                        <span className="text-white">{relationValue} / 100</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-slate-800 p-px">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ${status.color.replace('text-', 'bg-')}`} 
                          style={{ width: `${((relationValue + 100) / 200) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <ActivityIcon status={relationValue < 0 ? 'down' : 'up'} />
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter leading-none">Raid Intensity</span>
                        <span className={`text-[11px] font-mono font-black ${relationValue < 0 ? 'text-high-danger' : 'text-high-success'}`}>{raidIntensity}%</span>
                      </div>
                    </div>
                    {isTruce && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-high-primary/10 border border-high-primary/40 rounded-sm flex items-center justify-center">
                          <Handshake size={12} className="text-high-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-high-primary font-black uppercase tracking-tighter leading-none">Truce Active</span>
                          <span className="text-[10px] font-mono font-black text-white italic">{(faction.truceUntil! - state.time)}m Left</span>
                        </div>
                      </div>
                    )}
                    {isVendetta && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-high-danger/10 border border-high-danger/40 rounded-sm flex items-center justify-center">
                          <Skull size={12} className="text-high-danger" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-high-danger font-black uppercase tracking-tighter leading-none">Vendetta</span>
                          <span className="text-[10px] font-mono font-black text-white">FORMAL WAR</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-col gap-2 shrink-0 md:w-48">
                  <button
                    onClick={() => negotiateTruce(faction.id, 5000, 120)}
                    disabled={state.funds < 5000 || isTruce || faction.type === FactionType.POLICE}
                    className="flex-1 md:w-full py-2.5 text-[9px] font-black uppercase border-2 transition-all rounded-sm shadow-sm active:scale-95 tracking-widest flex items-center justify-center gap-2
                      disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800
                      enabled:bg-high-primary/10 enabled:border-high-primary/60 enabled:text-high-primary enabled:hover:bg-high-primary enabled:hover:text-white"
                  >
                    <Handshake size={14} /> Negotiate Truce (-₮5000)
                  </button>
                  <button
                    onClick={() => declareVendetta(faction.id)}
                    disabled={isVendetta}
                    className="flex-1 md:w-full py-2.5 text-[9px] font-black uppercase border-2 transition-all rounded-sm shadow-sm active:scale-95 tracking-widest flex items-center justify-center gap-2
                      disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800
                      enabled:bg-high-danger/10 enabled:border-high-danger/60 enabled:text-high-danger enabled:hover:bg-high-danger enabled:hover:text-white"
                  >
                    <Skull size={14} /> Declare Vendetta
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-high-card border-2 border-slate-800 p-3 flex gap-3 items-start rounded-sm">
        <Info size={16} className="text-high-primary shrink-0 mt-0.5" />
        <p className="text-[9px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">
          Diplomatic status affects the probability and intensity of rival gang raids on your controlled sectors. 
          <span className="text-high-danger ml-1">Vendettas</span> significantly increase aggression, while <span className="text-high-primary ml-1">Truces</span> provide temporary safety.
        </p>
      </div>
    </div>
  );
}

const ActivityIcon = ({ status }: { status: 'up' | 'down' }) => (
  <div className={`w-6 h-6 rounded-sm flex items-center justify-center border ${status === 'up' ? 'bg-high-success/10 border-high-success/40 text-high-success' : 'bg-high-danger/10 border-high-danger/40 text-high-danger'}`}>
    {status === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
  </div>
);
