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

const FLOOR_HEIGHT_METERS = 5;
const MAX_ROOMS_PER_FLOOR = 9;
const MAX_ROOM_GRID_SIDE = 3;

const getRoomGridSide = (roomsPerFloor: number) => {
  const gridSide = Math.max(1, Math.ceil(Math.sqrt(roomsPerFloor)));
  return Math.min(MAX_ROOM_GRID_SIDE, gridSide);
};

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
      heightMeters: FLOOR_HEIGHT_METERS,
    };
  }

  const buildingSectors = baseSectors.filter((sector) => (sector.buildingId || 'player-hq') === building.id);
  const inferredRooms = (building.width || 1) * (building.height || 1);
  const roomCount = Math.max(1, Math.min(MAX_ROOMS_PER_FLOOR, buildingSectors.length || building.presetFacilities?.length || inferredRooms));
  const level = Math.max(1, building.unlockedFloors || 1);
  const visualFloors = Math.max(1, Math.min(MAX_ROOMS_PER_FLOOR, level));
  const floorCount = Math.max(1, Math.min(MAX_ROOMS_PER_FLOOR, visualFloors));
  const heightMeters = floorCount * FLOOR_HEIGHT_METERS;

  const baseFootprintW = Math.max(1, building.width || 1);
  const baseFootprintH = Math.max(1, building.height || 1);
  const roomsPerFloor = Math.max(1, Math.ceil(roomCount / floorCount));
  const roomGridSide = getRoomGridSide(roomsPerFloor);
  const footprintW = Math.max(baseFootprintW, roomGridSide);
  const footprintH = Math.max(baseFootprintH, roomGridSide);

  const height3D = 35 + Math.max(0, floorCount - 1) * 12;

  return {
    roomCount,
    footprintW,
    footprintH,
    level,
    visualFloors: floorCount,
    extraRooms: Math.max(0, roomCount - MAX_ROOMS_PER_FLOOR),
    height3D,
    heightMeters,
  };
}
