/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameProvider, useGame } from './store/GameContext';
import CityMap from './components/CityMap';
import BaseManagement from './components/BaseManagement';
import TacticalMission from './components/TacticalMission';
import SquadManagement from './components/SquadManagement';
import { LayoutDashboard, Map as MapIcon, FlaskConical, Hammer, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const GameContent = () => {
  const { state } = useGame();
  const [activeTab, setActiveTab] = useState<'CITY' | 'BASE'>('CITY');

  if (state.activeMission && state.activeMission.status !== 'TRANSIT' && state.activeMission.status !== 'RETURNING') {
    return (
      <div className="h-[100dvh] w-full overflow-hidden">
        <TacticalMission />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-high-bg text-high-text font-sans overflow-hidden md:border-2 border-high-border">
      {/* Header / HUD */}
      <header className="h-10 bg-high-header border-b border-high-border flex items-center justify-between px-2 md:px-4 text-[11px] font-mono tracking-[0.2em] uppercase shrink-0 shadow-lg z-50">
        <div className="flex gap-4 md:gap-8 items-center overflow-hidden">
          <div className="text-white font-black tracking-tighter text-glow-blue scale-110">NEON TURF v0.2.4</div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-high-dim hidden xs:inline font-black">FUNDS:</span>
            <span className="text-high-success font-black text-glow-green">₮{state.funds.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-high-dim hidden xs:inline font-black">TIME:</span>
            <span className="text-white font-black">
              {Math.floor(state.time / (24 * 60))}D {Math.floor((state.time % (24 * 60)) / 60)}H
            </span>
          </div>
        </div>

        <div className="flex gap-3 md:gap-5 items-center shrink-0">
          <div className="hidden sm:block bg-slate-800/80 px-3 py-0.5 border border-slate-600 text-[10px] font-black text-high-success tracking-[0.1em] shadow-inner">
            UPLINK: ONLINE
          </div>
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-high-success/20 rounded-full border border-high-success/40"></div>
            <div className="w-3 h-3 bg-high-success rounded-full shadow-[0_0_10px_rgba(74,222,128,0.6)] animate-pulse"></div>
            <div className="w-3 h-3 bg-slate-900 rounded-full border border-slate-800"></div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'CITY' && (
            <motion.div
              key="city"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0 w-full h-full relative overflow-hidden"
            >
              <CityMap />
            </motion.div>
          )}
          {activeTab === 'BASE' && (
            <motion.div
              key="base"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0 w-full h-full relative overflow-hidden"
            >
              <BaseManagement />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Footer */}
      <nav className="h-12 md:h-14 bg-high-header border-t border-high-border flex items-center px-2 md:px-4 justify-between shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.3)] z-50">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <NavButton
            active={activeTab === 'CITY'}
            onClick={() => setActiveTab('CITY')}
            label="CITY MAP"
          />
          <NavButton
            active={activeTab === 'BASE'}
            onClick={() => setActiveTab('BASE')}
            label="COMMAND HQ"
          />
        </div>
        <div className="hidden sm:flex gap-8 text-[11px]">
          <div className="flex items-center gap-2 text-high-primary font-mono tracking-widest uppercase font-black text-glow-blue">
            SECURE LINK ESTABLISHED
          </div>
        </div>
      </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
  <button
    onClick={onClick}
    className={`text-[11px] px-6 py-2.5 font-mono font-black tracking-[0.2em] transition-all duration-200 border-2 rounded-sm shadow-sm active:scale-95 ${
      active 
        ? 'bg-high-primary/20 text-white border-high-primary shadow-[0_0_20px_rgba(96,165,250,0.3)] text-glow-blue' 
        : 'bg-slate-900/40 text-slate-300 hover:text-white border-slate-800 hover:border-slate-600'
    }`}
  >
    {label}
  </button>
);

export default function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}

