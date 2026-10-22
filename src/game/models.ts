import * as THREE from 'three';
import { PlatformSurfaceTheme, TimedZoneState } from './levels';
import { getSharedPlatformTexture } from './textures';
import { markShared } from './dispose';

export interface LumiRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  defaultMeshGroup: THREE.Group;
  customModelSlot: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  windupKey: THREE.Group;
  scarfTail: THREE.Mesh;
  antennaBulb: THREE.Mesh;
  shieldBubble: THREE.Mesh;
}

/**
 * 주인공 캐릭터 루미(Lumi) 아트토이 스타일 다중 파츠 3D 모델 + 외부 GLB 모델 장착 슬롯
 * 갤럭시 탭 S6 Lite 최적화: 저폴리곤 세그먼트 및 경량 MeshLambertMaterial 적용
 */
export function createLumiCharacter(): LumiRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const defaultMeshGroup = new THREE.Group();
  bodyGroup.add(defaultMeshGroup);

  const customModelSlot = new THREE.Group();
  customModelSlot.visible = false;
  bodyGroup.add(customModelSlot);

  const suitMat = new THREE.MeshLambertMaterial({
    color: 0x38bdf8,
  });
  const whiteTrimMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
  });
  const visorMat = new THREE.MeshLambertMaterial({
    color: 0x0f172a,
  });
  const eyeGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });
  const cheekGlowMat = new THREE.MeshBasicMaterial({
    color: 0xfb7185,
  });
  const goldMat = new THREE.MeshLambertMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.25,
  });
  const bootMat = new THREE.MeshLambertMaterial({
    color: 0xf43f5e,
  });
  const scarfMat = new THREE.MeshLambertMaterial({
    color: 0xf43f5e,
  });

  // 1 & 2: Left & Right Legs
  const legGeo = new THREE.CapsuleGeometry(0.135, 0.18, 6, 8);
  const leftLeg = new THREE.Mesh(legGeo, bootMat);
  leftLeg.position.set(-0.18, 0.22, 0);
  defaultMeshGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, bootMat);
  rightLeg.position.set(0.18, 0.22, 0);
  defaultMeshGroup.add(rightLeg);

  // 3: Rounded Art-Toy Torso
  const torsoGeo = new THREE.CylinderGeometry(0.32, 0.39, 0.54, 14);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.position.set(0, 0.58, 0);
  defaultMeshGroup.add(torso);

  // 4: Belly Belt & Explorer Neck Scarf + Fluttering Scarf Tail
  const beltGeo = new THREE.TorusGeometry(0.35, 0.05, 8, 14);
  const belt = new THREE.Mesh(beltGeo, whiteTrimMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.set(0, 0.45, 0);
  defaultMeshGroup.add(belt);

  const neckRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.065, 8, 14),
    scarfMat
  );
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.set(0, 0.84, 0);
  defaultMeshGroup.add(neckRing);

  const scarfTail = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.42, 0.06),
    scarfMat
  );
  scarfTail.position.set(0.08, 0.68, 0.34);
  scarfTail.rotation.x = 0.35;
  defaultMeshGroup.add(scarfTail);

  // 5 & 6: Left & Right Arms
  const armGeo = new THREE.CapsuleGeometry(0.105, 0.24, 6, 8);
  const leftArm = new THREE.Mesh(armGeo, whiteTrimMat);
  leftArm.position.set(-0.45, 0.62, 0);
  leftArm.rotation.z = 0.22;
  defaultMeshGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, whiteTrimMat);
  rightArm.position.set(0.45, 0.62, 0);
  rightArm.rotation.z = -0.22;
  defaultMeshGroup.add(rightArm);

  // 7: Head Helmet + Ear Headphones
  const headGeo = new THREE.SphereGeometry(0.43, 14, 12);
  const head = new THREE.Mesh(headGeo, whiteTrimMat);
  head.position.set(0, 1.14, 0);
  head.scale.set(1.06, 0.96, 1.0);
  defaultMeshGroup.add(head);

  const earGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10);
  earGeo.rotateZ(Math.PI / 2);
  const leftEar = new THREE.Mesh(earGeo, suitMat);
  leftEar.position.set(-0.45, 1.14, 0);
  defaultMeshGroup.add(leftEar);

  const rightEar = new THREE.Mesh(earGeo, suitMat);
  rightEar.position.set(0.45, 1.14, 0);
  defaultMeshGroup.add(rightEar);

  // 8: Visor & Glowing Eyes + Rosy Cheeks (facing -Z forward)
  const visorGeo = new THREE.SphereGeometry(0.34, 12, 10);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 1.14, -0.16);
  visor.scale.set(1.05, 0.72, 0.6);
  defaultMeshGroup.add(visor);

  const eyeGeo = new THREE.SphereGeometry(0.058, 8, 6);
  const leftEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
  leftEye.position.set(-0.13, 1.16, -0.35);
  leftEye.scale.set(1, 1.35, 0.5);
  defaultMeshGroup.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
  rightEye.position.set(0.13, 1.16, -0.35);
  rightEye.scale.set(1, 1.35, 0.5);
  defaultMeshGroup.add(rightEye);

  const cheekGeo = new THREE.SphereGeometry(0.038, 6, 6);
  const leftCheek = new THREE.Mesh(cheekGeo, cheekGlowMat);
  leftCheek.position.set(-0.21, 1.08, -0.33);
  leftCheek.scale.set(1.2, 0.7, 0.5);
  defaultMeshGroup.add(leftCheek);

  const rightCheek = new THREE.Mesh(cheekGeo, cheekGlowMat);
  rightCheek.position.set(0.21, 1.08, -0.33);
  rightCheek.scale.set(1.2, 0.7, 0.5);
  defaultMeshGroup.add(rightCheek);

  // 9: Star Antenna on top of Helmet
  const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.24, 6);
  const stem = new THREE.Mesh(stemGeo, suitMat);
  stem.position.set(0, 1.58, 0);
  defaultMeshGroup.add(stem);

  const bulbGeo = new THREE.OctahedronGeometry(0.13, 0);
  const antennaBulb = new THREE.Mesh(bulbGeo, goldMat);
  antennaBulb.position.set(0, 1.74, 0);
  defaultMeshGroup.add(antennaBulb);

  // 10: Wind-Up Key Backpack on back (+Z side)
  const windupKey = new THREE.Group();
  windupKey.position.set(0, 0.65, 0.37);

  const keyShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8),
    goldMat
  );
  keyShaft.rotation.x = Math.PI / 2;
  windupKey.add(keyShaft);

  const loopGeo = new THREE.TorusGeometry(0.12, 0.035, 6, 12);
  const leftLoop = new THREE.Mesh(loopGeo, goldMat);
  leftLoop.position.set(-0.11, 0, 0.12);
  windupKey.add(leftLoop);

  const rightLoop = new THREE.Mesh(loopGeo, goldMat);
  rightLoop.position.set(0.11, 0, 0.12);
  windupKey.add(rightLoop);

  defaultMeshGroup.add(windupKey);

  // Respawn / Invincibility Shield Bubble
  const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
    })
  );
  shieldBubble.position.set(0, 0.85, 0);
  shieldBubble.visible = false;
  root.add(shieldBubble);

  return {
    root,
    bodyGroup,
    defaultMeshGroup,
    customModelSlot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    windupKey,
    scarfTail,
    antennaBulb,
    shieldBubble,
  };
}

