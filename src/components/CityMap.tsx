/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useGame, getInitialFacilitiesForBuilding } from '../store/GameContext';
import { Building } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Info, Target, ShieldAlert, X, ChevronRight, Truck, User, 
  Radio, Zap, Shield, Warehouse, Building2, Factory, Crosshair, 
  AlertTriangle, Compass, Navigation, Flame, Sun, Layers, HelpCircle
} from 'lucide-react';

export function getDynamicBuildingSize(building: Building, baseSectors: any[] = []) {
  if (!building) {
    return { roomCount: 1, footprintW: 1, footprintH: 1, level: 1, extraRooms: 0, height3D: 35 };
  }
  const buildingSectors = baseSectors.filter((s: any) => (s.buildingId || 'player-hq') === building.id);
  const roomCount = Math.max(1, buildingSectors.length || building.presetFacilities?.length || 1);

  // Ground footprint on uniform 3x3 lot:
  // 1 room: 1x1
  // 2-3 rooms: 2x2
  // 4+ rooms: 3x3 (Max lot footprint on ground)
  let footprintW = 1;
  let footprintH = 1;
  if (roomCount >= 4) {
    footprintW = 3;
    footprintH = 3;
  } else if (roomCount >= 2) {
    footprintW = 2;
    footprintH = 2;
  }

  const level = building.unlockedFloors || Math.max(1, Math.ceil(roomCount / 9));

  // 3D vertical height calculation (in pixels):
  const footprintBonus = (footprintW - 1) * 15;
  const extraLevelBonus = (level - 1) * 28;
  const height3D = 35 + footprintBonus + extraLevelBonus;

  return {
    roomCount,
    footprintW,
    footprintH,
    level,
    extraRooms: Math.max(0, roomCount - 9),
    height3D
  };
}

