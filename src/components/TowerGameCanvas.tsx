import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  DamageZoneSpec,
  evaluateMovingPlatformPos,
  evaluateRotatingBeamAngle,
  evaluateTimedHazardTileStates,
  getFloorBlueprint,
  JumpPadSpec,
  MovingPlatformSpec,
  RotatingBeamSpec,
  TimedHazardTileSpec,
  TimedZoneState,
} from '../game/levels';
import {
  createDamageZoneMesh,
  createDropShadowRing,
  createExitPortalMesh,
  createGoldenKeyMesh,
  createJumpPadMesh,
  createLumiCharacter,
  createPlatformMesh,
  createRotatingBeamMesh,
  createTimedHazardTileMesh,
  LumiRig,
} from '../game/models';
import { createSkyEnvironment } from '../game/environment';
import { setPlatformTextureAnisotropy } from '../game/textures';
import {
  LoadedGLBCharacter,
  loadNormalizedGLBCharacter,
  updateGLBCharacterAnimation,
} from '../game/characterLoader';
import { soundFX } from '../game/audio';
import { disposeObject3D } from '../game/dispose';
import { TouchInputRef } from './TouchControls';

export type GameStatus =
  | 'TITLE'
  | 'PLAYING'
  | 'PAUSED'
  | 'FLOOR_CLEAR'
  | 'FLOOR_FAIL';

interface TowerGameCanvasProps {
  gameStatus: GameStatus;
  currentFloor: number;
  attemptId: number;
  customModelUrl: string | null;
  lowResMode: boolean;
  fps30Cap: boolean;
  touchInputRef: React.MutableRefObject<TouchInputRef>;
  onCollectKey: () => void;
  onLoseHeart: () => void;
  onFloorClear: () => void;
  onTogglePause: () => void;
  onPortalLockedNotice: () => void;
  onModelLoadStatus?: (status: { loading: boolean; error: string | null }) => void;
  onResolutionReport?: (info: { width: number; height: number }) => void;
}

interface ActivePlatformBox {
  id: string;
  mesh: THREE.Group;
  center: [number, number, number];
  prevCenter: [number, number, number];
  size: [number, number, number];
  spec?: MovingPlatformSpec;
}

interface ActiveBeamHazard {
  spec: RotatingBeamSpec;
  root: THREE.Group;
  spinner: THREE.Group;
  currentAngle: number;
}

interface ActiveJumpPad {
  spec: JumpPadSpec;
  root: THREE.Group;
  buttonCap: THREE.Group;
  pulseRing: THREE.Mesh;
  bounceTimer: number;
  cooldown: number;
}

