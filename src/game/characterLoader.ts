import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export interface CharacterPreset {
  id: string;
  name: string;
  role: string;
  species: string;
  badgeColor: string;
  modelFile: string | null; // null = default procedural Lumi
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'frog-real',
    name: '폴짝 개구리',
    role: '연못 점프왕',
    species: '참개구리',
    badgeColor: '#22c55e',
    modelFile: 'models/frog-real.glb',
  },
  {
    id: 'flamingo-real',
    name: '실제 홍학',
    role: '하늘 비행대',
    species: '분홍 플라밍고',
    badgeColor: '#ec4899',
    modelFile: 'models/flamingo-real.glb',
  },
  {
    id: 'fox',
    name: '붉은 여우',
    role: '숲속 추격자',
    species: '야생 여우',
    badgeColor: '#f97316',
    modelFile: 'models/fox.glb',
  },
  {
    id: 'finn-frog',
    name: '개구리 대원 핀',
    role: '점프 전문가',
    species: '개구리 탐험가',
    badgeColor: '#10b981',
    modelFile: 'models/finn-frog.glb',
  },
  {
    id: 'shiba-inu',
    name: '시바견',
    role: '구조 파트너',
    species: '시바견 대원',
    badgeColor: '#f59e0b',
    modelFile: 'models/shiba-inu.glb',
  },
  {
    id: 'lumi-default',
    name: '별빛 로봇 루미',
    role: '기본 아트토이',
    species: '아트토이 로봇',
    badgeColor: '#38bdf8',
    modelFile: null,
  },
];

export interface LoadedGLBCharacter {
  wrapper: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: {
    idle: THREE.AnimationAction | null;
    walk: THREE.AnimationAction | null;
    jump: THREE.AnimationAction | null;
  };
  activeAction: THREE.AnimationAction | null;
  isHopper: boolean;
}

let sharedLoader: GLTFLoader | null = null;

function getGLTFLoader(): GLTFLoader {
  if (!sharedLoader) {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
    );
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    sharedLoader = loader;
  }
  return sharedLoader;
}

/**
 * 스무스 셰이딩(법선 병합) - 폴리곤/정점 수는 그대로 유지합니다.
 * - 같은 위치에 있는 (UV 이음새·플랫 셰이딩으로 분리된) 정점들끼리 면 법선을 평균내어
 *   각진 면이 둥글게 보이도록 합니다.
 * - creaseAngle보다 크게 꺾인 모서리(장화 밑창, 헬멧 테두리 등)는 날카롭게 유지합니다.
 * - 인덱스/UV/스키닝(JOINTS·WEIGHTS) 속성을 건드리지 않으므로 애니메이션에 안전합니다.
 * - 로딩 시 1회만 실행되며, 플레이 중 GPU/CPU 부하는 0입니다.
 */
