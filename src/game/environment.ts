import * as THREE from 'three';
import { SkyTimeTheme } from './levels';

export interface SkyEnvironmentController {
  root: THREE.Group;
  setTheme: (
    theme: SkyTimeTheme,
    scene: THREE.Scene,
    dirLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight
  ) => void;
  update: (elapsedTime: number, dt: number, playerPos: THREE.Vector3) => void;
}

interface FloatingIslandItem {
  group: THREE.Group;
  baseY: number;
  bobPhase: number;
  windmillBlades?: THREE.Group;
}

const skyGradientCache = new Map<SkyTimeTheme, THREE.CanvasTexture>();

/**
 * 전체 화면을 이중으로 칠하던 3D SkyDome 구체 셰이더(Overdraw 원인)를 제거하고,
 * 드로우 콜 및 프래그먼트 셰이더 부하가 0인 1x64 수직 그라데이션 배경 텍스처를 생성합니다.
 */
function getSkyGradientBackground(theme: SkyTimeTheme): THREE.CanvasTexture {
  const cached = skyGradientCache.get(theme);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 64);

  if (theme === 'sunset') {
    grad.addColorStop(0.0, '#312e81');
    grad.addColorStop(0.48, '#fb923c');
    grad.addColorStop(0.82, '#fdba74');
    grad.addColorStop(1.0, '#fde047');
  } else if (theme === 'starlight') {
    grad.addColorStop(0.0, '#090d16');
    grad.addColorStop(0.55, '#1e1b4b');
    grad.addColorStop(1.0, '#312e81');
  } else {
    grad.addColorStop(0.0, '#0284c7');
    grad.addColorStop(0.55, '#7dd3fc');
    grad.addColorStop(1.0, '#bae6fd');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  skyGradientCache.set(theme, tex);
  return tex;
}

/**
 * 갤럭시 탭 S6 Lite (Exynos 9611 / Mali-G72 MP3) 초경량 하늘·구름·부유섬 배경:
 * 1) 3D SkyDome 메쉬 제거 -> 1x64px scene.background 그라데이션 텍스처로 전체 화면 오버드로우 100% 제거
 * 2) 지수 안개(FogExp2) 제거 -> 연산이 가장 가벼운 선형 안개(THREE.Fog) 적용
 * 3) 뭉게구름 클러스터 단일 THREE.InstancedMesh (1 Draw Call) 통합
 */
