import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Building } from '../types';

interface ThreeCitySceneProps {
  buildings: Building[];
  selectedBuildingId?: string | null;
}

const ThreeCityScene: React.FC<ThreeCitySceneProps> = ({ buildings, selectedBuildingId }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

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
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');
    scene.fog = new THREE.Fog('#030712', 18, 40);

    const camera = new THREE.PerspectiveCamera(48, (container.clientWidth || 800) / (container.clientHeight || 600), 0.1, 200);
    camera.position.set(18, 18, 18);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0x7c8ca8, 0.75);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xf8fafc, 1.2);
    directionalLight.position.set(16, 24, 10);
    scene.add(directionalLight);

    const accentLight = new THREE.PointLight(0x60a5fa, 10, 35, 1.8);
    accentLight.position.set(0, 12, 0);
    scene.add(accentLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x101826, roughness: 0.95, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(40, 40, 0x334155, 0x111827);
    grid.position.y = 0.01;
    scene.add(grid);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.9, metalness: 0.08 });
    const roadWidth = 0.75;
    const roadThickness = 0.08;
    const roadAxes = [0, 8, 16, 24, 32];

    roadAxes.forEach((axis) => {
      const horizontal = new THREE.Mesh(
        new THREE.BoxGeometry(40, roadThickness, roadWidth),
        roadMaterial
      );
      horizontal.position.set(0, 0.045, axis - 20);
      scene.add(horizontal);

      const vertical = new THREE.Mesh(
        new THREE.BoxGeometry(roadWidth, roadThickness, 40),
        roadMaterial
      );
      vertical.position.set(axis - 20, 0.045, 0);
      scene.add(vertical);
    });

    const buildingGroup = new THREE.Group();
    buildingGroup.name = 'building-group';
    scene.add(buildingGroup);

    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85, metalness: 0.1 });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7, metalness: 0.2, emissive: 0x1d4ed8, emissiveIntensity: 0.25 });

    buildingList.forEach((building) => {
      const width = Math.max(1.2, Math.min(3.8, building.width * 1.2));
      const depth = Math.max(1.2, Math.min(3.8, building.height * 1.2));
      const height = Math.max(1.5, Math.min(4.8, (building.health / Math.max(building.maxHealth, 1)) * 3 + 1.2));
      const x = building.x - 18 + width / 2;
      const z = building.y - 18 + depth / 2;
      const buildingMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        building.id === selectedBuildingId ? selectedMaterial : buildingMaterial
      );
      buildingMesh.position.set(x, height / 2 + 0.06, z);
      buildingMesh.castShadow = true;
      buildingMesh.receiveShadow = true;
      buildingGroup.add(buildingMesh);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.92, 0.2, depth * 0.92),
        new THREE.MeshStandardMaterial({ color: building.ownerId === 'player' ? 0x334155 : 0x475569, roughness: 0.7, metalness: 0.1 })
      );
      roof.position.set(x, height + 0.08, z);
      buildingGroup.add(roof);
    });

    const animate = () => {
      frameRef.current = window.requestAnimationFrame(animate);
      const time = performance.now() * 0.0003;
      buildingGroup.rotation.y = Math.sin(time) * 0.03;
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      if (!container || !camera || !renderer) {
        return;
      }
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    resize();
    window.addEventListener('resize', resize);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    cleanupRef.current = () => {
      window.removeEventListener('resize', resize);
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
      if (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };

    return cleanupRef.current;
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) {
      return;
    }

    const scene = sceneRef.current;
    const buildingGroup = scene.children.find((child): child is THREE.Group => child instanceof THREE.Group && child.name === 'building-group');
    if (buildingGroup) {
      buildingGroup.clear();
      scene.remove(buildingGroup);
    }

    const newBuildingGroup = new THREE.Group();
    newBuildingGroup.name = 'building-group';
    scene.add(newBuildingGroup);

    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85, metalness: 0.1 });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7, metalness: 0.2, emissive: 0x1d4ed8, emissiveIntensity: 0.25 });

    buildingList.forEach((building) => {
      const width = Math.max(1.2, Math.min(3.8, building.width * 1.2));
      const depth = Math.max(1.2, Math.min(3.8, building.height * 1.2));
      const height = Math.max(1.5, Math.min(4.8, (building.health / Math.max(building.maxHealth, 1)) * 3 + 1.2));
      const x = building.x - 18 + width / 2;
      const z = building.y - 18 + depth / 2;
      const buildingMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        building.id === selectedBuildingId ? selectedMaterial : buildingMaterial
      );
      buildingMesh.position.set(x, height / 2 + 0.06, z);
      buildingMesh.castShadow = true;
      buildingMesh.receiveShadow = true;
      newBuildingGroup.add(buildingMesh);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.92, 0.2, depth * 0.92),
        new THREE.MeshStandardMaterial({ color: building.ownerId === 'player' ? 0x334155 : 0x475569, roughness: 0.7, metalness: 0.1 })
      );
      roof.position.set(x, height + 0.08, z);
      newBuildingGroup.add(roof);
    });
  }, [buildingList, selectedBuildingId]);

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
