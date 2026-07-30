import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Building } from '../types';

interface ThreeCitySceneProps {
  buildings: Building[];
  selectedBuildingId?: string | null;
  camera: {
    zoom: number;
    rotation: number;
    pitch: number;
    offset: { x: number; y: number };
  };
  onBuildingSelect?: (buildingId: string) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const SCENE_BACKGROUND = '#f6fbff';
const SCENE_FOG = '#dbeafe';

const getSceneLayout = (buildings: Building[]) => {
  const minX = Math.min(...buildings.map((building) => building.x), 1);
  const maxX = Math.max(...buildings.map((building) => building.x + (building.width || 1)), 30);
  const minY = Math.min(...buildings.map((building) => building.y), 1);
  const maxY = Math.max(...buildings.map((building) => building.y + (building.height || 1)), 30);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const lotScale = 1.18;
  const terrainSize = Math.max(28, Math.max(maxX - minX + 6, maxY - minY + 6) * lotScale + 8);

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX,
    centerY,
    lotScale,
    terrainSize,
  };
};

const buildLabelTexture = (name: string, accentColor: string, selected: boolean) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = selected ? '#020617' : '#0f172a';
  context.strokeStyle = accentColor;
  context.lineWidth = 22;
  context.beginPath();
  context.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 28);
  context.fill();
  context.stroke();

  context.font = '700 48px Inter, Arial, sans-serif';
  context.fillStyle = '#f8fafc';
  context.textBaseline = 'middle';
  context.fillText(name, 48, 72, 360);

  context.font = '600 30px Inter, Arial, sans-serif';
  context.fillStyle = accentColor;
  context.fillText('TURF', 48, 124);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
};

