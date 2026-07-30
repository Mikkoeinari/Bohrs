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
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');
    scene.fog = new THREE.Fog('#020617', 24, 70);

    const cameraObject = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
    cameraObject.position.set(24, 20, 24);
    cameraObject.lookAt(0, 1.5, 0);
    scene.add(cameraObject);

    const ambientLight = new THREE.AmbientLight(0x8fa9c8, 0.75);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xf8fafc, 1.2);
    directionalLight.position.set(16, 24, 10);
    scene.add(directionalLight);

    const accentLight = new THREE.PointLight(0x60a5fa, 10, 60, 2.2);
    accentLight.position.set(-8, 10, 8);
    scene.add(accentLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 44),
      new THREE.MeshStandardMaterial({ color: 0x101826, roughness: 0.98, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(44, 44, 0x334155, 0x111827);
    grid.position.y = 0.01;
    scene.add(grid);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.95, metalness: 0.08 });
    const roadWidth = 0.9;
    const roadThickness = 0.12;
    const roadAxes = [-12, -4, 4, 12, 20];

    roadAxes.forEach((axis) => {
      const horizontal = new THREE.Mesh(
        new THREE.BoxGeometry(44, roadThickness, roadWidth),
        roadMaterial
      );
      horizontal.position.set(0, 0.055, axis);
      scene.add(horizontal);

      const vertical = new THREE.Mesh(
        new THREE.BoxGeometry(roadWidth, roadThickness, 44),
        roadMaterial
      );
      vertical.position.set(axis, 0.055, 0);
      scene.add(vertical);
    });

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

    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85, metalness: 0.1 });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7, metalness: 0.2, emissive: 0x1d4ed8, emissiveIntensity: 0.25 });

    buildingMeshesRef.current = [];

    buildingList.forEach((building) => {
      const width = Math.max(1.4, Math.min(4.2, (building.width || 1) * 1.25));
      const depth = Math.max(1.4, Math.min(4.2, (building.height || 1) * 1.25));
      const healthRatio = building.maxHealth > 0 ? building.health / building.maxHealth : 1;
      const height = Math.max(2.0, Math.min(6.4, healthRatio * 4.2 + 1.6));
      const cityScale = 1.24;
      const x = (building.x - 15) * cityScale;
      const z = (building.y - 15) * cityScale;
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
          ? '#19324f'
          : building.ownerId === 'rivals'
            ? '#3f1717'
            : building.ownerId === 'police'
              ? '#142c4a'
              : building.ownerId === 'corps'
                ? '#2d1b69'
                : '#232b3d'
      );
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.86,
        metalness: 0.1,
      });
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.58,
        metalness: 0.2,
        emissive: accentColor,
        emissiveIntensity: 0.16,
      });
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0xcffafe,
        roughness: 0.3,
        metalness: 0.15,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.16,
      });

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width * 1.02, 0.18, depth * 1.02),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95, metalness: 0.03 })
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
          roughness: 0.7,
          metalness: 0.1,
          emissive: accentColor,
          emissiveIntensity: 0.08,
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
