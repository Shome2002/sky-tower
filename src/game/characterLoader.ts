import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export interface LoadedGLBCharacter {
  wrapper: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: {
    idle: THREE.AnimationAction | null;
    walk: THREE.AnimationAction | null;
    jump: THREE.AnimationAction | null;
  };
  activeAction: THREE.AnimationAction | null;
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

  model.traverse((child: any) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  // Compute bounding box and normalize height + ground pivot (y = 0)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  const maxAxis = Math.max(size.y, size.x, size.z, 0.001);
  const scaleFactor = targetHeight / maxAxis;
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

    const findClipByKeywords = (keywords: string[]) =>
      clips.find((c) =>
        keywords.some((kw) => c.name.toLowerCase().includes(kw))
      );

    const idleClip =
      findClipByKeywords(['idle', 'stand', 'wait', 'breath']) ?? clips[0];
    const walkClip =
      findClipByKeywords(['run', 'walk', 'move', 'jog']) ??
      clips[Math.min(1, clips.length - 1)];
    const jumpClip = findClipByKeywords(['jump', 'air', 'hop', 'fall']);

    if (idleClip) {
      idleAction = mixer.clipAction(idleClip);
      idleAction.play();
    }
    if (walkClip && walkClip !== idleClip) {
      walkAction = mixer.clipAction(walkClip);
    }
    if (jumpClip) {
      jumpAction = mixer.clipAction(jumpClip);
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
      if (customChar.activeAction) {
        customChar.activeAction.fadeOut(0.18);
      }
      desiredAction.reset().fadeIn(0.18).play();
      customChar.activeAction = desiredAction;
    }

    customChar.mixer.update(dt);
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