const ThreeCityScene: React.FC<ThreeCitySceneProps> = ({ buildings, selectedBuildingId, camera, onBuildingSelect }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const buildingGroupRef = useRef<THREE.Group | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);
  const buildingMeshesRef = useRef<THREE.Mesh[]>([]);

  const buildingList = useMemo(() => buildings.slice().sort((a, b) => {
    const aCenter = a.x + a.width / 2 + a.y + a.height / 2;
    const bCenter = b.x + b.width / 2 + b.y + b.height / 2;
    return aCenter - bCenter;
  }), [buildings]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BACKGROUND);
    scene.fog = new THREE.Fog(SCENE_FOG, 24, 80);

    const cameraObject = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
    cameraObject.position.set(24, 20, 24);
    cameraObject.lookAt(0, 1.5, 0);
    scene.add(cameraObject);

    const hemisphereLight = new THREE.HemisphereLight(0xb9d9ff, 0x233449, 1.25);
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xfff7d6, 1.5);
    directionalLight.position.set(16, 24, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.9);
    fillLight.position.set(-14, 12, -8);
    scene.add(fillLight);

    const accentLight = new THREE.PointLight(0x60a5fa, 10, 70, 2.2);
    accentLight.position.set(-8, 10, 8);
    scene.add(accentLight);

    const sceneLayout = getSceneLayout(buildingList);
    const { centerX, centerY, lotScale, terrainSize } = sceneLayout;
    const terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(terrainSize, terrainSize, 64, 64),
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.98,
        metalness: 0.02,
        vertexColors: true,
      })
    );
    const terrainPositions = terrain.geometry.attributes.position;
    const terrainColors = new Float32Array(terrainPositions.count * 3);
    const terrainColorA = new THREE.Color('#f3f7fb');
    const terrainColorB = new THREE.Color('#e2ebf5');
    const terrainColorC = new THREE.Color('#d0ddeb');
    for (let index = 0; index < terrainPositions.count; index += 1) {
      const x = terrainPositions.getX(index);
      const y = terrainPositions.getY(index);
      const roadSpacing = 4 * lotScale;
      const roadDistance = Math.min(
        Math.abs(x - Math.round(x / roadSpacing) * roadSpacing),
        Math.abs(y - Math.round(y / roadSpacing) * roadSpacing)
      );
      const height = Math.sin(x * 0.22) * 0.06 + Math.cos(y * 0.18) * 0.04 + (roadDistance < 0.2 ? 0.02 : 0);
      terrainPositions.setZ(index, height);

      const paletteRoll = Math.sin(x * 0.14 + y * 0.1) * 0.5 + 0.5;
      const terrainColor = paletteRoll > 0.3
        ? terrainColorA.clone().lerp(terrainColorB, paletteRoll)
        : terrainColorA.clone().lerp(terrainColorC, 0.5 + paletteRoll);
      terrainColor.toArray(terrainColors, index * 3);
    }
    terrain.geometry.setAttribute('color', new THREE.BufferAttribute(terrainColors, 3));
    terrain.geometry.computeVertexNormals();
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    scene.add(terrain);

    const grid = new THREE.GridHelper(terrainSize, 24, 0x8ba1b5, 0xe2e8f0);
    grid.position.y = 0.02;
    scene.add(grid);

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b7280,
      roughness: 0.9,
      metalness: 0.02,
      emissive: 0x94a3b8,
      emissiveIntensity: 0.06,
    });
    const laneMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.01,
      emissive: 0xf8fafc,
      emissiveIntensity: 0.08,
    });
    const roadWidth = 1.35;
    const roadThickness = 0.16;
    const roadGroup = new THREE.Group();
    const streetLines = new Map<string, boolean>();

    const addRoadSegment = ({
      x,
      z,
      length,
      axis,
      laneOffset = 0,
    }: {
      x: number;
      z: number;
      length: number;
      axis: 'x' | 'z';
      laneOffset?: number;
    }) => {
      if (length <= 0.001) {
        return;
      }

      if (axis === 'x') {
        const road = new THREE.Mesh(
          new THREE.BoxGeometry(length, roadThickness, roadWidth),
          roadMaterial
        );
        road.position.set(x, 0.1, z);
        road.receiveShadow = true;
        roadGroup.add(road);

        const lane = new THREE.Mesh(
          new THREE.BoxGeometry(length * 0.86, roadThickness * 0.34, roadWidth * 0.3),
          laneMaterial
        );
        lane.position.set(x, 0.11 + laneOffset, z);
        lane.receiveShadow = true;
        roadGroup.add(lane);
        return;
      }

      const road = new THREE.Mesh(
        new THREE.BoxGeometry(roadWidth, roadThickness, length),
        roadMaterial
      );
      road.position.set(x, 0.1, z);
      road.receiveShadow = true;
      roadGroup.add(road);

      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(roadWidth * 0.3, roadThickness * 0.34, length * 0.86),
        laneMaterial
      );
      lane.position.set(x, 0.11 + laneOffset, z);
      lane.receiveShadow = true;
      roadGroup.add(lane);
    };

    const addStreetLine = ({
      lotCoord,
      axis,
    }: {
      lotCoord: number;
      axis: 'x' | 'z';
    }) => {
      const worldCoord = (lotCoord - (axis === 'x' ? centerX : centerY)) * lotScale;
      const key = `${axis}:${lotCoord.toFixed(3)}`;
      if (streetLines.has(key)) {
        return;
      }
      streetLines.set(key, true);

      if (axis === 'x') {
        addRoadSegment({ x: 0, z: worldCoord, length: terrainSize, axis: 'x' });
        return;
      }

      addRoadSegment({ x: worldCoord, z: 0, length: terrainSize, axis: 'z' });
    };

    buildingList.forEach((building) => {
      const width = building.width || 1;
      const height = building.height || 1;
      addStreetLine({ lotCoord: building.x - 0.5, axis: 'z' });
      addStreetLine({ lotCoord: building.x + width + 0.5, axis: 'z' });
      addStreetLine({ lotCoord: building.y - 0.5, axis: 'x' });
      addStreetLine({ lotCoord: building.y + height + 0.5, axis: 'x' });
    });

    scene.add(roadGroup);

    const buildingGroup = new THREE.Group();
    buildingGroup.name = 'building-group';
    scene.add(buildingGroup);

    const animate = () => {
      frameRef.current = window.requestAnimationFrame(animate);
      renderer.render(scene, cameraObject);
    };
    animate();

    const resize = () => {
      if (!container || !cameraObject || !renderer) {
        return;
      }
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;
      cameraObject.aspect = width / height;
      cameraObject.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownRef.current = { x: event.clientX, y: event.clientY };
      pointerMovedRef.current = false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerDownRef.current) {
        return;
      }
      const dx = event.clientX - pointerDownRef.current.x;
      const dy = event.clientY - pointerDownRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        pointerMovedRef.current = true;
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!cameraObject || pointerMovedRef.current) {
        pointerDownRef.current = null;
        pointerMovedRef.current = false;
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), cameraObject);
      const intersects = raycasterRef.current.intersectObjects(buildingMeshesRef.current, true);
      const targetMesh = intersects[0]?.object as THREE.Mesh | undefined;
      const buildingId = targetMesh?.userData?.buildingId as string | undefined;
      if (buildingId && onBuildingSelect) {
        onBuildingSelect(buildingId);
      }
      pointerDownRef.current = null;
      pointerMovedRef.current = false;
      event.stopPropagation();
    };

    resize();
    window.addEventListener('resize', resize);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = cameraObject;
    buildingGroupRef.current = buildingGroup;

    cleanupRef.current = () => {
      window.removeEventListener('resize', resize);
      rendererRef.current?.domElement.removeEventListener('pointerdown', handlePointerDown);
      rendererRef.current?.domElement.removeEventListener('pointermove', handlePointerMove);
      rendererRef.current?.domElement.removeEventListener('click', handleClick);
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      buildingGroupRef.current = null;
      if (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };

    return cleanupRef.current;
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !buildingGroupRef.current) {
      return;
    }

    const buildingGroup = buildingGroupRef.current;
    buildingGroup.clear();

    const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7, metalness: 0.2, emissive: 0x60a5fa, emissiveIntensity: 0.3 });
    const { centerX, centerY, lotScale } = getSceneLayout(buildingList);

    buildingMeshesRef.current = [];

    buildingList.forEach((building) => {
      const footprintWidth = Math.max(1.2, Math.min(4.2, (building.width || 1) * lotScale * 0.96));
      const footprintDepth = Math.max(1.2, Math.min(4.2, (building.height || 1) * lotScale * 0.96));
      const width = Math.max(1.2, Math.min(3.8, footprintWidth * 0.8));
      const depth = Math.max(1.2, Math.min(3.8, footprintDepth * 0.8));
      const healthRatio = building.maxHealth > 0 ? building.health / building.maxHealth : 1;
      const height = Math.max(2.0, Math.min(6.4, healthRatio * 4.2 + 1.6));
      const x = (building.x + (building.width || 1) / 2 - centerX) * lotScale;
      const z = (building.y + (building.height || 1) / 2 - centerY) * lotScale;
      const isSelected = building.id === selectedBuildingId;
      const accentColorHex = building.ownerId === 'player'
        ? '#38bdf8'
        : building.ownerId === 'rivals'
          ? '#fb7185'
          : building.ownerId === 'police'
            ? '#60a5fa'
            : building.ownerId === 'corps'
              ? '#a78bfa'
              : '#94a3b8';
      const accentColor = new THREE.Color(accentColorHex);
      const bodyColor = new THREE.Color(
        isSelected ? '#1d4ed8' : building.ownerId === 'player'
          ? '#16354f'
          : building.ownerId === 'rivals'
            ? '#5a2020'
            : building.ownerId === 'police'
              ? '#18355a'
              : building.ownerId === 'corps'
                ? '#352260'
                : '#334155'
      );
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.82,
        metalness: 0.08,
      });
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.56,
        metalness: 0.18,
        emissive: accentColor,
        emissiveIntensity: 0.24,
      });
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.28,
        metalness: 0.12,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.22,
      });

      const footprint = new THREE.Mesh(
        new THREE.BoxGeometry(footprintWidth, 0.08, footprintDepth),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.95, metalness: 0.02 })
      );
      footprint.position.set(x, 0.04, z);
      footprint.receiveShadow = true;
      buildingGroup.add(footprint);

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width * 1.02, 0.18, depth * 1.02),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.95, metalness: 0.03 })
      );
      base.position.set(x, 0.09, z);
      base.receiveShadow = true;
      buildingGroup.add(base);

      const buildingMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        isSelected ? selectedMaterial : bodyMaterial
      );
      buildingMesh.position.set(x, height / 2 + 0.09, z);
      buildingMesh.castShadow = true;
      buildingMesh.receiveShadow = true;
      buildingMesh.userData = { buildingId: building.id };
      buildingGroup.add(buildingMesh);
      buildingMeshesRef.current.push(buildingMesh);

      const facadeBand = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.78, Math.max(0.32, height * 0.24), depth * 0.12),
        accentMaterial
      );
      facadeBand.position.set(x, height * 0.48 + 0.1, z + depth / 2 + 0.06);
      buildingGroup.add(facadeBand);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.94, 0.16, depth * 0.94),
        new THREE.MeshStandardMaterial({
          color: accentColor,
          roughness: 0.68,
          metalness: 0.1,
          emissive: accentColor,
          emissiveIntensity: 0.14,
        })
      );
      roof.position.set(x, height + 0.08, z);
      buildingGroup.add(roof);

      const roofCap = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.44, 0.1, depth * 0.44),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.1 })
      );
      roofCap.position.set(x, height + 0.18, z);
      buildingGroup.add(roofCap);

      const windowCount = Math.max(2, Math.min(6, Math.round(height / 1.2)));
      for (let index = 0; index < windowCount; index += 1) {
        const windowOffset = (index - (windowCount - 1) / 2) * 0.5;
        const window = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.2, width * 0.15), 0.14, 0.04),
          windowMaterial
        );
        window.position.set(x + windowOffset, height * 0.28 + 0.1, z + depth / 2 + 0.06);
        buildingGroup.add(window);
      }

      const labelTexture = buildLabelTexture(building.name, accentColorHex, isSelected);
      if (labelTexture) {
        const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false });
        const label = new THREE.Sprite(labelMaterial);
        label.position.set(x, height + 1.35, z);
        label.scale.set(4.2 + Math.min(1.2, width * 0.22), 1.2, 1);
        label.renderOrder = 20;
        buildingGroup.add(label);
      }
    });
  }, [buildingList, selectedBuildingId]);

  useEffect(() => {
    if (!cameraRef.current) {
      return;
    }

    const cameraObject = cameraRef.current;
    const panScale = 0.12 / Math.max(camera.zoom, 0.25);
    const target = new THREE.Vector3(camera.offset.x * panScale, 0.95, camera.offset.y * panScale);
    const radius = 24 / Math.max(camera.zoom, 0.25);
    const yaw = THREE.MathUtils.degToRad(camera.rotation);
    const pitch = THREE.MathUtils.degToRad(clamp(camera.pitch, 24, 72));
    const phi = Math.PI / 2 - pitch;

    const x = target.x + radius * Math.sin(phi) * Math.cos(yaw);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * Math.sin(phi) * Math.sin(yaw);

    cameraObject.position.set(x, y, z);
    cameraObject.lookAt(target);
  }, [camera.offset.x, camera.offset.y, camera.pitch, camera.rotation, camera.zoom]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
};

export default ThreeCityScene;