/**
 * 실시간 그림자(ShadowMap) 대신 점프 높이와 착지 지점을 선명하게 보여주는 캐릭터 발밑 원형 그림자
 */
export function createDropShadowRing(): THREE.Group {
  const group = new THREE.Group();

  const innerDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 18),
    new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    })
  );
  innerDisc.rotation.x = -Math.PI / 2;
  group.add(innerDisc);

  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.47, 0.57, 20),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  outerRing.rotation.x = -Math.PI / 2;
  group.add(outerRing);

  return group;
}

interface CachedThemeMaterials {
  topMat: THREE.MeshLambertMaterial;
  bodyMat: THREE.MeshLambertMaterial;
  rimMat: THREE.MeshLambertMaterial;
}

const platformMaterialCache = new Map<
  PlatformSurfaceTheme,
  CachedThemeMaterials
>();

function getPlatformThemeMaterials(
  theme: PlatformSurfaceTheme
): CachedThemeMaterials {
  const cached = platformMaterialCache.get(theme);
  if (cached) return cached;

  const palette: Record<
    PlatformSurfaceTheme,
    { body: number; trim: number }
  > = {
    meadow: { body: 0xd97706, trim: 0x16a34a },
    stone: { body: 0x64748b, trim: 0x334155 },
    emerald: { body: 0x0f766e, trim: 0x2dd4bf },
    gold: { body: 0xb45309, trim: 0xf59e0b },
    royal: { body: 0x0369a1, trim: 0x38bdf8 },
  };

  const colors = palette[theme];
  const map = getSharedPlatformTexture(theme);

  const mats: CachedThemeMaterials = {
    topMat: markShared(new THREE.MeshLambertMaterial({ map })),
    bodyMat: markShared(new THREE.MeshLambertMaterial({ color: colors.body })),
    rimMat: markShared(new THREE.MeshLambertMaterial({ color: colors.trim })),
  };

  platformMaterialCache.set(theme, mats);
  return mats;
}