function applySmoothNormals(
  geometry: THREE.BufferGeometry,
  creaseAngleDeg = 70
): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  if (!pos || pos.count < 3) return;
  if (geometry.morphAttributes.position?.length) return; // 모프 타깃 모델은 건너뜀

  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const normalAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;

  const index = geometry.getIndex();
  const vertCount = pos.count;
  const triCount = index ? index.count / 3 : vertCount / 3;

  // 1) 삼각형별 면 법선 (넓이 가중, 비정규화)
  const faceN = new Float32Array(triCount * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const getIdx = (i: number) => (index ? index.getX(i) : i);

  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, getIdx(t * 3));
    b.fromBufferAttribute(pos, getIdx(t * 3 + 1));
    c.fromBufferAttribute(pos, getIdx(t * 3 + 2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    ab.cross(ac);
    faceN[t * 3] = ab.x;
    faceN[t * 3 + 1] = ab.y;
    faceN[t * 3 + 2] = ab.z;
  }

  // 2) 위치가 같은 정점들을 그룹화 (양자화 해시)
  geometry.computeBoundingBox();
  const bbSize = geometry.boundingBox!.getSize(new THREE.Vector3());
  const eps = Math.max(bbSize.x, bbSize.y, bbSize.z, 1e-6) * 1e-5;
  const groupOf = new Int32Array(vertCount);
  const keyToGroup = new Map<string, number>();
  let groupCount = 0;
  for (let v = 0; v < vertCount; v++) {
    const key = `${Math.round(pos.getX(v) / eps)}_${Math.round(
      pos.getY(v) / eps
    )}_${Math.round(pos.getZ(v) / eps)}`;
    let g = keyToGroup.get(key);
    if (g === undefined) {
      g = groupCount++;
      keyToGroup.set(key, g);
    }
    groupOf[v] = g;
  }

  // 3) 그룹별로 인접 삼각형 목록 구성 (CSR 형식)
  const groupTriCounts = new Int32Array(groupCount + 1);
  for (let i = 0; i < triCount * 3; i++) groupTriCounts[groupOf[getIdx(i)] + 1]++;
  for (let g = 0; g < groupCount; g++) groupTriCounts[g + 1] += groupTriCounts[g];
  const groupTris = new Int32Array(triCount * 3);
  const fill = groupTriCounts.slice(0, groupCount);
  for (let i = 0; i < triCount * 3; i++) {
    const g = groupOf[getIdx(i)];
    groupTris[fill[g]++] = Math.floor(i / 3);
  }

  // 4) 정점별로 원래 법선과 crease 각도 이내인 면 법선만 합산
  const cosCrease = Math.cos((creaseAngleDeg * Math.PI) / 180);
  const out = new Float32Array(vertCount * 3);
  const ref = new THREE.Vector3();
  const fn = new THREE.Vector3();
  const acc = new THREE.Vector3();

  for (let v = 0; v < vertCount; v++) {
    ref.fromBufferAttribute(normalAttr, v);
    const refLen = ref.length();
    const g = groupOf[v];
    const start = groupTriCounts[g];
    const end = groupTriCounts[g + 1];
    acc.set(0, 0, 0);

    for (let k = start; k < end; k++) {
      const t = groupTris[k];
      fn.set(faceN[t * 3], faceN[t * 3 + 1], faceN[t * 3 + 2]);
      const len = fn.length();
      if (len < 1e-12) continue;
      if (refLen > 1e-6 && fn.dot(ref) / (len * refLen) < cosCrease) continue;
      acc.add(fn);
    }

    if (acc.lengthSq() < 1e-20) acc.copy(ref);
    acc.normalize();
    out[v * 3] = acc.x;
    out[v * 3 + 1] = acc.y;
    out[v * 3 + 2] = acc.z;
  }

  geometry.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

/**
 * 외부 .glb / .gltf 3D 캐릭터 파일을 로드하고
 * 1) 캐릭터 키를 1.55m로 자동 정규화,
 * 2) 발바닥 중앙이 y = 0에 오도록 피벗 정렬,
 * 3) 내장된 스켈레탈 애니메이션(Idle, Walk/Run, Jump)을 자동 매핑합니다.
 */
export async function loadNormalizedGLBCharacter(
  url: string,
  targetHeight = 1.55
): Promise<LoadedGLBCharacter> {
  const loader = getGLTFLoader();

  const gltf = await new Promise<any>((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });

  const model: THREE.Group = gltf.scene;

  const processedGeometries = new WeakSet<THREE.BufferGeometry>();
  model.traverse((child: any) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;

      // 각진 폴리곤 완화: 정점 수를 늘리지 않고 법선만 부드럽게 재계산 (로딩 시 1회)
      const geo: THREE.BufferGeometry = child.geometry;
      if (geo && !processedGeometries.has(geo)) {
        processedGeometries.add(geo);
        applySmoothNormals(geo);
      }

      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const mat of mats) {
        if (mat && mat.flatShading) {
          mat.flatShading = false;
          mat.needsUpdate = true;
        }
      }
    }
  });

  // Compute bounding box and normalize height + ground pivot (y = 0)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  const lowerUrl = url.toLowerCase();
  const isFlamingo = lowerUrl.includes('flamingo-real');
  const isHopper = lowerUrl.includes('frog-real');

  // 실제 홍학(flamingo-real)은 긴 날개 폭 때문에 기본 정규화 시 몸통이 작아 보이므로 크기를 3배로 확대
  const effectiveTargetSize = isFlamingo ? targetHeight * 3.0 : targetHeight;
  const maxAxis = Math.max(size.y, size.x, size.z, 0.001);
  const scaleFactor = effectiveTargetSize / maxAxis;
  model.scale.setScalar(scaleFactor);

  // Recompute box after scaling so feet sit flush at y = 0
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  model.position.set(
    -scaledCenter.x,
    -scaledBox.min.y,
    -scaledCenter.z
  );

  // Rotate model 180 deg around Y if it faces +Z by default so forward aligns with -Z
  const pivotGroup = new THREE.Group();
  model.rotation.y = Math.PI;
  pivotGroup.add(model);

  // Inspect animation clips
  const clips: THREE.AnimationClip[] = gltf.animations || [];
  let mixer: THREE.AnimationMixer | null = null;
  let idleAction: THREE.AnimationAction | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let jumpAction: THREE.AnimationAction | null = null;

  if (clips.length > 0) {
    mixer = new THREE.AnimationMixer(model);

    const findExactOrPartial = (
      exactNames: string[],
      partialKeywords: string[]
    ) => {
      for (const exact of exactNames) {
        const match = clips.find(
          (c) =>
            c.name.toLowerCase() === exact.toLowerCase() ||
            c.name.toLowerCase().endsWith(`|${exact.toLowerCase()}`)
        );
        if (match) return match;
      }
      return clips.find((c) =>
        partialKeywords.some((kw) => c.name.toLowerCase().includes(kw))
      );
    };

    const idleClip =
      findExactOrPartial(
        ['Idle', 'Frog_Idle', 'Wave', 'Stand'],
        ['idle', 'stand', 'wait', 'breath', 'fly']
      ) ?? clips[0];
    const walkClip =
      findExactOrPartial(
        ['Run', 'Gallop', 'Frog_Jump', 'Walk'],
        ['run', 'gallop', 'frog_jump', 'walk', 'move', 'jog', 'hop']
      );
    const jumpClip = findExactOrPartial(
      ['Jump_Idle', 'Frog_Jump', 'Jump', 'Gallop_Jump', 'Jump_ToIdle'],
      ['jump', 'air', 'hop', 'fall']
    );

    if (idleClip) {
      idleAction = mixer.clipAction(idleClip);
      idleAction.play();
    }
    if (walkClip && walkClip !== idleClip) {
      walkAction = mixer.clipAction(walkClip);
      if (isHopper) {
        walkAction.timeScale = 1.65;
      }
    }
    if (jumpClip && jumpClip !== idleClip) {
      // walk와 jump가 동일한 클립(예: Frog_Jump)일 때 별도 클립으로 복제하여 이동 중 점프 전환이 즉시 작동하도록 분리
      const distinctJumpClip =
        jumpClip === walkClip ? jumpClip.clone() : jumpClip;
      if (distinctJumpClip === jumpClip && jumpClip === walkClip) {
        distinctJumpClip.name = `${jumpClip.name}_JumpAction`;
      } else if (jumpClip === walkClip) {
        distinctJumpClip.name = `${jumpClip.name}_JumpAction`;
      }
      jumpAction = mixer.clipAction(distinctJumpClip);
      if (isHopper) {
        jumpAction.timeScale = 1.35;
      }
    }
  }

  return {
    wrapper: pivotGroup,
    mixer,
    actions: {
      idle: idleAction,
      walk: walkAction,
      jump: jumpAction,
    },
    activeAction: idleAction,
    isHopper,
  };
}

