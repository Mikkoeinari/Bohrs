/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useGame, getUnitEncumbrance } from '../store/GameContext';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Swords, ArrowRight, User, X, ChevronLeft, ChevronRight, List, Move, Crosshair, Package, RefreshCw, Zap, Sparkles, Scale, Gauge } from 'lucide-react';
import { ITEMS } from '../data';
import type { BaseSector, Building } from '../types';
import { ThreeCityScene, type CombatSceneLayout } from './ThreeCityScene';

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
  moveTarget?: {x: number, y: number};
  cooldown?: number;
  behavior?: BehavioralStance;
  specialty?: string;
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
  linkedDoor?: string; // coordinate key of paired door block
  orientation?: 'ns' | 'ew'; // wall orientation: 'ns' = thin in X (north-south wall), 'ew' = thin in Y (east-west wall)
}

const MIN_VOXEL_CUBE_SIZE = 24;
const DOOR_MAX_HP = 60;

const VoxelBox = ({ width = 36, height = 36, depth = 36, topColor, bottomColor, frontColor, backColor, leftColor, rightColor, children, offsetZ = 0 }: any) => {
  // Dimensions: width (X-axis), depth (Y-axis on board), height (Z-axis = vertical above board)
  // The container sits in the board's XY plane; Z points up from the board surface.
  const w = Math.max(4, width);
  const h = Math.max(4, height); // vertical extent
  const d = Math.max(4, depth);  // Y-axis extent
  const halfW = w / 2;
  const halfH = h / 2;
  const halfD = d / 2;
  const baseOffsetZ = offsetZ || halfH;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        width: `${w}px`,
        height: `${d}px`,
        left: '50%',
        top: '50%',
        transform: `translate3d(-50%, -50%, ${baseOffsetZ}px)`,
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Top face (X/Y plane, lifted along +Z) */}
      <div
        className="absolute border border-black/20"
        style={{
          width: `${w}px`, height: `${d}px`,
          left: 0, top: 0,
          backgroundColor: topColor,
          transform: `translate3d(0, 0, ${halfH}px)`,
          boxSizing: 'border-box'
        }}
      >
        {children}
      </div>

      {/* Bottom face (X/Y plane, lifted along -Z) */}
      <div
        className="absolute border border-black/20"
        style={{
          width: `${w}px`, height: `${d}px`,
          left: 0, top: 0,
          backgroundColor: bottomColor,
          transform: `translate3d(0, 0, ${-halfH}px) rotateX(180deg)`,
          boxSizing: 'border-box'
        }}
      />

      {/* Front face (X/Z plane, pushed to +Y edge) */}
      <div
        className="absolute border border-black/20"
        style={{
          width: `${w}px`, height: `${h}px`,
          left: 0, top: `${halfD - halfH}px`,
          backgroundColor: frontColor,
          transformOrigin: 'center center',
          transform: `translate3d(0, ${halfD}px, 0) rotateX(-90deg)`,
          boxSizing: 'border-box'
        }}
      />

      {/* Back face (X/Z plane, pushed to -Y edge) */}
      <div
        className="absolute border border-black/20"
        style={{
          width: `${w}px`, height: `${h}px`,
          left: 0, top: `${halfD - halfH}px`,
          backgroundColor: backColor,
          transformOrigin: 'center center',
          transform: `translate3d(0, ${-halfD}px, 0) rotateX(90deg)`,
          boxSizing: 'border-box'
        }}
      />

      {/* Left face (Y/Z plane, pushed to -X edge) */}
      <div
        className="absolute border border-black/20"
        style={{
          width: `${d}px`, height: `${h}px`,
          left: `${halfW - halfD}px`, top: `${halfD - halfH}px`,
          backgroundColor: leftColor,
          transformOrigin: 'center center',
          transform: `translate3d(${-halfW}px, 0, 0) rotateY(-90deg)`,
          boxSizing: 'border-box'
        }}
      />

      {/* Right face (Y/Z plane, pushed to +X edge) */}
      <div
        className="absolute border border-black/20"
        style={{
          width: `${d}px`, height: `${h}px`,
          left: `${halfW - halfD}px`, top: `${halfD - halfH}px`,
          backgroundColor: rightColor,
          transformOrigin: 'center center',
          transform: `translate3d(${halfW}px, 0, 0) rotateY(90deg)`,
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
};

const ObstacleVoxel = ({ type, hp, maxHp, cellSize = 48, orientation }: { type: ObstacleType; hp: number; maxHp: number; cellSize?: number; orientation?: 'ns' | 'ew' }) => {
  const s = Math.max(24, Math.round(cellSize * 0.85));

  // Type-specific shapes: width, height (vertical), depth, and colors
  const shapeConfig = useMemo(() => {
    switch (type) {
      case 'wall':
        // Thin wall slab: orientation determines which axis is thin
        // 'ns' = north-south wall (thin in X, tall depth), 'ew' = east-west wall (thin in Y, wide)
        if (orientation === 'ns') {
          return {
            w: Math.round(s * 0.18), h: Math.round(s * 0.9), d: s,
            top: '#6b7280', bottom: '#374151', front: '#6b7280', back: '#6b7280', left: '#9ca3af', right: '#4b5563'
          };
        }
        return {
          w: s, h: Math.round(s * 0.9), d: Math.round(s * 0.18),
          top: '#6b7280', bottom: '#374151', front: '#9ca3af', back: '#4b5563', left: '#6b7280', right: '#6b7280'
        };
      case 'server':
        // Tall thin server rack
        return {
          w: Math.round(s * 0.5), h: Math.round(s * 0.95), d: Math.round(s * 0.35),
          top: '#1e293b', bottom: '#0f172a', front: '#334155', back: '#1e293b', left: '#1e293b', right: '#1e293b'
        };
      case 'vat':
        // Cylindrical approximation: medium cube, slightly taller
        return {
          w: Math.round(s * 0.55), h: Math.round(s * 0.7), d: Math.round(s * 0.55),
          top: '#065f46', bottom: '#064e3b', front: '#10b981', back: '#047857', left: '#059669', right: '#059669'
        };
      case 'crate':
        // Squat crate box
        return {
          w: Math.round(s * 0.6), h: Math.round(s * 0.45), d: Math.round(s * 0.6),
          top: '#92400e', bottom: '#78350f', front: '#d97706', back: '#b45309', left: '#b45309', right: '#d97706'
        };
      case 'desk':
        // Flat slab table: wide, short, decent depth
        return {
          w: Math.round(s * 0.8), h: Math.round(s * 0.25), d: Math.round(s * 0.5),
          top: '#44403c', bottom: '#292524', front: '#57534e', back: '#44403c', left: '#44403c', right: '#57534e'
        };
      case 'generator':
        // Large boxy machine
        return {
          w: Math.round(s * 0.7), h: Math.round(s * 0.6), d: Math.round(s * 0.6),
          top: '#374151', bottom: '#1f2937', front: '#dc2626', back: '#991b1b', left: '#4b5563', right: '#4b5563'
        };
      case 'bed':
        // Low flat slab: wide, very short, long depth
        return {
          w: Math.round(s * 0.45), h: Math.round(s * 0.2), d: Math.round(s * 0.85),
          top: '#e0e7ff', bottom: '#6366f1', front: '#a5b4fc', back: '#818cf8', left: '#818cf8', right: '#a5b4fc'
        };
      case 'door':
        // Tall thin door panel
        return {
          w: Math.round(s * 0.75), h: Math.round(s * 0.95), d: Math.round(s * 0.12),
          top: '#78350f', bottom: '#451a03', front: '#a16207', back: '#92400e', left: '#92400e', right: '#a16207'
        };
      default:
        return {
          w: Math.round(s * 0.6), h: Math.round(s * 0.6), d: Math.round(s * 0.6),
          top: '#475569', bottom: '#1e293b', front: '#64748b', back: '#334155', left: '#475569', right: '#475569'
        };
    }
  }, [type, s, orientation]);

  // Damage tint: darken as HP drops
  const damageOpacity = maxHp > 0 ? Math.max(0, 1 - hp / maxHp) * 0.5 : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ transformStyle: 'preserve-3d' }}>
      <VoxelBox
        width={shapeConfig.w}
        height={shapeConfig.h}
        depth={shapeConfig.d}
        topColor={shapeConfig.top}
        bottomColor={shapeConfig.bottom}
        frontColor={shapeConfig.front}
        backColor={shapeConfig.back}
        leftColor={shapeConfig.left}
        rightColor={shapeConfig.right}
      />
      {damageOpacity > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${damageOpacity})`, borderRadius: '2px' }} />
      )}
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


export const getLayoutForBuildingType = (buildingType: string, sectors: BaseSector[] = [], missionType: string = 'RAID', building?: Building | null) => {
  if (missionType === 'URBAN') {
    const rooms: Room[] = [];
    const floorPlan: Record<string, FloorPlanTile> = {};
    const obstacles: Record<string, ObstacleData> = {};

    // Track tile roomType for visual styling (ROAD, SIDEWALK, BUILDING, PAVEMENT)
    const setTile = (x: number, y: number, label: FloorTileLabel, roomType?: string) => {
      floorPlan[`${x},${y}`] = { label, roomType };
    };

    const placeObstacle = (x: number, y: number, type: ObstacleType, hp: number, roomType?: string) => {
      setTile(x, y, 'furniture', roomType);
      obstacles[`${x},${y}`] = { type, hp, maxHp: hp };
    };

    // Road runs horizontally through the middle (3 tiles wide)
    const roadY = Math.floor(MAP_GRID_SIZE / 2);       // centre lane y=12
    // Cross-street runs vertically (3 tiles wide)
    const alleyX = Math.floor(MAP_GRID_SIZE / 2);      // centre lane x=12

    // Helpers
    const isRoadRow = (y: number) => y >= roadY - 1 && y <= roadY + 1;
    const isAlleyCol = (x: number) => x >= alleyX - 1 && x <= alleyX + 1;
    const isSidewalkRow = (y: number) => y === roadY - 2 || y === roadY + 2;
    const isSidewalkCol = (x: number) => x === alleyX - 2 || x === alleyX + 2;

    // Lay down every tile
    for (let x = 0; x < MAP_GRID_SIZE; x++) {
      for (let y = 0; y < MAP_GRID_SIZE; y++) {
        const isBoundary = x === 0 || x === MAP_GRID_SIZE - 1 || y === 0 || y === MAP_GRID_SIZE - 1;
        // Open the boundary where road/alley exits the map
        const isOpenBoundary = isBoundary && (isRoadRow(y) || isAlleyCol(x));

        if (isOpenBoundary) {
          setTile(x, y, 'accessway', 'ROAD');
        } else if (isBoundary) {
          setTile(x, y, 'wall', 'BUILDING');
          const isVerticalEdge = (x === 0 || x === MAP_GRID_SIZE - 1) && y > 0 && y < MAP_GRID_SIZE - 1;
          obstacles[`${x},${y}`] = { type: 'wall', hp: 100, maxHp: 100, orientation: isVerticalEdge ? 'ns' : 'ew' };
        } else if (isRoadRow(y) || isAlleyCol(x)) {
          setTile(x, y, 'accessway', 'ROAD');
        } else if (isSidewalkRow(y) || isSidewalkCol(x)) {
          setTile(x, y, 'floor', 'SIDEWALK');
        } else {
          setTile(x, y, 'floor', 'PAVEMENT');
        }
      }
    }

    // Building block walls in the four quadrant corners (leaves sidewalks open)
    const buildBlock = (bx1: number, by1: number, bx2: number, by2: number) => {
      for (let bx = bx1; bx <= bx2; bx++) {
        for (let by = by1; by <= by2; by++) {
          if (isRoadRow(by) || isAlleyCol(bx)) continue; // never overwrite street
          const isFacade = bx === bx1 || bx === bx2 || by === by1 || by === by2;
          if (isFacade) {
            setTile(bx, by, 'wall', 'BUILDING');
            const isVerticalEdge = (bx === bx1 || bx === bx2) && by > by1 && by < by2;
            obstacles[`${bx},${by}`] = { type: 'wall', hp: 100, maxHp: 100, orientation: isVerticalEdge ? 'ns' : 'ew' };
          } else {
            setTile(bx, by, 'floor', 'BUILDING');
          }
        }
      }
    };

    // NW building block
    buildBlock(2, 2, 8, 8);
    // NE building block
    buildBlock(15, 2, 21, 8);
    // SW building block
    buildBlock(2, 15, 8, 21);
    // SE building block
    buildBlock(15, 15, 21, 21);

    // Parked cars (desk = car body) on road shoulders
    const carPositions: {x: number; y: number}[] = [
      { x: 4,  y: roadY - 1 }, { x: 5,  y: roadY - 1 },
      { x: 17, y: roadY + 1 }, { x: 18, y: roadY + 1 },
      { x: 8,  y: roadY + 1 }, { x: 9,  y: roadY + 1 },
    ];
    carPositions.forEach(({ x, y }) => {
      if (floorPlan[`${x},${y}`]?.label !== 'wall') {
        placeObstacle(x, y, 'desk', 55, 'ROAD');
      }
    });

    // Street barriers / concrete blocks (crates) — mid-road cover for both sides
    const barrierPositions: {x: number; y: number}[] = [
      { x: 3,  y: roadY },  { x: 13, y: roadY - 1 },
      { x: 20, y: roadY },  { x: 7,  y: roadY + 1 },
    ];
    barrierPositions.forEach(({ x, y }) => {
      if (floorPlan[`${x},${y}`]?.label !== 'wall') {
        placeObstacle(x, y, 'crate', 80, 'ROAD');
      }
    });

    // Dumpsters/bins on sidewalks
    const binPositions: {x: number; y: number}[] = [
      { x: 10, y: roadY - 2 }, { x: 14, y: roadY + 2 },
      { x: alleyX - 2, y: 5 }, { x: alleyX + 2, y: 18 },
    ];
    binPositions.forEach(({ x, y }) => {
      if (floorPlan[`${x},${y}`]?.label === 'floor') {
        placeObstacle(x, y, 'crate', 50, 'SIDEWALK');
      }
    });

    // Generator / utility box near alley
    placeObstacle(alleyX + 2, roadY - 3, 'generator', 90, 'SIDEWALK');
    placeObstacle(alleyX - 2, roadY + 3, 'generator', 90, 'SIDEWALK');

    // Named zones
    rooms.push({ name: 'MAIN STREET', x1: 0, y1: roadY - 1, x2: MAP_GRID_SIZE - 1, y2: roadY + 1, color: 'text-slate-300 border-slate-500/30', bgClass: 'bg-slate-950/10', type: 'STREET' });
    rooms.push({ name: 'CROSS STREET', x1: alleyX - 1, y1: 0, x2: alleyX + 1, y2: MAP_GRID_SIZE - 1, color: 'text-amber-300 border-amber-500/30', bgClass: 'bg-amber-950/10', type: 'ALLEY' });
    rooms.push({ name: 'NORTH SIDEWALK', x1: 1, y1: roadY - 2, x2: MAP_GRID_SIZE - 2, y2: roadY - 2, color: 'text-zinc-300 border-zinc-500/20', bgClass: 'bg-zinc-950/10', type: 'SIDEWALK' });
    rooms.push({ name: 'SOUTH SIDEWALK', x1: 1, y1: roadY + 2, x2: MAP_GRID_SIZE - 2, y2: roadY + 2, color: 'text-zinc-300 border-zinc-500/20', bgClass: 'bg-zinc-950/10', type: 'SIDEWALK' });

    return { rooms, floorPlan, obstacles, lootTiles: [] as { x: number; y: number; itemId: string; name: string }[] };
  }

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

  // Room furniture: positions are relative to interior top-left (x1+1, y1+1), range 0–8 each axis.
  // Furniture is pushed to walls leaving centre clear for unit movement.
  const roomStyles: Record<string, { name: string; color: string; bgClass: string; furniture: Array<{ x: number; y: number; type: PlacedObstacleType }> }> = {
    // Command bay: row of consoles along north wall, server racks on west wall, single desk at south
    COMMAND: { name: 'COMMAND BAY', color: 'text-red-400 border-red-500/30', bgClass: 'bg-red-950/10', furniture: [
      { x: 1, y: 0, type: 'desk' }, { x: 3, y: 0, type: 'desk' }, { x: 5, y: 0, type: 'desk' }, { x: 7, y: 0, type: 'desk' },
      { x: 0, y: 2, type: 'server' }, { x: 0, y: 4, type: 'server' },
      { x: 4, y: 7, type: 'desk' },
    ] },
    // Lab: server racks lining both side walls, chemical vats at south
    LAB: { name: 'LAB BAY', color: 'text-cyan-400 border-cyan-500/30', bgClass: 'bg-cyan-950/10', furniture: [
      { x: 0, y: 1, type: 'server' }, { x: 0, y: 3, type: 'server' }, { x: 0, y: 5, type: 'server' },
      { x: 8, y: 1, type: 'server' }, { x: 8, y: 3, type: 'server' }, { x: 8, y: 5, type: 'server' },
      { x: 2, y: 7, type: 'vat' }, { x: 6, y: 7, type: 'vat' },
    ] },
    // Armory: crates stacked in two parallel columns, walkway between
    ARMORY: { name: 'ARMORY BAY', color: 'text-orange-400 border-orange-500/30', bgClass: 'bg-orange-950/10', furniture: [
      { x: 1, y: 1, type: 'crate' }, { x: 2, y: 1, type: 'crate' },
      { x: 1, y: 3, type: 'crate' }, { x: 2, y: 3, type: 'crate' },
      { x: 6, y: 1, type: 'crate' }, { x: 7, y: 1, type: 'crate' },
      { x: 6, y: 3, type: 'crate' }, { x: 7, y: 3, type: 'crate' },
      { x: 4, y: 6, type: 'desk' },
    ] },
    // Infirmary: beds in two rows along side walls, record desk at south
    INFIRMARY: { name: 'MED BAY', color: 'text-emerald-400 border-emerald-500/30', bgClass: 'bg-emerald-950/10', furniture: [
      { x: 1, y: 1, type: 'bed' }, { x: 1, y: 3, type: 'bed' }, { x: 1, y: 5, type: 'bed' },
      { x: 7, y: 1, type: 'bed' }, { x: 7, y: 3, type: 'bed' },
      { x: 4, y: 7, type: 'desk' },
    ] },
    // Quarters: bunk rows against both side walls, writing desk at south
    QUARTERS: { name: 'QUARTERS', color: 'text-slate-400 border-slate-500/30', bgClass: 'bg-slate-900/10', furniture: [
      { x: 1, y: 0, type: 'bed' }, { x: 1, y: 2, type: 'bed' }, { x: 1, y: 4, type: 'bed' }, { x: 1, y: 6, type: 'bed' },
      { x: 7, y: 0, type: 'bed' }, { x: 7, y: 2, type: 'bed' },
      { x: 4, y: 7, type: 'desk' },
    ] },
    // Workshop: heavy machinery along north wall, spare-parts crates in corners, workbench at south
    WORKSHOP: { name: 'WORKSHOP', color: 'text-amber-400 border-amber-500/30', bgClass: 'bg-amber-950/10', furniture: [
      { x: 0, y: 0, type: 'generator' }, { x: 0, y: 2, type: 'generator' },
      { x: 6, y: 0, type: 'crate' }, { x: 7, y: 0, type: 'crate' },
      { x: 6, y: 2, type: 'crate' }, { x: 7, y: 2, type: 'crate' },
      { x: 3, y: 6, type: 'desk' },
    ] },
    // Power bay: generators and coolant vats in symmetric grid
    POWER: { name: 'POWER BAY', color: 'text-purple-400 border-purple-500/30', bgClass: 'bg-purple-950/10', furniture: [
      { x: 1, y: 1, type: 'generator' }, { x: 4, y: 1, type: 'generator' }, { x: 7, y: 1, type: 'generator' },
      { x: 1, y: 5, type: 'vat' }, { x: 4, y: 5, type: 'vat' }, { x: 7, y: 5, type: 'vat' },
    ] },
    // Hydroponics: growing vats in a 4×2 grid, leaving pathways between
    HYDROPONICS: { name: 'HYDROPONICS', color: 'text-lime-400 border-lime-500/30', bgClass: 'bg-lime-950/10', furniture: [
      { x: 1, y: 0, type: 'vat' }, { x: 3, y: 0, type: 'vat' }, { x: 5, y: 0, type: 'vat' }, { x: 7, y: 0, type: 'vat' },
      { x: 1, y: 3, type: 'vat' }, { x: 3, y: 3, type: 'vat' }, { x: 5, y: 3, type: 'vat' }, { x: 7, y: 3, type: 'vat' },
    ] },
    // Garage: supply crates along north wall, generator/compressor on west side
    GARAGE: { name: 'GARAGE', color: 'text-zinc-400 border-zinc-500/30', bgClass: 'bg-zinc-900/10', furniture: [
      { x: 1, y: 0, type: 'crate' }, { x: 3, y: 0, type: 'crate' }, { x: 5, y: 0, type: 'crate' }, { x: 7, y: 0, type: 'crate' },
      { x: 0, y: 6, type: 'generator' },
    ] },
    // Staircase: no furniture, just stairs
    STAIRCASE: { name: 'STAIRS', color: 'text-yellow-400 border-yellow-500/30', bgClass: 'bg-yellow-950/10', furniture: [] },
    // Lounge: couches/beds along side walls, coffee tables (desks) in centre area
    LOUNGE: { name: 'LOUNGE', color: 'text-indigo-400 border-indigo-500/30', bgClass: 'bg-indigo-950/10', furniture: [
      { x: 1, y: 1, type: 'bed' }, { x: 1, y: 3, type: 'bed' },
      { x: 7, y: 1, type: 'bed' }, { x: 7, y: 3, type: 'bed' },
      { x: 3, y: 6, type: 'desk' }, { x: 5, y: 6, type: 'desk' },
    ] },
    // Lobby: reception desk counter along north wall, additional desk on each side
    LOBBY: { name: 'LOBBY', color: 'text-blue-400 border-blue-500/30', bgClass: 'bg-blue-950/10', furniture: [
      { x: 2, y: 0, type: 'desk' }, { x: 4, y: 0, type: 'desk' }, { x: 6, y: 0, type: 'desk' },
      { x: 1, y: 3, type: 'desk' }, { x: 2, y: 3, type: 'desk' }, { x: 3, y: 3, type: 'desk' },
    ] },
  };

  // Building-geometry-aware layout: each floor is a row of rooms, each column is a room slot.
  // ROOM_STEP = 6: rooms are 7 tiles wide/tall (5 interior + shared walls), stepping 6 tiles apart.
  const ROOM_STEP = 6;
  const numFloors = Math.max(1, Math.min(3, building?.unlockedFloors || 1));
  const numCols = building
    ? Math.max(1, Math.min(3, building.width))
    : Math.max(1, Math.min(3, Math.ceil(Math.sqrt(roomCount))));

  // Building bounding box, centered in the map
  const buildingW = numCols * ROOM_STEP + 1;
  const buildingH = numFloors * ROOM_STEP + 1;
  const bx = Math.max(1, Math.floor((MAP_GRID_SIZE - buildingW) / 2));
  const by = Math.max(1, Math.floor((MAP_GRID_SIZE - buildingH) / 2));

  const setTile = (x: number, y: number, label: FloorTileLabel, roomType?: string, roomName?: string) => {
    floorPlan[`${x},${y}`] = { label, roomType, roomName };
  };

  const getTileHp = (type: PlacedObstacleType) => {
    if (type === 'generator') return 120;
    if (type === 'vat') return 80;
    if (type === 'server' || type === 'desk') return 60;
    if (type === 'crate') return 40;
    if (type === 'bed') return 50;
    return 50;
  };

  const placeDoor = (x: number, y: number) => {
    // 2-block door: place door at (x,y) and an adjacent tile
    // Determine second block direction: prefer vertical (y+1), fallback to horizontal (x+1)
    let x2 = x;
    let y2 = y + 1;
    if (y2 >= MAP_GRID_SIZE) { y2 = y - 1; }

    const key1 = `${x},${y}`;
    const key2 = `${x2},${y2}`;

    setTile(x, y, 'accessway');
    setTile(x2, y2, 'accessway');
    delete obstacles[key1];
    delete obstacles[key2];
    obstacles[key1] = { type: 'door', hp: DOOR_MAX_HP, maxHp: DOOR_MAX_HP, linkedDoor: key2 };
    obstacles[key2] = { type: 'door', hp: DOOR_MAX_HP, maxHp: DOOR_MAX_HP, linkedDoor: key1 };
  };

  const carveRoom = (x1: number, y1: number, x2: number, y2: number, roomType: string, template: { name: string; color: string; bgClass: string; furniture: Array<{ x: number; y: number; type: PlacedObstacleType }> }) => {
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
          // Determine wall orientation: vertical edges (left/right) are 'ns', horizontal edges (top/bottom) are 'ew'
          const isVerticalEdge = (tileX === x1 || tileX === x2) && tileY > y1 && tileY < y2;
          const orientation: 'ns' | 'ew' = isVerticalEdge ? 'ns' : 'ew';
          obstacles[`${tileX},${tileY}`] = { type: 'wall', hp: 100, maxHp: 100, orientation };
        }
      }
    }

    if (roomType === 'STAIRCASE') {
      const stairsX = x1 + 1;
      const stairsY = y1 + 1;
      setTile(stairsX, stairsY, 'stairs', roomType, template.name);
    } else {
      template.furniture.forEach((slot) => {
        const furnitureX = x1 + 1 + slot.x;
        const furnitureY = y1 + 1 + slot.y;
        const hp = getTileHp(slot.type);
        setTile(furnitureX, furnitureY, 'furniture', roomType, template.name);
        obstacles[`${furnitureX},${furnitureY}`] = { type: slot.type, hp, maxHp: hp };
      });
    }
  };

  // Fill the entire map — boundary tiles become walls, interior is open floor
  for (let x = 0; x < MAP_GRID_SIZE; x++) {
    for (let y = 0; y < MAP_GRID_SIZE; y++) {
      const isBoundary = x === 0 || x === MAP_GRID_SIZE - 1 || y === 0 || y === MAP_GRID_SIZE - 1;
      setTile(x, y, isBoundary ? 'wall' : 'floor');
      if (isBoundary) {
        const isVerticalEdge = (x === 0 || x === MAP_GRID_SIZE - 1) && y > 0 && y < MAP_GRID_SIZE - 1;
        const orientation: 'ns' | 'ew' = isVerticalEdge ? 'ns' : 'ew';
        obstacles[`${x},${y}`] = { type: 'wall', hp: 100, maxHp: 100, orientation };
      }
    }
  }

  // Carve each room in the building grid (floor row × column)
  for (let floor = 0; floor < numFloors; floor++) {
    for (let col = 0; col < numCols; col++) {
      const roomIndex = floor * numCols + col;
      const roomType = resolvedRoomTypes[roomIndex % resolvedRoomTypes.length] || 'LOBBY';
      const x1 = bx + col * ROOM_STEP;
      const y1 = by + floor * ROOM_STEP;
      const x2 = x1 + ROOM_STEP;
      const y2 = y1 + ROOM_STEP;
      const template = roomStyles[roomType] || roomStyles.LOBBY;
      carveRoom(x1, y1, x2, y2, roomType, template);
    }
  }

  // Doors between horizontally adjacent rooms on the same floor (through shared vertical walls)
  for (let floor = 0; floor < numFloors; floor++) {
    for (let col = 0; col < numCols - 1; col++) {
      const sharedWallX = bx + (col + 1) * ROOM_STEP;
      const doorY = by + floor * ROOM_STEP + Math.floor(ROOM_STEP / 2);
      placeDoor(sharedWallX, doorY);
    }
  }

  // Staircase access between floors (through shared horizontal walls at rightmost column's centre)
  if (numFloors > 1) {
    const stairX = bx + (numCols - 1) * ROOM_STEP + Math.floor(ROOM_STEP / 2);
    for (let floor = 0; floor < numFloors - 1; floor++) {
      const sharedWallY = by + (floor + 1) * ROOM_STEP;
      setTile(stairX, sharedWallY, 'stairs');
      delete obstacles[`${stairX},${sharedWallY}`];
    }
  }

  // Entry door on the left outer wall of the ground floor
  const entryDoorY = by + Math.floor(ROOM_STEP / 2);
  placeDoor(bx, entryDoorY);

  return { rooms, floorPlan, obstacles, lootTiles: [] as { x: number; y: number; itemId: string; name: string }[] };
};

const TacticalMission = () => {
  const { state, finishMission } = useGame();
  const activeMission = state.activeMission;
  const activeBuilding = activeMission ? (state.world?.buildings[activeMission.buildingId] || state.buildings[activeMission.buildingId]) : null;
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

  const calculateEnemyLoadoutWeight = (itemIds: string[]) =>
    itemIds.reduce((sum, itemId) => sum + (ITEMS[itemId]?.weight || 0), 0);

  const createEnemyBehaviorProfile = (stance: BehavioralStance) => {
    switch (stance) {
      case 'AMOK': {
        const primaryWeapon = Math.random() < 0.5 ? 'shotgun' : 'plasma_smg';
        return {
          stance,
          specialty: Math.random() < 0.5 ? 'Berserker' : 'Rampager',
          weapons: [primaryWeapon, primaryWeapon === 'shotgun' ? 'pistol' : 'smg'],
          inventory: [Math.random() < 0.5 ? 'grenade' : 'stim'],
          hp: 58,
          accuracy: 58,
          ap: 10,
          movementApCost: 2,
          carryLimit: 10,
        };
      }
      case 'AGGRESSIVE': {
        const primaryWeapon = Math.random() < 0.5 ? 'rifle' : 'polymer_carbine';
        return {
          stance,
          specialty: Math.random() < 0.5 ? 'Rifleman' : 'Flanker',
          weapons: [primaryWeapon, primaryWeapon === 'rifle' ? 'pistol' : 'smg'],
          inventory: [Math.random() < 0.5 ? 'grenade' : 'stim'],
          hp: 52,
          accuracy: 64,
          ap: 10,
          movementApCost: 2,
          carryLimit: 10,
        };
      }
      case 'SUPPORT': {
        const primaryWeapon = Math.random() < 0.5 ? 'smg' : 'plasma_smg';
        return {
          stance,
          specialty: Math.random() < 0.5 ? 'Medic' : 'Field Tech',
          weapons: [primaryWeapon, 'pistol'],
          inventory: ['medkit', Math.random() < 0.5 ? 'stim' : 'trauma_kit'],
          hp: 48,
          accuracy: 56,
          ap: 10,
          movementApCost: 2,
          carryLimit: 12,
        };
      }
      case 'DEFENSIVE': {
        const primaryWeapon = Math.random() < 0.5 ? 'shotgun' : 'rifle';
        return {
          stance,
          specialty: Math.random() < 0.5 ? 'Bulwark' : 'Sentinel',
          weapons: [primaryWeapon, primaryWeapon === 'shotgun' ? 'pistol' : 'smg'],
          inventory: ['medkit', 'trauma_kit'],
          hp: 64,
          accuracy: 54,
          ap: 10,
          movementApCost: 2,
          carryLimit: 12,
        };
      }
      case 'PASSIVE': {
        const primaryWeapon = Math.random() < 0.5 ? 'precision_rifle' : 'magnetic_rail_driver';
        return {
          stance,
          specialty: Math.random() < 0.5 ? 'Marksman' : 'Sniper',
          weapons: [primaryWeapon, 'pistol'],
          inventory: [Math.random() < 0.5 ? 'stim' : 'medkit'],
          hp: 44,
          accuracy: 82,
          ap: 10,
          movementApCost: 2,
          carryLimit: 10,
        };
      }
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
  const boardSize = GRID_SIZE * CELL_SIZE;
  const boardPadding = CELL_SIZE * 2;
  const boardViewportSize = boardSize + boardPadding * 2;

  const combatLayout = useMemo<CombatSceneLayout | undefined>(() => {
    const tiles = Object.entries(floorPlan as Record<string, FloorPlanTile>).map(([key, tile]) => {
      const [xStr, yStr] = key.split(',');
      const x = Number(xStr);
      const y = Number(yStr);
      const obstacle = obstacles[key] as ObstacleData | undefined;
      const tileType = tile.label === 'wall'
        ? 'wall'
        : tile.label === 'accessway'
          ? 'accessway'
          : tile.label === 'stairs'
            ? 'stairs'
            : tile.label === 'furniture'
              ? 'furniture'
              : 'floor';

      return {
        x,
        y,
        tileType,
        roomType: tile.roomType,
        roomName: tile.roomName,
        obstacle: obstacle && obstacle.hp > 0 ? {
          type: obstacle.type,
          hp: obstacle.hp,
          maxHp: obstacle.maxHp,
          orientation: obstacle.orientation,
        } : undefined,
      };
    });

    return {
      gridSize: GRID_SIZE,
      tiles,
      units: units.filter((unit) => unit.hp > 0).map((unit) => ({
        id: unit.id,
        name: unit.name,
        faction: unit.faction,
        x: unit.x,
        y: unit.y,
        hp: unit.hp,
        maxHp: unit.maxHp,
        isSelected: unit.id === selectedUnitId,
      })),
    };
  }, [floorPlan, obstacles, units, selectedUnitId]);

  // Initialize mission units
  useEffect(() => {
    const activeMission = state.activeMission;
    const activeBuilding = activeMission ? (state.world?.buildings[activeMission.buildingId] || state.buildings[activeMission.buildingId]) : null;
    const buildingType = activeBuilding?.type || 'WAREHOUSE';
    const buildingSectors = (state.baseSectors || []).filter(
      (sector: BaseSector) => (sector.buildingId || 'player-hq') === (activeMission?.buildingId || 'player-hq')
    );

    const { rooms: genRooms, floorPlan: generatedFloorPlan, obstacles: generatedObstacles, lootTiles: generatedLootTiles } = getLayoutForBuildingType(buildingType, buildingSectors, activeMission?.type, activeBuilding);
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
    const enemyUnits: TacticalUnit[] = Array.from({ length: 2 }, (_, i) => {
      const stance = ['AMOK', 'AGGRESSIVE', 'SUPPORT', 'DEFENSIVE', 'PASSIVE'][Math.floor(Math.random() * 5)] as BehavioralStance;
      const profile = createEnemyBehaviorProfile(stance);
      const loadoutItems = [...profile.weapons, ...profile.inventory];
      const totalWeight = calculateEnemyLoadoutWeight(loadoutItems);

      return {
        id: `e${i + 1}`,
        name: `${profile.specialty} ${i + 1}`,
        faction: 'ENEMY',
        x: i === 0 ? 15 : 14,
        y: i === 0 ? 10 : 12,
        hp: profile.hp,
        maxHp: profile.hp,
        ap: profile.ap,
        maxAp: profile.ap,
        accuracy: profile.accuracy,
        weapons: profile.weapons,
        activeWeaponId: profile.weapons[0],
        inventory: profile.inventory,
        behavior: profile.stance,
        specialty: profile.specialty,
        totalWeight,
        carryLimit: profile.carryLimit,
        movementApCost: profile.movementApCost,
      };
    });

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
    const isObstacle = !!(obs && obs.hp > 0);

    if (pendingAction && pendingAction.unitId === selectedUnitId && pendingAction.x === x && pendingAction.y === y) {
      if (pendingAction.type === 'ATTACK') {
         const target = units.find(u => u.x === x && u.y === y && u.hp > 0);
         if (target) {
            setUnits(prev => prev.map(u => u.id === selectedUnit.id ? {
              ...u,
              targetEnemyId: target.id,
              targetObstacleCoords: undefined,
              moveTarget: undefined,
              path: []
            } : u));
            setLog(prev => [`[COMMAND] ${selectedUnit.name} targeting ${target.name}.`, ...prev]);
         } else if (isObstacle) {
            setUnits(prev => prev.map(u => u.id === selectedUnit.id ? {
              ...u,
              targetObstacleCoords: {x, y},
              targetEnemyId: undefined,
              moveTarget: undefined,
              path: []
            } : u));
            setLog(prev => [`[COMMAND] ${selectedUnit.name} targeting ${obs.type.toUpperCase()} wall at (${x},${y}).`, ...prev]);
         }
      } else if (pendingAction.type === 'MOVE') {
         const path = findPath(selectedUnit.x, selectedUnit.y, x, y);
         if (path.length > 0) {
            setUnits(prev => prev.map(u => u.id === selectedUnit.id ? {
              ...u,
              path,
              targetEnemyId: undefined,
              targetObstacleCoords: undefined,
              moveTarget: { x, y }
            } : u));
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
                // Destroy linked door block
                const linked = nextObs[key].linkedDoor;
                if (linked && nextObs[linked] && nextObs[linked].hp > 0) {
                  nextObs[linked] = { ...nextObs[linked], hp: 0 };
                }
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
            } else if (stance === 'AGGRESSIVE') {
              // AGGRESSIVE: Engage nearby enemies in sight; leave movement to player-issued orders.
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

              if (u.moveTarget && u.x === u.moveTarget.x && u.y === u.moveTarget.y) {
                u.moveTarget = undefined;
              }

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
                  // Destroy linked door block
                  const linked = nextObs[key].linkedDoor;
                  if (linked && nextObs[linked] && nextObs[linked].hp > 0) {
                    nextObs[linked] = { ...nextObs[linked], hp: 0 };
                  }
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


  const activeOrderTarget = useMemo(() => {
    if (!selectedUnit) return null;
    if (selectedUnit.moveTarget) {
      return { type: 'MOVE' as const, x: selectedUnit.moveTarget.x, y: selectedUnit.moveTarget.y };
    }

    const targetEnemy = selectedUnit.targetEnemyId
      ? units.find(u => u.id === selectedUnit.targetEnemyId && u.hp > 0) ?? null
      : null;
    if (targetEnemy) {
      return { type: 'ATTACK_ENEMY' as const, x: targetEnemy.x, y: targetEnemy.y };
    }

    if (selectedUnit.targetObstacleCoords) {
      const obstacleTarget = selectedUnit.targetObstacleCoords;
      const obstacleKey = `${obstacleTarget.x},${obstacleTarget.y}`;
      const obstacle = obstacles[obstacleKey];
      if (obstacle && obstacle.hp > 0) {
        return { type: 'ATTACK_OBSTACLE' as const, x: obstacleTarget.x, y: obstacleTarget.y };
      }
    }

    return null;
  }, [selectedUnit, units, obstacles]);

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

      <div 
        className="flex-1 flex min-h-0 relative overflow-hidden bg-[#090c12]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        <div className="absolute inset-0">
          <ThreeCityScene
            camera={{ zoom, rotation, pitch, offset }}
            combatLayout={combatLayout}
            onTileSelect={handleTileClick}
          />
        </div>

        <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
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