/**
 * 3파츠 복합 블록 발판 (공유 텍스처 + 공유 MeshLambertMaterial로 GPU 상태 전환 최소화)
 */
export function createPlatformMesh(
  size: [number, number, number],
  theme: PlatformSurfaceTheme
): THREE.Group {
  const [w, h, d] = size;
  const group = new THREE.Group();

  const { topMat, bodyMat, rimMat } = getPlatformThemeMaterials(theme);

  // Top textured surface cap (top face sits at y = 0 in local space)
  const capHeight = Math.min(0.28, h * 0.28);
  const topCap = new THREE.Mesh(
    new THREE.BoxGeometry(w, capHeight, d),
    topMat
  );
  topCap.position.y = -capHeight / 2;
  group.add(topCap);

  // Main body block
  const bodyHeight = Math.max(0.2, h - capHeight);
  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.95, bodyHeight, d * 0.95),
    bodyMat
  );
  bodyMesh.position.y = -capHeight - bodyHeight / 2;
  group.add(bodyMesh);

  // Accent rim stripe
  const rimMesh = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.08, 0.11, d + 0.08),
    rimMat
  );
  rimMesh.position.y = -capHeight;
  group.add(rimMesh);

  return group;
}

// Shared materials for rotating beams
let sharedBeamMats: {
  baseMat: THREE.MeshLambertMaterial;
  hazardMat: THREE.MeshLambertMaterial;
  stripeMat: THREE.MeshLambertMaterial;
} | null = null;

function getSharedBeamMaterials() {
  if (!sharedBeamMats) {
    sharedBeamMats = {
      baseMat: markShared(new THREE.MeshLambertMaterial({ color: 0x334155 })),
      hazardMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0xf43f5e,
          emissive: 0xe11d48,
          emissiveIntensity: 0.2,
        })
      ),
      stripeMat: markShared(new THREE.MeshLambertMaterial({ color: 0xfbbf24 })),
    };
  }
  return sharedBeamMats;
}

/**
 * 회전 막대 장애물 (저폴리곤 세그먼트 + 공유 MeshLambertMaterial)
 */