/**
 * 매 프레임 GLB 캐릭터의 AnimationMixer 및 절차적 보정 모션을 업데이트합니다.
 */
export function updateGLBCharacterAnimation(
  customChar: LoadedGLBCharacter,
  dt: number,
  isMoving: boolean,
  isGrounded: boolean,
  walkCycle: number
): void {
  if (customChar.mixer) {
    let desiredAction = customChar.actions.idle;
    if (!isGrounded && customChar.actions.jump) {
      desiredAction = customChar.actions.jump;
    } else if (isMoving && customChar.actions.walk) {
      desiredAction = customChar.actions.walk;
    } else if (isMoving && customChar.actions.idle) {
      desiredAction = customChar.actions.idle;
    }

    if (desiredAction && desiredAction !== customChar.activeAction) {
      const isEnteringJump = desiredAction === customChar.actions.jump;
      const isEnteringHopWalk =
        customChar.isHopper && desiredAction === customChar.actions.walk;

      // 점프 키 입력 또는 폴짝 개구리 이동 시작 시 크로스페이드 딜레이를 0.04초로 최소화
      const fadeDuration = isEnteringJump || isEnteringHopWalk ? 0.04 : 0.14;

      if (customChar.activeAction) {
        customChar.activeAction.fadeOut(fadeDuration);
      }
      desiredAction.reset();

      if (isEnteringHopWalk) {
        // Frog_Jump 초반 바닥 웅크림(0.0~0.21s) 구간을 건너뛰어 미끄러짐 없이 첫 프레임부터 즉시 도약
        desiredAction.time = 0.22;
      } else if (isEnteringJump) {
        // 점프 버튼 입력 시 모든 캐릭터의 초반 준비 동작 딜레이를 건너뛰어 즉각 공중 도약 포즈 재생
        const clipDur = desiredAction.getClip().duration;
        desiredAction.time = customChar.isHopper
          ? 0.22
          : Math.min(0.12, clipDur * 0.2);
      }

      desiredAction.fadeIn(fadeDuration).play();
      customChar.activeAction = desiredAction;
    }

    // 단일 클립 비행 캐릭터(실제 홍학 등)는 이동/점프 시 날갯짓 속도를 높여 생동감 부여
    if (!customChar.actions.walk && !customChar.actions.jump) {
      customChar.mixer.timeScale = !isGrounded ? 1.45 : isMoving ? 1.25 : 0.85;
    } else {
      customChar.mixer.timeScale = 1.0;
    }

    customChar.mixer.update(dt);

    // 폴짝 개구리(isHopper)가 지면 이동 중이거나 체공 중일 때 바닥 정지 프레임을 생략하여 연속 점프 유지
    if (customChar.isHopper) {
      if (
        customChar.activeAction === customChar.actions.walk &&
        customChar.actions.walk
      ) {
        if (
          customChar.actions.walk.time > 0.72 ||
          customChar.actions.walk.time < 0.20
        ) {
          customChar.actions.walk.time = 0.20;
        }
      } else if (
        customChar.activeAction === customChar.actions.jump &&
        customChar.actions.jump &&
        !isGrounded
      ) {
        // 공중에 떠 있는 동안에는 착지 후 정지 프레임(0.60s 이후)으로 넘어가지 않고 도약 포즈 유지
        if (customChar.actions.jump.time > 0.58) {
          customChar.actions.jump.time = 0.58;
        }
      }
    }
  }

  // If the GLB has no walk animation clip, add gentle procedural hop & sway
  if (!customChar.actions.walk) {
    const hop = isGrounded && isMoving ? Math.abs(Math.sin(walkCycle)) * 0.14 : 0;
    const sway = isGrounded && isMoving ? Math.cos(walkCycle) * 0.08 : 0;
    customChar.wrapper.position.y = hop;
    customChar.wrapper.rotation.z = sway;
  } else {
    customChar.wrapper.position.y = 0;
    customChar.wrapper.rotation.z = 0;
  }
}
