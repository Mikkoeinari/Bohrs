import { Building } from './types';

export interface BuildingVisualMetrics {
  roomCount: number;
  footprintW: number;
  footprintH: number;
  level: number;
  visualFloors: number;
  extraRooms: number;
  height3D: number;
  heightMeters: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function getBuildingVisualMetrics(building: Building | null | undefined, baseSectors: Array<{ buildingId?: string }> = []): BuildingVisualMetrics {
  if (!building) {
    return {
      roomCount: 1,
      footprintW: 1,
      footprintH: 1,
      level: 1,
      visualFloors: 1,
      extraRooms: 0,
      height3D: 35,
      heightMeters: 5,
    };
  }

  const buildingSectors = baseSectors.filter((sector) => (sector.buildingId || 'player-hq') === building.id);
  const roomCount = Math.max(1, Math.min(9, buildingSectors.length || building.presetFacilities?.length || 1));
  const level = Math.max(1, building.unlockedFloors || 1);
  const visualFloors = Math.max(level, Math.min(9, roomCount));
  const floorCount = Math.max(1, Math.min(9, visualFloors));
  const heightMeters = floorCount * 5;

  const baseFootprintW = Math.max(1, building.width || 1);
  const baseFootprintH = Math.max(1, building.height || 1);
  const fallbackFootprint = Math.max(baseFootprintW, baseFootprintH);
  const footprintW = roomCount >= 9 ? 3 : fallbackFootprint;
  const footprintH = roomCount >= 9 ? 3 : fallbackFootprint;

  const height3D = 35 + Math.max(0, floorCount - 1) * 12;

  return {
    roomCount,
    footprintW,
    footprintH,
    level,
    visualFloors: floorCount,
    extraRooms: Math.max(0, roomCount - 9),
    height3D,
    heightMeters,
  };
}