export function createRotatingBeamMesh(
  radius: number,
  beamHeightOffset: number,
  armType: 'single' | 'double'
): { root: THREE.Group; spinner: THREE.Group } {
  const root = new THREE.Group();
  const spinner = new THREE.Group();
  root.add(spinner);

  const { baseMat, hazardMat, stripeMat } = getSharedBeamMaterials();

  // Base plate on floor
  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.78, 0.18, 12),
    baseMat
  );
  basePlate.position.y = 0.09;
  root.add(basePlate);

  // Central turret column
  const hubHeight = beamHeightOffset + 0.38;
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.42, hubHeight, 12),
    baseMat
  );
  hub.position.y = hubHeight / 2;
  spinner.add(hub);

  // Top beacon cap
  const topCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    stripeMat
  );
  topCap.position.y = hubHeight;
  spinner.add(topCap);

  // Rotating horizontal bar(s)
  const barLength = armType === 'double' ? radius * 2 : radius;
  const barCenterOffset = armType === 'double' ? 0 : radius / 2;

  const barGeo = new THREE.CylinderGeometry(0.18, 0.18, barLength, 10);
  barGeo.rotateZ(Math.PI / 2);
  const barMesh = new THREE.Mesh(barGeo, hazardMat);
  barMesh.position.set(barCenterOffset, beamHeightOffset, 0);
  spinner.add(barMesh);

  // Warning yellow rings along the bar
  const ringGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.22, 10);
  ringGeo.rotateZ(Math.PI / 2);
  const ringOffsets =
    armType === 'double'
      ? [-radius * 0.65, -radius * 0.3, radius * 0.3, radius * 0.65]
      : [radius * 0.35, radius * 0.7];
  for (const xOff of ringOffsets) {
    const ring = new THREE.Mesh(ringGeo, stripeMat);
    ring.position.set(xOff, beamHeightOffset, 0);
    spinner.add(ring);
  }

  // End caps
  const endCapGeo = new THREE.SphereGeometry(0.22, 8, 8);
  const posEndCap = new THREE.Mesh(endCapGeo, stripeMat);
  posEndCap.position.set(radius, beamHeightOffset, 0);
  spinner.add(posEndCap);

  if (armType === 'double') {
    const negEndCap = new THREE.Mesh(endCapGeo, stripeMat);
    negEndCap.position.set(-radius, beamHeightOffset, 0);
    spinner.add(negEndCap);
  }

  return { root, spinner };
}

/**
 * 층마다 1개 배치되는 황금 열쇠 (Golden Key) 3D 모델
 */
export function createGoldenKeyMesh(): {
  root: THREE.Group;
  keyBody: THREE.Group;
  haloRing: THREE.Mesh;
} {
  const root = new THREE.Group();
  const keyBody = new THREE.Group();
  root.add(keyBody);

  const goldMat = new THREE.MeshLambertMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.38,
  });

  // Key Bow (Top Ring)
  const bow = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.11, 8, 16),
    goldMat
  );
  bow.position.y = 0.55;
  keyBody.add(bow);

  // Key Shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.85, 8),
    goldMat
  );
  shaft.position.y = -0.05;
  keyBody.add(shaft);

  // Key Teeth
  const tooth1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.12, 0.12),
    goldMat
  );
  tooth1.position.set(0.14, -0.22, 0);
  keyBody.add(tooth1);

  const tooth2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.12, 0.12),
    goldMat
  );
  tooth2.position.set(0.17, -0.4, 0);
  keyBody.add(tooth2);

  // Ground Halo Ring
  const haloRing = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 0.95, 20),
    new THREE.MeshBasicMaterial({
      color: 0xfde047,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
    })
  );
  haloRing.rotation.x = -Math.PI / 2;
  haloRing.position.y = -0.75;
  root.add(haloRing);

  return { root, keyBody, haloRing };
}

/**
 * 출구 포털 (열쇠 획득 전: 잠긴 호박색 / 열쇠 획득 후: 시안 블루 빛기둥 활성화)
 */
