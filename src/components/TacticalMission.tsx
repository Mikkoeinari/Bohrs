/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useGame, getUnitEncumbrance } from '../store/GameContext';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Swords, ArrowRight, User, X, ChevronLeft, ChevronRight, List, Move, Crosshair, Package, RefreshCw, Zap, Sparkles, Scale, Gauge } from 'lucide-react';
import { ITEMS } from '../data';
import type { BaseSector } from '../types';

export type BehavioralStance = 'AMOK' | 'AGGRESSIVE' | 'SUPPORT' | 'DEFENSIVE' | 'PASSIVE';

interface TacticalUnit {
  id: string;
  name: string;
  faction: 'PLAYER' | 'ENEMY';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  accuracy: number;
  weapons: string[];
  activeWeaponId: string;
  inventory: string[];
  path?: {x: number, y: number}[];
  targetEnemyId?: string;
  targetObstacleCoords?: {x: number, y: number};
  cooldown?: number;
  behavior?: BehavioralStance;
  totalWeight?: number;
  carryLimit?: number;
  movementApCost?: number;
}

interface PendingAction {
  type: 'MOVE' | 'ATTACK';
  unitId: string;
  x: number;
  y: number;
}

export interface Room {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  bgClass: string;
  type: string;
}

type ObstacleType = 'wall' | 'server' | 'vat' | 'crate' | 'desk' | 'generator' | 'bed' | 'door';
type PlacedObstacleType = Exclude<ObstacleType, 'door'>;

interface ObstacleData {
  type: ObstacleType;
  hp: number;
  maxHp: number;
}

const VoxelCube = ({ width = 36, height = 30, depth = 36, topColor, frontColor, leftColor, rightColor, children }: any) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const halfDepth = depth / 2;

  return (
    <div 
      className="absolute pointer-events-none"
      style={{
        width: `${width}px`,
        height: `${depth}px`,
        left: '50%',
        top: '50%',
        transform: 'translate3d(-50%, -50%, 0px)',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Top face */}
      <div 
        className="absolute inset-0 border border-black/10"
        style={{
          backgroundColor: topColor,
          transform: `rotateX(90deg) translateZ(${halfDepth}px)`
        }}
      >
        {children}
      </div>

      {/* Bottom face */}
      <div 
        className="absolute inset-0 border border-black/10"
        style={{
          backgroundColor: topColor,
          transform: `rotateX(-90deg) translateZ(${halfDepth}px)`
        }}
      />

      {/* Front face (facing South / positive Y) */}
      <div 
        className="absolute left-0 right-0 border border-black/10"
        style={{
          height: `${height}px`,
          backgroundColor: frontColor,
          bottom: 0,
          transform: `translateZ(${halfDepth}px)`,
          transformOrigin: 'bottom'
        }}
      />

      {/* Back face (facing North / negative Y) */}
      <div 
        className="absolute left-0 right-0 border border-black/10"
        style={{
          height: `${height}px`,
          backgroundColor: frontColor,
          top: 0,
          transform: `rotateY(180deg) translateZ(${halfDepth}px)`,
          transformOrigin: 'top'
        }}
      />

      {/* Left face (facing West / negative X) */}
      <div 
        className="absolute top-0 bottom-0 border border-black/10"
        style={{
          width: `${height}px`,
          height: `${depth}px`,
          backgroundColor: leftColor,
          left: 0,
          transform: `rotateY(-90deg)`,
          transformOrigin: 'left'
        }}
      />

      {/* Right face (facing East / positive X) */}
      <div 
        className="absolute top-0 bottom-0 border border-black/10"
        style={{
          width: `${height}px`,
          height: `${depth}px`,
          backgroundColor: rightColor,
          right: 0,
          transform: `rotateY(90deg)`,
          transformOrigin: 'right'
        }}
      />
    </div>
  );
};

const ObstacleVoxel = ({ type, hp, maxHp }: { type: ObstacleType; hp: number; maxHp: number }) => {
  const palette = (() => {
    switch (type) {
      case 'wall':
        return {
          width: 30,
          height: 16,
          depth: 24,
          topColor: '#64748b',
          frontColor: '#475569',
          leftColor: '#334155',
          rightColor: '#64748b',
        };
      case 'server':
        return {
          width: 28,
          height: 18,
          depth: 28,
          topColor: '#0f172a',
          frontColor: '#1d4ed8',
          leftColor: '#1e3a8a',
          rightColor: '#2563eb',
        };
      case 'vat':
        return {
          width: 28,
          height: 20,
          depth: 26,
          topColor: '#065f46',
          frontColor: '#047857',
          leftColor: '#064e3b',
          rightColor: '#10b981',
        };
      case 'crate':
        return {
          width: 28,
          height: 16,
          depth: 24,
          topColor: '#b45309',
          frontColor: '#92400e',
          leftColor: '#78350f',
          rightColor: '#d97706',
        };
      case 'desk':
        return {
          width: 34,
          height: 14,
          depth: 24,
          topColor: '#4b5563',
          frontColor: '#374151',
          leftColor: '#1f2937',
          rightColor: '#6b7280',
        };
      case 'generator':
        return {
          width: 28,
          height: 18,
          depth: 24,
          topColor: '#7f1d1d',
          frontColor: '#991b1b',
          leftColor: '#b91c1c',
          rightColor: '#dc2626',
        };
      case 'bed':
        return {
          width: 32,
          height: 14,
          depth: 24,
          topColor: '#1e3a8a',
          frontColor: '#2563eb',
          leftColor: '#1d4ed8',
          rightColor: '#60a5fa',
        };
      default:
        return {
          width: 28,
          height: 16,
          depth: 24,
          topColor: '#64748b',
          frontColor: '#475569',
          leftColor: '#334155',
          rightColor: '#64748b',
        };
    }
  })();

  const detailClassName = (() => {
    switch (type) {
      case 'server':
        return 'border border-cyan-300/60 bg-cyan-400/25';
      case 'vat':
        return 'border border-emerald-200/60 bg-emerald-300/20';
      case 'crate':
        return 'border border-amber-200/50 bg-amber-200/20';
      case 'desk':
        return 'border border-zinc-200/40 bg-zinc-100/15';
      case 'generator':
        return 'border border-red-200/50 bg-red-300/20';
      case 'bed':
        return 'border border-sky-200/50 bg-sky-100/15';
      default:
        return 'border border-slate-100/20 bg-slate-100/10';
    }
  })();

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ transformStyle: 'preserve-3d' }}>
      <VoxelCube
        width={palette.width}
        height={palette.height}
        depth={palette.depth}
        topColor={palette.topColor}
        frontColor={palette.frontColor}
        leftColor={palette.leftColor}
        rightColor={palette.rightColor}
      >
        <div className={`absolute inset-[18%] rounded-[2px] ${detailClassName}`} />
      </VoxelCube>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[60] bg-black/75 px-1.5 py-0.5 rounded border border-white/20 flex items-center gap-0.5 shadow-md scale-75">
        <span className="text-[6px] text-amber-400 font-bold tracking-tighter leading-none">{hp}</span>
        <div className="w-6 h-1 bg-slate-900 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500" style={{ width: `${(hp / maxHp) * 100}%` }} />
        </div>
      </div>
    </div>
  );
};

const MAP_GRID_SIZE = 24;

type FloorTileLabel = 'floor' | 'wall' | 'furniture' | 'accessway' | 'stairs';

interface FloorPlanTile {
  label: FloorTileLabel;
  roomType?: string;
  roomName?: string;
}

interface RoomPlacementSpec {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  roomType: string;
}

interface RoomConnectionSpec {
  fromIndex: number;
  toIndex: number;
  axis: 'H' | 'V';
}

