import React from 'react';
import { useGame } from '../store/GameContext';
import { VEHICLES, VEHICLE_UPGRADES } from '../data';
import { motion } from 'framer-motion';
import { Vehicle } from '../types';

export const VehicleManagement: React.FC = () => {
  const { state, buyVehicle, upgradeVehicle, setActiveVehicle, setVehicleBase } = useGame();

  const ownedVehicles = Object.values(state.vehicles) as Vehicle[];

  return (
    <div className="p-4 h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-mono font-black text-white tracking-widest text-glow-blue uppercase">Garage Terminal</h2>
        <div className="bg-slate-900 border border-slate-700 px-3 py-1 text-xs font-mono text-high-dim">
          FUNDS: <span className="text-high-success">₮{state.funds.toLocaleString()}</span>
        </div>
      </div>

      {/* Owned Vehicles */}
      <section>
        <h3 className="text-xs font-mono font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Current Fleet</h3>
        {ownedVehicles.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 p-8 text-center rounded-sm">
            <p className="text-slate-500 font-mono text-sm">No vehicles in inventory.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ownedVehicles.map(vehicle => {
              const isActive = state.activeVehicleId === vehicle.id;
              return (
                <div 
                  key={vehicle.id} 
                  className={`bg-slate-900 border transition-all ${isActive ? 'border-high-primary shadow-[0_0_15px_rgba(96,165,250,0.2)]' : 'border-slate-800'} p-4 rounded-sm flex flex-col gap-4`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-mono font-black text-lg">{vehicle.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{vehicle.type}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold text-slate-500">BASE:</span>
                        <select value={vehicle.currentBuildingId || 'player-hq'} onChange={(e) => setVehicleBase(vehicle.id, e.target.value)} disabled={vehicle.status !== 'READY'} className="bg-slate-900 text-white font-mono text-[9px] px-1 py-0.5 outline-none border border-slate-700 rounded-sm disabled:opacity-50">
                          {(Object.values(state.buildings) as any[]).filter(b => b.ownerId === 'player').map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveVehicle(isActive ? undefined : vehicle.id)}
                      className={`px-3 py-1 text-[10px] font-mono font-black border transition-all ${
                        isActive 
                          ? 'bg-high-primary text-white border-high-primary shadow-[0_0_10px_rgba(96,165,250,0.5)]' 
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
                      }`}
                    >
                      {isActive ? 'ACTIVE' : 'SELECT'}
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <StatBox label="SPEED" value={vehicle.stats.speed} unit="km/h" />
                    <StatBox label="ARMOR" value={vehicle.stats.armor} />
                    <StatBox label="CAPACITY" value={vehicle.stats.capacity} unit="units" />
                    <StatBox label="FUEL" value={(vehicle.stats.fuelEfficiency * 100).toFixed(0)} unit="%" />
                  </div>

                  {/* Upgrades */}
                  <div>
                    <h5 className="text-[10px] font-mono font-bold text-slate-600 uppercase mb-2">Available Upgrades</h5>
                    <div className="space-y-2">
                      {Object.values(VEHICLE_UPGRADES).map(upgrade => {
                        const hasUpgrade = vehicle.upgrades.includes(upgrade.id);
                        return (
                          <div key={upgrade.id} className="flex items-center justify-between bg-slate-950 p-2 border border-slate-800 rounded-sm">
                            <div>
                              <p className="text-[11px] font-mono font-bold text-slate-300">{upgrade.name}</p>
                              <p className="text-[9px] font-mono text-slate-500">{upgrade.description}</p>
                            </div>
                            <button
                              disabled={hasUpgrade || state.funds < upgrade.cost}
                              onClick={() => upgradeVehicle(vehicle.id, upgrade.id)}
                              className={`px-2 py-1 text-[9px] font-mono font-black border transition-all ${
                                hasUpgrade
                                  ? 'bg-high-success/20 text-high-success border-high-success/40 cursor-default'
                                  : state.funds < upgrade.cost
                                    ? 'bg-slate-900 text-slate-700 border-slate-800 cursor-not-allowed'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                              }`}
                            >
                              {hasUpgrade ? 'INSTALLED' : `₮${upgrade.cost}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Purchase New */}
      <section>
        <h3 className="text-xs font-mono font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Purchase Vehicles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {state.unlockedVehicles.map(vId => {
            const template = VEHICLES[vId];
            if (!template) return null;
            return (
              <div key={vId} className="bg-slate-900 border border-slate-800 p-4 rounded-sm space-y-4 hover:border-slate-700 transition-colors">
                <div>
                  <h4 className="text-white font-mono font-black">{template.name}</h4>
                  <p className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">{template.type}</p>
                </div>
                <div className="text-[10px] font-mono text-slate-400 space-y-1">
                  <div className="flex justify-between"><span>Speed</span><span>{template.stats.speed}</span></div>
                  <div className="flex justify-between"><span>Armor</span><span>{template.stats.armor}</span></div>
                  <div className="flex justify-between"><span>Cap.</span><span>{template.stats.capacity}</span></div>
                </div>
                <button
                  disabled={state.funds < template.cost}
                  onClick={() => buyVehicle(vId)}
                  className={`w-full py-2 text-xs font-mono font-black border transition-all ${
                    state.funds < template.cost
                      ? 'bg-slate-900 text-slate-700 border-slate-800 cursor-not-allowed'
                      : 'bg-high-success/10 text-high-success border-high-success/40 hover:bg-high-success hover:text-slate-950'
                  }`}
                >
                  PURCHASE: ₮{template.cost.toLocaleString()}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const StatBox = ({ label, value, unit }: { label: string, value: number | string, unit?: string }) => (
  <div className="bg-slate-950 border border-slate-800 p-2 rounded-sm">
    <p className="text-[8px] font-mono font-bold text-slate-600 uppercase mb-0.5">{label}</p>
    <p className="text-xs font-mono font-black text-white">
      {value}{unit && <span className="text-[9px] text-slate-500 ml-0.5">{unit}</span>}
    </p>
  </div>
);