export function createExitPortalMesh(): {
  root: THREE.Group;
  innerVortex: THREE.Mesh;
  outerRing: THREE.Mesh;
  lightBeam: THREE.Mesh;
  setUnlocked: (unlocked: boolean) => void;
} {
  const root = new THREE.Group();

  const stoneMat = new THREE.MeshLambertMaterial({
    color: 0xe2e8f0,
  });
  const pillarAccentMat = new THREE.MeshLambertMaterial({
    color: 0x0284c7,
  });

  // Base pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 2.2, 0.28, 16),
    stoneMat
  );
  pedestal.position.y = 0.14;
  root.add(pedestal);

  // Left & Right Pillars
  const pillarGeo = new THREE.CylinderGeometry(0.24, 0.28, 2.8, 10);
  const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
  leftPillar.position.set(-1.35, 1.5, 0);
  root.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
  rightPillar.position.set(1.35, 1.5, 0);
  root.add(rightPillar);

  // Top Arch Lintel
  const topArch = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.45, 0.65),
    pillarAccentMat
  );
  topArch.position.set(0, 2.95, 0);
  root.add(topArch);

  // Rotating Rune Ring
  const outerRingMat = new THREE.MeshLambertMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.4,
  });
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.09, 8, 20),
    outerRingMat
  );
  outerRing.position.set(0, 1.55, 0);
  root.add(outerRing);

  // Inner Energy Vortex Disc
  const vortexMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const innerVortex = new THREE.Mesh(
    new THREE.CircleGeometry(1.08, 20),
    vortexMat
  );
  innerVortex.position.set(0, 1.55, 0);
  root.add(innerVortex);

  // Vertical Sky Beam (visible when unlocked!)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const lightBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.45, 9.0, 14, 1, true),
    beamMat
  );
  lightBeam.position.set(0, 4.6, 0);
  lightBeam.visible = false;
  root.add(lightBeam);

  const setUnlocked = (unlocked: boolean) => {
    if (unlocked) {
      outerRingMat.color.setHex(0x22d3ee);
      outerRingMat.emissive.setHex(0x06b6d4);
      outerRingMat.emissiveIntensity = 0.7;
      vortexMat.color.setHex(0x38bdf8);
      vortexMat.opacity = 0.82;
      lightBeam.visible = true;
    } else {
      outerRingMat.color.setHex(0xf59e0b);
      outerRingMat.emissive.setHex(0xd97706);
      outerRingMat.emissiveIntensity = 0.35;
      vortexMat.color.setHex(0xf59e0b);
      vortexMat.opacity = 0.38;
      lightBeam.visible = false;
    }
  };

  return { root, innerVortex, outerRing, lightBeam, setUnlocked };
}

let sharedDamageZoneResources: {
  frameMat: THREE.MeshLambertMaterial;
  lavaMat: THREE.MeshBasicMaterial;
  spikeMat: THREE.MeshLambertMaterial;
  spikeGeo: THREE.ConeGeometry;
} | null = null;

function getSharedDamageZoneResources() {
  if (!sharedDamageZoneResources) {
    sharedDamageZoneResources = {
      frameMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0xfbbf24,
        })
      ),
      lavaMat: markShared(
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
        })
      ),
      spikeMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0xe11d48,
          emissive: 0x9f1239,
          emissiveIntensity: 0.35,
        })
      ),
      spikeGeo: markShared(new THREE.ConeGeometry(0.18, 0.34, 5)),
    };
  }
  return sharedDamageZoneResources;
}

/**
 * 밟으면 데미지를 주는 고정 가시/용암 위험 바닥 (탭 S6 Lite 최적화 공유 지오메트리·재질 적용)
 */
export function createDamageZoneMesh(size: [number, number]): THREE.Group {
  const [w, d] = size;
  const group = new THREE.Group();
  const { frameMat, lavaMat, spikeMat, spikeGeo } =
    getSharedDamageZoneResources();

  // Yellow hazard border frame sitting slightly above platform surface
  const borderMesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.06, d),
    frameMat
  );
  borderMesh.position.y = 0.03;
  group.add(borderMesh);

  // Glowing magma inner bed
  const innerW = Math.max(0.4, w - 0.24);
  const innerD = Math.max(0.4, d - 0.24);
  const lavaBed = new THREE.Mesh(
    new THREE.BoxGeometry(innerW, 0.08, innerD),
    lavaMat
  );
  lavaBed.position.y = 0.045;
  group.add(lavaBed);

  // Low-poly spikes arranged evenly across the hazard strip
  const cols = Math.max(2, Math.min(6, Math.round(innerW / 0.85)));
  const rows = Math.max(2, Math.min(6, Math.round(innerD / 0.85)));
  const stepX = innerW / cols;
  const stepZ = innerD / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const sx = -innerW / 2 + stepX * (c + 0.5);
      const sz = -innerD / 2 + stepZ * (r + 0.5);
      spike.position.set(sx, 0.24, sz);
      group.add(spike);
    }
  }

  return group;
}