export const getLayoutForBuildingType = (buildingType: string, sectors: BaseSector[] = []) => {
  const roomTypes = sectors
    .filter((sector): sector is BaseSector => Boolean(sector?.type && sector.type !== 'EMPTY'))
    .map((sector) => sector.type);

  const fallbackRoomTypes = buildingType === 'FACTORY' || buildingType === 'LAB'
    ? ['LAB', 'WORKSHOP', 'POWER', 'STAIRCASE']
    : buildingType === 'BASE'
      ? ['COMMAND', 'ARMORY', 'INFIRMARY', 'QUARTERS']
      : buildingType === 'OFFICE' || buildingType === 'CLUB'
        ? ['COMMAND', 'ARMORY', 'INFIRMARY', 'LOUNGE']
        : ['WORKSHOP', 'POWER', 'QUARTERS', 'STAIRCASE'];

  const selectedRoomTypes = roomTypes.length > 0 ? roomTypes : fallbackRoomTypes;
  const roomCount = Math.min(9, Math.max(1, selectedRoomTypes.length));
  const resolvedRoomTypes = selectedRoomTypes.slice(0, roomCount);

  const rooms: Room[] = [];
  const floorPlan: Record<string, FloorPlanTile> = {};
  const obstacles: Record<string, ObstacleData> = {};

  const roomStyles: Record<string, { name: string; color: string; bgClass: string; furnitureType: PlacedObstacleType; furniturePositions: Array<{ x: number; y: number }> }> = {
    COMMAND: { name: 'COMMAND BAY', color: 'text-red-400 border-red-500/30', bgClass: 'bg-red-950/10', furnitureType: 'desk', furniturePositions: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
    LAB: { name: 'LAB BAY', color: 'text-cyan-400 border-cyan-500/30', bgClass: 'bg-cyan-950/10', furnitureType: 'server', furniturePositions: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ARMORY: { name: 'ARMORY BAY', color: 'text-orange-400 border-orange-500/30', bgClass: 'bg-orange-950/10', furnitureType: 'generator', furniturePositions: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
    INFIRMARY: { name: 'MED BAY', color: 'text-emerald-400 border-emerald-500/30', bgClass: 'bg-emerald-950/10', furnitureType: 'bed', furniturePositions: [{ x: 0, y: 0 }] },
    QUARTERS: { name: 'QUARTERS', color: 'text-slate-400 border-slate-500/30', bgClass: 'bg-slate-900/10', furnitureType: 'bed', furniturePositions: [{ x: 0, y: 0 }] },
    WORKSHOP: { name: 'WORKSHOP', color: 'text-amber-400 border-amber-500/30', bgClass: 'bg-amber-950/10', furnitureType: 'generator', furniturePositions: [{ x: 0, y: 0 }] },
    POWER: { name: 'POWER BAY', color: 'text-purple-400 border-purple-500/30', bgClass: 'bg-purple-950/10', furnitureType: 'vat', furniturePositions: [{ x: 1, y: 0 }] },
    HYDROPONICS: { name: 'HYDROPONICS', color: 'text-lime-400 border-lime-500/30', bgClass: 'bg-lime-950/10', furnitureType: 'vat', furniturePositions: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    GARAGE: { name: 'GARAGE', color: 'text-zinc-400 border-zinc-500/30', bgClass: 'bg-zinc-900/10', furnitureType: 'desk', furniturePositions: [{ x: 0, y: 1 }] },
    STAIRCASE: { name: 'STAIRS', color: 'text-yellow-400 border-yellow-500/30', bgClass: 'bg-yellow-950/10', furnitureType: 'desk', furniturePositions: [] },
    LOUNGE: { name: 'LOUNGE', color: 'text-indigo-400 border-indigo-500/30', bgClass: 'bg-indigo-950/10', furnitureType: 'bed', furniturePositions: [{ x: 0, y: 0 }] },
    LOBBY: { name: 'LOBBY', color: 'text-blue-400 border-blue-500/30', bgClass: 'bg-blue-950/10', furnitureType: 'desk', furniturePositions: [{ x: 0, y: 0 }] },
  };

  const roomBoxSize = 11;
  const roomPadding = 1;

  const buildRoomLayout = (count: number) => {
    const placements: RoomPlacementSpec[] = [];
    const connections: RoomConnectionSpec[] = [];

    const makePlacement = (x1: number, y1: number, index: number) => {
      const roomType = resolvedRoomTypes[index] || resolvedRoomTypes[resolvedRoomTypes.length - 1] || 'LOBBY';
      placements.push({
        x1,
        y1,
        x2: x1 + roomBoxSize - 1,
        y2: y1 + roomBoxSize - 1,
        roomType,
      });
    };

    if (count === 1) {
      makePlacement(6, 7, 0);
      return { placements, connections };
    }

    if (count === 2) {
      makePlacement(2, 7, 0);
      makePlacement(13, 7, 1);
      connections.push({ fromIndex: 0, toIndex: 1, axis: 'H' });
      return { placements, connections };
    }

    if (count === 3) {
      makePlacement(2, 2, 0);
      makePlacement(2, 14, 1);
      makePlacement(13, 2, 2);
      connections.push({ fromIndex: 0, toIndex: 1, axis: 'V' });
      connections.push({ fromIndex: 1, toIndex: 2, axis: 'H' });
      return { placements, connections };
    }

    const columns = Math.min(3, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const maxX = MAP_GRID_SIZE - roomBoxSize - 1;
    const maxY = MAP_GRID_SIZE - roomBoxSize - 1;
    const xStep = columns > 1 ? Math.floor(maxX / (columns - 1)) : 0;
    const yStep = rows > 1 ? Math.floor(maxY / (rows - 1)) : 0;

    for (let index = 0; index < count; index++) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x1 = Math.min(1 + column * xStep, maxX);
      const y1 = Math.min(1 + row * yStep, maxY);
      makePlacement(x1, y1, index);
    }

    for (let index = 1; index < count; index++) {
      const previousIndex = index - 1;
      const previousPlacement = placements[previousIndex];
      const currentPlacement = placements[index];
      const axis = currentPlacement.x1 >= previousPlacement.x2 ? 'H' : 'V';
      connections.push({ fromIndex: previousIndex, toIndex: index, axis });
    }

    return { placements, connections };
  };

  const setTile = (x: number, y: number, label: FloorTileLabel, roomType?: string, roomName?: string) => {
    floorPlan[`${x},${y}`] = { label, roomType, roomName };
  };

  const getTileHp = (type: PlacedObstacleType) => {
    if (type === 'generator') return 120;
    if (type === 'vat') return 80;
    if (type === 'server' || type === 'desk') return 60;
    if (type === 'bed') return 50;
    return 50;
  };

  const placeDoor = (x: number, y: number) => {
    setTile(x, y, 'accessway');
    delete obstacles[`${x},${y}`];
    obstacles[`${x},${y}`] = { type: 'door', hp: 0, maxHp: 0 };
  };

  const carveRoom = (x1: number, y1: number, x2: number, y2: number, roomType: string, template: { name: string; color: string; bgClass: string; furnitureType: PlacedObstacleType; furniturePositions: Array<{ x: number; y: number }> }) => {
    rooms.push({
      name: template.name,
      x1,
      y1,
      x2,
      y2,
      color: template.color,
      bgClass: template.bgClass,
      type: roomType,
    });

    for (let tileX = x1; tileX <= x2; tileX++) {
      for (let tileY = y1; tileY <= y2; tileY++) {
        const isBorder = tileX === x1 || tileX === x2 || tileY === y1 || tileY === y2;
        setTile(tileX, tileY, isBorder ? 'wall' : 'floor', roomType, template.name);
        if (isBorder) {
          obstacles[`${tileX},${tileY}`] = { type: 'wall', hp: 100, maxHp: 100 };
        }
      }
    }

    if (roomType === 'STAIRCASE') {
      const stairsX = x1 + 1;
      const stairsY = y1 + 1;
      setTile(stairsX, stairsY, 'stairs', roomType, template.name);
    } else {
      template.furniturePositions.forEach((slot) => {
        const furnitureX = x1 + 1 + slot.x;
        const furnitureY = y1 + 1 + slot.y;
        const hp = getTileHp(template.furnitureType);
        setTile(furnitureX, furnitureY, 'furniture', roomType, template.name);
        obstacles[`${furnitureX},${furnitureY}`] = { type: template.furnitureType, hp, maxHp: hp };
      });
    }
  };

  const carveConnection = (fromPlacement: RoomPlacementSpec, toPlacement: RoomPlacementSpec) => {
    if (toPlacement.x1 >= fromPlacement.x2) {
      const corridorY = Math.round((fromPlacement.y1 + fromPlacement.y2) / 2);
      const corridorStart = fromPlacement.x2 + roomPadding;
      const corridorEnd = toPlacement.x1 - roomPadding;
      const doorX = Math.max(corridorStart, Math.min(corridorEnd, Math.floor((corridorStart + corridorEnd) / 2)));

      for (let tileX = corridorStart; tileX <= corridorEnd; tileX++) {
        setTile(tileX, corridorY, 'accessway');
        delete obstacles[`${tileX},${corridorY}`];
      }

      placeDoor(doorX, corridorY);
      return;
    }

    if (toPlacement.y1 >= fromPlacement.y2) {
      const corridorX = Math.round((fromPlacement.x1 + fromPlacement.x2) / 2);
      const corridorStart = fromPlacement.y2 + roomPadding;
      const corridorEnd = toPlacement.y1 - roomPadding;
      const doorY = Math.max(corridorStart, Math.min(corridorEnd, Math.floor((corridorStart + corridorEnd) / 2)));

      for (let tileY = corridorStart; tileY <= corridorEnd; tileY++) {
        setTile(corridorX, tileY, 'accessway');
        delete obstacles[`${corridorX},${tileY}`];
      }

      placeDoor(corridorX, doorY);
      return;
    }
  };

  for (let x = 0; x < MAP_GRID_SIZE; x++) {
    for (let y = 0; y < MAP_GRID_SIZE; y++) {
      const isBoundary = x === 0 || x === MAP_GRID_SIZE - 1 || y === 0 || y === MAP_GRID_SIZE - 1;
      setTile(x, y, isBoundary ? 'wall' : 'floor');
      if (isBoundary) {
        obstacles[`${x},${y}`] = { type: 'wall', hp: 100, maxHp: 100 };
      }
    }
  }

  const { placements, connections } = buildRoomLayout(roomCount);
  placements.forEach((placement) => {
    const template = roomStyles[placement.roomType] || roomStyles.LOBBY;
    carveRoom(placement.x1, placement.y1, placement.x2, placement.y2, placement.roomType, template);
  });

  if (placements.length > 0) {
    const firstPlacement = placements[0];
    const exteriorDoorY = Math.round((firstPlacement.y1 + firstPlacement.y2) / 2);
    placeDoor(firstPlacement.x1, exteriorDoorY);
  }

  connections.forEach((connection) => {
    carveConnection(placements[connection.fromIndex], placements[connection.toIndex]);
  });

  return { rooms, floorPlan, obstacles, lootTiles: [] as { x: number; y: number; itemId: string; name: string }[] };
};

const TacticalMission = () => {
  const { state, finishMission } = useGame();
  const [units, setUnits] = useState<TacticalUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [lootTiles, setLootTiles] = useState<{ x: number, y: number, itemId: string, name: string }[]>([]);
  const [isPaused, setIsPaused] = useState(true);
  const [tick, setTick] = useState(0);
  const [unitKills, setUnitKills] = useState<Record<string, number>>({});
  const [log, setLog] = useState<string[]>(['Operation Initialized. Sector 4 Laboratory secure entry confirmed.']);
  const [showStatus, setShowStatus] = useState(true);
  const [showLog, setShowLog] = useState(true);

  const [missionOutcome, setMissionOutcome] = useState<'IN_PROGRESS' | 'VICTORY' | 'DEFEAT'>('IN_PROGRESS');
  const [loot, setLoot] = useState<{ id: string; itemId?: string; name: string; type: string; credits?: number; secured: boolean }[]>([]);
  const [isConquerPhase, setIsConquerPhase] = useState(false);
  const [failedAction, setFailedAction] = useState<{ x: number, y: number, type: 'BLOCKED' | 'NO_AP' | 'OBSTRUCTED' } | null>(null);
  const GRID_SIZE = MAP_GRID_SIZE;

  const [obstacles, setObstacles] = useState<Record<string, ObstacleData>>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  const [floorPlan, setFloorPlan] = useState<Record<string, FloorPlanTile>>({});
  const [mortarTargetingMode, setMortarTargetingMode] = useState(false);

  const hasLineOfSight = (x1: number, y1: number, x2: number, y2: number) => {
    let currX = x1;
    let currY = y1;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    while (currX !== x2 || currY !== y2) {
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currY += sy;
      }
      
      const obs = obstacles[`${currX},${currY}`];
      if ((currX !== x2 || currY !== y2) && obs && obs.hp > 0 && obs.type !== 'door') {
        return false;
      }
    }
    return true;
  };

  const isTileOccupied = (x: number, y: number, excludeUnitId?: string) => {
    const obs = obstacles[`${x},${y}`];
    if (obs && obs.hp > 0 && obs.type !== 'door') return true;
    return units.some(u => u.x === x && u.y === y && u.hp > 0 && u.id !== excludeUnitId);
  };

  const toggleLoot = (lootId: string) => {
    setLoot(prev => prev.map(item => item.id === lootId ? { ...item, secured: !item.secured } : item));
  };

  const handleChallengeTurf = () => {
    setIsConquerPhase(true);
    setMissionOutcome('IN_PROGRESS');
    setLog(prev => ["// SECTOR REINFORCEMENTS DETECTED", "// INITIATING TURF CONQUEST PROTOCOL", ...prev]);
    
    // Spawn harder enemies
    const enemyCount = 4 + Math.floor(Math.random() * 3);
    const harderEnemies: TacticalUnit[] = Array.from({ length: enemyCount }).map((_, i) => ({
      id: `conquer-enemy-${i}`,
      name: `Elite Guard ${i+1}`,
      faction: 'ENEMY',
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * 4), // Spawn near top
      hp: 150,
      maxHp: 150,
      ap: 3,
      maxAp: 3,
      accuracy: 75,
      weapons: ['Heavy Rifle'],
      activeWeaponId: 'Heavy Rifle',
      inventory: []
    }));
    
    setUnits(prev => [
      ...prev.filter(u => u.faction === 'PLAYER').map(u => ({ ...u, ap: u.maxAp })), 
      ...harderEnemies
    ]);
  };

  const handleExtract = () => {
    const victory = missionOutcome === 'VICTORY';
    
    // Compile secured items and credits
    const securedItemsMap: Record<string, number> = {};
    let extraFunds = 0;
    
    if (victory) {
      loot.forEach(item => {
        if (item.secured) {
          if (item.type === 'CREDITS' && item.credits) {
            extraFunds += item.credits;
          } else if (item.itemId) {
            securedItemsMap[item.itemId] = (securedItemsMap[item.itemId] || 0) + 1;
          }
        }
      });
    }

    // Compile unit ending HPs
    const endingHps: Record<string, number> = {};
    units.filter(u => u.faction === 'PLAYER').forEach(u => {
      endingHps[u.id] = Math.max(0, u.hp); // Persist combat HP results
    });

    finishMission(victory, securedItemsMap, extraFunds, endingHps, isConquerPhase && victory, unitKills);
  };

  const getStanceIcon = (st: BehavioralStance) => {
    switch (st) {
      case 'AMOK': return '🔥';
      case 'AGGRESSIVE': return '⚔️';
      case 'SUPPORT': return '📡';
      case 'DEFENSIVE': return '🛡️';
      case 'PASSIVE': return '💤';
    }
  };

  const getStanceLabel = (st: BehavioralStance) => {
    switch (st) {
      case 'AMOK': return 'AMOK';
      case 'AGGRESSIVE': return 'AGGR';
      case 'SUPPORT': return 'SUPP';
      case 'DEFENSIVE': return 'DEF';
      case 'PASSIVE': return 'PASS';
    }
  };

  const getStanceStyle = (st: BehavioralStance, isActive: boolean) => {
    if (!isActive) return 'bg-[#0c111a] text-slate-400 border-[#2d3748] hover:text-white';
    switch (st) {
      case 'AMOK': return 'bg-red-950/90 text-red-400 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
      case 'AGGRESSIVE': return 'bg-orange-950/90 text-orange-400 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]';
      case 'SUPPORT': return 'bg-cyan-950/90 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]';
      case 'DEFENSIVE': return 'bg-emerald-950/90 text-emerald-300 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]';
      case 'PASSIVE': return 'bg-slate-900 text-slate-300 border-slate-600 shadow-[0_0_8px_rgba(148,163,184,0.3)]';
    }
  };

  const setUnitStance = (unitId: string, stance: BehavioralStance) => {
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, behavior: stance } : u));
    const targetUnit = units.find(u => u.id === unitId);
    if (targetUnit) {
      setLog(prev => [`[BEHAVIOR] ${targetUnit.name} set to ${stance} stance (${getStanceIcon(stance)}).`, ...prev]);
    }
  };

  const setAllSquadStance = (stance: BehavioralStance) => {
    setUnits(prev => prev.map(u => u.faction === 'PLAYER' ? { ...u, behavior: stance } : u));
    setLog(prev => [`[SQUAD COMMAND] All soldiers switched to ${stance} stance (${getStanceIcon(stance)}).`, ...prev]);
  };

  // Cover Detection Helper
  const getCoverLevel = (targetX: number, targetY: number, attackerX: number, attackerY: number, obs: Record<string, any>): 'FULL' | 'HALF' | 'NONE' => {
    const dirX = Math.sign(attackerX - targetX);
    const dirY = Math.sign(attackerY - targetY);

    const xShield = dirX !== 0 && obs[`${targetX + dirX},${targetY}`]?.hp > 0;
    const yShield = dirY !== 0 && obs[`${targetX},${targetY + dirY}`]?.hp > 0;
    const cornerShield = dirX !== 0 && dirY !== 0 && obs[`${targetX + dirX},${targetY + dirY}`]?.hp > 0;

    if (xShield || yShield || cornerShield) {
      return 'FULL';
    }

    const adjacentWalls = (obs[`${targetX + 1},${targetY}`]?.hp > 0 ? 1 : 0) +
                          (obs[`${targetX - 1},${targetY}`]?.hp > 0 ? 1 : 0) +
                          (obs[`${targetX},${targetY + 1}`]?.hp > 0 ? 1 : 0) +
                          (obs[`${targetX},${targetY - 1}`]?.hp > 0 ? 1 : 0);

    if (adjacentWalls >= 2) return 'FULL';
    if (adjacentWalls >= 1) return 'HALF';
    return 'NONE';
  };

  const getUnitCoverStatus = (unitX: number, unitY: number, obs: Record<string, any>): 'FULL' | 'HALF' | 'NONE' => {
    const adjacentWalls = (obs[`${unitX + 1},${unitY}`]?.hp > 0 ? 1 : 0) +
                          (obs[`${unitX - 1},${unitY}`]?.hp > 0 ? 1 : 0) +
                          (obs[`${unitX},${unitY + 1}`]?.hp > 0 ? 1 : 0) +
                          (obs[`${unitX},${unitY - 1}`]?.hp > 0 ? 1 : 0);
    if (adjacentWalls >= 2) return 'FULL';
    if (adjacentWalls >= 1) return 'HALF';
    return 'NONE';
  };

  const CELL_SIZE = 48;

  // Initialize mission units
  useEffect(() => {
    const activeMission = state.activeMission;
    const activeBuilding = activeMission ? state.buildings[activeMission.buildingId] : null;
    const buildingType = activeBuilding?.type || 'WAREHOUSE';
    const buildingSectors = (state.baseSectors || []).filter(
      (sector: BaseSector) => (sector.buildingId || 'player-hq') === (activeMission?.buildingId || 'player-hq')
    );

    const { rooms: genRooms, floorPlan: generatedFloorPlan, obstacles: generatedObstacles, lootTiles: generatedLootTiles } = getLayoutForBuildingType(buildingType, buildingSectors);
    setRooms(genRooms);
    setFloorPlan(generatedFloorPlan);
    setObstacles(generatedObstacles);
    setLootTiles(generatedLootTiles);

    const playerUnits: TacticalUnit[] = Object.values(state.units)
      .filter((u: any) => u.location === 'MISSION')
      .map((u: any, i) => {
        const weapons = [u.equipment.handRight, u.equipment.handLeft].filter(Boolean) as string[];
        const inventory = [...(u.equipment.inventory || [])];

        const encumbrance = getUnitEncumbrance(u);
        const baseAp = 10 + Math.floor(((u.stats.speed || 30) - 30) / 5);
        const apPenalty = Math.floor(encumbrance.excessWeight / 2);
        let calculatedMaxAp = Math.max(6, Math.min(24, baseAp - apPenalty));

        if (u.unlockedSkills?.includes('time_dilation')) {
          calculatedMaxAp += 4;
        }
        
        return {
          id: u.id,
          name: u.name,
          faction: 'PLAYER',
          x: 8 + i,
          y: 10,
          hp: u.stats.hp,
          maxHp: u.stats.maxHp,
          ap: calculatedMaxAp,
          maxAp: calculatedMaxAp,
          accuracy: u.stats.accuracy,
          weapons: weapons.length > 0 ? weapons : ['pistol'],
          activeWeaponId: weapons[0] || 'pistol',
          inventory: inventory,
          behavior: 'AGGRESSIVE',
          totalWeight: encumbrance.totalWeight,
          carryLimit: encumbrance.carryLimit,
          movementApCost: encumbrance.movementApCost,
        };
      });

    // Populate enemies: place them nicely in Quadrants
    const enemyUnits: TacticalUnit[] = [
     { id: 'e1', name: 'Sector Defender A', faction: 'ENEMY', x: 15, y: 10, hp: 45, maxHp: 45, ap: 10, maxAp: 10, accuracy: 52, weapons: ['pistol'], activeWeaponId: 'pistol', inventory: [], totalWeight: 4, carryLimit: 10, movementApCost: 2 },
     { id: 'e2', name: 'Sector Defender B', faction: 'ENEMY', x: 14, y: 12, hp: 45, maxHp: 45, ap: 10, maxAp: 10, accuracy: 52, weapons: ['pistol'], activeWeaponId: 'pistol', inventory: [], totalWeight: 4, carryLimit: 10, movementApCost: 2 }
    ];

    setUnits([...playerUnits, ...enemyUnits]);
    if (playerUnits.length > 0) {
      setSelectedUnitId(playerUnits[0].id);
    }
  }, []);

  const selectedUnit = units.find(u => u.id === selectedUnitId);

  const switchWeapon = () => {
    if (!selectedUnit) return;
    const currentIdx = selectedUnit.weapons.indexOf(selectedUnit.activeWeaponId);
    const nextIdx = (currentIdx + 1) % selectedUnit.weapons.length;
    const nextWeaponId = selectedUnit.weapons[nextIdx];
    
    setUnits(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, activeWeaponId: nextWeaponId } : u));
    setLog(prev => [`[GEAR] ${selectedUnit.name} switched to ${ITEMS[nextWeaponId]?.name || nextWeaponId}.`, ...prev]);
  };

  const useItem = (itemId: string) => {
    if (!selectedUnit || selectedUnit.ap < 3) return;
    
    if (itemId === 'medkit') {
      const hasFieldMedic = state.units[selectedUnit.id]?.unlockedSkills?.includes('field_medic');
      const healAmt = hasFieldMedic ? 45 : 25;
      setUnits(prev => prev.map(u => u.id === selectedUnit.id ? { 
        ...u, 
        hp: Math.min(u.maxHp, u.hp + healAmt),
        ap: u.ap - 3,
        inventory: u.inventory.filter((id, i) => id !== itemId || i !== u.inventory.indexOf(itemId))
      } : u));
      setLog(prev => [`[SIGNAL] ${selectedUnit.name} used Medkit. Vitals stabilized (+${healAmt} HP).`, ...prev]);
    } else if (itemId === 'stim') {
      setUnits(prev => prev.map(u => u.id === selectedUnit.id ? { 
        ...u, 
        ap: u.ap + 6,
        inventory: u.inventory.filter((id, i) => id !== itemId || i !== u.inventory.indexOf(itemId))
      } : u));
      setLog(prev => [`[SIGNAL] ${selectedUnit.name} used Bio-Stim. Neural pathways surged.`, ...prev]);
    } else if (itemId === 'grenade') {
      // Grenade is special - it should probably trigger a targeting mode, but for now we'll just log it 
      // or handle it as a close range burst if there's an enemy nearby
      const targets = units.filter(u => u.faction === 'ENEMY' && u.hp > 0 && Math.abs(u.x - selectedUnit.x) + Math.abs(u.y - selectedUnit.y) <= 4);
      
      if (targets.length > 0) {
        setUnits(prev => prev.map(u => {
          const isTarget = targets.some(t => t.id === u.id);
          if (isTarget) return { ...u, hp: Math.max(0, u.hp - 35) };
          if (u.id === selectedUnit.id) return { 
            ...u, 
            ap: u.ap - 4,
            inventory: u.inventory.filter((id, i) => id !== itemId || i !== u.inventory.indexOf(itemId))
          };
          return u;
        }));
        setLog(prev => [`[SIGNAL] ${selectedUnit.name} threw Grenade! Group damage confirmed.`, ...prev]);
      } else {
        setLog(prev => [`[SIGNAL] No targets in blast radius for grenade.`, ...prev]);
        return; // Don't consume if no targets
      }
    }
    
    setShowInventory(false);
  };

  const [destructionGrid, setDestructionGrid] = useState<Record<string, number>>({});

  // Game Speed & Auto Pause Controls
  const [gameSpeed, setGameSpeed] = useState<number>(0.5); // Default 0.5x tactical speed
  const [autoPauseOnSpotted, setAutoPauseOnSpotted] = useState<boolean>(true);
  const [autoPauseOnDamage, setAutoPauseOnDamage] = useState<boolean>(true);
  const [spottedEnemyIds, setSpottedEnemyIds] = useState<Set<string>>(new Set());

  // Visual Effects
  const [shotTracers, setShotTracers] = useState<{ id: string; fromX: number; fromY: number; toX: number; toY: number; color: string }[]>([]);
  const [damagePopups, setDamagePopups] = useState<{ id: string; x: number; y: number; text: string; color: string }[]>([]);

  // Camera State
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(45);
  const [pitch, setPitch] = useState(60);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'PAN' | 'ROTATE'>('PAN');
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [lastTouchDist, setLastTouchDist] = useState<number | null>(null);

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
      setRotation(prev => prev + dx * 0.5);
      setPitch(prev => Math.max(30, Math.min(80, prev + dy * 0.5)));
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
    setZoom(prev => Math.max(0.3, Math.min(3, prev - e.deltaY * 0.001)));
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
      setZoom(prev => Math.max(0.3, Math.min(3, prev + delta * 0.005)));
      setLastTouchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDist(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

  
  const handleTileClick = (x: number, y: number) => {
    if (!selectedUnit) return;

    if (mortarTargetingMode) {
      if (selectedUnit.ap < 6) {
        setLog(prev => ["// ERROR: NOT ENOUGH AP FOR MORTAR SUPPORT (6 AP REQUIRED)", ...prev]);
        setFailedAction({ x, y, type: 'NO_AP' });
        setTimeout(() => setFailedAction(null), 800);
        return;
      }
      triggerMortarStrike(x, y);
      return;
    }

    const obs = obstacles[`${x},${y}`];
    const isObstacle = !!(obs && obs.hp > 0 && obs.type !== 'door');

    if (pendingAction && pendingAction.unitId === selectedUnitId && pendingAction.x === x && pendingAction.y === y) {
      if (pendingAction.type === 'ATTACK') {
         const target = units.find(u => u.x === x && u.y === y && u.hp > 0);
         if (target) {
            setUnits(prev => prev.map(u => u.id === selectedUnit.id ? {...u, targetEnemyId: target.id, targetObstacleCoords: undefined, path: []} : u));
            setLog(prev => [`[COMMAND] ${selectedUnit.name} targeting ${target.name}.`, ...prev]);
         } else if (isObstacle) {
            setUnits(prev => prev.map(u => u.id === selectedUnit.id ? {...u, targetObstacleCoords: {x, y}, targetEnemyId: undefined, path: []} : u));
            setLog(prev => [`[COMMAND] ${selectedUnit.name} targeting ${obs.type.toUpperCase()} wall at (${x},${y}).`, ...prev]);
         }
      } else if (pendingAction.type === 'MOVE') {
         const path = findPath(selectedUnit.x, selectedUnit.y, x, y);
         if (path.length > 0) {
            setUnits(prev => prev.map(u => u.id === selectedUnit.id ? {...u, path, targetEnemyId: undefined, targetObstacleCoords: undefined} : u));
            setLog(prev => [`[COMMAND] ${selectedUnit.name} moving to ${x},${y}.`, ...prev]);
         } else {
            setLog(prev => [`[ERROR] No valid route.`, ...prev]);
            setFailedAction({ x, y, type: 'BLOCKED' });
            setTimeout(() => setFailedAction(null), 800);
         }
      }
      setPendingAction(null);
      return;
    }

    const targetUnit = units.find(u => u.x === x && u.y === y && u.hp > 0);
    
    if (targetUnit && targetUnit.faction === 'ENEMY') {
      const dist = Math.abs(selectedUnit.x - x) + Math.abs(selectedUnit.y - y);
      const hasLos = hasLineOfSight(selectedUnit.x, selectedUnit.y, x, y);
      if (dist <= 10 && hasLos) {
        setPendingAction({ type: 'ATTACK', unitId: selectedUnit.id, x, y });
      } else {
        setLog(prev => ["// ERROR: TARGET BLOCKED OR OUT OF RANGE", ...prev]);
        setFailedAction({ x, y, type: 'BLOCKED' });
        setTimeout(() => setFailedAction(null), 800);
      }
    } else if (isObstacle) {
      const dist = Math.abs(selectedUnit.x - x) + Math.abs(selectedUnit.y - y);
      const hasLos = hasLineOfSight(selectedUnit.x, selectedUnit.y, x, y);
      if (dist <= 10 && hasLos) {
        setPendingAction({ type: 'ATTACK', unitId: selectedUnit.id, x, y });
      } else {
        setLog(prev => ["// ERROR: OBSTACLE BLOCKED OR OUT OF RANGE", ...prev]);
        setFailedAction({ x, y, type: 'BLOCKED' });
        setTimeout(() => setFailedAction(null), 800);
      }
    } else if (!targetUnit) {
      setPendingAction({ type: 'MOVE', unitId: selectedUnit.id, x, y });
    } else if (targetUnit && targetUnit.faction === 'PLAYER') {
      setSelectedUnitId(targetUnit.id);
      setPendingAction(null);
    }
  };

  const triggerMortarStrike = (targetX: number, targetY: number) => {
    if (!selectedUnit) return;
    setUnits(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, ap: u.ap - 6 } : u));
    setMortarTargetingMode(false);
    
    setLog(prev => [`[TACTICAL MORTAR] 🚀 Mortar team launched high-explosive ordnance at (${targetX},${targetY})! ETA: 0.5s.`, ...prev]);

    setTimeout(() => {
      const radius = 2;
      
      // Damage any unit in radius
      setUnits(prevUnits => {
        let logs: string[] = [];
        const nextUnits = prevUnits.map(u => {
          if (u.hp <= 0) return u;
          const dist = Math.abs(u.x - targetX) + Math.abs(u.y - targetY);
          if (dist <= radius) {
            const dmg = dist === 0 ? 80 : dist === 1 ? 50 : 25;
            const updatedHp = Math.max(0, u.hp - dmg);
            
            // Add damage popup
            setDamagePopups(pop => [
              ...pop,
              {
                id: `mortar-u-${Date.now()}-${Math.random()}`,
                x: u.x,
                y: u.y,
                text: `-${dmg} HE!`,
                color: '#ef4444'
              }
            ]);
            
            logs.push(`[MORTAR STRIKE] 💥 ${u.name} caught in blast radius for ${dmg} HE DMG!`);
            if (updatedHp <= 0) {
              logs.push(`[NEUTRALIZED] ${u.name} vaporized by tactical mortar bombardment.`);
              if (selectedUnit.faction === 'PLAYER') {
                setUnitKills(k => ({ ...k, [selectedUnit.id]: (k[selectedUnit.id] || 0) + 1 }));
              }
            }
            return { ...u, hp: updatedHp };
          }
          return u;
        });
        if (logs.length > 0) {
          setLog(prev => [...logs.reverse(), ...prev]);
        }
        return nextUnits;
      });

      // Destruct/Voxelize obstacles in radius!
      setObstacles(prevObs => {
        const nextObs = { ...prevObs };
        let rubbleLogs: string[] = [];

        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            const nx = targetX + dx;
            const ny = targetY + dy;
            const key = `${nx},${ny}`;
            const obs = nextObs[key];
            if (obs && obs.hp > 0) {
              const dist = Math.abs(dx) + Math.abs(dy);
              const dmg = dist === 0 ? 150 : dist === 1 ? 100 : 50;
              const nextHp = Math.max(0, obs.hp - dmg);
              nextObs[key] = { ...obs, hp: nextHp };
              
              setDamagePopups(pop => [
                ...pop,
                {
                  id: `mortar-obs-${Date.now()}-${Math.random()}`,
                  x: nx,
                  y: ny,
                  text: `-${dmg} HP`,
                  color: '#fbbf24'
                }
              ]);

              if (nextHp <= 0) {
                rubbleLogs.push(`[MORTAR DEMOLITION] 💥 The ${obs.type.toUpperCase()} at (${nx},${ny}) collapsed into rubble under heavy bombardment!`);
              }
            }
          }
        }
        
        if (rubbleLogs.length > 0) {
          setLog(prev => [...rubbleLogs, ...prev]);
        }
        return nextObs;
      });

      const explosionTracers = Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI) / 4;
        return {
          id: `mortar-explode-${i}-${Date.now()}`,
          fromX: targetX,
          fromY: targetY,
          toX: Math.max(0, Math.min(11, targetX + Math.round(Math.cos(angle) * 2))),
          toY: Math.max(0, Math.min(11, targetY + Math.round(Math.sin(angle) * 2))),
          color: '#f59e0b'
        };
      });
      setShotTracers(prev => [...prev, ...explosionTracers]);

    }, 500);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    setLog(prev => [`--- TIME ${isPaused ? 'RESUMED' : 'PAUSED'} ---`, ...prev]);
  };

  
  // Game Loop
  useEffect(() => {
    if (isPaused || missionOutcome !== 'IN_PROGRESS') return;

    const intervalMs = Math.round(400 / gameSpeed);

    const interval = setInterval(() => {
      setTick(t => t + 1);

      // Fade older shot tracers & damage popups
      setShotTracers(prev => prev.slice(-3));
      setDamagePopups(prev => prev.slice(-5));

      setUnits(prevUnits => {
        let newUnits = [...prevUnits];
        let logs: string[] = [];
        let destroyed: Record<string, number> = {};
        let newTracers: { id: string; fromX: number; fromY: number; toX: number; toY: number; color: string }[] = [];
        let newPopups: { id: string; x: number; y: number; text: string; color: string }[] = [];
        let shouldAutoPause = false;
        let autoPauseReason = '';

        // 1. Check for newly spotted enemies by player units
        const alivePlayers = newUnits.filter(p => p.faction === 'PLAYER' && p.hp > 0);
        const aliveEnemies = newUnits.filter(e => e.faction === 'ENEMY' && e.hp > 0);

        aliveEnemies.forEach(e => {
          if (!spottedEnemyIds.has(e.id)) {
            const visibleToPlayer = alivePlayers.some(p => 
              Math.abs(p.x - e.x) + Math.abs(p.y - e.y) <= 12 && hasLineOfSight(p.x, p.y, e.x, e.y)
            );
            if (visibleToPlayer) {
              setSpottedEnemyIds(prev => new Set(prev).add(e.id));
              logs.push(`[CONTACT] Hostile ${e.name} spotted at (${e.x},${e.y})!`);
              if (autoPauseOnSpotted) {
                shouldAutoPause = true;
                autoPauseReason = `[ALERT] HOSTILE SPOTTED (${e.name}) - TIME AUTO-PAUSED!`;
              }
            }
          }
        });

        // 2. Unit Update Phase (AP regen, AI decisions, Auto-Engage, Movement)
        newUnits = newUnits.map(unit => {
          if (unit.hp <= 0) return unit;
          let u = { ...unit };

          // Regenerate AP
          if (u.ap < u.maxAp) {
             u.ap = Math.min(u.maxAp, u.ap + (u.faction === 'PLAYER' ? 1 : 1.5));
          }
          if (u.cooldown && u.cooldown > 0) {
             u.cooldown -= 1;
          }

          // ENEMY AI: Find player to attack or move towards
          if (u.faction === 'ENEMY') {
            const players = newUnits.filter(p => p.faction === 'PLAYER' && p.hp > 0);
            if (players.length > 0) {
              players.sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
              const target = players[0];
              const dist = Math.abs(target.x - u.x) + Math.abs(target.y - u.y);
              const hasLos = hasLineOfSight(u.x, u.y, target.x, target.y);
              
              if (dist <= 10 && hasLos) {
                u.targetEnemyId = target.id;
                u.path = [];
              } else {
                u.targetEnemyId = undefined;
                if (!u.path || u.path.length === 0) {
                  const queue = [{ x: u.x, y: u.y, path: [] as {x: number, y: number}[] }];
                  const visited = new Set([`${u.x},${u.y}`]);
                  let foundPath = [] as {x: number, y: number}[];

                  while (queue.length > 0) {
                    const { x, y, path } = queue.shift()!;
                    if (x === target.x && y === target.y) {
                      foundPath = path;
                      break;
                    }
                    if (path.length > 15) continue;

                    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
                    for (const [dx, dy] of dirs) {
                      const nx = x + dx;
                      const ny = y + dy;
                      const key = `${nx},${ny}`;
                      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && !visited.has(key)) {
                        const isOccupiedByOther = newUnits.some(other => other.x === nx && other.y === ny && other.hp > 0 && other.id !== u.id);
                        if ((!obstacles[key] && !isOccupiedByOther) || (nx === target.x && ny === target.y)) {
                          visited.add(key);
                          queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
                        }
                      }
                    }
                  }
                  u.path = foundPath;
                }
              }
            }
          }

          // PLAYER SOLDIER AUTOMATION BASED ON BEHAVIOR STANCE & LOADOUT AI
          if (u.faction === 'PLAYER') {
            const stance = u.behavior || 'AGGRESSIVE';
            const aliveEnemies = newUnits.filter(e => e.faction === 'ENEMY' && e.hp > 0);

            // 1. AUTO LOADOUT & MEDICAL MANAGEMENT
            if (u.ap >= 3 && u.inventory && u.inventory.length > 0) {
              const hasFieldMedic = state.units[u.id]?.unlockedSkills?.includes('field_medic');
              // A. Self-healing with Medkit if wounded
              if (u.hp < u.maxHp * 0.70 && u.inventory.includes('medkit')) {
                const healAmount = hasFieldMedic ? 45 : 30;
                u.hp = Math.min(u.maxHp, u.hp + healAmount);
                u.ap -= 3;
                u.inventory = u.inventory.filter((id, idx) => id !== 'medkit' || idx !== u.inventory.indexOf('medkit'));
                logs.push(`[AUTO-MEDIC] 💉 ${u.name} automatically applied Medi-Patch on self (+${healAmount} HP).`);
                newPopups.push({
                  id: `heal-${Date.now()}-${Math.random()}`,
                  x: u.x,
                  y: u.y,
                  text: `+${healAmount} HP`,
                  color: '#48bb78'
                });
              } 
              // B. Ally Healing with Medkit on adjacent wounded squadmates
              else if (u.inventory.includes('medkit') && (stance === 'SUPPORT' || stance === 'DEFENSIVE' || stance === 'AGGRESSIVE')) {
                const woundedAlly = newUnits.find(ally => 
                  ally.faction === 'PLAYER' && 
                  ally.hp > 0 && 
                  ally.id !== u.id && 
                  ally.hp < ally.maxHp * 0.65 &&
                  Math.abs(ally.x - u.x) + Math.abs(ally.y - u.y) <= 2
                );
                if (woundedAlly) {
                  const allyFieldMedic = state.units[u.id]?.unlockedSkills?.includes('field_medic');
                  const healAmount = allyFieldMedic ? 45 : 30;
                  woundedAlly.hp = Math.min(woundedAlly.maxHp, woundedAlly.hp + healAmount);
                  u.ap -= 3;
                  u.inventory = u.inventory.filter((id, idx) => id !== 'medkit' || idx !== u.inventory.indexOf('medkit'));
                  logs.push(`[AUTO-MEDIC] 💉 ${u.name} treated wounded squadmate ${woundedAlly.name} (+${healAmount} HP).`);
                  newPopups.push({
                    id: `heal-${Date.now()}-${Math.random()}`,
                    x: woundedAlly.x,
                    y: woundedAlly.y,
                    text: `+${healAmount} HP`,
                    color: '#48bb78'
                  });
                }
              }

              // C. Neuro-Stim usage if in combat with low AP
              if (u.targetEnemyId && u.ap <= 3 && u.inventory.includes('stim')) {
                u.ap += 6;
                u.inventory = u.inventory.filter((id, idx) => id !== 'stim' || idx !== u.inventory.indexOf('stim'));
                logs.push(`[AUTO-STIM] 🧪 ${u.name} administered Neuro-Stim (+6 AP surge).`);
                newPopups.push({
                  id: `stim-${Date.now()}-${Math.random()}`,
                  x: u.x,
                  y: u.y,
                  text: '+6 AP',
                  color: '#60a5fa'
                });
              }

              // D. Tactical Grenade usage if target is grouped or in cover
              if (u.targetEnemyId && u.ap >= 4 && u.inventory.includes('grenade')) {
                const targetEnemy = aliveEnemies.find(e => e.id === u.targetEnemyId);
                if (targetEnemy) {
                  const dist = Math.abs(targetEnemy.x - u.x) + Math.abs(targetEnemy.y - u.y);
                  if (dist <= 5) {
                    const blastEnemies = aliveEnemies.filter(e => Math.abs(e.x - targetEnemy.x) + Math.abs(e.y - targetEnemy.y) <= 2);
                    blastEnemies.forEach(be => {
                      be.hp = Math.max(0, be.hp - 35);
                      newPopups.push({
                        id: `boom-${Date.now()}-${Math.random()}`,
                        x: be.x,
                        y: be.y,
                        text: '-35 BOOM!',
                        color: '#fbbf24'
                      });
                      if (be.hp <= 0) {
                        logs.push(`[NEUTRALIZED] ${be.name} destroyed by grenade blast!`);
                        setUnitKills(prev => ({ ...prev, [u.id]: (prev[u.id] || 0) + 1 }));
                      }
                    });
                    u.ap -= 4;
                    u.inventory = u.inventory.filter((id, idx) => id !== 'grenade' || idx !== u.inventory.indexOf('grenade'));
                    logs.push(`[AUTO-TACTICAL] 💣 ${u.name} deployed Flash-Bang Grenade at ${targetEnemy.name}'s position!`);
                  }
                }
              }
            }

            // 2. AUTO WEAPON SELECTION & RANGE-BASED SWAPPING
            if (u.targetEnemyId && u.weapons && u.weapons.length > 1 && u.ap >= 1) {
              const currentTarget = aliveEnemies.find(t => t.id === u.targetEnemyId);
              if (currentTarget) {
                const dist = Math.abs(currentTarget.x - u.x) + Math.abs(currentTarget.y - u.y);
                const activeWItem = ITEMS[u.activeWeaponId] || { range: 10, damage: 25 };
                const activeCanReach = dist <= (activeWItem.range || 10);

                let bestWeaponId = u.activeWeaponId;
                let bestScore = activeCanReach ? (activeWItem.damage || 25) : -100;

                for (const wId of u.weapons) {
                  if (wId === u.activeWeaponId) continue;
                  const wItem = ITEMS[wId] || { range: 10, damage: 25 };
                  const canReach = dist <= (wItem.range || 10);

                  let score = -100;
                  if (canReach) {
                    score = wItem.damage || 25;
                    if (!activeCanReach) score += 200; // Priority boost if active weapon cannot reach!
                  } else {
                    score = -100 + (wItem.range || 10); // Prefer longer range weapon if neither reaches
                  }

                  if (score > bestScore) {
                    bestScore = score;
                    bestWeaponId = wId;
                  }
                }

                if (bestWeaponId !== u.activeWeaponId) {
                  const oldWName = ITEMS[u.activeWeaponId]?.name || u.activeWeaponId;
                  const newWName = ITEMS[bestWeaponId]?.name || bestWeaponId;
                  u.activeWeaponId = bestWeaponId;
                  u.ap -= 1;
                  logs.push(`[AUTO-GEAR] 🔄 ${u.name} auto-swapped from ${oldWName} to ${newWName} (Target dist: ${dist} tiles).`);
                }
              }
            }

            // 3. STANCE TARGETING & MOVEMENT LOGIC
            const maxSightRange = ITEMS[u.activeWeaponId]?.range ? Math.max(12, ITEMS[u.activeWeaponId].range!) : 12;

            if (stance === 'PASSIVE') {
              // PASSIVE: Hold fire and hold position unless manually targeted
              if (u.targetEnemyId) {
                const manualTarget = aliveEnemies.find(e => e.id === u.targetEnemyId);
                if (!manualTarget || Math.abs(manualTarget.x - u.x) + Math.abs(manualTarget.y - u.y) > maxSightRange || !hasLineOfSight(u.x, u.y, manualTarget.x, manualTarget.y)) {
                  u.targetEnemyId = undefined;
                }
              }
            } else if (stance === 'DEFENSIVE') {
              // DEFENSIVE: Hold ground. Reaction fire on any enemy in range & LOS. Never auto-move toward enemies.
              let currentTarget = u.targetEnemyId ? aliveEnemies.find(t => t.id === u.targetEnemyId) : null;
              if (currentTarget) {
                const dist = Math.abs(currentTarget.x - u.x) + Math.abs(currentTarget.y - u.y);
                if (dist > maxSightRange || !hasLineOfSight(u.x, u.y, currentTarget.x, currentTarget.y)) {
                  currentTarget = null;
                  u.targetEnemyId = undefined;
                }
              }
              if (!currentTarget && aliveEnemies.length > 0) {
                const enemiesInLos = aliveEnemies.filter(e => Math.abs(e.x - u.x) + Math.abs(e.y - u.y) <= maxSightRange && hasLineOfSight(u.x, u.y, e.x, e.y));
                if (enemiesInLos.length > 0) {
                  enemiesInLos.sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
                  u.targetEnemyId = enemiesInLos[0].id;
                }
              }
            } else if (stance === 'SUPPORT') {
              // SUPPORT: Prioritize enemies near squadmates; regroup with nearest squadmate if out of combat.
              let currentTarget = u.targetEnemyId ? aliveEnemies.find(t => t.id === u.targetEnemyId) : null;
              if (currentTarget) {
                const dist = Math.abs(currentTarget.x - u.x) + Math.abs(currentTarget.y - u.y);
                if (dist > maxSightRange || !hasLineOfSight(u.x, u.y, currentTarget.x, currentTarget.y)) {
                  currentTarget = null;
                  u.targetEnemyId = undefined;
                }
              }
              if (!currentTarget && aliveEnemies.length > 0) {
                const enemiesInLos = aliveEnemies.filter(e => Math.abs(e.x - u.x) + Math.abs(e.y - u.y) <= maxSightRange && hasLineOfSight(u.x, u.y, e.x, e.y));
                if (enemiesInLos.length > 0) {
                  enemiesInLos.sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
                  u.targetEnemyId = enemiesInLos[0].id;
                }
              }
              // Regroup if no target and far from allies
              if (!u.targetEnemyId && (!u.path || u.path.length === 0)) {
                const allies = newUnits.filter(p => p.faction === 'PLAYER' && p.hp > 0 && p.id !== u.id);
                if (allies.length > 0) {
                  allies.sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
                  const closestAlly = allies[0];
                  if (Math.abs(closestAlly.x - u.x) + Math.abs(closestAlly.y - u.y) > 3) {
                    const p = findPath(u.x, u.y, closestAlly.x, closestAlly.y);
                    if (p.length > 0) u.path = p.slice(0, 3);
                  }
                }
              }
            } else if (stance === 'AGGRESSIVE') {
              // AGGRESSIVE: Engage nearby enemies in sight, advance toward spotted enemies if clear.
              let currentTarget = u.targetEnemyId ? aliveEnemies.find(t => t.id === u.targetEnemyId) : null;
              if (currentTarget) {
                const dist = Math.abs(currentTarget.x - u.x) + Math.abs(currentTarget.y - u.y);
                if (dist > maxSightRange || !hasLineOfSight(u.x, u.y, currentTarget.x, currentTarget.y)) {
                  currentTarget = null;
                  u.targetEnemyId = undefined;
                }
              }
              if (!currentTarget && aliveEnemies.length > 0) {
                const enemiesInLos = aliveEnemies.filter(e => Math.abs(e.x - u.x) + Math.abs(e.y - u.y) <= maxSightRange && hasLineOfSight(u.x, u.y, e.x, e.y));
                if (enemiesInLos.length > 0) {
                  enemiesInLos.sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
                  u.targetEnemyId = enemiesInLos[0].id;
                } else if (!u.path || u.path.length === 0) {
                  const spotted = aliveEnemies.filter(e => spottedEnemyIds.has(e.id));
                  if (spotted.length > 0) {
                    spotted.sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
                    const p = findPath(u.x, u.y, spotted[0].x, spotted[0].y);
                    if (p.length > 0) u.path = p;
                  }
                }
              }
            } else if (stance === 'AMOK') {
              // AMOK: Berserk charge toward nearest enemy regardless of distance!
              let currentTarget = u.targetEnemyId ? aliveEnemies.find(t => t.id === u.targetEnemyId) : null;
              if (currentTarget) {
                const dist = Math.abs(currentTarget.x - u.x) + Math.abs(currentTarget.y - u.y);
                if (dist > maxSightRange || !hasLineOfSight(u.x, u.y, currentTarget.x, currentTarget.y)) {
                  currentTarget = null;
                  u.targetEnemyId = undefined;
                }
              }
              if (!currentTarget && aliveEnemies.length > 0) {
                const enemiesInLos = aliveEnemies.filter(e => Math.abs(e.x - u.x) + Math.abs(e.y - u.y) <= maxSightRange && hasLineOfSight(u.x, u.y, e.x, e.y));
                if (enemiesInLos.length > 0) {
                  enemiesInLos.sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
                  u.targetEnemyId = enemiesInLos[0].id;
                } else {
                  // Relentlessly charge nearest enemy on map
                  if (!u.path || u.path.length === 0) {
                    const sortedEnemies = [...aliveEnemies].sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
                    const targetEnemy = sortedEnemies[0];
                    const p = findPath(u.x, u.y, targetEnemy.x, targetEnemy.y);
                    if (p.length > 0) u.path = p;
                  }
                }
              }
            }
          }

          // Movement & Reaction Fire (Overwatch)
          const moveStepAp = u.movementApCost || 2;
          if (u.path && u.path.length > 0 && u.ap >= moveStepAp && (!u.cooldown || u.cooldown <= 0)) {
            const nextStep = u.path[0];
            if (!isTileOccupied(nextStep.x, nextStep.y, u.id)) {
              u.x = nextStep.x;
              u.y = nextStep.y;
              u.ap -= moveStepAp;
              u.cooldown = Math.max(2, moveStepAp);
              u.path = u.path.slice(1);

              // REACTION SHOT / AMBUSH: Check if stepping into opponent's line of sight triggers reaction fire
              const opposingFaction = u.faction === 'PLAYER' ? 'ENEMY' : 'PLAYER';
              const potentialReactors = newUnits.filter(h => 
                h.faction === opposingFaction &&
                h.hp > 0 &&
                h.id !== u.id &&
                (!h.cooldown || h.cooldown <= 1) &&
                h.ap >= 4 &&
                (h.faction === 'ENEMY' || h.behavior !== 'PASSIVE') &&
                Math.abs(h.x - nextStep.x) + Math.abs(h.y - nextStep.y) <= 10 &&
                hasLineOfSight(h.x, h.y, nextStep.x, nextStep.y)
              );

              if (potentialReactors.length > 0) {
                const reactor = potentialReactors[0];
                const isReactorPlayer = reactor.faction === 'PLAYER';
                const baseDmg = Math.floor(Math.random() * 18) + 12;
                const cover = getCoverLevel(nextStep.x, nextStep.y, reactor.x, reactor.y, obstacles);
                let reactionDmg = baseDmg;
                if (cover === 'FULL') reactionDmg = Math.max(3, Math.round(baseDmg * 0.5));
                else if (cover === 'HALF') reactionDmg = Math.max(5, Math.round(baseDmg * 0.7));

                u.hp = Math.max(0, u.hp - reactionDmg);
                reactor.ap -= 4;
                reactor.cooldown = 4;

                const tracerColor = isReactorPlayer ? '#38bdf8' : '#ef4444';
                const popupColor = isReactorPlayer ? '#48bb78' : '#ef4444';

                newTracers.push({
                  id: `react-${Date.now()}-${Math.random()}`,
                  fromX: reactor.x,
                  fromY: reactor.y,
                  toX: nextStep.x,
                  toY: nextStep.y,
                  color: tracerColor
                });

                newPopups.push({
                  id: `react-${Date.now()}-${Math.random()}`,
                  x: nextStep.x,
                  y: nextStep.y,
                  text: `-${reactionDmg}${cover !== 'NONE' ? ` (${cover} COVER)` : ''}`,
                  color: popupColor
                });

                logs.push(`[REACTION SHOT] ⚡ ${reactor.name} ambushed ${u.name} moving into sight for ${reactionDmg} DMG${cover !== 'NONE' ? ` (${cover} COVER)` : ''}!`);

                if (!isReactorPlayer && u.faction === 'PLAYER' && autoPauseOnDamage) {
                  shouldAutoPause = true;
                  autoPauseReason = `[ALERT] ${u.name} HIT BY REACTION SHOT (${reactionDmg} DMG) - TIME AUTO-PAUSED!`;
                }

                if (u.hp <= 0) {
                  u.path = [];
                  logs.push(`[NEUTRALIZED] ${u.name} eliminated by reaction fire.`);
                  if (isReactorPlayer) {
                    setUnitKills(prev => ({ ...prev, [reactor.id]: (prev[reactor.id] || 0) + 1 }));
                  }
                }
              }
            } else {
              u.path = [];
            }
          }

          return u;
        });

        // 2.5 Obstacle Breach Attack Phase (Destructible world!)
        newUnits = newUnits.map(u => {
          if (u.hp <= 0 || u.ap < 4 || (u.cooldown && u.cooldown > 0) || !u.targetObstacleCoords) return u;
          const { x: obsX, y: obsY } = u.targetObstacleCoords;
          const key = `${obsX},${obsY}`;
          const obs = obstacles[key];
          if (!obs || obs.hp <= 0) {
            u.targetObstacleCoords = undefined;
            return u;
          }

          const activeW = ITEMS[u.activeWeaponId] || { range: 10, damage: 25 };
          const maxWeaponRange = activeW.range || 10;
          const weaponBaseDmg = activeW.damage || 25;

          const dist = Math.abs(obsX - u.x) + Math.abs(obsY - u.y);
          const hasLos = hasLineOfSight(u.x, u.y, obsX, obsY);

          if (dist <= maxWeaponRange && hasLos) {
            const baseDamage = Math.floor((weaponBaseDmg * 0.75) + Math.random() * (weaponBaseDmg * 0.5));
            let damage = Math.round(baseDamage * 1.2); 

            setObstacles(prevObs => {
              const nextObs = { ...prevObs };
              if (nextObs[key]) {
                const updatedHp = Math.max(0, nextObs[key].hp - damage);
                nextObs[key] = { ...nextObs[key], hp: updatedHp };
                if (updatedHp <= 0) {
                  logs.push(`[BREACHED] 💥 The ${obs.type.toUpperCase()} at (${obsX},${obsY}) was completely destroyed and reduced to rubble!`);
                }
              }
              return nextObs;
            });

            u.ap -= 4;
            u.cooldown = 4;

            newTracers.push({
              id: `obs-shoot-${Date.now()}-${Math.random()}`,
              fromX: u.x,
              fromY: u.y,
              toX: obsX,
              toY: obsY,
              color: '#f59e0b'
            });

            newPopups.push({
              id: `obs-dmg-${Date.now()}-${Math.random()}`,
              x: obsX,
              y: obsY,
              text: `-${damage} HP`,
              color: '#fbbf24'
            });

            logs.push(`[BREACH FIRE] 💥 ${u.name} blasted the ${obs.type.toUpperCase()} wall for ${damage} DMG.`);

            if (obs.hp - damage <= 0) {
              u.targetObstacleCoords = undefined;
            }
          } else {
            u.targetObstacleCoords = undefined;
          }

          return u;
        });

        // 3. Attack Phase with Cover Damage Mitigation
        newUnits = newUnits.map(u => {
          if (u.hp <= 0 || u.ap < 4 || (u.cooldown && u.cooldown > 0) || !u.targetEnemyId) return u;
          const target = newUnits.find(t => t.id === u.targetEnemyId && t.hp > 0);
          if (!target) {
            u.targetEnemyId = undefined;
            return u;
          }

          const activeW = ITEMS[u.activeWeaponId] || { range: 10, damage: 25 };
          const maxWeaponRange = activeW.range || 10;
          const weaponBaseDmg = activeW.damage || 25;

          const dist = Math.abs(target.x - u.x) + Math.abs(target.y - u.y);
          const hasLos = hasLineOfSight(u.x, u.y, target.x, target.y);

          if (dist <= maxWeaponRange && hasLos) {
            const isPlayer = u.faction === 'PLAYER';
            const baseDamage = Math.floor((weaponBaseDmg * 0.75) + Math.random() * (weaponBaseDmg * 0.5));
            const accuracyFactor = 0.85 + (u.accuracy / 100) * 0.45; // Higher accuracy deals higher precision damage
            let damage = Math.round(baseDamage * accuracyFactor);

            // Apply special offensive traits for players
            let specLog = '';
            if (isPlayer) {
              const globalUnit = state.units[u.id];
              if (globalUnit) {
                // 1. Shadow Strike (+50% dmg)
                if (globalUnit.unlockedSkills?.includes('shadow_strike')) {
                  damage = Math.round(damage * 1.5);
                  specLog += ' [SHADOW STRIKE]';
                }
                // 2. Double Tap (35% chance of 40% bonus)
                if (globalUnit.unlockedSkills?.includes('double_tap') && Math.random() < 0.35) {
                  damage = Math.round(damage * 1.4);
                  specLog += ' [DOUBLE TAP]';
                }
                // 3. Deadeye Criticals (25% chance of double dmg)
                if (globalUnit.unlockedSkills?.includes('deadeye') && Math.random() < 0.25) {
                  damage = damage * 2;
                  specLog += ' [CRITICAL DEADEYE]';
                }
              }
            }

            const cover = getCoverLevel(target.x, target.y, u.x, u.y, obstacles);
            if (cover === 'FULL') damage = Math.max(3, Math.round(damage * 0.5));
            else if (cover === 'HALF') damage = Math.max(5, Math.round(damage * 0.7));

            // Apply special defensive traits for targets
            if (target.faction === 'PLAYER') {
              const targetUnit = state.units[target.id];
              if (targetUnit) {
                if (targetUnit.unlockedSkills?.includes('ironclad')) {
                  damage = Math.max(1, Math.round(damage * 0.70)); // 30% reduction
                  specLog += ' [IRONCLAD RESIST]';
                } else if (targetUnit.unlockedSkills?.includes('plated_rigging')) {
                  damage = Math.max(1, Math.round(damage * 0.85)); // 15% reduction
                  specLog += ' [RIGGING SHIELD]';
                }
              }
            }

            target.hp = Math.max(0, target.hp - damage);
            u.ap -= 4;
            u.cooldown = 4;

            const tracerColor = isPlayer ? '#38bdf8' : '#ef4444';
            const popupColor = isPlayer ? '#48bb78' : '#ef4444';

            newTracers.push({
              id: `${Date.now()}-${Math.random()}`,
              fromX: u.x,
              fromY: u.y,
              toX: target.x,
              toY: target.y,
              color: tracerColor
            });

            newPopups.push({
              id: `${Date.now()}-${Math.random()}`,
              x: target.x,
              y: target.y,
              text: `-${damage}${cover !== 'NONE' ? ` (${cover} COVER)` : ''}${specLog}`,
              color: popupColor
            });

            logs.push(`[${isPlayer ? 'RETURN FIRE' : 'HOSTILE FIRE'}] ${u.name} shot ${target.name} for ${damage} DMG${cover !== 'NONE' ? ` (${cover} COVER)` : ''}${specLog}!`);
            destroyed[`${target.x},${target.y}`] = (destroyed[`${target.x},${target.y}`] || 0) + 1;

            if (target.hp <= 0) {
              logs.push(`[NEUTRALIZED] ${target.name} eliminated.`);
              if (isPlayer) {
                setUnitKills(prev => ({ ...prev, [u.id]: (prev[u.id] || 0) + 1 }));
              }
            }

            if (!isPlayer && target.faction === 'PLAYER' && autoPauseOnDamage) {
              shouldAutoPause = true;
              autoPauseReason = `[ALERT] ${target.name} TAKING DAMAGE (${damage} DMG) - TIME AUTO-PAUSED!`;
            }
          } else {
            u.targetEnemyId = undefined;
          }

          return u;
        });

        if (newTracers.length > 0) {
          setShotTracers(prev => [...prev, ...newTracers]);
        }
        if (newPopups.length > 0) {
          setDamagePopups(prev => [...prev, ...newPopups]);
        }

        if (logs.length > 0) {
          setLog(prev => [...logs.reverse(), ...prev]);
        }
        if (Object.keys(destroyed).length > 0) {
          setDestructionGrid(prev => {
             const next = {...prev};
             Object.keys(destroyed).forEach(k => next[k] = (next[k] || 0) + destroyed[k]);
             return next;
          });
        }

        if (shouldAutoPause) {
          setIsPaused(true);
          if (autoPauseReason) {
            setLog(prev => [autoPauseReason, ...prev]);
          }
        }

        return newUnits;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPaused, missionOutcome, obstacles, gameSpeed, autoPauseOnSpotted, autoPauseOnDamage, spottedEnemyIds]);

  // BFS Pathfinding helper
  const findPath = (startX: number, startY: number, targetX: number, targetY: number) => {
    const queue = [{ x: startX, y: startY, path: [] as {x: number, y: number}[] }];
    const visited = new Set([`${startX},${startY}`]);

    while (queue.length > 0) {
      const { x, y, path } = queue.shift()!;
      if (x === targetX && y === targetY) return path;

      // Check all 4 directions
      const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;

        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && !visited.has(key)) {
          // If it's the target, it might be occupied by an enemy, but we just want to path NEXT TO it, 
          // or path TO it if it's empty. Since this is for movement, targetX,targetY should be empty unless it's a move command to an empty tile.
          // In case targetX,targetY is occupied, our movement logic prevents stepping on it later, but BFS should allow pathing *through* it? 
          // No, BFS shouldn't path through obstacles.
          if (!isTileOccupied(nx, ny) || (nx === targetX && ny === targetY)) {
            visited.add(key);
            queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
          }
        }
      }
    }
    return [];
  };

  // Check victory/defeat
  useEffect(() => {
    const aliveEnemies = units.filter(u => u.faction === 'ENEMY' && u.hp > 0);
    const alivePlayer = units.filter(u => u.faction === 'PLAYER' && u.hp > 0);

    if (units.length > 0 && aliveEnemies.length === 0 && missionOutcome === 'IN_PROGRESS') {
      setLog(prev => ["OBJECTIVE SECURED: ALL HOSTILES NEUTRALIZED", ...prev]);
      setMissionOutcome('VICTORY');

      // Generate randomized sector vault loot
      const possibleLoot = [
        { id: 'pistol', name: '9mm Handgun', type: 'WEAPON' },
        { id: 'shotgun', name: 'Riot Breaker', type: 'WEAPON' },
        { id: 'vest', name: 'Kevlar Vest', type: 'ARMOR' },
      ];
      
      const generatedLoot: any[] = [];
      
      // Generate credits/funds loot
      const lootedCredits = Math.floor(Math.random() * 1500) + 1500; // ₮1,500 - ₮3,000
      generatedLoot.push({
        id: 'credits',
        name: `₮${lootedCredits.toLocaleString()} Credits`,
        type: 'CREDITS',
        credits: lootedCredits,
        secured: true
      });

      // Pull 2 random gear items from the loot table
      for (let i = 0; i < 2; i++) {
        const randomItem = possibleLoot[Math.floor(Math.random() * possibleLoot.length)];
        generatedLoot.push({
          id: `${randomItem.id}_${i}_${Date.now()}`,
          itemId: randomItem.id,
          name: randomItem.name,
          type: randomItem.type,
          secured: true
        });
      }

      setLoot(generatedLoot);
    } else if (units.length > 0 && alivePlayer.length === 0 && missionOutcome === 'IN_PROGRESS') {
      setLog(prev => ["MISSION FAILURE: ASSETS COMPROMISED", ...prev]);
      setMissionOutcome('DEFEAT');
    }
  }, [units, missionOutcome]);


  if (missionOutcome !== 'IN_PROGRESS') {
    const isVictory = missionOutcome === 'VICTORY';
    return (
      <div className="h-full w-full bg-[#090c12] flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`w-full max-w-4xl bg-[#0f141e] border ${isVictory ? 'border-[#48bb78]/50 shadow-[0_0_50px_rgba(72,187,120,0.1)]' : 'border-[#f56565]/50 shadow-[0_0_50px_rgba(245,101,101,0.1)]'} p-6 md:p-8 flex flex-col gap-6 relative`}
        >
          {/* Status glow border */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${isVictory ? 'bg-[#48bb78]' : 'bg-[#f56565]'}`} />

          {/* Heading */}
          <div className="flex flex-col items-center text-center mt-2">
            <span className={`text-[10px] font-mono tracking-widest uppercase font-bold ${isVictory ? 'text-[#48bb78]' : 'text-[#f56565]'}`}>
              {isVictory ? 'SIGNAL DECRYPTION COMPLETE // ASSETS EXTRACTING' : 'SIGNAL LOSS DETECTED // EMERGENCY RETREAT REQUIRED'}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight text-white mt-1">
              {isVictory 
                ? (isConquerPhase ? 'Sector Captured' : 'Raid Complete') 
                : (isConquerPhase ? 'Conquest Failed' : 'Raid Compromised')}
            </h1>
            <p className="text-[#718096] text-xs font-mono uppercase mt-2">
              SECTOR 4 LABORATORY DEPOT // INTEL LOGGED
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Left Col: Squad Debrief & Vitality */}
            <div className="bg-[#131924] border border-[#2d3748] p-4 flex flex-col gap-4">
              <div className="text-[10px] text-[#4a5568] font-bold uppercase border-b border-[#2d3748] pb-1.5 flex justify-between items-center">
                <span>Squad Status & Recovery</span>
                <span>VITALITY REPORT</span>
              </div>
              <div className="space-y-3.5">
                {units.filter(u => u.faction === 'PLAYER').map(u => {
                  const isWounded = u.hp < u.maxHp;
                  const kills = unitKills[u.id] || 0;
                  const xpGained = (isVictory ? 150 : 30) + (kills * 50);
                  
                  const stateUnit = state.units[u.id];
                  const oldLevel = stateUnit?.level || 1;
                  const oldExp = stateUnit?.exp || 0;
                  const expNeeded = oldLevel * 150;
                  const newTotalExp = oldExp + xpGained;
                  const leveledUp = newTotalExp >= expNeeded;

                  return (
                    <div key={u.id} className="p-3 bg-[#1a1f2b] border border-[#2d3748] flex flex-col gap-2 rounded-sm shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-white uppercase">{u.name}</span>
                          <span className="text-[8px] bg-amber-950/80 border border-amber-500/60 text-amber-300 px-1.5 py-0.5 font-mono rounded font-black">
                            LVL {oldLevel}
                          </span>
                        </div>
                        {u.hp <= 0 ? (
                          <span className="text-[8px] font-bold font-mono text-white bg-[#f56565] px-1.5 py-0.5 rounded uppercase">CRITICAL / KIA</span>
                        ) : isWounded ? (
                          <span className="text-[8px] font-bold font-mono text-[#f56565] border border-[#f56565]/30 bg-[#f56565]/5 px-1.5 py-0.5 rounded uppercase animate-pulse">WOUNDED</span>
                        ) : (
                          <span className="text-[8px] font-bold font-mono text-[#48bb78] border border-[#48bb78]/30 bg-[#48bb78]/5 px-1.5 py-0.5 rounded uppercase">OPERATIONAL</span>
                        )}
                      </div>

                      {/* Vitality Bar */}
                      <div className="w-full bg-[#0c0e14] h-1.5 overflow-hidden rounded-full">
                        <div className={`h-full ${u.hp <= 0 ? 'bg-transparent' : isWounded ? 'bg-[#f56565]' : 'bg-[#48bb78]'}`} style={{ width: `${(Math.max(0, u.hp)/u.maxHp)*100}%` }} />
                      </div>

                      {/* XP & Kill Breakdown */}
                      <div className="flex justify-between items-center text-[9px] font-mono border-t border-slate-800/80 pt-1.5">
                        <span className="text-amber-400 font-black flex items-center gap-1">
                          ⚡ +{xpGained} XP ({isVictory ? '+150 Win' : '+30 Loss'}{kills > 0 ? `, +${kills*50} Kills` : ''})
                        </span>
                        <span className="text-slate-400 font-black">
                          {kills} Kill{kills !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Level Up Banner if applicable */}
                      {leveledUp && (
                        <div className="p-1.5 bg-gradient-to-r from-yellow-950/90 to-amber-900/70 border border-yellow-500/80 rounded flex items-center justify-between text-[8px] font-mono font-black text-yellow-300 animate-pulse mt-0.5 shadow-sm">
                          <span className="flex items-center gap-1"><Sparkles size={11} /> RANK LEVEL UP! (LVL {oldLevel + 1})</span>
                          <span className="text-emerald-300">+1 SKILL PT | +ACC | +RANGE</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Col: Loot Assessment */}
            <div className="bg-[#131924] border border-[#2d3748] p-4 flex flex-col gap-4">
              <div className="text-[10px] text-[#4a5568] font-bold uppercase border-b border-[#2d3748] pb-1.5 flex justify-between items-center">
                <span>Sector Vault Cargo</span>
                <span>LOOT ASSESSMENT</span>
              </div>
              
              {isVictory ? (
                <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[260px] pr-1">
                  {loot.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-3 bg-[#1a1f2b] border transition-all ${item.secured ? 'border-[#48bb78]/40 bg-[#1e2d24]/20' : 'border-[#2d3748] opacity-65'}`}
                    >
                      <div className="flex justify-between items-center gap-4">
                        <div>
                          <div className="text-[11px] font-bold text-white uppercase">{item.name}</div>
                          <div className="text-[8px] font-mono text-[#718096] uppercase">{item.type}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => toggleLoot(item.id)}
                            className={`px-2 py-1 text-[8px] font-bold uppercase border transition-all ${
                              item.secured 
                                ? 'bg-[#48bb78] text-[#0f141e] border-[#48bb78]' 
                                : 'bg-transparent text-[#718096] border-[#2d3748] hover:text-white hover:border-[#4a5568]'
                            }`}
                          >
                            SECURE
                          </button>
                          <button
                            onClick={() => toggleLoot(item.id)}
                            className={`px-2 py-1 text-[8px] font-bold uppercase border transition-all ${
                              !item.secured 
                                ? 'bg-[#c53030] text-white border-[#c53030]' 
                                : 'bg-transparent text-[#718096] border-[#2d3748] hover:text-[#f56565] hover:border-[#f56565]/40'
                            }`}
                          >
                            DISCARD
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-[#2d3748] text-center text-[#718096] text-[10px] uppercase">
                  <span className="font-bold text-[#f56565] mb-1">CARGO COMPROMISED</span>
                  Squad was forced to retreat without loot to survive.
                </div>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex flex-col gap-4 pt-4 border-t border-[#2d3748]">
            {isVictory && !isConquerPhase && (
              <div className="bg-yellow-900/20 border border-yellow-600/30 p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-600 rounded-full animate-pulse">
                    <Target size={16} className="text-white" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">High Stakes Choice</div>
                    <div className="text-[9px] text-yellow-600 font-mono uppercase">Secure current gains or risk it all for territorial control</div>
                  </div>
                </div>
                <button 
                  onClick={handleChallengeTurf}
                  className="w-full sm:w-auto px-6 py-2.5 bg-yellow-600 text-white hover:bg-yellow-500 text-[10px] font-black uppercase tracking-widest border border-transparent transition-all shadow-[0_0_20px_rgba(202,138,4,0.4)] hover:scale-105 active:scale-95"
                >
                  Challenge for Turf
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-[9px] font-mono text-[#4a5568] uppercase text-center sm:text-left">
                * {isVictory ? 'SECURED CARGO WILL BE LINKED TO HQ STOCKS & FUNDS' : 'RECOVERY EFFORTS WILL ATTEMPT TO SALVAGE WOUNDED UNITS'}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {isVictory && (
                  <>
                    <button 
                      onClick={() => setLoot(prev => prev.map(l => ({ ...l, secured: true })))}
                      className="flex-1 sm:flex-initial px-3 py-2 border border-[#2d3748] hover:border-[#4a5568] bg-[#1a1f2b] text-[#a0aab8] hover:text-white text-[10px] font-bold uppercase font-mono tracking-wider transition-colors"
                    >
                      SECURE ALL
                    </button>
                  </>
                )}
                <button 
                  onClick={handleExtract}
                  className={`flex-1 sm:flex-initial px-8 py-3 ${isVictory ? 'bg-[#48bb78] text-[#0f141e] hover:bg-[#38a169]' : 'bg-[#c53030] text-white hover:bg-[#e53e3e]'} text-[11px] font-black uppercase tracking-widest border border-transparent transition-all shadow-lg`}
                >
                  {isVictory 
                    ? (isConquerPhase ? 'CLAIM SECTOR & EXTRACT' : 'SECURE LOOT & EXTRACT') 
                    : 'RETREAT TO BASE'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="h-full w-full bg-[#0c0e14] flex flex-col overflow-hidden select-none relative touch-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Tactical Header */}
      <div className="h-10 bg-[#161b26] border-b border-[#2d3748] px-2 md:px-4 flex items-center justify-between text-[10px] md:text-[11px] font-mono tracking-widest uppercase z-50 shrink-0 gap-2">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto custom-scrollbar py-1">
          <div className="text-[#e2e8f0] font-bold shrink-0">TACTICAL HUD</div>
          
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-[#0c111a] p-0.5 rounded border border-[#2d3748] shrink-0">
            <span className="text-slate-500 text-[8px] mr-1 hidden sm:inline">SPEED:</span>
            {[
              { label: '0.25x', val: 0.25 },
              { label: '0.5x', val: 0.5 },
              { label: '1x', val: 1 },
              { label: '2x', val: 2 }
            ].map(s => (
              <button
                key={s.label}
                onClick={() => setGameSpeed(s.val)}
                className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition-colors ${
                  gameSpeed === s.val ? 'bg-[#4299e1] text-black font-black' : 'text-slate-400 hover:text-white bg-[#1a202c]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Auto-Pause Toggles */}
          <div className="hidden md:flex items-center gap-1.5 text-[8px] shrink-0">
            <button
              onClick={() => setAutoPauseOnSpotted(!autoPauseOnSpotted)}
              className={`px-2 py-0.5 rounded border transition-colors ${
                autoPauseOnSpotted ? 'border-[#38a169] text-[#48bb78] bg-[#48bb78]/10' : 'border-[#4a5568] text-slate-500'
              }`}
            >
              PAUSE CONTACT: {autoPauseOnSpotted ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setAutoPauseOnDamage(!autoPauseOnDamage)}
              className={`px-2 py-0.5 rounded border transition-colors ${
                autoPauseOnDamage ? 'border-[#38a169] text-[#48bb78] bg-[#48bb78]/10' : 'border-[#4a5568] text-slate-500'
              }`}
            >
              PAUSE DAMAGE: {autoPauseOnDamage ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <span className="text-[#718096] hidden xs:inline">STATUS:</span>
            <span className={!isPaused ? 'text-[#48bb78]' : 'text-[#f56565]'}>{!isPaused ? 'ACTIVE' : 'PAUSED'}</span>
          </div>
        </div>
        <button 
          onClick={() => finishMission(false)}
          className="text-[#718096] hover:text-white transition-colors p-1 shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex min-h-0 relative overflow-hidden bg-[#090c12]">
        {/* Combat Grid */}
        <div 
          className="absolute inset-0 flex items-center justify-center bg-transparent cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          style={{ perspective: '2000px' }}
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a5568 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
	          
          <div 
            className="relative transition-transform duration-75 ease-out pointer-events-auto will-change-transform"
            style={{
              width: GRID_SIZE * CELL_SIZE,
              height: GRID_SIZE * CELL_SIZE,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotateX(${pitch}deg) rotateZ(${rotation}deg) translateZ(50px)`,
              transformStyle: 'preserve-3d',
              transformOrigin: 'center',
              zIndex: 10
            }}
          >
            {/* Ground Plane */}
            <div
              className="absolute inset-0 overflow-hidden rounded-sm border border-[#1a1f2b] shadow-[0_0_100px_rgba(0,0,0,0.5)]"
              style={{
                backgroundColor: '#0c0e14',
                transform: 'translateZ(-1px)',
                transformStyle: 'preserve-3d',
              }}
            >
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.16) 1px, transparent 1px)`,
                  backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                  transform: 'translateZ(0.5px)',
                  transformStyle: 'preserve-3d',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 70%)',
                  transform: 'translateZ(0.75px)',
                  transformStyle: 'preserve-3d',
                  opacity: 0.35,
                }}
              />
            </div>

            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
              const x = i % GRID_SIZE;
              const y = Math.floor(i / GRID_SIZE);
              const unit = units.find(u => u.x === x && u.y === y && u.hp > 0);
              const isSelected = selectedUnitId === unit?.id;
              const destruction = destructionGrid[`${x},${y}`] || 0;
              const obsData = obstacles[`${x},${y}`];
              const isObstacle = !!(obsData && obsData.hp > 0 && obsData.type !== 'door');
              const room = rooms.find(r => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2);
              const tileInfo = floorPlan[`${x},${y}`];
              const tileLabel = tileInfo?.label ?? 'floor';

              // Range calculations
              let isInMoveRange = false;
              let isInAttackRange = false;
              let hasLos = false;
              let hasAp = false;
              
              if (selectedUnit && !isPaused) {
                const dist = Math.abs(selectedUnit.x - x) + Math.abs(selectedUnit.y - y);
                isInMoveRange = !unit && !isObstacle && selectedUnit.ap >= dist * 2;
                isInAttackRange = (unit?.faction === 'ENEMY' || isObstacle) && dist <= 10;
                if (isInAttackRange) {
                  hasLos = hasLineOfSight(selectedUnit.x, selectedUnit.y, x, y);
                  hasAp = selectedUnit.ap >= 4;
                }
              }

              // Keep the tile cells visually transparent so the combat map stays as a continuous floor plane.
              const tileCellClassName = 'absolute flex items-center justify-center transition-all group';

              return (
                <div 
                  key={i}
                  onClick={() => handleTileClick(x, y)}
                  className={tileCellClassName}
                  style={{ 
                    width: CELL_SIZE, 
                    height: CELL_SIZE,
                    left: x * CELL_SIZE,
                    top: y * CELL_SIZE,
                    transform: 'translateZ(1px)',
                    transformStyle: 'preserve-3d',
                    zIndex: 1,
                  }}
                >
                  {/* Failed Action Overlay */}
                  <AnimatePresence>
                    {failedAction && failedAction.x === x && failedAction.y === y && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1.1 }}
                        exit={{ opacity: 0, scale: 1.4 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-red-600/60 z-[100] flex flex-col items-center justify-center pointer-events-none rounded-sm border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                      >
                        {failedAction.type === 'BLOCKED' ? <Shield size={18} className="text-white drop-shadow-md" /> : 
                         failedAction.type === 'NO_AP' ? <Zap size={18} className="text-amber-300 drop-shadow-md" /> :
                         <X size={18} className="text-white drop-shadow-md" />}
                        <span className="text-[8px] font-black uppercase text-white mt-0.5 tracking-tighter drop-shadow-lg text-center leading-none">
                          {failedAction.type.replace('_', ' ')}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Gray out / Blocked Indicators */}
                  {isInAttackRange && (!hasLos || !hasAp) && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center pointer-events-none z-20">
                      {!hasLos ? <Shield size={10} className="text-slate-500" /> : <Zap size={10} className="text-amber-600" />}
                      <span className="text-[5px] font-black uppercase text-slate-500 mt-0.5">{!hasLos ? 'BLOCKED' : 'NO AP'}</span>
                    </div>
                  )}

                  {obsData && !isObstacle && obsData.type === 'door' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ transformStyle: 'preserve-3d' }}>
                      <div className="w-8 h-8 rounded-sm border border-amber-400/70 bg-amber-500/20 shadow-[0_0_16px_rgba(245,158,11,0.35)]" />
                      <div className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-amber-300/70" />
                      <span className="absolute bottom-3 text-[6px] font-black uppercase tracking-[0.25em] text-amber-100">DOOR</span>
                    </div>
                  )}

                  {isObstacle && obsData && (
                    <ObstacleVoxel type={obsData.type} hp={obsData.hp} maxHp={obsData.maxHp} />
                  )}

                  {destruction > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-full h-full bg-[#2d3748]/30 border border-red-900/40 opacity-50" />
                    </div>
                  )}

                  {pendingAction && pendingAction.x === x && pendingAction.y === y && (
                    <div className="absolute inset-0 flex items-center justify-center z-30">
                      <motion.div 
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: [1, 1.2, 1], rotate: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-[0_0_20px_currentColor] pointer-events-none ${
                          pendingAction.type === 'ATTACK' 
                            ? 'border-red-500 text-red-500 bg-red-950/90' 
                            : 'border-cyan-400 text-cyan-400 bg-cyan-950/90'
                        }`}
                      >
                        {pendingAction.type === 'ATTACK' ? <Crosshair size={20} /> : <Move size={20} />}
                        <div className="absolute -bottom-6 whitespace-nowrap text-[8px] font-black uppercase tracking-widest bg-black/80 px-2 py-0.5 rounded border border-white/20">
                          Confirm {pendingAction.type}
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {unit && (
                    <motion.div
                      layoutId={unit.id}
                      className={`w-8 h-8 flex items-center justify-center relative z-10 transition-all ${
                        unit.faction === 'PLAYER' 
                          ? isSelected ? 'text-[#4299e1] drop-shadow-[0_0_8px_rgba(66,153,225,0.8)]' : 'text-[#48bb78]'
                          : 'text-[#f56565] drop-shadow-[0_0_8px_rgba(245,101,101,0.6)]'
                      }`}
                      style={{ 
                        transform: `translateZ(12px) rotateZ(${-rotation}deg) rotateX(${-pitch}deg) translateY(-10px)`,
                        transformStyle: 'preserve-3d',
                        zIndex: 20,
                      }}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: (unit.faction === 'ENEMY' && !isPaused) ? 1.2 : 1, 
                        opacity: 1,
                        boxShadow: (unit.faction === 'ENEMY' && !isPaused) ? '0 0 20px rgba(245,101,101,0.4)' : 'none'
                      }}
                    >
                      <User size={24} className={unit.faction === 'ENEMY' ? 'animate-pulse' : ''} />
                      {/* Health bar standing upright & Cover badge */}
                      <div className="absolute -top-4 flex flex-col items-center gap-0.5">
                        <div className="w-6 h-0.5 bg-[#0c0e14] overflow-hidden">
                          <div className="h-full bg-[#f56565]" style={{ width: `${(unit.hp/unit.maxHp)*100}%` }} />
                        </div>
                        {getUnitCoverStatus(unit.x, unit.y, obstacles) !== 'NONE' && (
                          <div className="px-1 text-[6px] font-black uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-500 rounded shadow-md pointer-events-none flex items-center gap-0.5 whitespace-nowrap">
                            <span>🛡️</span>
                            <span>{getUnitCoverStatus(unit.x, unit.y, obstacles)} COVER</span>
                          </div>
                        )}
                      </div>
                      {/* Soldier Behavioral Stance Badge */}
                      {unit.faction === 'PLAYER' && (
                        <div className="absolute -bottom-3 px-1 py-0.2 text-[6px] font-black uppercase tracking-tighter bg-black/90 rounded border border-white/20 whitespace-nowrap flex items-center gap-0.5 shadow-md pointer-events-none">
                          <span>{getStanceIcon(unit.behavior || 'AGGRESSIVE')}</span>
                          <span className="text-slate-200">{getStanceLabel(unit.behavior || 'AGGRESSIVE')}</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })}

            {/* SVG Shot Tracers */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
              {shotTracers.map(tracer => (
                <line
                  key={tracer.id}
                  x1={tracer.fromX * CELL_SIZE + CELL_SIZE / 2}
                  y1={tracer.fromY * CELL_SIZE + CELL_SIZE / 2}
                  x2={tracer.toX * CELL_SIZE + CELL_SIZE / 2}
                  y2={tracer.toY * CELL_SIZE + CELL_SIZE / 2}
                  stroke={tracer.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="animate-pulse"
                  style={{
                    filter: `drop-shadow(0 0 6px ${tracer.color})`
                  }}
                />
              ))}
            </svg>

            {/* Floating Damage Popups */}
            {damagePopups.map(popup => (
              <motion.div
                key={popup.id}
                initial={{ opacity: 1, scale: 1.5, y: 0 }}
                animate={{ opacity: 0, scale: 1, y: -35 }}
                transition={{ duration: 0.8 }}
                className="absolute pointer-events-none text-[13px] font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
                style={{
                  left: popup.x * CELL_SIZE + 10,
                  top: popup.y * CELL_SIZE,
                  color: popup.color,
                  transform: `translateZ(16px) rotateZ(${-rotation}deg) rotateX(${-pitch}deg) translateY(-25px)`,
                  transformStyle: 'preserve-3d',
                  zIndex: 40,
                }}
              >
                {popup.text}
              </motion.div>
            ))}
          </div>
          
          <div className="absolute top-2 right-2 flex flex-col gap-2 z-20">
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => { setZoom(1); setRotation(45); setPitch(60); setOffset({ x: 0, y: 0 }); }}
                className="p-1.5 bg-[#1a1f2b] border border-[#2d3748] text-[#718096] hover:text-white text-[8px] uppercase font-bold tracking-tighter transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* COMBAT HUD - FALLOUT STYLE */}
      <div className="h-28 md:h-48 bg-[#0c111a] border-t-4 border-[#1e2533] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-50 flex flex-row p-1 gap-1 shrink-0 font-mono">
        {/* Module 1: Squad List - Hidden on mobile */}
        <div className="hidden md:flex w-56 flex-col bg-[#141b26] border border-[#2d3748] p-1 gap-1 overflow-y-auto custom-scrollbar shrink-0">
          <div className="flex items-center justify-between px-1 border-b border-[#2d3748] pb-1 mb-0.5">
            <span className="text-[9px] text-[#4a5568] font-black uppercase">Squad Stance</span>
            <div className="flex gap-0.5">
              {(['AMOK', 'AGGRESSIVE', 'SUPPORT', 'DEFENSIVE', 'PASSIVE'] as BehavioralStance[]).map(st => (
                <button
                  key={st}
                  title={`Set ALL squad members to ${st}`}
                  onClick={() => setAllSquadStance(st)}
                  className="px-1 py-0.2 text-[6px] font-black bg-[#0c111a] border border-[#2d3748] text-slate-400 hover:text-white hover:border-cyan-400 rounded transition-colors"
                >
                  {st[0]}
                </button>
              ))}
            </div>
          </div>
          {units.filter(u => u.faction === 'PLAYER').map(u => (
            <div 
              key={u.id}
              onClick={() => setSelectedUnitId(u.id)}
              className={`flex items-center justify-between p-1 cursor-pointer transition-all border ${
                selectedUnitId === u.id ? 'bg-[#4299e1]/10 border-[#4299e1]' : 'hover:bg-slate-800 border-transparent'
              } ${u.hp <= 0 ? 'opacity-40 grayscale' : ''}`}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[9px] shrink-0">{getStanceIcon(u.behavior || 'AGGRESSIVE')}</span>
                <span className={`text-[10px] font-black uppercase truncate ${selectedUnitId === u.id ? 'text-[#4299e1]' : 'text-slate-300'}`}>
                  {u.name}
                </span>
              </div>
              <div className="flex gap-1 items-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.hp <= 0 ? '#f56565' : '#48bb78' }} />
                <span className="text-[8px] text-slate-500">{u.ap}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Module 2: Selected Unit Monitor */}
        <div className="flex-1 min-w-0 bg-[#161d2b] border border-[#2d3748] p-1.5 md:p-3 flex gap-2 md:gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          
          {selectedUnit ? (
            <>
              <div className="hidden xs:flex w-10 h-10 md:w-20 md:h-full bg-[#0c111a] border border-[#2d3748] items-center justify-center text-[#4299e1]/20 shrink-0">
                <User size={20} className="md:w-12 md:h-12" />
              </div>
              <div className="flex-1 flex flex-col justify-center md:justify-between min-w-0">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="text-[9px] md:text-[12px] font-black text-white uppercase tracking-wider truncate">{selectedUnit.name}</div>
                    <div className="text-[6px] md:text-[8px] text-high-primary uppercase tracking-[0.2em] animate-pulse">Link: Active</div>
                  </div>
                  {/* Mobile Unit Cycle */}
                  <div className="flex md:hidden gap-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const playerUnits = units.filter(u => u.faction === 'PLAYER' && u.hp > 0);
                        const idx = playerUnits.findIndex(u => u.id === selectedUnitId);
                        const prevIdx = (idx - 1 + playerUnits.length) % playerUnits.length;
                        setSelectedUnitId(playerUnits[prevIdx].id);
                      }}
                      className="p-1 bg-[#0c111a] border border-[#2d3748] text-[#4299e1]"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const playerUnits = units.filter(u => u.faction === 'PLAYER' && u.hp > 0);
                        const idx = playerUnits.findIndex(u => u.id === selectedUnitId);
                        const nextIdx = (idx + 1) % playerUnits.length;
                        setSelectedUnitId(playerUnits[nextIdx].id);
                      }}
                      className="p-1 bg-[#0c111a] border border-[#2d3748] text-[#4299e1]"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1 md:space-y-2">
                    <div className="space-y-0.5 md:space-y-1">
                      <div className="flex justify-between text-[6px] md:text-[8px] font-black">
                        <span className="text-slate-400">VIT</span>
                        <span className="text-white">{selectedUnit.hp}/{selectedUnit.maxHp}</span>
                      </div>
                      <div className="h-1 md:h-1.5 bg-black/40 border border-[#2d3748] p-0.5">
                        <div className="h-full bg-high-success" style={{ width: `${(selectedUnit.hp/selectedUnit.maxHp)*100}%` }} />
                      </div>
                    </div>
                    
                    <div className="space-y-0.5 md:space-y-1">
                      <div className="flex justify-between text-[6px] md:text-[8px] font-black">
                        <span className="text-slate-400">AP</span>
                        <span className="text-high-primary">{selectedUnit.ap}/{selectedUnit.maxAp}</span>
                      </div>
                      <div className="h-1 md:h-1.5 bg-black/40 border border-[#2d3748] p-0.5">
                        <div className="h-full bg-high-primary" style={{ width: `${(selectedUnit.ap/selectedUnit.maxAp)*100}%` }} />
                      </div>
                    </div>

                    {/* Weight & Encumbrance Indicator */}
                    <div className="flex items-center justify-between text-[6px] md:text-[8px] font-mono font-bold uppercase pt-0.5">
                      <span className={`flex items-center gap-1 ${selectedUnit.totalWeight && selectedUnit.carryLimit && selectedUnit.totalWeight > selectedUnit.carryLimit ? 'text-amber-400 font-extrabold' : 'text-slate-400'}`}>
                        <Scale size={10} className="text-amber-400" /> GEAR: {selectedUnit.totalWeight || 0}KG / {selectedUnit.carryLimit || 10}KG
                      </span>
                      <span className="text-cyan-400 flex items-center gap-1">
                        <Gauge size={10} /> MOVE: {selectedUnit.movementApCost || 2} AP/TILE
                      </span>
                    </div>

                    {/* Behavioral Stance Selector */}
                    {selectedUnit.faction === 'PLAYER' && (
                      <div className="flex items-center gap-1 pt-0.5 overflow-x-auto custom-scrollbar">
                        <span className="text-[6px] md:text-[8px] text-slate-500 font-black uppercase shrink-0">STANCE:</span>
                        <div className="flex gap-0.5 md:gap-1 shrink-0">
                          {(['AMOK', 'AGGRESSIVE', 'SUPPORT', 'DEFENSIVE', 'PASSIVE'] as BehavioralStance[]).map(st => {
                            const isActive = (selectedUnit.behavior || 'AGGRESSIVE') === st;
                            return (
                              <button
                                key={st}
                                onClick={() => setUnitStance(selectedUnit.id, st)}
                                className={`px-1 md:px-1.5 py-0.5 text-[6px] md:text-[8px] font-black uppercase rounded border transition-all flex items-center gap-0.5 ${
                                  getStanceStyle(st, isActive)
                                }`}
                              >
                                <span>{getStanceIcon(st)}</span>
                                <span className="hidden xs:inline">{getStanceLabel(st)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Loadout Section */}
                  <div className="flex gap-1 shrink-0">
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={switchWeapon}
                        className="w-12 md:w-20 h-10 md:h-14 bg-[#0c111a] border border-[#2d3748] flex flex-col items-center justify-center hover:bg-slate-800 transition-colors relative"
                      >
                        <RefreshCw size={10} className="absolute top-1 right-1 text-slate-600" />
                        <span className="text-[6px] md:text-[8px] text-slate-500 uppercase">Weapon</span>
                        <span className="text-[8px] md:text-[10px] text-white font-black truncate w-full text-center px-1">
                          {ITEMS[selectedUnit.activeWeaponId]?.name.split(' ')[0] || 'Unarmed'}
                        </span>
                      </button>
                    </div>

                    <button
                      onClick={() => setMortarTargetingMode(!mortarTargetingMode)}
                      disabled={selectedUnit.ap < 6}
                      className={`w-12 md:w-16 h-10 md:h-14 border flex flex-col items-center justify-center transition-all disabled:opacity-30 relative ${
                        mortarTargetingMode 
                          ? 'border-amber-400 bg-amber-500/10 text-amber-300 animate-pulse' 
                          : 'border-[#2d3748] bg-[#0c111a] text-slate-400 hover:border-amber-500/40 hover:text-amber-300'
                      }`}
                    >
                      <Crosshair size={14} className="text-amber-500" />
                      <span className="text-[5px] text-slate-500 uppercase font-black leading-none mt-1">MORTAR</span>
                      <span className="text-[5px] text-amber-500 font-extrabold tracking-tighter leading-none mt-0.5">6 AP</span>
                      {mortarTargetingMode && (
                        <div className="absolute -top-6 whitespace-nowrap bg-amber-500 text-black font-black text-[6px] uppercase px-1 py-0.2 rounded border border-amber-300 shadow-md">
                          SELECT TARGET
                        </div>
                      )}
                    </button>

                    <button 
                      onClick={() => setShowInventory(!showInventory)}
                      className={`w-10 h-10 md:h-14 bg-[#0c111a] border flex flex-col items-center justify-center transition-colors ${
                        showInventory ? 'border-[#4299e1] bg-[#4299e1]/10 text-[#4299e1]' : 'border-[#2d3748] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Package size={16} />
                      <span className="text-[6px] text-slate-500 uppercase mt-0.5">INV</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#2d3748] text-[8px] uppercase font-black italic">
              Scanning...
            </div>
          )}
        </div>

        {/* Module 3: Combat Log - Hidden on mobile/tablet */}
        <div className="hidden lg:flex flex-[1.5] bg-[#090e16] border border-[#2d3748] p-2 flex-col gap-1 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-1 opacity-20"><List size={12} className="text-[#4299e1]" /></div>
          <div className="flex-1 overflow-y-auto space-y-1 text-[9px] custom-scrollbar pr-1">
            {log.slice(0, 10).map((entry, i) => (
              <div key={i} className={`flex gap-2 border-l border-slate-700/50 pl-2 py-0.5 ${
                entry.startsWith('---') ? 'text-white font-black bg-white/5' : entry.includes('[HOSTILE]') ? 'text-red-400' : 'text-slate-400'
              }`}>
                <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
                <span className="truncate">{entry}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Module 4: Action Controls */}
        <div className="w-32 md:w-56 bg-[#161d2b] border border-[#2d3748] p-1.5 flex flex-col justify-center gap-1.5 shrink-0">
          <button 
            onClick={togglePause}
            
            className={`w-full flex-1 md:py-4 font-black uppercase tracking-[0.15em] text-[9px] md:text-[12px] border-2 transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 ${
              !isPaused 
                ? 'bg-red-950 border-red-600 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.2)]' 
                : 'bg-slate-900 border-slate-800 text-slate-600'
            }`}
          >
            <span className="leading-none text-center">{isPaused ? 'RESUME TIME' : 'PAUSE TIME'}</span>
            <div className="hidden md:flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={`w-1 h-1 rotate-45 ${!isPaused ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </button>
          
          <div className="grid grid-cols-2 gap-1 h-6 md:h-10 shrink-0">
            <div className="bg-[#0c111a] border border-[#2d3748] flex flex-col items-center justify-center">
              <span className="text-[5px] text-slate-500 uppercase">STL</span>
              <span className="text-[6px] md:text-[9px] text-high-danger font-black">EXP</span>
            </div>
            <div className="bg-[#0c111a] border border-[#2d3748] flex flex-col items-center justify-center">
              <span className="text-[5px] text-slate-500 uppercase">SIG</span>
              <span className="text-[6px] md:text-[9px] text-high-success font-black">STB</span>
            </div>
          </div>
        </div>
      </div>
      {/* Inventory Overlay */}
      <AnimatePresence>
        {showInventory && selectedUnit && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="w-full max-w-md bg-[#161d2b] border-4 border-[#2d3748] shadow-2xl overflow-hidden font-mono">
              <div className="bg-[#2d3748] p-2 flex justify-between items-center">
                <span className="text-white font-black text-[12px] uppercase tracking-widest flex items-center gap-2">
                  <Package size={14} /> Unit Inventory: {selectedUnit.name}
                </span>
                <button onClick={() => setShowInventory(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {selectedUnit.inventory.length > 0 ? (
                  selectedUnit.inventory.map((itemId, i) => (
                    <button 
                      key={i}
                      onClick={() => useItem(itemId)}
                      disabled={selectedUnit.ap < 3}
                      className="bg-[#0c111a] border border-[#2d3748] p-3 flex flex-col items-center gap-1 hover:border-[#4299e1] hover:bg-[#4299e1]/10 transition-all disabled:opacity-50 group"
                    >
                      <span className="text-white font-black uppercase text-[10px]">{itemId}</span>
                      <span className="text-[8px] text-slate-500 uppercase group-hover:text-[#4299e1]">Use (3 AP)</span>
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 py-8 text-center text-slate-600 text-[10px] uppercase font-black italic">
                    Inventory Empty
                  </div>
                )}
              </div>
              <div className="bg-[#0c111a] border-t border-[#2d3748] p-2 text-center">
                <span className="text-[8px] text-slate-500 uppercase">Available Action Points: {selectedUnit.ap}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TacticalMission;