interface ActiveTimedHazardTile {
  spec: TimedHazardTileSpec;
  root: THREE.Group;
  setZoneStates: (z1: TimedZoneState, z2: TimedZoneState) => void;
  zone1State: TimedZoneState;
  zone2State: TimedZoneState;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

// Pre-allocated math objects to avoid GC
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

export const TowerGameCanvas: React.FC<TowerGameCanvasProps> = ({
  gameStatus,
  currentFloor,
  attemptId,
  customModelUrl,
  lowResMode,
  fps30Cap,
  touchInputRef,
  onCollectKey,
  onLoseHeart,
  onFloorClear,
  onTogglePause,
  onPortalLockedNotice,
  onModelLoadStatus,
  onResolutionReport,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const callbacksRef = useRef({
    onCollectKey,
    onLoseHeart,
    onFloorClear,
    onTogglePause,
    onPortalLockedNotice,
    onModelLoadStatus,
    onResolutionReport,
  });
  useEffect(() => {
    callbacksRef.current = {
      onCollectKey,
      onLoseHeart,
      onFloorClear,
      onTogglePause,
      onPortalLockedNotice,
      onModelLoadStatus,
      onResolutionReport,
    };
  }, [
    onCollectKey,
    onLoseHeart,
    onFloorClear,
    onTogglePause,
    onPortalLockedNotice,
    onModelLoadStatus,
    onResolutionReport,
  ]);

  const statusRef = useRef<GameStatus>(gameStatus);
  useEffect(() => {
    statusRef.current = gameStatus;
  }, [gameStatus]);

  const perfConfigRef = useRef<{
    lowResMode: boolean;
    fps30Cap: boolean;
    needsResize: boolean;
  }>({
    lowResMode,
    fps30Cap,
    needsResize: true,
  });

  useEffect(() => {
    perfConfigRef.current.lowResMode = lowResMode;
    perfConfigRef.current.fps30Cap = fps30Cap;
    perfConfigRef.current.needsResize = true;
  }, [lowResMode, fps30Cap]);

  const floorLoadRequestRef = useRef<{
    floor: number;
    attemptId: number;
    needsRebuild: boolean;
  }>({
    floor: currentFloor,
    attemptId,
    needsRebuild: true,
  });

  useEffect(() => {
    floorLoadRequestRef.current = {
      floor: currentFloor,
      attemptId,
      needsRebuild: true,
    };
  }, [currentFloor, attemptId]);

  const customModelRequestRef = useRef<{
    url: string | null;
    needsUpdate: boolean;
  }>({
    url: customModelUrl,
    needsUpdate: true,
  });

  useEffect(() => {
    customModelRequestRef.current = {
      url: customModelUrl,
      needsUpdate: true,
    };
  }, [customModelUrl]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Galaxy Tab S6 Lite (Exynos 9611 / Mali-G72 MP3) Ultra-Light Renderer:
    // - antialias: true (MSAA - 타일/발판 모서리 계단 현상 제거, 해상도는 그대로 유지)
    // - stencil: false, powerPreference: 'high-performance'
    // - Internal buffer scaled down to ~1000x600 (600k pixel budget) by default
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    // 비등방성 필터링: 기기 GPU가 지원하는 최대치(최대 16x)로 바닥 텍스처에 적용
    setPlatformTextureAnisotropy(renderer.capabilities.getMaxAnisotropy());
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.Fog(0xbae6fd, 48, 138);

    const camera = new THREE.PerspectiveCamera(
      56,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.25,
      180
    );
    camera.position.set(0, 4.5, 7.5);

    /**
     * 해상도 스케일러:
     * - lowResMode가 켜져 있으면 화면 비율을 유지한 채 내부 WebGL 버퍼를 최대 1000x600 (약 60만 픽셀) 수준으로 축소합니다.
     * - 갤럭시 탭 S6 Lite (2000x1200 물리 해상도) 기준 픽셀 연산량을 1/4로 줄여 렉을 근본적으로 해소합니다.
     */
    const updateRenderResolution = () => {
      if (!container) return;
      const clientW = Math.max(1, container.clientWidth);
      const clientH = Math.max(1, container.clientHeight);
      const aspect = clientW / clientH;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      let renderW = clientW;
      let renderH = clientH;

      if (perfConfigRef.current.lowResMode) {
        const targetPixelBudget = 1000 * 600; // 600,000 pixels
        const currentPixels = clientW * clientH;
        if (currentPixels > targetPixelBudget) {
          const scale = Math.sqrt(targetPixelBudget / currentPixels);
          renderW = Math.max(480, Math.round(clientW * scale));
          renderH = Math.max(300, Math.round(clientH * scale));
        } else if (clientW > 1000 || clientH > 600) {
          const scale = Math.min(1000 / clientW, 600 / clientH);
          renderW = Math.max(480, Math.round(clientW * scale));
          renderH = Math.max(300, Math.round(clientH * scale));
        } else {
          // Even if CSS viewport is already ~1000x600, force 1000x600 cap or 0.75x if small
          renderW = Math.min(1000, clientW);
          renderH = Math.min(600, clientH);
        }
      }

      // false -> Do NOT overwrite CSS width/height (stays stretched to 100% of screen)
      renderer.setSize(renderW, renderH, false);
      callbacksRef.current.onResolutionReport?.({
        width: renderW,
        height: renderH,
      });
    };

    updateRenderResolution();

    // Lightweight Sky & Directional Lighting (No ShadowMap pass)
    const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x0284c7, 0.95);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    dirLight.position.set(18, 36, 22);
    dirLight.castShadow = false;
    scene.add(dirLight);

    // Zero-overdraw Sky Gradient, Instanced Cloud Clusters & Low-Poly Islands
    const skyEnv = createSkyEnvironment();
    scene.add(skyEnv.root);

    // Create Hero Character Lumi & Drop Shadow Ring
    const lumi: LumiRig = createLumiCharacter();
    scene.add(lumi.root);

    let activeGLBChar: LoadedGLBCharacter | null = null;
    let glbLoadToken = 0;

    const releaseActiveGLBModel = () => {
      const prevMixer = activeGLBChar?.mixer ?? null;
      if (prevMixer) {
        prevMixer.stopAllAction();
        prevMixer.uncacheRoot(prevMixer.getRoot());
      }
      while (lumi.customModelSlot.children.length > 0) {
        const child = lumi.customModelSlot.children[0];
        lumi.customModelSlot.remove(child);
        disposeObject3D(child);
      }
      activeGLBChar = null;
    };

    const applyCustomGLBModel = async (targetUrl: string | null) => {
      const token = ++glbLoadToken;
      releaseActiveGLBModel();

      if (!targetUrl) {
        lumi.customModelSlot.visible = false;
        lumi.defaultMeshGroup.visible = true;
        callbacksRef.current.onModelLoadStatus?.({ loading: false, error: null });
        return;
      }

      callbacksRef.current.onModelLoadStatus?.({ loading: true, error: null });
      try {
        const loaded = await loadNormalizedGLBCharacter(targetUrl, 1.55);
        // 로딩 중에 다른 모델이 요청되었거나 컴포넌트가 해제되었다면 결과를 즉시 폐기
        if (token !== glbLoadToken) {
          loaded.mixer?.stopAllAction();
          disposeObject3D(loaded.wrapper);
          return;
        }
        activeGLBChar = loaded;
        lumi.customModelSlot.add(loaded.wrapper);
        lumi.customModelSlot.visible = true;
        lumi.defaultMeshGroup.visible = false;
        callbacksRef.current.onModelLoadStatus?.({ loading: false, error: null });
      } catch {
        if (token !== glbLoadToken) return;
        lumi.customModelSlot.visible = false;
        lumi.defaultMeshGroup.visible = true;
        callbacksRef.current.onModelLoadStatus?.({
          loading: false,
          error: 'GLB 모델을 불러오지 못해 기본 캐릭터(루미)로 표시합니다.',
        });
      }
    };

    const dropShadow = createDropShadowRing();
    scene.add(dropShadow);

    // Pooled Burst Particles (Lightweight 14-particle pool)
    const particlePool: BurstParticle[] = [];
    const partGeo = new THREE.OctahedronGeometry(0.14, 0);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const mesh = new THREE.Mesh(partGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      particlePool.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.6,
      });
    }