let sharedJumpPadResources: {
  baseMat: THREE.MeshLambertMaterial;
  springMat: THREE.MeshLambertMaterial;
  capMat: THREE.MeshLambertMaterial;
  emblemMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
} | null = null;

function getSharedJumpPadResources() {
  if (!sharedJumpPadResources) {
    sharedJumpPadResources = {
      baseMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0x334155,
        })
      ),
      springMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0xfacc15,
          emissive: 0xd97706,
          emissiveIntensity: 0.3,
        })
      ),
      capMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0x06b6d4,
          emissive: 0x0891b2,
          emissiveIntensity: 0.45,
        })
      ),
      emblemMat: markShared(
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
        })
      ),
      ringMat: markShared(
        new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        })
      ),
    };
  }
  return sharedJumpPadResources;
}

/**
 * 밟으면 즉시 통상 점프의 3배 높이로 솟구치는 슈퍼 점프 버튼 (Jump Pad)
 */
export function createJumpPadMesh(radius = 0.76): {
  root: THREE.Group;
  buttonCap: THREE.Group;
  pulseRing: THREE.Mesh;
} {
  const root = new THREE.Group();
  const { baseMat, springMat, capMat, emblemMat, ringMat } =
    getSharedJumpPadResources();

  // Outer metallic housing rim on floor
  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.96, radius * 1.08, 0.14, 16),
    baseMat
  );
  basePlate.position.y = 0.07;
  root.add(basePlate);

  // Inner golden spring coil cylinder
  const springCoil = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.58, radius * 0.65, 0.22, 12),
    springMat
  );
  springCoil.position.y = 0.16;
  root.add(springCoil);

  // Movable glowing cyan button cap + star/arrow emblem
  const buttonCap = new THREE.Group();
  buttonCap.position.y = 0.26;
  root.add(buttonCap);

  const capDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.78, radius * 0.84, 0.16, 16),
    capMat
  );
  buttonCap.add(capDisc);

  const innerStar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.42, radius * 0.46, 0.04, 6),
    emblemMat
  );
  innerStar.position.y = 0.09;
  buttonCap.add(innerStar);

  // Glowing outer pulse ring
  const pulseRing = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.05, radius * 1.24, 20),
    ringMat
  );
  pulseRing.rotation.x = -Math.PI / 2;
  pulseRing.position.y = 0.04;
  root.add(pulseRing);

  return { root, buttonCap, pulseRing };
}

let sharedTimedTileResources: {
  borderMat: THREE.MeshLambertMaterial;
  greenMat: THREE.MeshLambertMaterial;
  yellowMat: THREE.MeshLambertMaterial;
  redMat: THREE.MeshLambertMaterial;
  spikeYellowMat: THREE.MeshLambertMaterial;
  spikeRedMat: THREE.MeshLambertMaterial;
  spikeGeo: THREE.ConeGeometry;
} | null = null;

function getSharedTimedTileResources() {
  if (!sharedTimedTileResources) {
    sharedTimedTileResources = {
      borderMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0x1e293b,
        })
      ),
      greenMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0x22c55e,
          emissive: 0x15803d,
          emissiveIntensity: 0.42,
        })
      ),
      yellowMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0xfacc15,
          emissive: 0xd97706,
          emissiveIntensity: 0.58,
        })
      ),
      redMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0xef4444,
          emissive: 0xb91c1c,
          emissiveIntensity: 0.72,
        })
      ),
      spikeYellowMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0xfef08a,
          emissive: 0xca8a04,
          emissiveIntensity: 0.45,
        })
      ),
      spikeRedMat: markShared(
        new THREE.MeshLambertMaterial({
          color: 0xffe4e6,
          emissive: 0xe11d48,
          emissiveIntensity: 0.55,
        })
      ),
      spikeGeo: markShared(new THREE.ConeGeometry(0.18, 0.36, 5)),
    };
  }
  return sharedTimedTileResources;
}