const CityMap = () => {
  const { state, startMission, startScout } = useGame();
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [launchBaseId, setLaunchBaseId] = useState<string>('player-hq');
  
  // Camera State
  const [zoom, setZoom] = useState(window.innerWidth < 768 ? 0.45 : 0.65);
  const [rotation, setRotation] = useState(0);
  const [pitch, setPitch] = useState(45);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'PAN' | 'ROTATE'>('PAN');
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [lastTouchDist, setLastTouchDist] = useState<number | null>(null);

  const GRID_SIZE = 36;
  const CELL_SIZE = 75;
  // Keep the terrain layers separated enough that they don't fight each other when the camera is rotated or pitched.
  const GROUND_PLANE_DEPTH_OFFSET = 0.8;
  const BUILDING_BASE_DEPTH_OFFSET = 0.45;
  const PATH_ADDITIONAL_OFFSET = 0.7;
  const SELECTION_HIGHLIGHT_OFFSET = 0.15;
  // Keep labels slightly above the building roofs so they remain readable while the camera moves.
  const LABEL_HEIGHT_OFFSET = 22;

  // Evenly spaced road axes (Grid lines where roads run every 4 cells)
  const ROAD_AXES_X = useMemo(() => new Set([0, 4, 8, 12, 16, 20, 24, 28, 32]), []);
  const ROAD_AXES_Y = useMemo(() => new Set([0, 4, 8, 12, 16, 20, 24, 28, 32]), []);

  useEffect(() => {
    if (selectedBuildingId) setShowInfo(true);
  }, [selectedBuildingId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragMode(e.button === 2 || e.shiftKey ? 'ROTATE' : 'PAN');
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;

    if (dragMode === 'ROTATE') {
      setRotation(prev => (prev + dx * 0.5 + 360) % 360);
      setPitch(prev => Math.max(20, Math.min(68, prev + dy * 0.5)));
    } else {
      setOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
    }
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    setZoom(prev => Math.max(0.2, Math.min(1.8, prev - e.deltaY * 0.001)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragMode('PAN');
      setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setLastTouchDist(null);
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - lastMousePos.x;
      const dy = e.touches[0].clientY - lastMousePos.y;
      
      setOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2 && lastTouchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastTouchDist;
      setZoom(prev => Math.max(0.2, Math.min(1.8, prev + delta * 0.005)));
      setLastTouchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDist(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

  const selectedBuilding = selectedBuildingId ? state.buildings[selectedBuildingId] : null;
  let activeVehicle = state.activeVehicleId ? state.vehicles[state.activeVehicleId] : null;
  const playerHq = state.buildings['player-hq'];

  const calculateDistance = (b1: any, b2: any) => {
    if (!b1 || !b2) return 0;
    return Math.sqrt(Math.pow(b1.x - b2.x, 2) + Math.pow(b1.y - b2.y, 2));
  };

  const distance = calculateDistance(state.buildings[launchBaseId] || playerHq, selectedBuilding);
  activeVehicle = state.activeVehicleId ? state.vehicles[state.activeVehicleId] : null;
  if (activeVehicle && (activeVehicle.currentBuildingId || 'player-hq') !== launchBaseId) {
    activeVehicle = null;
  }
  const travelSpeed = activeVehicle ? activeVehicle.stats.speed : 10; 
  const travelTimeMinutes = Math.round((distance * 100) / travelSpeed);

  const scoutTravelSpeed = 30;
  const scoutTravelTimeMinutes = Math.round((distance * 100) / scoutTravelSpeed);
  const scoutCost = (selectedBuilding?.width || 1) * (selectedBuilding?.height || 1) * 100;

  const handleStartMission = (building: any) => {
    let squadUnits: string[] = [];
    if (state.activeMission) {
      squadUnits = state.activeMission.units;
    } else {
      squadUnits = Object.keys(state.units).filter(id => state.units[id].location === 'BASE' && (state.units[id].currentBuildingId || 'player-hq') === launchBaseId);
    }

    if (squadUnits.length === 0) return;

    startMission({
      id: `mission-${Date.now()}`,
      buildingId: building.id,
      startBuildingId: launchBaseId,
      type: 'RAID',
      units: squadUnits,
      enemyUnits: [], 
      map: { width: 10, height: 10, tiles: [] },
      turn: 1,
      status: 'TRANSIT',
      transitTimeRemaining: travelTimeMinutes,
      transitTimeTotal: travelTimeMinutes
    });
  };

  const handleStartScout = (building: any) => {
    startScout(building.id);
  };

  const mission = state.activeMission;
  const isInTransit = mission?.status === 'TRANSIT' || mission?.status === 'RETURNING';
  const targetBuilding = mission ? state.buildings[mission.buildingId] : null;
  
  let squadPos = { x: 0, y: 0 };
  let startPos = { x: playerHq?.x ?? 0, y: playerHq?.y ?? 0 };

  if (mission?.startPosX !== undefined && mission?.startPosY !== undefined) {
    startPos = { x: mission.startPosX, y: mission.startPosY };
  }

  if (isInTransit && targetBuilding && mission) {
    const progress = 1 - (mission.transitTimeRemaining / mission.transitTimeTotal);
    const from = mission.status === 'RETURNING' ? targetBuilding : startPos;
    const to = mission.status === 'RETURNING' ? playerHq || startPos : targetBuilding;
    squadPos = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    };
  }

  // Pre-calculate building occupation lookup grid based on dynamic lot footprints
  const buildingOccupiedMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(state.buildings).forEach((b: any) => {
      const { footprintW, footprintH } = getDynamicBuildingSize(b, state.baseSectors || []);
      const offsetX = Math.floor((3 - footprintW) / 2);
      const offsetY = Math.floor((3 - footprintH) / 2);
      const startX = b.x + offsetX;
      const startY = b.y + offsetY;
      for (let bx = startX; bx < startX + footprintW; bx++) {
        for (let by = startY; by < startY + footprintH; by++) {
          map.set(`${bx},${by}`, b.id);
        }
      }
    });
    return map;
  }, [state.buildings, state.baseSectors]);

  // Depth-sorted buildings to eliminate Z-fighting & overlapping glitches across camera angles
  const sortedBuildings = useMemo(() => {
    const rad = (rotation * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const pitchCos = Math.cos(pitchRad);

    return Object.values(state.buildings).slice().sort((a: Building, b: Building) => {
      const { footprintW: fWa, footprintH: fHa } = getDynamicBuildingSize(a, state.baseSectors || []);
      const { footprintW: fWb, footprintH: fHb } = getDynamicBuildingSize(b, state.baseSectors || []);
      
      const centerAx = (a.x + (3 - fWa)/2) + fWa / 2;
      const centerAy = (a.y + (3 - fHa)/2) + fHa / 2;
      const centerBx = (b.x + (3 - fWb)/2) + fWb / 2;
      const centerBy = (b.y + (3 - fHb)/2) + fHb / 2;

      // Depth sort should account for both the orbit rotation and the tilt/pitch so the scene
      // doesn't pop or shimmer when the camera is moved.
      const rotatedAxisA = centerAx * sin + centerAy * cos;
      const rotatedAxisB = centerBx * sin + centerBy * cos;
      const depthA = -rotatedAxisA * pitchCos;
      const depthB = -rotatedAxisB * pitchCos;

      return depthA - depthB;
    });
  }, [state.buildings, state.baseSectors, rotation, pitch]);

  // Determine building physical properties & visual height dynamically
  const getBuildingProps = (building: Building) => {
    const { height3D } = getDynamicBuildingSize(building, state.baseSectors || []);
    const isDestroyed = building.health <= 0;
    const height = isDestroyed ? 6 : height3D;
    return { height, isDestroyed };
  };

  return (
    <div 
      className="h-full w-full flex overflow-hidden bg-[#0a0d14] select-none relative touch-none font-sans isolation-isolate"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Isolated 2D HUD Overlays Layer */}
      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-3 md:p-4">
        {/* Top Header & Transit/Scout Status HUD */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-2 w-full">
          <div className="pointer-events-auto flex items-center gap-3">
            <div className="bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-sm shadow-xl backdrop-blur-md flex items-center gap-2">
              <Navigation size={14} className="text-high-primary animate-pulse" />
              <span className="text-[10px] font-mono font-black text-white uppercase tracking-widest">BOHRS METROPOLITAN ZONE</span>
              <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 border border-emerald-500/30 rounded-xs">SECTOR 09</span>
            </div>
          </div>

          <div className="pointer-events-auto w-64 md:w-80 flex flex-col gap-2">
            {isInTransit && mission && targetBuilding && (
              <div className="bg-slate-900/95 border-2 border-high-primary p-3 shadow-[0_0_20px_rgba(96,165,250,0.4)] backdrop-blur-md rounded-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono font-black text-white uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <Truck size={12} className="text-high-primary animate-bounce" />
                    {mission.status === 'RETURNING' ? 'Squad Returning' : 'Squad in Transit'}
                  </span>
                  <span className="text-[10px] font-mono font-black text-high-primary animate-pulse">ETA: {mission.transitTimeRemaining} MIN</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-high-primary shadow-[0_0_10px_rgba(96,165,250,0.8)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(1 - mission.transitTimeRemaining / mission.transitTimeTotal) * 100}%` }}
                  />
                </div>
                <div className="mt-2 text-[8px] font-mono text-slate-400 uppercase flex justify-between font-bold">
                  <span>{mission.status === 'RETURNING' ? targetBuilding.name : 'BASE HQ'}</span>
                  <span>{mission.status === 'RETURNING' ? 'BASE HQ' : targetBuilding.name}</span>
                </div>
              </div>
            )}

            {state.activeScouts?.map(scout => {
              const tb = state.buildings[scout.buildingId];
              if (!tb) return null;
              return (
                <div key={`hud-${scout.id}`} className="bg-slate-900/95 border border-emerald-500/50 p-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md rounded-sm">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-[0.1em] flex items-center gap-1">
                      <Radio size={10} className="animate-spin text-emerald-400" />
                      Scout: {tb.name}
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold">ETA: {scout.transitTimeRemaining}m</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(1 - scout.transitTimeRemaining / scout.transitTimeTotal) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Camera Preset Quick Controls & Legend */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/95 border border-slate-700/80 p-1.5 rounded-sm shadow-xl backdrop-blur-md w-fit">
            <button 
              onClick={() => { 
                setZoom(window.innerWidth < 768 ? 0.45 : 0.65); 
                setRotation(0); 
                setPitch(45); 
                setOffset({ x: 0, y: 0 }); 
              }}
              className={`px-2.5 py-1 border text-[9px] font-mono uppercase font-black tracking-wider transition-colors flex items-center gap-1 cursor-pointer ${
                rotation === 0 && pitch === 45 ? 'bg-high-primary text-slate-950 border-cyan-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
              }`}
              title="Reset to 3D North View"
            >
              <Compass size={12} className={rotation === 0 && pitch === 45 ? "text-slate-900" : "text-high-primary"} />
              North
            </button>
            <button 
              onClick={() => { setRotation(45); setPitch(45); }}
              className={`px-2 py-1 border text-[9px] font-mono uppercase font-black transition-colors cursor-pointer ${
                rotation === 45 && pitch === 45 ? 'bg-high-primary text-slate-950 border-cyan-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
              }`}
              title="3D Isometric View"
            >
              Iso (45°)
            </button>
            <button 
              onClick={() => { setRotation(45); setPitch(28); }}
              className={`px-2 py-1 border text-[9px] font-mono uppercase font-black transition-colors cursor-pointer ${
                pitch === 28 ? 'bg-high-primary text-slate-950 border-cyan-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
              }`}
              title="Low Angle Tactical View"
            >
              Low Angle
            </button>
            <button 
              onClick={() => { setRotation(0); setPitch(68); }}
              className={`px-2 py-1 border text-[9px] font-mono uppercase font-black transition-colors cursor-pointer ${
                pitch === 68 ? 'bg-high-primary text-slate-950 border-cyan-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
              }`}
              title="Top Down Radar View"
            >
              Top Down
            </button>

            <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />

            <button 
              onClick={() => setRotation(r => (r - 45 + 360) % 360)}
              className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-[9px] font-mono font-black transition-colors cursor-pointer"
              title="Rotate Left 45°"
            >
              ↺ -45°
            </button>
            <button 
              onClick={() => setRotation(r => (r + 45) % 360)}
              className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-[9px] font-mono font-black transition-colors cursor-pointer"
              title="Rotate Right 45°"
            >
              ↻ +45°
            </button>
          </div>
          <div className="hidden sm:block px-2.5 py-1 bg-slate-950/80 border border-slate-800 text-[8px] font-mono text-slate-400 uppercase rounded-sm w-fit backdrop-blur-sm">
            L-Click Drag: Pan // Shift / R-Click Drag: Orbit & Pitch // Scroll: Zoom
          </div>
        </div>
      </div>

      {/* Map Viewport */}
      <div 
        className="absolute inset-0 bg-[#0d1017] overflow-hidden cursor-grab active:cursor-grabbing z-0"
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onClick={() => setSelectedBuildingId(null)}
        style={{ perspective: '2200px' }}
      >
        {/* Subtle Ambient City Glow Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-black" />

        {/* Camera Container (Pan & Zoom) */}
        <div 
          className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
            isDragging ? 'transition-none' : 'transition-transform duration-150 ease-out'
          }`}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        >
          {/* Isometric World Container (Rotation & Pitch) */}
          <div 
            className="relative pointer-events-auto will-change-transform"
            style={{ 
              width: GRID_SIZE * CELL_SIZE, 
              height: GRID_SIZE * CELL_SIZE,
              transform: `rotateX(${pitch}deg) rotateZ(${rotation}deg)`,
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Extended Ground Plane (City Foundation) */}
            <div 
              className="absolute bg-[#121622] shadow-[0_0_150px_rgba(0,0,0,0.8)] border-4 border-slate-800/80 rounded-sm overflow-hidden"
              style={{
                left: -200,
                top: -200,
                width: GRID_SIZE * CELL_SIZE + 400,
                height: GRID_SIZE * CELL_SIZE + 400,
                transform: `translateZ(${-GROUND_PLANE_DEPTH_OFFSET}px)`,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
              }}
            >
              {/* Outer Suburban Perimeter Texture */}
              <div 
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: `radial-gradient(#1e293b 1.5px, transparent 1.5px), linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
                  backgroundSize: `40px 40px, ${CELL_SIZE * 2}px ${CELL_SIZE * 2}px, ${CELL_SIZE * 2}px ${CELL_SIZE * 2}px`
                }}
              />
            </div>

            {/* City Ground Grid & Road Network Canvas */}
            <div 
              className="absolute inset-0 bg-[#161b26] border-2 border-slate-700/60 shadow-2xl"
              style={{
                transform: `translateZ(${GROUND_PLANE_DEPTH_OFFSET}px)`,
                transformStyle: 'flat'
              }}
            >
              {/* Render Ground Grid Tiles: Roads, Sidewalks, Parks, and Plazas */}
              <div 
                className="grid h-full w-full pointer-events-none"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                  gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                  transformStyle: 'flat'
                }}
              >
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
                  const gx = idx % GRID_SIZE;
                  const gy = Math.floor(idx / GRID_SIZE);
                  const key = `${gx},${gy}`;
                  
                  const isOccupied = buildingOccupiedMap.has(key);
                  const isRoadX = ROAD_AXES_X.has(gx);
                  const isRoadY = ROAD_AXES_Y.has(gy);

                  // Subway tracks lead to Player HQ Depot
                  const isSubwayTrack = (gx >= 1 && gx <= 3 && gy === 4);

                  if (isOccupied) {
                    return (
                      <div key={idx} className="bg-[#1a202c] border border-slate-800/50 relative shadow-inner">
                        <div className="absolute inset-0 bg-slate-900/60 m-1 border border-slate-700/30" />
                      </div>
                    );
                  }

                  if (isSubwayTrack) {
                    return (
                      <div key={idx} className="bg-[#181d28] relative flex items-center justify-center border border-slate-800">
                        {/* Rail lines */}
                        <div className="w-full h-2 bg-amber-500/20 border-y border-amber-500/60 flex justify-between px-1">
                          <div className="w-full h-full bg-slate-700 opacity-60 bg-[repeating-linear-gradient(90deg,#475569_0px,#475569_2px,transparent_2px,transparent_6px)]" />
                        </div>
                      </div>
                    );
                  }

                  if (isRoadX && isRoadY) {
                    // Intersection
                    return (
                      <div key={idx} className="bg-[#141824] relative border border-slate-800/80 flex items-center justify-center">
                        {/* Zebra Crosswalk lines */}
                        <div className="absolute inset-1 border border-slate-700/40 flex flex-col justify-between p-1">
                          <div className="h-1 bg-white/30 w-full" />
                          <div className="h-1 bg-white/30 w-full" />
                        </div>
                      </div>
                    );
                  }

                  if (isRoadX) {
                    // Vertical Road
                    return (
                      <div key={idx} className="bg-[#161a24] relative border-x border-slate-800 flex justify-center">
                        {/* Yellow Dashed Center Lane */}
                        <div className="w-0.5 h-full bg-amber-500/80 bg-[repeating-linear-gradient(0deg,#f59e0b_0px,#f59e0b_8px,transparent_8px,transparent_16px)]" />
                      </div>
                    );
                  }

                  if (isRoadY) {
                    // Horizontal Road
                    return (
                      <div key={idx} className="bg-[#161a24] relative border-y border-slate-800 flex items-center">
                        {/* Yellow Dashed Center Lane */}
                        <div className="h-0.5 w-full bg-amber-500/80 bg-[repeating-linear-gradient(90deg,#f59e0b_0px,#f59e0b_8px,transparent_8px,transparent_16px)]" />
                      </div>
                    );
                  }

                  // Check if adjacent to road to render Sidewalk
                  const isSidewalk = ROAD_AXES_X.has(gx - 1) || ROAD_AXES_X.has(gx + 1) || ROAD_AXES_Y.has(gy - 1) || ROAD_AXES_Y.has(gy + 1);

                  if (isSidewalk) {
                    return (
                      <div key={idx} className="bg-[#1f2736] border border-slate-700/40 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:12px_12px] opacity-30" />
                      </div>
                    );
                  }

                  // Parks / Urban Plazas in open blocks
                  const isPark = (gx + gy) % 7 === 0;

                  if (isPark) {
                    return (
                      <div key={idx} className="bg-[#0e271f] border border-emerald-900/40 relative flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-emerald-600/50 border border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                      </div>
                    );
                  }

                  // Standard City Block Tile
                  return (
                    <div key={idx} className="bg-[#141923] border border-slate-800/40 relative opacity-80">
                      <div className="absolute inset-0 bg-[linear-gradient(#1e293b_1px,transparent_1px),linear-gradient(90deg,#1e293b_1px,transparent_1px)] [background-size:25px_25px] opacity-20" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transit Path Line */}
            {isInTransit && targetBuilding && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ transform: `translateZ(${GROUND_PLANE_DEPTH_OFFSET + PATH_ADDITIONAL_OFFSET}px)` }}>
                <line 
                  x1={startPos.x * CELL_SIZE + CELL_SIZE / 2}
                  y1={startPos.y * CELL_SIZE + CELL_SIZE / 2}
                  x2={targetBuilding.x * CELL_SIZE + (targetBuilding.width * CELL_SIZE) / 2}
                  y2={targetBuilding.y * CELL_SIZE + (targetBuilding.height * CELL_SIZE) / 2}
                  stroke="#60a5fa"
                  strokeWidth="3"
                  strokeDasharray="6 6"
                  className="opacity-70 animate-pulse"
                />
              </svg>
            )}

            {/* Active Scout Path Lines */}
            {state.activeScouts?.map(scout => {
              const tb = state.buildings[scout.buildingId];
              if (!tb) return null;
              return (
                <svg key={`path-${scout.id}`} className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ transform: `translateZ(${GROUND_PLANE_DEPTH_OFFSET + PATH_ADDITIONAL_OFFSET}px)` }}>
                  <line 
                    x1={scout.startPosX * CELL_SIZE + CELL_SIZE / 2}
                    y1={scout.startPosY * CELL_SIZE + CELL_SIZE / 2}
                    x2={tb.x * CELL_SIZE + (tb.width * CELL_SIZE) / 2}
                    y2={tb.y * CELL_SIZE + (tb.height * CELL_SIZE) / 2}
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    className="opacity-60"
                  />
                </svg>
              );
            })}

            {/* Squad Marker (during transit) */}
            {isInTransit && (
              <motion.div 
                className="absolute z-50 pointer-events-none"
                style={{
                  left: squadPos.x * CELL_SIZE,
                  top: squadPos.y * CELL_SIZE,
                  transformStyle: 'preserve-3d'
                }}
              >
                <div className="relative flex items-center justify-center" style={{ transform: 'translateZ(25px)' }}>
                  <div className="absolute w-10 h-10 bg-high-primary/30 rounded-full animate-ping" />
                  <div className="bg-high-primary p-2 border-2 border-white rounded-full shadow-[0_0_20px_rgba(96,165,250,0.9)]">
                    {activeVehicle ? <Truck size={16} className="text-white" /> : <User size={16} className="text-white" />}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Active Scout Markers */}
            {state.activeScouts?.map(scout => {
              const tb = state.buildings[scout.buildingId];
              if (!tb) return null;
              const progress = 1 - (scout.transitTimeRemaining / scout.transitTimeTotal);
              const spX = scout.startPosX + (tb.x + tb.width / 2 - scout.startPosX) * progress;
              const spY = scout.startPosY + (tb.y + tb.height / 2 - scout.startPosY) * progress;
              return (
                <motion.div 
                  key={`marker-${scout.id}`}
                  className="absolute z-40 pointer-events-none"
                  style={{
                    left: spX * CELL_SIZE,
                    top: spY * CELL_SIZE,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <div className="relative flex items-center justify-center" style={{ transform: 'translateZ(15px)' }}>
                    <div className="absolute w-8 h-8 bg-emerald-500/30 rounded-full animate-ping" />
                    <div className="bg-emerald-600 p-1.5 border border-white rounded-full shadow-[0_0_12px_rgba(16,185,129,0.9)]">
                      <User size={12} className="text-white" />
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* 3D Realistic Buildings */}
            {sortedBuildings.map((building: Building) => {
              const { roomCount, footprintW, footprintH, level, height3D } = getDynamicBuildingSize(building, state.baseSectors || []);
              const isDestroyed = building.health <= 0;
              const height = isDestroyed ? 6 : height3D;
              const isSelected = selectedBuildingId === building.id;
              const isHovered = hoveredBuildingId === building.id;
              const faction = state.factions[building.ownerId] || { name: 'Neutral', color: '#64748b' };
              
              // Center footprint inside uniform 3x3 lot
              const offsetX = (3 - footprintW) / 2;
              const offsetY = (3 - footprintH) / 2;
              const W = footprintW * CELL_SIZE - 2;
              const D = footprintH * CELL_SIZE - 2;
              const posX = (building.x + offsetX) * CELL_SIZE + 1;
              const posY = (building.y + offsetY) * CELL_SIZE + 1;

              return (
                <div
                  key={building.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBuildingId(building.id);
                  }}
                  onMouseEnter={() => setHoveredBuildingId(building.id)}
                  onMouseLeave={() => setHoveredBuildingId(null)}
                  className={`absolute cursor-pointer transition-all duration-300 ${
                    isSelected ? 'z-50' : 'z-20'
                  }`}
                  style={{
                    left: posX,
                    top: posY,
                    width: W,
                    height: D,
                    transform: `translateZ(${BUILDING_BASE_DEPTH_OFFSET}px)`,
                    transformStyle: 'preserve-3d'
                  }}
                >
                  {/* Ground Foundation Base */}
                  <div 
                    className="absolute inset-0 bg-[#0f141d] border border-slate-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.9)]"
                    style={{ 
                      transform: `translateZ(${BUILDING_BASE_DEPTH_OFFSET}px)`
                    }}
                  />

                  {/* Ground Selection Ring */}
                  {isSelected && (
                    <div 
                      className="absolute inset-[-8px] border-2 border-high-primary rounded-sm shadow-[0_0_25px_rgba(96,165,250,0.8)] animate-pulse pointer-events-none"
                      style={{ 
                        transform: `translateZ(${BUILDING_BASE_DEPTH_OFFSET + SELECTION_HIGHLIGHT_OFFSET}px)`
                      }}
                    />
                  )}

                  {!isDestroyed ? (
                    <>
                      {/* ROOF (Top Face) */}
                      <div 
                        className={`absolute inset-0 border transition-colors flex flex-col justify-between overflow-hidden shadow-inner ${
                          isSelected 
                            ? 'border-white shadow-[0_0_30px_rgba(255,255,255,0.8)]' 
                            : isHovered 
                              ? 'border-slate-300' 
                              : 'border-slate-700'
                        }`}
                        style={{ 
                          transform: `translateZ(${height + BUILDING_BASE_DEPTH_OFFSET}px)`,
                          backgroundColor: isSelected 
                            ? `${faction.color}ee` 
                            : building.id === 'player-hq' 
                              ? '#1f2937' 
                              : building.type === 'OFFICE' 
                                ? '#1e293b' 
                                : building.type === 'FACTORY' 
                                  ? '#27272a' 
                                  : '#18181b'
                        }}
                      >
                        {/* Custom Roof Textures & Details per Building Type */}
                        {building.id === 'player-hq' ? (
                          // Player HQ Roof: Subway Depot Helipad & Radar
                          <div className="relative w-full h-full bg-[#1e293b] p-1.5 flex flex-col justify-between border-2 border-amber-500/50">
                            <div className="flex justify-between items-center text-[8px] font-mono font-black text-amber-400">
                              <span className="flex items-center gap-1"><Shield size={10} /> HQ DEPOT</span>
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                            </div>
                            <div className="flex items-center justify-center">
                              {/* Helipad Symbol [H] */}
                              <div className="w-10 h-10 rounded-full border-2 border-amber-400 flex items-center justify-center font-mono font-black text-amber-300 text-sm shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                                H
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-[7px] font-mono text-slate-400 font-bold">
                              <span>TRACK 01</span>
                              <span>LVL {level} // {roomCount} BAYS</span>
                            </div>
                          </div>
                        ) : building.id === 'rival-base' ? (
                          // Rival Gang Base Roof
                          <div className="relative w-full h-full bg-[#311018] p-1.5 flex flex-col justify-between border-2 border-red-600/80">
                            <div className="flex justify-between items-center text-[8px] font-mono font-black text-red-400">
                              <span className="flex items-center gap-1"><Flame size={10} /> SKULL FORTRESS</span>
                              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                            </div>
                            <div className="text-center font-black text-red-500 text-xs tracking-widest uppercase">
                              ☠ FORTRESS
                            </div>
                            <div className="h-1 bg-red-900/60 rounded" />
                          </div>
                        ) : building.id === 'city-hall' ? (
                          // City Hall Roof: Classical Glass Dome & Pediment
                          <div className="relative w-full h-full bg-[#1e293b] p-2 flex flex-col items-center justify-between border-2 border-blue-400/60">
                            <div className="text-[8px] font-mono font-black text-blue-300 uppercase tracking-widest">CENTRAL PLAZA</div>
                            <div className="w-12 h-12 rounded-full bg-blue-900/60 border-2 border-cyan-400/80 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                              <Sun size={18} className="text-cyan-300 animate-spin" style={{ animationDuration: '20s' }} />
                            </div>
                            <div className="text-[7px] font-mono text-slate-400">PLAZA DOME</div>
                          </div>
                        ) : building.type === 'OFFICE' ? (
                          // High-rise Office Tower Roof: Solar panels & AC vents
                          <div className="relative w-full h-full bg-[#0f172a] p-1.5 flex flex-col justify-between border border-cyan-500/40">
                            <div className="flex justify-between text-[7px] font-mono font-bold text-cyan-400">
                              <span>CORP TOWER</span>
                              <Radio size={10} className="text-cyan-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-1 my-auto">
                              <div className="h-4 bg-cyan-950 border border-cyan-800 rounded-xs" />
                              <div className="h-4 bg-cyan-950 border border-cyan-800 rounded-xs" />
                            </div>
                            <div className="text-[7px] font-mono text-slate-400 text-right">LVL {level} FACADE</div>
                          </div>
                        ) : building.type === 'FACTORY' ? (
                          // Industrial Factory Roof: Chimneys & Vent Pipes
                          <div className="relative w-full h-full bg-[#18181b] p-1.5 flex flex-col justify-between border border-amber-600/40">
                            <div className="flex justify-between text-[7px] font-mono font-bold text-amber-500">
                              <span>INDUSTRIAL</span>
                              <Zap size={10} className="text-amber-400" />
                            </div>
                            <div className="flex justify-around items-center my-1">
                              <div className="w-3 h-3 rounded-full bg-slate-800 border border-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                              <div className="w-3 h-3 rounded-full bg-slate-800 border border-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                            </div>
                            <div className="text-[7px] font-mono text-slate-500">EXHAUST BAY</div>
                          </div>
                        ) : (
                          // Standard Warehouse / Apartment Roof: Brick & Tar
                          <div className="relative w-full h-full bg-[#27272a] p-1 flex flex-col justify-between border border-slate-700">
                            <div className="text-[7px] font-mono text-slate-400 font-bold truncate">{building.name}</div>
                            <div className="w-4 h-4 bg-slate-800 border border-slate-600 rounded-xs mx-auto my-auto" />
                            <div className="text-[6.5px] font-mono text-slate-500 text-right">LVL {level} UNIT</div>
                          </div>
                        )}
                      </div>

                      {/* FRONT / SOUTH WALL (Facing South/Viewer) */}
                      <div 
                        className="absolute bg-[#182030] border border-slate-700/90 overflow-hidden" 
                        style={{
                         width: W,
                         height: height,
                         top: D,
                         left: 0,
                         transform: `translateZ(${BUILDING_BASE_DEPTH_OFFSET}px) rotateX(-90deg)`,
                         transformOrigin: 'top',
                         filter: 'brightness(95%)'
                        }}
                      >
                        {/* Vertical Floors / Levels Matrix */}
                        <div className="w-full h-full flex flex-col justify-between bg-[linear-gradient(180deg,rgba(30,41,59,0.8)_0%,rgba(15,23,42,0.95)_100%)] p-0.5">
                          {Array.from({ length: Math.max(1, level) }).map((_, floorIdx) => (
                            <div key={floorIdx} className="w-full border-b border-slate-700/60 flex items-center justify-around py-0.5" style={{ height: `${100 / Math.max(1, level)}%` }}>
                              <div className="w-2 h-2/3 bg-amber-400/80 rounded-xs shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
                              <div className="w-2 h-2/3 bg-slate-800 border border-slate-700 rounded-xs" />
                              <div className="w-2 h-2/3 bg-cyan-400/80 rounded-xs shadow-[0_0_4px_rgba(34,211,238,0.5)]" />
                              {footprintW >= 2 && (
                                <div className="w-2 h-2/3 bg-amber-400/80 rounded-xs shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* BACK / NORTH WALL */}
                      <div 
                        className="absolute bg-[#121826] border border-slate-700/80 overflow-hidden" 
                        style={{ 
                          width: W, 
                          height: height, 
                          top: 0, 
                          left: 0,
                          transform: `translateZ(${BUILDING_BASE_DEPTH_OFFSET}px) rotateX(-90deg)`,
                          transformOrigin: 'top',
                          filter: 'brightness(70%)'
                        }}
                      >
                        <div className="w-full h-full flex flex-col justify-between bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(30,41,59,0.8)_100%)] p-0.5">
                          {Array.from({ length: Math.max(1, level) }).map((_, floorIdx) => (
                            <div key={floorIdx} className="w-full border-b border-slate-700/60 flex items-center justify-around py-0.5" style={{ height: `${100 / Math.max(1, level)}%` }}>
                              <div className="w-2 h-2/3 bg-slate-800 border border-slate-700 rounded-xs" />
                              <div className="w-2 h-2/3 bg-cyan-400/80 rounded-xs shadow-[0_0_4px_rgba(34,211,238,0.5)]" />
                              <div className="w-2 h-2/3 bg-amber-400/80 rounded-xs shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* LEFT / WEST WALL */}
                      <div 
                        className="absolute bg-[#141c2c] border border-slate-700/80 overflow-hidden" 
                        style={{ 
                          width: height, 
                          height: D, 
                          top: 0, 
                          left: 0,
                          transform: `translateZ(${BUILDING_BASE_DEPTH_OFFSET}px) rotateY(-90deg)`,
                          transformOrigin: 'left',
                          filter: 'brightness(80%)'
                        }}
                      >
                        <div className="w-full h-full flex flex-col justify-around bg-[linear-gradient(90deg,rgba(15,23,42,0.9)_0%,rgba(30,41,59,0.85)_100%)] p-0.5">
                          {Array.from({ length: Math.max(1, level) }).map((_, floorIdx) => (
                            <div key={floorIdx} className="w-full border-b border-slate-700/50 flex items-center justify-around py-0.5" style={{ height: `${100 / Math.max(1, level)}%` }}>
                              <div className="w-1.5 h-2/3 bg-amber-400/70 rounded-xs" />
                              <div className="w-1.5 h-2/3 bg-slate-800 border border-slate-700 rounded-xs" />
                              <div className="w-1.5 h-2/3 bg-cyan-400/70 rounded-xs" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* RIGHT / EAST WALL */}
                      <div 
                        className="absolute bg-[#101622] border border-slate-700/80 overflow-hidden" 
                        style={{ 
                          width: height, 
                          height: D, 
                          top: 0, 
                          left: W,
                          transform: `translateZ(${BUILDING_BASE_DEPTH_OFFSET}px) rotateY(-90deg)`,
                          transformOrigin: 'left',
                          filter: 'brightness(75%)'
                        }}
                      >
                        <div className="w-full h-full flex flex-col justify-around bg-[linear-gradient(90deg,rgba(30,41,59,0.85)_0%,rgba(15,23,42,0.9)_100%)] p-0.5">
                          {Array.from({ length: Math.max(1, level) }).map((_, floorIdx) => (
                            <div key={floorIdx} className="w-full border-b border-slate-700/50 flex items-center justify-around py-0.5" style={{ height: `${100 / Math.max(1, level)}%` }}>
                              <div className="w-1.5 h-2/3 bg-cyan-400/70 rounded-xs" />
                              <div className="w-1.5 h-2/3 bg-amber-400/70 rounded-xs" />
                              <div className="w-1.5 h-2/3 bg-slate-800 border border-slate-700 rounded-xs" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Destroyed Building Rubble Heap */
                    <div 
                      className="absolute inset-0 bg-red-950/60 border-2 border-red-700/80 rounded-xs p-1 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                      style={{ 
                        transform: `translateZ(${height}px)`
                      }}
                    >
                      <AlertTriangle size={14} className="text-red-500 animate-pulse" />
                      <span className="text-[7px] font-mono font-black text-red-400 uppercase tracking-tight">RUINS</span>
                    </div>
                  )}

                  {/* Selected Building Vertical Light Pillar */}
                  {isSelected && (
                    <div 
                      className="absolute w-1 bg-gradient-to-t from-high-primary to-transparent pointer-events-none"
                      style={{
                        height: 250,
                        left: W / 2,
                        top: D / 2,
                        transform: `translateZ(${height + BUILDING_BASE_DEPTH_OFFSET}px) rotateX(90deg)`,
                        transformOrigin: 'bottom center',
                        boxShadow: '0 0 15px rgba(96,165,250,0.9)'
                      }}
                    />
                  )}

                  {/* World Space Floating Label - Upright Facing Camera */}
                  <div 
                    className="absolute pointer-events-none transition-all duration-200"
                    style={{
                     left: W / 2,
                     top: 0,
                     transform: `translate3d(-50%, -100%, ${height + LABEL_HEIGHT_OFFSET + BUILDING_BASE_DEPTH_OFFSET}px) rotateZ(-${rotation}deg) rotateX(-${pitch}deg)`,
                     transformOrigin: 'center center'
                    }}
                  >
                    <div className={`px-2 py-1 rounded-sm shadow-2xl backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap border ${
                      isSelected 
                        ? 'bg-slate-900/95 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' 
                        : 'bg-slate-950/90 border-slate-700 text-slate-200'
                    }`}>
                      {/* Faction Color Indicator */}
                      <span 
                        className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: faction.color }}
                      />
                      
                      <span className="text-[9px] font-mono font-black uppercase tracking-tight">
                        {building.name}
                      </span>

                      {level > 1 ? (
                        <span className="text-[7.5px] font-mono font-black text-cyan-300 bg-cyan-950/90 px-1.5 py-0.5 rounded border border-cyan-500/50 shadow-[0_0_6px_rgba(34,211,238,0.4)]">
                          LVL {level} // {roomCount} RMs
                        </span>
                      ) : (
                        <span className="text-[7.5px] font-mono font-bold text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-slate-700">
                          {roomCount} RM
                        </span>
                      )}

                      {/* Health Indicator Mini-Bar */}
                      <div className="w-8 h-1 bg-slate-800 rounded-full overflow-hidden ml-1 border border-slate-700">
                        <div 
                          className={`h-full ${building.health < building.maxHealth * 0.3 ? 'bg-red-500' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.max(0, (building.health / building.maxHealth) * 100)}%` }}
                        />
                      </div>

                      {building.isScouted && (
                        <span className="text-[7px] font-mono font-bold text-amber-400 bg-amber-950/80 px-1 rounded-xs border border-amber-500/40">
                          INTEL
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Structure Intel Sidebar */}
      <AnimatePresence>
        {showInfo && selectedBuilding && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-[#0d111a] border-l border-slate-700 flex flex-col z-50 shadow-2xl"
          >
            <div className="p-4 border-b border-high-border flex justify-between items-center bg-high-header shadow-md">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white text-glow-blue flex items-center gap-2">
                <Target size={16} className="text-high-primary" />
                Structure Intel
              </h3>
              <button onClick={() => setShowInfo(false)} className="text-slate-400 hover:text-white p-1 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-high-sidebar shadow-inner">
              <section>
                <div className="text-[10px] text-high-dim font-black uppercase mb-1.5 tracking-widest border-l-2 border-high-primary pl-2">
                  Tactical Entry
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">{selectedBuilding.name}</h2>
                <div className="mt-2 text-[11px] font-mono font-bold uppercase flex items-center gap-2">
                  <span className="text-high-dim">STATUS:</span>
                  <span className={selectedBuilding.health > 0 ? 'text-high-success text-glow-green' : 'text-high-danger text-glow-red animate-pulse'}>
                    {selectedBuilding.health > 0 ? 'OPERATIONAL' : 'ASSET DESTROYED'}
                  </span>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex justify-between text-[10px] font-mono text-slate-300 font-bold tracking-tight">
                  <span className="uppercase">Structural Integrity</span>
                  <span className={selectedBuilding.health < selectedBuilding.maxHealth * 0.3 ? 'text-high-danger' : 'text-white'}>
                    {Math.round((selectedBuilding.health / selectedBuilding.maxHealth) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-high-bg border border-high-border rounded-full overflow-hidden p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${selectedBuilding.health < selectedBuilding.maxHealth * 0.3 ? 'bg-high-danger shadow-[0_0_8px_rgba(248,113,113,0.5)]' : 'bg-high-primary shadow-[0_0_8px_rgba(96,165,250,0.5)]'}`}
                    style={{ width: `${(selectedBuilding.health / selectedBuilding.maxHealth) * 100}%` }} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-high-card p-3 border border-high-border rounded shadow-sm">
                    <div className="text-[9px] text-high-dim uppercase font-black tracking-widest mb-1">Category</div>
                    <div className="text-[11px] text-white font-mono font-bold">{selectedBuilding.type}</div>
                  </div>
                  <div className="bg-high-card p-3 border border-high-border rounded shadow-sm">
                    <div className="text-[9px] text-high-dim uppercase font-black tracking-widest mb-1">Owner</div>
                    <div className="text-[11px] font-mono font-bold truncate" style={{ color: state.factions[selectedBuilding.ownerId]?.color || '#10b981' }}>
                      {state.factions[selectedBuilding.ownerId]?.name}
                    </div>
                  </div>
                </div>
              </section>

              <section className="pt-4 border-t border-high-border space-y-4">
                {selectedBuilding.ownerId === 'player' ? (
                  <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-sm space-y-3 shadow-md">
                    <div className="flex justify-between items-center text-[10px] font-mono font-black uppercase text-emerald-400 tracking-wider">
                      <span className="flex items-center gap-1.5">🏛️ Conquered Territory</span>
                      <span className="text-glow-green">{(state.baseSectors || []).filter(s => s.buildingId === selectedBuilding.id).length} BAYS</span>
                    </div>
                    <div className="space-y-1.5">
                      {(state.baseSectors || []).filter(s => s.buildingId === selectedBuilding.id).length > 0 ? (
                        (state.baseSectors || []).filter(s => s.buildingId === selectedBuilding.id).map((sector) => (
                          <div key={sector.id} className="p-2 bg-black/60 border border-emerald-900/60 rounded text-[10px] font-mono flex justify-between items-center">
                            <span className="text-slate-200 font-bold truncate pr-2">{sector.name}</span>
                            <span className={sector.type === 'EMPTY' ? 'text-slate-500 font-mono' : 'text-emerald-400 font-black'}>
                              [{sector.type}]
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-slate-400 font-mono">Main Operations HQ (6 Subway Bays)</div>
                      )}
                    </div>
                  </div>
                ) : selectedBuilding.isScouted ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-sm space-y-2 text-[10px] font-mono text-slate-300">
                      <div className="flex justify-between items-center text-[9px] font-mono font-black uppercase text-amber-400">
                        <span>💡 Pre-Equipped Facilities</span>
                        <span>SCOUTED</span>
                      </div>
                      <p className="text-[9.5px] text-slate-400">Capturing this structure instantly unlocks the following pre-built facility bays:</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(() => {
                          const area = (selectedBuilding.width || 1) * (selectedBuilding.height || 1);
                          const slots = area >= 6 ? 3 : area >= 3 ? 2 : 1;
                          const facs = getInitialFacilitiesForBuilding(selectedBuilding, slots);
                          const iconMap: Record<string, string> = {
                            LAB: '🔬 Tech Lab',
                            GARAGE: '🚚 Garage',
                            ARMORY: '🛡️ Armory',
                            INFIRMARY: '🏥 Infirmary',
                            COMMAND: '🏢 Command',
                            POWER: '⚡ Generator Core',
                            HYDROPONICS: '🌱 Hydroponics',
                            WORKSHOP: '🔧 Workshop Bay',
                            QUARTERS: '🛏️ Crew Quarters',
                            EMPTY: '📦 Empty Bay'
                          };
                          return facs.map((f, idx) => (
                            <span key={idx} className="px-2 py-1 bg-black/80 border border-amber-500/30 text-amber-300 font-bold text-[9px] rounded shadow-sm">
                              {iconMap[f] || f}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                    
                    {selectedBuilding.intel && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-sm space-y-2 text-[10px] font-mono text-slate-300">
                        <div className="flex justify-between items-center text-[9px] font-mono font-black uppercase text-blue-400">
                          <span>📊 Intel Report</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                           <div className="flex justify-between">
                             <span className="text-slate-400">Civilians Present:</span>
                             <span className="text-white font-bold">{selectedBuilding.intel.civilians}</span>
                           </div>
                           <div className="flex justify-between">
                             <span className="text-slate-400">Est. Resources:</span>
                             <span className="text-green-400 font-bold">₮{selectedBuilding.intel.resources}</span>
                           </div>
                           <div className="flex justify-between">
                             <span className="text-slate-400">Hostiles Detected:</span>
                             <span className="text-red-400 font-bold">{selectedBuilding.intel.hostiles}</span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-sm space-y-2 text-[10px] font-mono text-slate-300 text-center">
                    <div className="text-[12px] text-amber-500 font-black uppercase mb-1">UNSCOUTED STRUCTURE</div>
                    <p className="text-[9.5px] text-slate-400">Facilities and hostile presence are unknown. Send a scout squad to gather intel before launching a raid.</p>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-sm space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-mono font-black uppercase text-slate-500 tracking-widest">
                    <span>Transit Logistics</span>
                    <span className="text-high-primary">ESTIMATED</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">From:</span>
                    <select
                      value={launchBaseId}
                      onChange={(e) => setLaunchBaseId(e.target.value)}
                      className="bg-slate-800 text-white font-mono text-[10px] px-2 py-1 outline-none border border-slate-700 rounded-sm"
                    >
                      {(Object.values(state.buildings) as any[]).filter(b => b.ownerId === 'player').map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {activeVehicle ? <Truck size={14} className="text-high-primary" /> : <User size={14} className="text-slate-400" />}
                      <span className="text-[11px] font-mono font-bold text-white uppercase">{activeVehicle ? activeVehicle.name : 'BY FOOT'}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-mono font-black text-white">{travelTimeMinutes} MIN</div>
                      <div className="text-[8px] font-mono text-slate-500 uppercase">Travel Time</div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-slate-500 font-bold uppercase">
                    <span>Distance: {distance.toFixed(1)} km</span>
                    <span>Speed: {travelSpeed} km/h</span>
                  </div>
                </div>

                {selectedBuilding.ownerId !== 'player' ? (
                  <button 
                    onClick={() => handleStartMission(selectedBuilding)}
                    disabled={selectedBuilding.health <= 0}
                    className="w-full py-3.5 bg-red-700 hover:bg-red-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[12px] font-black uppercase tracking-[0.2em] transition-all border border-red-900/50 flex items-center justify-center gap-3 group shadow-lg rounded-sm cursor-pointer"
                  >
                    <Target size={16} className="group-hover:scale-125 transition-transform" />
                    Commence Raid
                  </button>
                ) : (
                  <div className="p-4 border-2 border-dashed border-high-border text-center text-[10px] text-high-dim uppercase font-bold tracking-[0.1em] rounded-sm">
                    Operational Headquarters
                  </div>
                )}
                
                {(() => {
                  const isScouting = state.activeScouts?.some(s => s.buildingId === selectedBuilding.id);
                  const isScouted = selectedBuilding.isScouted;
                  const canScout = selectedBuilding.ownerId !== 'player' && !isScouted && !isScouting && state.funds >= scoutCost;
                  let btnText = `Gather Intel - ₮${scoutCost} (${scoutTravelTimeMinutes}m)`;
                  if (isScouting) btnText = 'Scout En Route...';
                  else if (isScouted) btnText = 'Intel Gathered';
                  else if (selectedBuilding.ownerId !== 'player' && state.funds < scoutCost) btnText = 'Insufficient Funds';
                  
                  return (
                    <button 
                      onClick={() => handleStartScout(selectedBuilding)}
                      disabled={!canScout}
                      className="w-full py-2.5 bg-slate-800 disabled:bg-slate-900 disabled:text-slate-600 enabled:hover:bg-slate-700 text-slate-300 text-[10px] uppercase font-bold tracking-widest transition-colors border border-slate-700 disabled:border-slate-800 rounded-sm cursor-pointer">
                      {btnText}
                    </button>
                  );
                })()}
              </section>
            </div>

            <div className="p-3 bg-[#0a0d14] text-[8px] font-mono text-slate-500 border-t border-slate-800 flex justify-between items-center">
              <span>SECURE ACCESS LOGS</span>
              <span className="animate-pulse text-emerald-400 font-bold">● LIVE UPLINK</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showInfo && selectedBuilding && (
        <button 
          onClick={() => setShowInfo(true)}
          className="absolute right-4 bottom-16 p-3 bg-high-primary text-slate-950 font-black z-40 shadow-2xl border border-white flex items-center gap-2 text-[10px] uppercase tracking-widest rounded-sm cursor-pointer"
        >
          <Info size={16} />
          <span>Structure Intel</span>
        </button>
      )}
    </div>
  );
};

export default CityMap;
