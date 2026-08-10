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

export const FLOOR_HEIGHT_METERS = 5;
export const MAX_ROOMS_PER_FLOOR = 9;
export const MAX_ROOM_GRID_SIDE = 3;

const getRoomGridSide = (roomsPerFloor: number) => {
  const gridSide = Math.max(1, Math.ceil(Math.sqrt(roomsPerFloor)));
  return Math.min(MAX_ROOM_GRID_SIDE, gridSide);
};

export interface BuildingLotBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const getBuildingLotCenter = (building: Pick<Building, 'x' | 'y'>, _lotSideRooms = MAX_ROOM_GRID_SIDE) => ({
  x: building.x,
  y: building.y,
});

export const getBuildingLotBounds = (building: Pick<Building, 'x' | 'y' | 'width' | 'height'>, lotSideRooms = MAX_ROOM_GRID_SIDE): BuildingLotBounds => {
  const center = getBuildingLotCenter(building, lotSideRooms);
  const footprintW = Math.max(1, building.width || 1);
  const footprintH = Math.max(1, building.height || 1);

  return {
    minX: center.x - footprintW / 2,
    maxX: center.x + footprintW / 2,
    minY: center.y - footprintH / 2,
    maxY: center.y + footprintH / 2,
  };
};

export const getBuildingLotOriginOffset = (footprintSize: number, lotSideRooms = MAX_ROOM_GRID_SIDE) => {
  const normalizedFootprintSize = Math.max(1, footprintSize);
  return Math.floor((lotSideRooms - normalizedFootprintSize) / 2);
};

export function getBuildingVisualMetrics(building: Building | null | undefined, baseSectors: Array<{ buildingId?: string; level?: number }> = []): BuildingVisualMetrics {
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
  const groundFloorRoomCount = Math.max(
    1,
    Math.min(
      MAX_ROOMS_PER_FLOOR,
      buildingSectors.filter((sector) => (sector.level ?? 1) <= 1).length || buildingSectors.length || building.presetFacilities?.length || 1
    )
  );
  const roomCount = groundFloorRoomCount;
  const level = Math.max(1, building.unlockedFloors || 1);
  const visualFloors = Math.max(1, Math.min(MAX_ROOMS_PER_FLOOR, level));
  const floorCount = Math.max(1, Math.min(MAX_ROOMS_PER_FLOOR, visualFloors));
  const heightMeters = floorCount * FLOOR_HEIGHT_METERS;

  const baseFootprintW = Math.max(1, building.width || 1);
  const baseFootprintH = Math.max(1, building.height || 1);
  const roomsPerFloor = Math.max(1, Math.min(MAX_ROOMS_PER_FLOOR, groundFloorRoomCount));
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