/**
 * 진행 방향에서 바라봤을 때 가로로 2등분되어
 * (초록 3 : 노랑 1 : 빨강 2) 비율로 교차 변화하는 시간차 데미지 장판 타일
 */
export function createTimedHazardTileMesh(
  size: [number, number],
  splitAxis: 'z' | 'x'
): {
  root: THREE.Group;
  setZoneStates: (zone1: TimedZoneState, zone2: TimedZoneState) => void;
} {
  const [w, d] = size;
  const root = new THREE.Group();
  const res = getSharedTimedTileResources();

  const zoneW = splitAxis === 'x' ? w / 2 : w;
  const zoneD = splitAxis === 'z' ? d / 2 : d;

  const buildHalfZone = (offsetX: number, offsetZ: number) => {
    const zoneGroup = new THREE.Group();
    zoneGroup.position.set(offsetX, 0, offsetZ);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.4, zoneW - 0.1),
        0.045,
        Math.max(0.4, zoneD - 0.1)
      ),
      res.borderMat
    );
    frame.position.y = 0.022;
    zoneGroup.add(frame);

    const padW = Math.max(0.4, zoneW - 0.34);
    const padD = Math.max(0.4, zoneD - 0.34);
    const padMesh = new THREE.Mesh(
      new THREE.BoxGeometry(padW, 0.075, padD),
      res.greenMat
    );
    padMesh.position.y = 0.042;
    zoneGroup.add(padMesh);

    const spikesGroup = new THREE.Group();
    const spikeMeshes: THREE.Mesh[] = [];
    const cols = Math.max(2, Math.min(5, Math.round(padW / 1.15)));
    const rows = Math.max(2, Math.min(4, Math.round(padD / 1.15)));
    const stepX = padW / cols;
    const stepZ = padD / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const spike = new THREE.Mesh(res.spikeGeo, res.spikeRedMat);
        const sx = -padW / 2 + stepX * (c + 0.5);
        const sz = -padD / 2 + stepZ * (r + 0.5);
        spike.position.set(sx, 0.22, sz);
        spikesGroup.add(spike);
        spikeMeshes.push(spike);
      }
    }
    spikesGroup.visible = false;
    zoneGroup.add(spikesGroup);
    root.add(zoneGroup);

    const applyState = (state: TimedZoneState) => {
      if (state === 'green') {
        padMesh.material = res.greenMat;
        spikesGroup.visible = false;
      } else if (state === 'yellow') {
        padMesh.material = res.yellowMat;
        spikesGroup.visible = true;
        spikesGroup.scale.set(1, 0.38, 1);
        for (const sm of spikeMeshes) {
          sm.material = res.spikeYellowMat;
        }
      } else {
        padMesh.material = res.redMat;
        spikesGroup.visible = true;
        spikesGroup.scale.set(1, 1, 1);
        for (const sm of spikeMeshes) {
          sm.material = res.spikeRedMat;
        }
      }
    };

    return { applyState };
  };

  // splitAxis === 'z' -> zone1: +d/4 (진입부), zone2: -d/4 (진출부)
  // splitAxis === 'x' -> zone1: +w/4 (진입부), zone2: -w/4 (진출부)
  const half1 =
    splitAxis === 'z'
      ? buildHalfZone(0, d / 4)
      : buildHalfZone(w / 4, 0);
  const half2 =
    splitAxis === 'z'
      ? buildHalfZone(0, -d / 4)
      : buildHalfZone(-w / 4, 0);

  let currentZ1: TimedZoneState | null = null;
  let currentZ2: TimedZoneState | null = null;

  const setZoneStates = (z1: TimedZoneState, z2: TimedZoneState) => {
    if (z1 !== currentZ1) {
      currentZ1 = z1;
      half1.applyState(z1);
    }
    if (z2 !== currentZ2) {
      currentZ2 = z2;
      half2.applyState(z2);
    }
  };

  return { root, setZoneStates };
}