    const spawnBurst = (
      x: number,
      y: number,
      z: number,
      colorHex: number,
      count = 10
    ) => {
      let spawned = 0;
      for (const p of particlePool) {
        if (p.life <= 0) {
          p.mesh.visible = true;
          p.mesh.position.set(x, y, z);
          (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
          const a = (spawned / count) * Math.PI * 2;
          const spd = 2.4 + (spawned % 3) * 1.1;
          p.vel.set(
            Math.cos(a) * spd,
            3.2 + (spawned % 2) * 1.5,
            Math.sin(a) * spd
          );
          p.maxLife = 0.55;
          p.life = p.maxLife;
          spawned++;
          if (spawned >= count) break;
        }
      }
    };

    // Level Group Container
    const levelGroup = new THREE.Group();
    scene.add(levelGroup);

    let staticBoxes: ActivePlatformBox[] = [];
    let movingBoxes: ActivePlatformBox[] = [];
    let beamHazards: ActiveBeamHazard[] = [];
    let damageZones: DamageZoneSpec[] = [];
    let jumpPads: ActiveJumpPad[] = [];
    let timedHazardTiles: ActiveTimedHazardTile[] = [];
    let goldenKeyObj: ReturnType<typeof createGoldenKeyMesh> | null = null;
    let exitPortalObj: ReturnType<typeof createExitPortalMesh> | null = null;

    // Player & Simulation State
    const sim = {
      floorElapsedTime: 0,
      playerPos: new THREE.Vector3(0, 0, 0),
      playerVel: new THREE.Vector3(0, 0, 0),
      playerYaw: 0,
      cameraYaw: 0,
      cameraPitch: 0,
      manualCameraCooldown: 0,
      guideYawTarget: null as number | null,
      isGrounded: true,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      standingPlatform: null as ActivePlatformBox | null,
      hasKey: false,
      checkpointPos: [0, 0, 0] as [number, number, number],
      invincibleTimer: 0,
      shakeTimer: 0,
      squashScaleY: 1,
      walkCycle: 0,
      isMovingHorizontally: false,
      portalNoticeCooldown: 0,
      lastHandledJumpPress: 0,
      lastHandledAlignPress: 0,
    };

    const buildFloorScene = (floorNum: number) => {
      // 이전 층 오브젝트를 씬에서 제거한 뒤 GPU 메모리(Geometry/Material)까지 해제
      // (공유 캐시 재질·텍스처는 markShared 표시로 보존되어 다음 층에서 재사용)
      while (levelGroup.children.length > 0) {
        const child = levelGroup.children[0];
        levelGroup.remove(child);
        disposeObject3D(child);
      }
      goldenKeyObj = null;
      exitPortalObj = null;

      const bp = getFloorBlueprint(floorNum);
      staticBoxes = [];
      movingBoxes = [];
      beamHazards = [];
      damageZones = bp.damageZones ? [...bp.damageZones] : [];
      jumpPads = [];
      timedHazardTiles = [];

      // Update Floor Sky Time-of-Day Theme (1층/3층: 맑은 낮, 2층: 황금 노을, 4층: 별빛 밤하늘)
      skyEnv.setTheme(bp.skyTheme, scene, dirLight, hemiLight);

      // 1. Static Textured Platforms
      for (const sp of bp.staticPlatforms) {
        const mesh = createPlatformMesh(sp.size, sp.theme);
        mesh.position.set(sp.position[0], sp.position[1], sp.position[2]);
        levelGroup.add(mesh);
        staticBoxes.push({
          id: sp.id,
          mesh,
          center: [...sp.position],
          prevCenter: [...sp.position],
          size: [...sp.size],
        });
      }

      // 2. Deterministic Moving Platforms
      for (const mp of bp.movingPlatforms) {
        const initialPos: [number, number, number] = [0, 0, 0];
        evaluateMovingPlatformPos(mp, 0, initialPos);
        const mesh = createPlatformMesh(mp.size, mp.theme ?? 'emerald');
        mesh.position.set(initialPos[0], initialPos[1], initialPos[2]);
        levelGroup.add(mesh);
        movingBoxes.push({
          id: mp.id,
          mesh,
          center: [...initialPos],
          prevCenter: [...initialPos],
          size: [...mp.size],
          spec: mp,
        });
      }

      // 3. Deterministic Rotating Beams
      for (const rb of bp.rotatingBeams) {
        const { root, spinner } = createRotatingBeamMesh(
          rb.radius,
          rb.beamHeightOffset,
          rb.armType
        );
        root.position.set(rb.center[0], rb.center[1], rb.center[2]);
        spinner.rotation.y = rb.initialAngle;
        levelGroup.add(root);
        beamHazards.push({
          spec: rb,
          root,
          spinner,
          currentAngle: rb.initialAngle,
        });
      }

      // 4. Fixed Spike / Lava Damage Floor Zones
      for (const dz of damageZones) {
        const dzMesh = createDamageZoneMesh(dz.size);
        dzMesh.position.set(dz.position[0], dz.position[1], dz.position[2]);
        levelGroup.add(dzMesh);
      }

      // 4.5. Super Jump Buttons (Jump Pads)
      if (bp.jumpPads) {
        for (const jp of bp.jumpPads) {
          const { root, buttonCap, pulseRing } = createJumpPadMesh(
            jp.radius ?? 0.76
          );
          root.position.set(jp.position[0], jp.position[1], jp.position[2]);
          levelGroup.add(root);
          jumpPads.push({
            spec: jp,
            root,
            buttonCap,
            pulseRing,
            bounceTimer: 0,
            cooldown: 0,
          });
        }
      }

      // 4.6. Timed Alternating Hazard Tiles (2-split 3:1:2 Green/Yellow/Red)
      if (bp.timedHazardTiles) {
        for (const th of bp.timedHazardTiles) {
          const { root, setZoneStates } = createTimedHazardTileMesh(
            th.size,
            th.splitAxis
          );
          root.position.set(th.position[0], th.position[1], th.position[2]);
          const initialStates = evaluateTimedHazardTileStates(th, 0);
          setZoneStates(initialStates.zone1, initialStates.zone2);
          levelGroup.add(root);
          timedHazardTiles.push({
            spec: th,
            root,
            setZoneStates,
            zone1State: initialStates.zone1,
            zone2State: initialStates.zone2,
          });
        }
      }

      // 5. Single Golden Key
      goldenKeyObj = createGoldenKeyMesh();
      goldenKeyObj.root.position.set(
        bp.keyPosition[0],
        bp.keyPosition[1],
        bp.keyPosition[2]
      );
      levelGroup.add(goldenKeyObj.root);

      // 6. Exit Portal (align wide arch front perpendicular to the player's approach direction)
      exitPortalObj = createExitPortalMesh();
      exitPortalObj.root.position.set(
        bp.portalPosition[0],
        bp.portalPosition[1],
        bp.portalPosition[2]
      );
      const approachDx = bp.portalPosition[0] - bp.keyCheckpointSpawn[0];
      const approachDz = bp.portalPosition[2] - bp.keyCheckpointSpawn[2];
      const autoPortalYaw = Math.atan2(-approachDx, -approachDz);
      exitPortalObj.root.rotation.y = bp.portalYaw ?? autoPortalYaw;
      exitPortalObj.setUnlocked(false);
      levelGroup.add(exitPortalObj.root);

      // Reset deterministic simulation clock, player state & touch joystick state
      touchInputRef.current.right = 0;
      touchInputRef.current.forward = 0;
      touchInputRef.current.jumpHeld = false;
      touchInputRef.current.lookYawDelta = 0;
      touchInputRef.current.lookPitchDelta = 0;
      touchInputRef.current.isDraggingCamera = false;

      sim.floorElapsedTime = 0;
      sim.hasKey = false;
      sim.checkpointPos = [...bp.spawnPoint];
      sim.playerPos.set(bp.spawnPoint[0], bp.spawnPoint[1], bp.spawnPoint[2]);
      sim.playerVel.set(0, 0, 0);
      sim.playerYaw = 0;
      sim.cameraYaw = 0;
      sim.cameraPitch = 0;
      sim.manualCameraCooldown = 0;
      sim.guideYawTarget = null;
      sim.isGrounded = true;
      sim.coyoteTimer = 0.16;
      sim.jumpBufferTimer = 0;
      sim.standingPlatform = null;
      sim.invincibleTimer = 1.0;
      sim.shakeTimer = 0;
      sim.squashScaleY = 1;
      sim.isMovingHorizontally = false;
      sim.portalNoticeCooldown = 0;

      lumi.root.position.copy(sim.playerPos);
      lumi.root.rotation.y = 0;

      renderer.compile(scene, camera);
    };

    const heldKeys: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (
          statusRef.current === 'PLAYING' ||
          statusRef.current === 'PAUSED'
        ) {
          e.preventDefault();
          callbacksRef.current.onTogglePause();
        }
        return;
      }