export function createSkyEnvironment(): SkyEnvironmentController {
  const root = new THREE.Group();

  // 1. Single-Draw-Call Instanced Fluffy Cloud Clusters (1 Draw Call)
  const puffOffsets: Array<[number, number, number, number, number, number, boolean]> = [
    [0, 0.45, 0, 2.3, 1.65, 1.85, false],
    [-1.8, 0.1, 0.2, 1.75, 1.35, 1.5, false],
    [1.85, 0.15, -0.15, 1.85, 1.4, 1.55, false],
    [-0.9, 0.65, -0.5, 1.55, 1.3, 1.4, false],
    [0.95, 0.55, 0.55, 1.6, 1.25, 1.4, false],
    [0, -0.26, 0, 2.55, 0.85, 1.95, true],
  ];

  const clusterPositions: Array<[number, number, number, number]> = [
    [-92, 12, -16, 1.5],
    [76, 12, -18, 1.5],
    [-96, 10, -42, 1.6],
    [80, 11, -40, 1.55],
    [-94, 14, -72, 1.6],
    [78, 13, -74, 1.55],
    [-48, 16, -96, 1.7],
    [48, 16, -96, 1.7],
    [0, 18, -102, 1.95],
    [-26, 16, -98, 1.65],
    [26, 16, -98, 1.65],
    [-64, -6, 18, 1.45],
  ];

  const totalInstances = clusterPositions.length * puffOffsets.length;
  const lowPolyPuffGeo = new THREE.SphereGeometry(1, 7, 5);
  const cloudInstMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.24,
  });

  const cloudInstancedMesh = new THREE.InstancedMesh(
    lowPolyPuffGeo,
    cloudInstMat,
    totalInstances
  );
  cloudInstancedMesh.frustumCulled = false;

  const dummyCluster = new THREE.Object3D();
  const dummyPuff = new THREE.Object3D();
  dummyCluster.add(dummyPuff);

  const topTint = new THREE.Color(0xffffff);
  const bellyTint = new THREE.Color(0xdbeafe);

  let instanceIdx = 0;
  clusterPositions.forEach(([bx, by, bz, scale], cIdx) => {
    dummyCluster.position.set(bx, by, bz);
    dummyCluster.scale.setScalar(scale);
    dummyCluster.rotation.set(0, (cIdx * 0.7) % Math.PI, 0);
    dummyCluster.updateMatrixWorld();

    puffOffsets.forEach(([ox, oy, oz, sx, sy, sz, isBelly]) => {
      dummyPuff.position.set(ox, oy, oz);
      dummyPuff.scale.set(sx, sy, sz);
      dummyPuff.updateMatrixWorld();

      cloudInstancedMesh.setMatrixAt(instanceIdx, dummyPuff.matrixWorld);
      cloudInstancedMesh.setColorAt(
        instanceIdx,
        isBelly ? bellyTint : topTint
      );
      instanceIdx++;
    });
  });

  cloudInstancedMesh.instanceMatrix.needsUpdate = true;
  if (cloudInstancedMesh.instanceColor) {
    cloudInstancedMesh.instanceColor.needsUpdate = true;
  }

  const cloudLayerGroup = new THREE.Group();
  cloudLayerGroup.add(cloudInstancedMesh);
  root.add(cloudLayerGroup);

  // 2. Low-Poly Floating Sky Islands (MeshLambertMaterial + Shared Geometries)
  const rockMat = new THREE.MeshLambertMaterial({
    color: 0x64748b,
    flatShading: true,
  });
  const grassIslandMat = new THREE.MeshLambertMaterial({
    color: 0x22c55e,
  });
  const trunkMat = new THREE.MeshLambertMaterial({
    color: 0x92400e,
  });
  const foliageMat = new THREE.MeshLambertMaterial({
    color: 0x16a34a,
  });
  const millWallMat = new THREE.MeshLambertMaterial({
    color: 0xf8fafc,
  });
  const millRoofMat = new THREE.MeshLambertMaterial({
    color: 0xe11d48,
  });
  const woodBladeMat = new THREE.MeshLambertMaterial({
    color: 0xfef08a,
  });
  const crystalMat = new THREE.MeshLambertMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
  });

  const sharedRockConeGeo = new THREE.ConeGeometry(3.5, 4.8, 5);
  const sharedGrassCapGeo = new THREE.CylinderGeometry(3.7, 3.4, 0.7, 6);
  const sharedTrunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.0, 5);
  const sharedCrownGeo = new THREE.SphereGeometry(0.82, 6, 5);
  const sharedMillTowerGeo = new THREE.CylinderGeometry(0.72, 1.0, 2.5, 6);
  const sharedMillRoofGeo = new THREE.ConeGeometry(0.95, 1.05, 6);
  const sharedBladeArmGeo = new THREE.BoxGeometry(0.26, 1.8, 0.08);
  const sharedCrystalGeo = new THREE.OctahedronGeometry(0.92, 0);

  const floatingIslands: FloatingIslandItem[] = [];
  // Placed well outside Floors 1~6 course bounds (x: [-76, +58.5], z: [0, -60])
  const islandSpecs: Array<{
    pos: [number, number, number];
    scale: number;
    hasWindmill: boolean;
    hasCrystal: boolean;
  }> = [
    { pos: [-56, 3.5, -18], scale: 1.35, hasWindmill: true, hasCrystal: false },
    { pos: [56, 4.5, -20], scale: 1.35, hasWindmill: false, hasCrystal: true },
    { pos: [-32, 8.0, -86], scale: 1.45, hasWindmill: false, hasCrystal: true },
    { pos: [32, 8.5, -86], scale: 1.45, hasWindmill: true, hasCrystal: false },
  ];

  islandSpecs.forEach((spec, idx) => {
    const islandGroup = new THREE.Group();

    const rockCone = new THREE.Mesh(sharedRockConeGeo, rockMat);
    rockCone.rotation.x = Math.PI;
    rockCone.position.y = -2.4;
    islandGroup.add(rockCone);

    const grassTop = new THREE.Mesh(sharedGrassCapGeo, grassIslandMat);
    grassTop.position.y = 0.2;
    islandGroup.add(grassTop);

    const treePositions: Array<[number, number]> = [
      [-1.5, -0.9],
      [1.4, -1.0],
    ];
    treePositions.forEach(([tx, tz], tIdx) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(sharedTrunkGeo, trunkMat);
      trunk.position.y = 0.5;
      tree.add(trunk);

      const crown = new THREE.Mesh(sharedCrownGeo, foliageMat);
      crown.position.y = 1.3;
      tree.add(crown);

      tree.position.set(tx, 0.5, tz);
      tree.scale.setScalar(0.9 + (tIdx % 2) * 0.2);
      islandGroup.add(tree);
    });

    let windmillBlades: THREE.Group | undefined;
    if (spec.hasWindmill) {
      const millTower = new THREE.Mesh(sharedMillTowerGeo, millWallMat);
      millTower.position.set(0.4, 1.75, 0.2);
      islandGroup.add(millTower);

      const millRoof = new THREE.Mesh(sharedMillRoofGeo, millRoofMat);
      millRoof.position.set(0.4, 3.5, 0.2);
      islandGroup.add(millRoof);

      windmillBlades = new THREE.Group();
      windmillBlades.position.set(0.4, 2.5, 0.98);
      for (let b = 0; b < 4; b++) {
        const arm = new THREE.Mesh(sharedBladeArmGeo, woodBladeMat);
        arm.position.y = 0.88;
        const pivot = new THREE.Group();
        pivot.rotation.z = (b * Math.PI) / 2;
        pivot.add(arm);
        windmillBlades.add(pivot);
      }
      islandGroup.add(windmillBlades);
    }

    if (spec.hasCrystal) {
      const crystal = new THREE.Mesh(sharedCrystalGeo, crystalMat);
      crystal.scale.set(0.75, 1.6, 0.75);
      crystal.position.set(0.2, 2.0, 0);
      islandGroup.add(crystal);
    }

    islandGroup.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    islandGroup.scale.setScalar(spec.scale);
    root.add(islandGroup);

    floatingIslands.push({
      group: islandGroup,
      baseY: spec.pos[1],
      bobPhase: idx * 1.5,
      windmillBlades,
    });
  });

  const setTheme = (
    theme: SkyTimeTheme,
    scene: THREE.Scene,
    dirLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight
  ) => {
    // Bind zero-overdraw 1x64 sky gradient directly to scene.background
    scene.background = getSkyGradientBackground(theme);

    if (theme === 'sunset') {
      // 2층: 황금빛 노을 회랑 (Golden Sunset & Linear Fog)
      cloudInstMat.color.setHex(0xfff7ed);
      cloudInstMat.emissive.setHex(0xfdba74);
      cloudInstMat.emissiveIntensity = 0.28;

      scene.fog = new THREE.Fog(0xfdba74, 48, 138);

      dirLight.color.setHex(0xffedd5);
      dirLight.intensity = 1.45;
      hemiLight.color.setHex(0xfef3c7);
      hemiLight.groundColor.setHex(0x4338ca);
      hemiLight.intensity = 0.95;
    } else if (theme === 'starlight') {
      cloudInstMat.color.setHex(0xcbd5e1);
      cloudInstMat.emissive.setHex(0x38bdf8);
      cloudInstMat.emissiveIntensity = 0.22;

      scene.fog = new THREE.Fog(0x1e1b4b, 48, 138);

      dirLight.color.setHex(0xe0f2fe);
      dirLight.intensity = 1.25;
      hemiLight.color.setHex(0x93c5fd);
      hemiLight.groundColor.setHex(0x1e1b4b);
      hemiLight.intensity = 0.8;
    } else {
      // 1층 기본값: 맑고 청량한 한낮의 하늘 (Daylight & Linear Fog)
      cloudInstMat.color.setHex(0xffffff);
      cloudInstMat.emissive.setHex(0xe0f2fe);
      cloudInstMat.emissiveIntensity = 0.24;

      scene.fog = new THREE.Fog(0xbae6fd, 48, 138);

      dirLight.color.setHex(0xfffbeb);
      dirLight.intensity = 1.45;
      hemiLight.color.setHex(0xf0f9ff);
      hemiLight.groundColor.setHex(0x0284c7);
      hemiLight.intensity = 0.95;
    }
  };

  const update = (
    elapsedTime: number,
    dt: number,
    _playerPos: THREE.Vector3
  ) => {
    // Zero-CPU-cost cloud layer drift & gentle bob (1 InstancedMesh transform update)
    cloudLayerGroup.position.x = Math.sin(elapsedTime * 0.16) * 2.2;
    cloudLayerGroup.position.y = Math.cos(elapsedTime * 0.55) * 0.35;

    // Bob floating islands & spin windmill blades
    for (const isl of floatingIslands) {
      isl.group.position.y =
        isl.baseY + Math.sin(elapsedTime * 0.9 + isl.bobPhase) * 0.25;
      if (isl.windmillBlades) {
        isl.windmillBlades.rotation.z += dt * 1.1;
      }
    }
  };

  return { root, setTheme, update };
}
