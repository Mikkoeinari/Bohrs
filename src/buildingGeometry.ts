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
      heightMeters: 3.2,
    };
  }

  const buildingSectors = baseSectors.filter((sector) => (sector.buildingId || 'player-hq') === building.id);
  const roomCount = Math.max(1, Math.min(9, buildingSectors.length || building.presetFacilities?.length || 1));
  const baseFootprintW = Math.max(1, building.width || 1);
  const baseFootprintH = Math.max(1, building.height || 1);
  const level = Math.max(1, building.unlockedFloors || 1);

  const visualFloors = Math.max(level, Math.min(3, Math.ceil(roomCount / 3)));
  const roomsPerFloor = Math.max(1, Math.ceil(roomCount / visualFloors));
  const footprintW = Math.max(baseFootprintW, clamp(Math.ceil(Math.sqrt(roomsPerFloor)), 1, 3));
  const footprintH = Math.max(baseFootprintH, clamp(Math.ceil(roomsPerFloor / footprintW), 1, 3));

  const footprintBonus = Math.max(0, (Math.max(footprintW, footprintH) - 1) * 8);
  const floorBonus = (visualFloors - 1) * 18;
  const height3D = 30 + floorBonus + footprintBonus;
  const heightMeters = clamp(2.8 + (visualFloors - 1) * 2.4 + Math.max(0, (Math.max(footprintW, footprintH) - 1) * 0.7), 2.8, 9.6);

  return {
    roomCount,
    footprintW,
    footprintH,
    level,
    visualFloors,
    extraRooms: Math.max(0, roomCount - 9),
    height3D,
    heightMeters,
  };
}