      if (e.code === 'Space' && !heldKeys['Space']) {
        sim.jumpBufferTimer = 0.18;
      }

      if ((e.code === 'KeyE' || e.code === 'KeyC') && !heldKeys[e.code]) {
        touchInputRef.current.alignCameraAt = performance.now();
      }

      heldKeys[e.code] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys[e.code] = false;
    };

    const onBlur = () => {
      for (const k of Object.keys(heldKeys)) {
        heldKeys[k] = false;
      }
      touchInputRef.current.right = 0;
      touchInputRef.current.forward = 0;
      touchInputRef.current.jumpHeld = false;
      touchInputRef.current.lookYawDelta = 0;
      touchInputRef.current.lookPitchDelta = 0;
      touchInputRef.current.isDraggingCamera = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const onResize = () => {
      updateRenderResolution();
    };
    window.addEventListener('resize', onResize);

    const distToSegment2D = (
      px: number,
      pz: number,
      ax: number,
      az: number,
      bx: number,
      bz: number
    ): number => {
      const vx = bx - ax;
      const vz = bz - az;
      const wx = px - ax;
      const wz = pz - az;
      const c1 = vx * wx + vz * wz;
      if (c1 <= 0) return Math.hypot(px - ax, pz - az);
      const c2 = vx * vx + vz * vz;
      if (c2 <= c1) return Math.hypot(px - bx, pz - bz);
      const b = c1 / c2;
      const projX = ax + b * vx;
      const projZ = az + b * vz;
      return Math.hypot(px - projX, pz - projZ);
    };

    const clock = new THREE.Clock();
    let animFrameId = 0;
    let frameAccumulator = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);

      const rawDelta = clock.getDelta();
      frameAccumulator += rawDelta;

      // Apply immediate resolution switch if user toggled lowResMode
      if (perfConfigRef.current.needsResize) {
        perfConfigRef.current.needsResize = false;
        updateRenderResolution();
      }

      // 30 FPS Frame Limiter: skip rendering until ~32.5ms has elapsed
      const minFrameInterval = perfConfigRef.current.fps30Cap ? 1 / 30.8 : 0;
      if (frameAccumulator < minFrameInterval) {
        return;
      }

      const dt = Math.min(frameAccumulator, 0.065);
      frameAccumulator = 0;

      if (floorLoadRequestRef.current.needsRebuild) {
        floorLoadRequestRef.current.needsRebuild = false;
        buildFloorScene(floorLoadRequestRef.current.floor);
      }

      if (customModelRequestRef.current.needsUpdate) {
        customModelRequestRef.current.needsUpdate = false;
        applyCustomGLBModel(customModelRequestRef.current.url);
      }

      const bp = getFloorBlueprint(floorLoadRequestRef.current.floor);
      const currentStatus = statusRef.current;

      if (touchInputRef.current.jumpPressedAt > sim.lastHandledJumpPress) {
        sim.lastHandledJumpPress = touchInputRef.current.jumpPressedAt;
        sim.jumpBufferTimer = 0.18;
      }

      if (touchInputRef.current.alignCameraAt > sim.lastHandledAlignPress) {
        sim.lastHandledAlignPress = touchInputRef.current.alignCameraAt;
        const targetCoords = sim.hasKey ? bp.portalPosition : bp.keyPosition;
        const dx = targetCoords[0] - sim.playerPos.x;
        const dz = targetCoords[2] - sim.playerPos.z;
        sim.cameraYaw = Math.atan2(-dx, -dz);
        sim.cameraPitch = 0;
        sim.playerYaw = sim.cameraYaw;
        sim.guideYawTarget = null;
        sim.manualCameraCooldown = 0;
        soundFX.playClick();
      }

      // Consume right-half screen camera drag deltas (Yaw + Pitch)
      if (
        touchInputRef.current.lookYawDelta !== 0 ||
        touchInputRef.current.lookPitchDelta !== 0
      ) {
        sim.cameraYaw += touchInputRef.current.lookYawDelta;
        sim.cameraPitch = THREE.MathUtils.clamp(
          sim.cameraPitch + touchInputRef.current.lookPitchDelta,
          -0.28,
          0.68
        );
        touchInputRef.current.lookYawDelta = 0;
        touchInputRef.current.lookPitchDelta = 0;
        sim.guideYawTarget = null;
        sim.manualCameraCooldown = 2.2;
      }

      if (currentStatus !== 'PLAYING') {
        // Ensure joystick never stays stuck when entering gate or modal
        touchInputRef.current.right = 0;
        touchInputRef.current.forward = 0;
        touchInputRef.current.jumpHeld = false;
      }

      if (currentStatus === 'PLAYING') {
        sim.floorElapsedTime += dt;

        if (sim.invincibleTimer > 0) {
          sim.invincibleTimer = Math.max(0, sim.invincibleTimer - dt);
        }
        if (sim.shakeTimer > 0) {
          sim.shakeTimer = Math.max(0, sim.shakeTimer - dt);
        }
        if (sim.portalNoticeCooldown > 0) {
          sim.portalNoticeCooldown = Math.max(0, sim.portalNoticeCooldown - dt);
        }
        if (sim.manualCameraCooldown > 0 && !touchInputRef.current.isDraggingCamera) {
          sim.manualCameraCooldown = Math.max(0, sim.manualCameraCooldown - dt);
        }

        // 1. Update Deterministic Moving Platforms
        for (const mp of movingBoxes) {
          if (!mp.spec) continue;
          mp.prevCenter[0] = mp.center[0];
          mp.prevCenter[1] = mp.center[1];
          mp.prevCenter[2] = mp.center[2];

          evaluateMovingPlatformPos(mp.spec, sim.floorElapsedTime, mp.center);
          mp.mesh.position.set(mp.center[0], mp.center[1], mp.center[2]);
        }

        if (sim.isGrounded && sim.standingPlatform) {
          const p = sim.standingPlatform;
          const dx = p.center[0] - p.prevCenter[0];
          const dy = p.center[1] - p.prevCenter[1];
          const dz = p.center[2] - p.prevCenter[2];
          sim.playerPos.x += dx;
          sim.playerPos.y += dy;
          sim.playerPos.z += dz;
        }

        // 2. Update Deterministic Rotating Beams
        for (const bh of beamHazards) {
          bh.currentAngle = evaluateRotatingBeamAngle(
            bh.spec,
            sim.floorElapsedTime
          );
          bh.spinner.rotation.y = bh.currentAngle;
        }

        // 2.5 Update Timed Alternating Hazard Tiles (3:1:2 Green -> Yellow -> Red)
        for (const th of timedHazardTiles) {
          const states = evaluateTimedHazardTileStates(
            th.spec,
            sim.floorElapsedTime
          );
          th.zone1State = states.zone1;
          th.zone2State = states.zone2;
          th.setZoneStates(states.zone1, states.zone2);
        }

        // 3. Combine Touch Joystick + Keyboard Input
        let inputRight = touchInputRef.current.right;
        let inputForward = touchInputRef.current.forward;

        if (heldKeys['KeyA'] || heldKeys['ArrowLeft']) inputRight -= 1;
        if (heldKeys['KeyD'] || heldKeys['ArrowRight']) inputRight += 1;
        if (heldKeys['KeyW'] || heldKeys['ArrowUp']) inputForward += 1;
        if (heldKeys['KeyS'] || heldKeys['ArrowDown']) inputForward -= 1;

        const inputMag = Math.hypot(inputRight, inputForward);
        if (inputMag > 1) {
          inputRight /= inputMag;
          inputForward /= inputMag;
        }

        const moveSpeed = 6.6;
        const sinYaw = Math.sin(sim.cameraYaw);
        const cosYaw = Math.cos(sim.cameraYaw);

        const worldMoveX = -sinYaw * inputForward + cosYaw * inputRight;
        const worldMoveZ = -cosYaw * inputForward - sinYaw * inputRight;

        sim.playerVel.x = THREE.MathUtils.damp(
          sim.playerVel.x,
          worldMoveX * moveSpeed,
          12,
          dt
        );
        sim.playerVel.z = THREE.MathUtils.damp(
          sim.playerVel.z,
          worldMoveZ * moveSpeed,
          12,
          dt
        );

        // Smoothly guide camera yaw toward exit portal when key is collected at an L-corner
        if (sim.guideYawTarget !== null) {
          let gDiff = sim.guideYawTarget - sim.cameraYaw;
          while (gDiff > Math.PI) gDiff -= Math.PI * 2;
          while (gDiff < -Math.PI) gDiff += Math.PI * 2;
          sim.cameraYaw += gDiff * Math.min(1, dt * 6.0);
          sim.playerYaw = sim.cameraYaw;
          if (Math.abs(gDiff) < 0.04) {
            sim.cameraYaw = sim.guideYawTarget;
            sim.guideYawTarget = null;
          }
        }

        if (Math.hypot(worldMoveX, worldMoveZ) > 0.12) {
          sim.isMovingHorizontally = true;
          const targetYaw = Math.atan2(-worldMoveX, -worldMoveZ);
          let diff = targetYaw - sim.playerYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          sim.playerYaw += diff * Math.min(1, dt * 12);

          if (
            sim.guideYawTarget === null &&
            !touchInputRef.current.isDraggingCamera &&
            sim.manualCameraCooldown <= 0
          ) {
            let camDiff = targetYaw - sim.cameraYaw;
            while (camDiff > Math.PI) camDiff -= Math.PI * 2;
            while (camDiff < -Math.PI) camDiff += Math.PI * 2;
            if (inputForward >= -0.1) {
              sim.cameraYaw += camDiff * Math.min(1, dt * 1.65);
            }
          }
          sim.walkCycle += dt * 12;
        } else {
          sim.isMovingHorizontally = false;
          sim.walkCycle = 0;
        }

        // 4. Jump & Coyote Time Physics (Sub-stepped at 30FPS for identical jump arc)
        if (sim.isGrounded) {
          sim.coyoteTimer = 0.18;
        } else {
          sim.coyoteTimer = Math.max(0, sim.coyoteTimer - dt);
        }

        if (sim.jumpBufferTimer > 0) {
          sim.jumpBufferTimer = Math.max(0, sim.jumpBufferTimer - dt);
        }

        if (sim.jumpBufferTimer > 0 && sim.coyoteTimer > 0) {
          sim.playerVel.y = 9.6;
          sim.isGrounded = false;
          sim.coyoteTimer = 0;
          sim.jumpBufferTimer = 0;
          sim.standingPlatform = null;
          sim.squashScaleY = 1.28;
          soundFX.playJump();
          spawnBurst(
            sim.playerPos.x,
            sim.playerPos.y + 0.1,
            sim.playerPos.z,
            0xe0f2fe,
            6
          );
        }

        const gravity = -22.5;
        const prevY = sim.playerPos.y;
        // Midpoint integration so 30FPS and 60FPS produce identical jump height
        sim.playerPos.x += sim.playerVel.x * dt;
        sim.playerPos.y += (sim.playerVel.y + 0.5 * gravity * dt) * dt;
        sim.playerPos.z += sim.playerVel.z * dt;
        sim.playerVel.y += gravity * dt;

        // 5. Platform Landing & Support Check
        const allPlatforms = [...staticBoxes, ...movingBoxes];
        let landedPlatform: ActivePlatformBox | null = null;
        let highestSurfaceBeneath = -999;

        const playerFootRadius = 0.34;
        for (const plat of allPlatforms) {
          const halfW = plat.size[0] / 2 + playerFootRadius;
          const halfD = plat.size[2] / 2 + playerFootRadius;
          const surfaceY = plat.center[1];

          if (
            Math.abs(sim.playerPos.x - plat.center[0]) <= halfW &&
            Math.abs(sim.playerPos.z - plat.center[2]) <= halfD
          ) {
            if (
              surfaceY <= sim.playerPos.y + 0.35 &&
              surfaceY > highestSurfaceBeneath
            ) {
              highestSurfaceBeneath = surfaceY;
            }

            if (
              sim.playerVel.y <= 0 &&
              prevY >= surfaceY - 0.3 &&
              sim.playerPos.y <= surfaceY + 0.15
            ) {
              if (!landedPlatform || surfaceY > landedPlatform.center[1]) {
                landedPlatform = plat;
              }
            }
          }
        }

        if (landedPlatform) {
          if (!sim.isGrounded && sim.playerVel.y < -3.0) {
            sim.squashScaleY = 0.76;
            soundFX.playLand();
          }
          sim.playerPos.y = landedPlatform.center[1];
          sim.playerVel.y = 0;
          sim.isGrounded = true;
          sim.standingPlatform = landedPlatform;
        } else {
          sim.isGrounded = false;
          sim.standingPlatform = null;
        }

        if (highestSurfaceBeneath > -100) {
          dropShadow.visible = true;
          dropShadow.position.set(
            sim.playerPos.x,
            highestSurfaceBeneath + 0.03,
            sim.playerPos.z
          );
          const heightGap = Math.max(0, sim.playerPos.y - highestSurfaceBeneath);
          const shadowScale = Math.max(0.45, 1 - heightGap * 0.12);
          dropShadow.scale.set(shadowScale, shadowScale, shadowScale);
        } else {
          dropShadow.visible = false;
        }

        // 5.5 Super Jump Button (Jump Pad) Trigger: stepping on a button launches 3x jump height
        for (const pad of jumpPads) {
          if (pad.cooldown > 0) {
            pad.cooldown = Math.max(0, pad.cooldown - dt);
          }
          const padRadius = (pad.spec.radius ?? 0.76) + 0.16;
          const dx = sim.playerPos.x - pad.spec.position[0];
          const dz = sim.playerPos.z - pad.spec.position[2];
          const surfY = pad.spec.position[1];
          if (
            pad.cooldown <= 0 &&
            Math.hypot(dx, dz) <= padRadius &&
            sim.playerPos.y >= surfY - 0.18 &&
            sim.playerPos.y <= surfY + 0.38
          ) {
            sim.playerVel.y = pad.spec.boostVelocityY ?? 18.5;
            sim.isGrounded = false;
            sim.coyoteTimer = 0;
            sim.jumpBufferTimer = 0;
            sim.standingPlatform = null;
            sim.squashScaleY = 1.42;
            pad.cooldown = 0.25;
            pad.bounceTimer = 0.36;
            soundFX.playSpringJump();
            spawnBurst(
              pad.spec.position[0],
              pad.spec.position[1] + 0.28,
              pad.spec.position[2],
              0x22d3ee,
              10
            );
            break;
          }
        }

        // 6. Rotating Beam Hazard Collision Check
        if (sim.invincibleTimer <= 0) {
          for (const bh of beamHazards) {
            const beamY = bh.spec.center[1] + bh.spec.beamHeightOffset;
            if (
              sim.playerPos.y < beamY + 0.26 &&
              sim.playerPos.y + 1.0 > beamY - 0.22
            ) {
              const cosA = Math.cos(-bh.currentAngle);
              const sinA = Math.sin(-bh.currentAngle);
              const r = bh.spec.radius;

              const bx = bh.spec.center[0] + cosA * r;
              const bz = bh.spec.center[2] + sinA * r;
              const ax =
                bh.spec.armType === 'double'
                  ? bh.spec.center[0] - cosA * r
                  : bh.spec.center[0];
              const az =
                bh.spec.armType === 'double'
                  ? bh.spec.center[2] - sinA * r
                  : bh.spec.center[2];

              const dist = distToSegment2D(
                sim.playerPos.x,
                sim.playerPos.z,
                ax,
                az,
                bx,
                bz
              );

              if (dist < 0.48) {
                soundFX.playHurt();
                sim.invincibleTimer = 1.6;
                sim.shakeTimer = 0.35;
                sim.playerVel.y = 6.2;
                const pushX = sim.playerPos.x - bh.spec.center[0];
                const pushZ = sim.playerPos.z - bh.spec.center[2];
                const pushLen = Math.hypot(pushX, pushZ) || 1;
                sim.playerVel.x = (pushX / pushLen) * 5.5;
                sim.playerVel.z = (pushZ / pushLen) * 5.5;
                spawnBurst(
                  sim.playerPos.x,
                  sim.playerPos.y + 0.6,
                  sim.playerPos.z,
                  0xf43f5e,
                  10
                );
                callbacksRef.current.onLoseHeart();
                break;
              }
            }
          }
        }

        // 6.5 Fixed Spike / Lava Damage Floor Zone Collision Check
        if (sim.invincibleTimer <= 0) {
          for (const dz of damageZones) {
            const halfW = dz.size[0] / 2 + 0.14;
            const halfD = dz.size[1] / 2 + 0.14;
            const surfY = dz.position[1];
            if (
              Math.abs(sim.playerPos.x - dz.position[0]) <= halfW &&
              Math.abs(sim.playerPos.z - dz.position[2]) <= halfD &&
              sim.playerPos.y >= surfY - 0.15 &&
              sim.playerPos.y <= surfY + 0.36
            ) {
              soundFX.playHurt();
              sim.invincibleTimer = 1.6;
              sim.shakeTimer = 0.35;
              sim.playerVel.y = 6.8;
              sim.isGrounded = false;
              sim.standingPlatform = null;
              spawnBurst(
                sim.playerPos.x,
                sim.playerPos.y + 0.35,
                sim.playerPos.z,
                0xf97316,
                10
              );
              callbacksRef.current.onLoseHeart();
              break;
            }
          }
        }

        // 6.6 Timed Alternating Hazard Tile Collision Check (Damage only when active zone is 'red')
        if (sim.invincibleTimer <= 0) {
          for (const th of timedHazardTiles) {
            const halfW = th.spec.size[0] / 2 - 0.12;
            const halfD = th.spec.size[1] / 2 - 0.12;
            const surfY = th.spec.position[1];
            const relX = sim.playerPos.x - th.spec.position[0];
            const relZ = sim.playerPos.z - th.spec.position[2];

            if (
              Math.abs(relX) <= halfW &&
              Math.abs(relZ) <= halfD &&
              sim.playerPos.y >= surfY - 0.15 &&
              sim.playerPos.y <= surfY + 0.36
            ) {
              const activeZoneState =
                th.spec.splitAxis === 'z'
                  ? relZ >= 0
                    ? th.zone1State
                    : th.zone2State
                  : relX >= 0
                  ? th.zone1State
                  : th.zone2State;

              if (activeZoneState === 'red') {
                soundFX.playHurt();
                sim.invincibleTimer = 1.6;
                sim.shakeTimer = 0.35;
                sim.playerVel.y = 6.8;
                sim.isGrounded = false;
                sim.standingPlatform = null;
                spawnBurst(
                  sim.playerPos.x,
                  sim.playerPos.y + 0.35,
                  sim.playerPos.z,
                  0xef4444,
                  10
                );
                callbacksRef.current.onLoseHeart();
                break;
              }
            }
          }
        }

        // 7. Fall Out of Bounds Check
        if (sim.playerPos.y < bp.fallLimitY) {
          soundFX.playHurt();
          sim.invincibleTimer = 1.6;
          sim.shakeTimer = 0.3;
          sim.playerPos.set(
            sim.checkpointPos[0],
            sim.checkpointPos[1] + 0.4,
            sim.checkpointPos[2]
          );
          sim.playerVel.set(0, 0, 0);
          // Re-align camera toward current objective (key or portal) on respawn
          const nextObj = sim.hasKey ? bp.portalPosition : bp.keyPosition;
          const rdx = nextObj[0] - sim.checkpointPos[0];
          const rdz = nextObj[2] - sim.checkpointPos[2];
          sim.cameraYaw = Math.atan2(-rdx, -rdz);
          sim.playerYaw = sim.cameraYaw;
          callbacksRef.current.onLoseHeart();
        }

        // 8. Golden Key Collection Check (Auto-guides camera around L-shaped corner!)
        if (!sim.hasKey && goldenKeyObj) {
          const distToKey = Math.hypot(
            sim.playerPos.x - bp.keyPosition[0],
            sim.playerPos.y + 0.6 - bp.keyPosition[1],
            sim.playerPos.z - bp.keyPosition[2]
          );
          if (distToKey < 1.45) {
            sim.hasKey = true;
            sim.checkpointPos = [...bp.keyCheckpointSpawn];
            goldenKeyObj.root.visible = false;
            exitPortalObj?.setUnlocked(true);
            soundFX.playKeyCollect();

            // Smoothly rotate camera toward the Exit Portal (especially helpful on L-shaped Floors 3 & 4)
            const pdx = bp.portalPosition[0] - sim.playerPos.x;
            const pdz = bp.portalPosition[2] - sim.playerPos.z;
            sim.guideYawTarget = Math.atan2(-pdx, -pdz);

            spawnBurst(
              bp.keyPosition[0],
              bp.keyPosition[1],
              bp.keyPosition[2],
              0xfacc15,
              12
            );
            callbacksRef.current.onCollectKey();
          }
        }

        // 9. Exit Portal Reach Check
        const distToPortal = Math.hypot(
          sim.playerPos.x - bp.portalPosition[0],
          sim.playerPos.y - bp.portalPosition[1],
          sim.playerPos.z - bp.portalPosition[2]
        );
        if (distToPortal < 1.65) {
          if (sim.hasKey) {
            // Immediately clear joystick state upon entering exit gate
            touchInputRef.current.right = 0;
            touchInputRef.current.forward = 0;
            touchInputRef.current.jumpHeld = false;
            sim.playerVel.set(0, 0, 0);
            sim.isMovingHorizontally = false;

            soundFX.playFloorClear();
            spawnBurst(
              bp.portalPosition[0],
              bp.portalPosition[1] + 1.2,
              bp.portalPosition[2],
              0x22d3ee,
              14
            );
            callbacksRef.current.onFloorClear();
          } else if (sim.portalNoticeCooldown <= 0) {
            sim.portalNoticeCooldown = 2.0;
            callbacksRef.current.onPortalLockedNotice();
          }
        }
      }

      // Animate Lumi Character Rig (or loaded GLB Character)
      sim.squashScaleY = THREE.MathUtils.damp(sim.squashScaleY, 1.0, 14, dt);
      const xzScale = 1 / Math.sqrt(sim.squashScaleY);
      lumi.bodyGroup.scale.set(xzScale, sim.squashScaleY, xzScale);

      lumi.root.position.copy(sim.playerPos);
      lumi.root.rotation.y = sim.playerYaw;

      if (activeGLBChar) {
        updateGLBCharacterAnimation(
          activeGLBChar,
          dt,
          sim.isMovingHorizontally,
          sim.isGrounded,
          sim.walkCycle
        );
      } else {
        const swing = Math.sin(sim.walkCycle) * 0.55;
        lumi.leftLeg.rotation.x = swing;
        lumi.rightLeg.rotation.x = -swing;
        lumi.leftArm.rotation.x = -swing * 0.8;
        lumi.rightArm.rotation.x = swing * 0.8;
        lumi.windupKey.rotation.z += dt * (sim.walkCycle > 0 ? 6.0 : 1.8);
        lumi.antennaBulb.rotation.y += dt * 2.5;
        lumi.scarfTail.rotation.x =
          0.38 +
          (sim.isMovingHorizontally
            ? 0.35 + Math.sin(sim.walkCycle * 2) * 0.18
            : 0);
      }

      if (sim.invincibleTimer > 0 && currentStatus === 'PLAYING') {
        lumi.shieldBubble.visible =
          Math.floor(sim.invincibleTimer * 12) % 2 === 0;
      } else {
        lumi.shieldBubble.visible = false;
      }

      const t = clock.getElapsedTime();
      skyEnv.update(t, dt, sim.playerPos);

      if (goldenKeyObj && goldenKeyObj.root.visible) {
        goldenKeyObj.keyBody.rotation.y = t * 2.2;
        goldenKeyObj.keyBody.position.y = Math.sin(t * 3.2) * 0.16;
        const pulse = 1 + Math.sin(t * 4) * 0.08;
        goldenKeyObj.haloRing.scale.set(pulse, pulse, 1);
      }
      if (exitPortalObj) {
        exitPortalObj.outerRing.rotation.z = t * 1.4;
        exitPortalObj.innerVortex.scale.setScalar(
          1 + Math.sin(t * 3.5) * 0.04
        );
      }

      for (const pad of jumpPads) {
        const ringPulse = 1 + Math.sin(t * 5.2) * 0.08;
        pad.pulseRing.scale.set(ringPulse, ringPulse, 1);
        if (pad.bounceTimer > 0) {
          pad.bounceTimer = Math.max(0, pad.bounceTimer - dt);
          const prog = 1 - pad.bounceTimer / 0.36;
          pad.buttonCap.position.y =
            0.26 + Math.sin(prog * Math.PI * 2.5) * 0.14 * (1 - prog);
        } else {
          pad.buttonCap.position.y = 0.26;
        }
      }

      for (const p of particlePool) {
        if (p.life > 0) {
          p.life -= dt;
          if (p.life <= 0) {
            p.mesh.visible = false;
          } else {
            p.vel.y -= 9.8 * dt;
            p.mesh.position.addScaledVector(p.vel, dt);
            p.mesh.rotation.x += dt * 5;
            p.mesh.rotation.y += dt * 5;
            const s = Math.max(0.01, p.life / p.maxLife);
            p.mesh.scale.setScalar(s);
          }
        }
      }

      if (currentStatus === 'TITLE') {
        const orbitAngle = t * 0.22;
        _camTargetPos.set(
          Math.sin(orbitAngle) * 11,
          5.8,
          Math.cos(orbitAngle) * 9 - 8
        );
        _camLookTarget.set(0, 2.0, -16);
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-4 * dt));
        camera.lookAt(_camLookTarget);
      } else {
        const pitch = sim.cameraPitch;
        const camDist = 6.8 * Math.cos(pitch * 0.65);
        const camHeight = 3.85 + Math.sin(pitch) * 3.5;
        const sinCam = Math.sin(sim.cameraYaw);
        const cosCam = Math.cos(sim.cameraYaw);

        _camTargetPos.set(
          sim.playerPos.x + sinCam * camDist,
          sim.playerPos.y + camHeight,
          sim.playerPos.z + cosCam * camDist
        );

        if (sim.shakeTimer > 0) {
          _camTargetPos.x += (Math.random() - 0.5) * 0.35;
          _camTargetPos.y += (Math.random() - 0.5) * 0.35;
        }

        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          _camTargetPos.x,
          8,
          dt
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          _camTargetPos.y,
          7,
          dt
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          _camTargetPos.z,
          8,
          dt
        );

        _camLookTarget.set(
          sim.playerPos.x - sinCam * 2.6,
          sim.playerPos.y + 1.15 - Math.sin(pitch) * 0.9,
          sim.playerPos.z - cosCam * 2.6
        );
        camera.lookAt(_camLookTarget);
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);

      // 진행 중인 GLB 비동기 로딩 결과를 무효화하고 모든 GPU 자원 해제
      glbLoadToken++;
      releaseActiveGLBModel();
      scene.remove(levelGroup, lumi.root, dropShadow, skyEnv.root);
      disposeObject3D(levelGroup);
      disposeObject3D(lumi.root);
      disposeObject3D(dropShadow);
      disposeObject3D(skyEnv.root);
      for (const p of particlePool) {
        scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
      }
      partGeo.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [touchInputRef]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden z-0"
    />
  );
};
