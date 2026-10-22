import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  CheckCircle2,
  Gauge,
  Heart,
  KeyRound,
  Lock,
  Monitor,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Sunset,
  Unlock,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  GameStatus,
  TowerGameCanvas,
} from './components/TowerGameCanvas';
import { TouchControls, TouchInputRef } from './components/TouchControls';
import { getFloorBlueprint, TOWER_FLOORS } from './game/levels';
import {
  CHARACTER_PRESETS,
  CharacterPreset,
} from './game/characterLoader';
import {
  loadSaveData,
  recordFloorCleared,
  resetSaveData,
  SaveData,
  writeSaveData,
} from './game/saveManager';
import { soundFX } from './game/audio';
import { PWAInstallButton } from './pwa/PWAInstallButton';

const MAX_HEARTS = 3;

export default function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [gameStatus, setGameStatus] = useState<GameStatus>('TITLE');
  const [currentFloor, setCurrentFloor] = useState<number>(() => {
    const initial = loadSaveData();
    return Math.min(TOWER_FLOORS.length, initial.lastPlayedFloor || 1);
  });
  const [hearts, setHearts] = useState<number>(MAX_HEARTS);
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [attemptId, setAttemptId] = useState<number>(1);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [activeRenderSize, setActiveRenderSize] = useState<{
    width: number;
    height: number;
  }>({ width: 1000, height: 600 });

  // External GLB character model state (initialized from saved preset)
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(() => {
    const initial = loadSaveData();
    const preset =
      CHARACTER_PRESETS.find((p) => p.id === initial.selectedCharacterId) ??
      CHARACTER_PRESETS[0];
    return preset.modelFile
      ? `${import.meta.env.BASE_URL}${preset.modelFile}`
      : null;
  });
  const [customModelName, setCustomModelName] = useState<string | null>(() => {
    const initial = loadSaveData();
    const preset =
      CHARACTER_PRESETS.find((p) => p.id === initial.selectedCharacterId) ??
      CHARACTER_PRESETS[0];
    return `${preset.name} (${preset.role})`;
  });
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const touchInputRef = useRef<TouchInputRef>({
    right: 0,
    forward: 0,
    jumpPressedAt: 0,
    jumpHeld: false,
    alignCameraAt: 0,
    lookYawDelta: 0,
    lookPitchDelta: 0,
    isDraggingCamera: false,
  });

  useEffect(() => {
    soundFX.setMuted(saveData.isMuted);
  }, [saveData.isMuted]);

  const triggerNotice = useCallback((msg: string, durationMs = 2600) => {
    setBannerNotice(msg);
    const timer = window.setTimeout(() => {
      setBannerNotice((prev) => (prev === msg ? null : prev));
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSelectCharacterPreset = (preset: CharacterPreset) => {
    soundFX.playClick();
    if (customModelUrl && customModelUrl.startsWith('blob:')) {
      URL.revokeObjectURL(customModelUrl);
    }
    const nextUrl = preset.modelFile
      ? `${import.meta.env.BASE_URL}${preset.modelFile}`
      : null;
    setCustomModelUrl(nextUrl);
    setCustomModelName(`${preset.name} (${preset.role})`);
    const updated: SaveData = {
      ...saveData,
      selectedCharacterId: preset.id,
    };
    setSaveData(updated);
    writeSaveData(updated);
    triggerNotice(
      `출동 준비 완료! [${preset.name} · ${preset.role}] 대원으로 변경되었습니다!`,
      2600
    );
  };

  const handleGLBFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (customModelUrl && customModelUrl.startsWith('blob:')) {
      URL.revokeObjectURL(customModelUrl);
    }
    const blobUrl = URL.createObjectURL(file);
    setCustomModelUrl(blobUrl);
    setCustomModelName(file.name);
    const updated: SaveData = {
      ...saveData,
      selectedCharacterId: 'custom-upload',
    };
    setSaveData(updated);
    writeSaveData(updated);
    triggerNotice(`3D 캐릭터 모델(${file.name})을 불러왔습니다!`, 2800);
    e.target.value = '';
  };

  const handleResetToDefaultCharacter = () => {
    const defaultPreset =
      CHARACTER_PRESETS.find((p) => p.id === 'lumi-default') ??
      CHARACTER_PRESETS[CHARACTER_PRESETS.length - 1];
    handleSelectCharacterPreset(defaultPreset);
  };

  const handleModelLoadStatus = useCallback(
    (status: { loading: boolean; error: string | null }) => {
      setModelLoading(status.loading);
      if (status.error) {
        setCustomModelName(null);
        triggerNotice(status.error, 3200);
      }
    },
    [triggerNotice]
  );

  const handleResolutionReport = useCallback(
    (info: { width: number; height: number }) => {
      setActiveRenderSize((prev) =>
        prev.width === info.width && prev.height === info.height ? prev : info
      );
    },
    []
  );

  const handleToggleLowRes = () => {
    soundFX.playClick();
    const nextLowRes = !saveData.lowResMode;
    const updated: SaveData = { ...saveData, lowResMode: nextLowRes };
    setSaveData(updated);
    writeSaveData(updated);
    triggerNotice(
      nextLowRes
        ? '해상도 1000×600 초경량 모드가 적용되었습니다.'
        : '표준 화면 해상도 모드로 전환되었습니다.',
      2200
    );
  };

  const handleToggleFps30 = () => {
    soundFX.playClick();
    const nextFps30 = !saveData.fps30Cap;
    const updated: SaveData = { ...saveData, fps30Cap: nextFps30 };
    setSaveData(updated);
    writeSaveData(updated);
    triggerNotice(
      nextFps30
        ? '프레임이 30 FPS로 고정되어 발열과 렉을 줄입니다.'
        : '프레임 제한이 60 FPS로 변경되었습니다.',
      2200
    );
  };

  const startFloor = useCallback(
    (floorNumber: number) => {
      soundFX.playClick();
      // Reset touch joystick & camera drag state when starting any floor
      touchInputRef.current.right = 0;
      touchInputRef.current.forward = 0;
      touchInputRef.current.jumpHeld = false;
      touchInputRef.current.lookYawDelta = 0;
      touchInputRef.current.lookPitchDelta = 0;
      touchInputRef.current.isDraggingCamera = false;

      const blueprint = getFloorBlueprint(floorNumber);
      setCurrentFloor(floorNumber);
      setHearts(MAX_HEARTS);
      setHasKey(false);
      setAttemptId((prev) => prev + 1);
      setGameStatus('PLAYING');

      const updatedSave: SaveData = {
        ...saveData,
        lastPlayedFloor: floorNumber,
      };
      setSaveData(updatedSave);
      writeSaveData(updatedSave);

      triggerNotice(
        `${blueprint.title} 출발! 황금 열쇠 1개를 찾아 출구 포털로 가세요!`,
        3200
      );
    },
    [saveData, triggerNotice]
  );

  const handleCollectKey = useCallback(() => {
    setHasKey(true);
    triggerNotice(
      '황금 열쇠 획득 완료! 체크포인트가 저장되었고 출구 포털 방향으로 시점이 안내됩니다!',
      3400
    );
  }, [triggerNotice]);

  const handleLoseHeart = useCallback(() => {
    setHearts((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        soundFX.playFloorFail();
        setGameStatus('FLOOR_FAIL');
        return 0;
      }
      triggerNotice(
        `앗! 조심하세요! 남은 하트 ${next}개 (체크포인트에서 계속 도전합니다)`,
        2200
      );
      return next;
    });
  }, [triggerNotice]);

  const handleFloorClear = useCallback(() => {
    touchInputRef.current.right = 0;
    touchInputRef.current.forward = 0;
    touchInputRef.current.jumpHeld = false;
    touchInputRef.current.isDraggingCamera = false;
    setGameStatus((prev) => {
      if (prev === 'FLOOR_CLEAR') return prev;
      const updated = recordFloorCleared(
        saveData,
        currentFloor,
        TOWER_FLOORS.length
      );
      setSaveData(updated);
      return 'FLOOR_CLEAR';
    });
  }, [currentFloor, saveData]);

  const handleTogglePause = useCallback(() => {
    soundFX.playClick();
    setGameStatus((prev) => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED') return 'PLAYING';
      return prev;
    });
  }, []);

  const handlePortalLockedNotice = useCallback(() => {
    triggerNotice(
      '출구 포털이 잠겨 있어요! 먼저 층 중간에 있는 황금 열쇠 1개를 찾아오세요!',
      2500
    );
  }, [triggerNotice]);

  const handleToggleMute = () => {
    const nextMuted = !saveData.isMuted;
    soundFX.setMuted(nextMuted);
    const updated: SaveData = { ...saveData, isMuted: nextMuted };
    setSaveData(updated);
    writeSaveData(updated);
  };

  const handleToggleTestUnlock = () => {
    soundFX.playClick();
    const updated: SaveData = {
      ...saveData,
      testUnlockAll: !saveData.testUnlockAll,
    };
    setSaveData(updated);
    writeSaveData(updated);
  };

  const handleResetSave = () => {
    soundFX.playClick();
    const fresh = resetSaveData();
    setSaveData(fresh);
    setCurrentFloor(1);
    triggerNotice('저장된 진행 기록이 1층 초기 상태로 리셋되었습니다.', 2400);
  };

  useEffect(() => {
    if (gameStatus !== 'TITLE') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        startFloor(currentFloor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameStatus, currentFloor, startFloor]);

  const currentBlueprint = getFloorBlueprint(currentFloor);
  const hasNextFloor = currentFloor < TOWER_FLOORS.length;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none">
      {/* 숨겨진 GLB/GLTF 파일 업로드 Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={handleGLBFileChange}
        className="hidden"
      />

      {/* 3D WebGL Viewport */}
      <TowerGameCanvas
        gameStatus={gameStatus}
        currentFloor={currentFloor}
        attemptId={attemptId}
        customModelUrl={customModelUrl}
        lowResMode={saveData.lowResMode}
        fps30Cap={saveData.fps30Cap}
        touchInputRef={touchInputRef}
        onCollectKey={handleCollectKey}
        onLoseHeart={handleLoseHeart}
        onFloorClear={handleFloorClear}
        onTogglePause={handleTogglePause}
        onPortalLockedNotice={handlePortalLockedNotice}
        onModelLoadStatus={handleModelLoadStatus}
        onResolutionReport={handleResolutionReport}
      />

      {/* 상단 HUD (플레이 중에도 화면 85% 이상 개방, backdrop-filter 미사용) */}
      {gameStatus !== 'TITLE' && (
        <header className="fixed top-0 inset-x-0 z-20 pointer-events-none px-4 pt-3 sm:px-6 sm:pt-4 flex items-center justify-between gap-3">
          {/* 좌측: 하트 3개 체력 표시 */}
          <div className="pointer-events-auto flex items-center gap-2.5 bg-slate-900/85 border-2 border-white/20 rounded-2xl px-4 py-2 shadow-lg">
            <div className="flex items-center gap-1.5" aria-label={`남은 하트 ${hearts}개`}>
              {Array.from({ length: MAX_HEARTS }).map((_, idx) => {
                const active = idx < hearts;
                return (
                  <Heart
                    key={idx}
                    className={`w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-200 ${
                      active
                        ? 'text-rose-500 fill-rose-500 scale-100'
                        : 'text-slate-600 fill-slate-800 scale-90'
                    }`}
                  />
                );
              })}
            </div>
            <span className="text-sm sm:text-base font-extrabold text-white tabular-nums ml-1">
              {hearts} / {MAX_HEARTS}
            </span>
          </div>

          {/* 중앙: 현재 층 타이틀 및 열쇠 1개 상태 */}
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/85 border-2 border-white/20 rounded-2xl px-4 py-2 shadow-lg">
            <span className="text-sm sm:text-base font-black text-sky-300 whitespace-nowrap">
              {currentBlueprint.title}
            </span>
            <span className="text-white/30" aria-hidden="true">|</span>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <KeyRound
                className={`w-5 h-5 ${
                  hasKey
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-400'
                }`}
              />
              <span
                className={`text-xs sm:text-sm font-extrabold ${
                  hasKey ? 'text-amber-300' : 'text-slate-300'
                }`}
              >
                {hasKey ? '열쇠 획득! 출구로 이동' : '열쇠 0 / 1'}
              </span>
            </div>
          </div>

          {/* 우측: 현재 해상도·FPS 상태 표시 + 사운드 + 일시정지 버튼 */}
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 bg-slate-900/85 border border-emerald-400/40 rounded-2xl px-3 py-1.5 text-xs font-extrabold text-emerald-300 tabular-nums">
              <span>
                {activeRenderSize.width}×{activeRenderSize.height}
              </span>
              <span>·</span>
              <span>{saveData.fps30Cap ? '30FPS' : '60FPS'}</span>
            </div>

            {saveData.testUnlockAll && (
              <div className="hidden lg:flex items-center gap-1 bg-slate-900/85 border border-sky-400/40 rounded-2xl p-1">
                {TOWER_FLOORS.map((fl) => (
                  <button
                    key={fl.floorNumber}
                    type="button"
                    onClick={() => startFloor(fl.floorNumber)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                      currentFloor === fl.floorNumber
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {fl.floorNumber}층
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleMute}
              className="w-11 h-11 rounded-2xl bg-slate-900/85 hover:bg-slate-800 border-2 border-white/20 text-white flex items-center justify-center shadow-lg cursor-pointer"
              aria-label={saveData.isMuted ? '소리 켜기' : '소리 끄기'}
            >
              {saveData.isMuted ? (
                <VolumeX className="w-5 h-5 text-rose-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-sky-300" />
              )}
            </button>

            <button
              type="button"
              onClick={handleTogglePause}
              className="h-11 px-3.5 rounded-2xl bg-slate-900/85 hover:bg-slate-800 border-2 border-white/20 text-white font-bold text-sm flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap"
            >
              <Pause className="w-4 h-4" />
              <span className="hidden sm:inline">일시정지</span>
            </button>
          </div>
        </header>
      )}

      {/* 플레이 중 중앙 상단 토스트 안내 배너 */}
      {bannerNotice && (
        <div className="fixed top-20 inset-x-0 z-40 pointer-events-none flex justify-center px-4">
          <div className="bg-slate-950/90 border-2 border-amber-400/70 text-white px-5 py-2.5 rounded-2xl shadow-xl text-sm sm:text-base font-extrabold text-center max-w-xl">
            {bannerNotice}
          </div>
        </div>
      )}

      {/* 태블릿 터치 조이스틱 & 점프/앞보기 대형 버튼 */}
      <TouchControls
        inputRef={touchInputRef}
        visible={gameStatus === 'PLAYING'}
      />

      {/* 1. 타이틀 및 층 선택 화면 (Title Screen) */}
      {gameStatus === 'TITLE' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 bg-slate-950/45 pointer-events-auto overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900/95 border-2 border-sky-400/40 p-5 sm:p-7 text-white shadow-2xl">
            {/* 상단 커스텀 SVG 타이틀 락업 & 앱 설치 버튼 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <svg
                  className="w-13 h-13 shrink-0"
                  viewBox="0 0 64 64"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect width="64" height="64" rx="16" fill="#0284c7" />
                  <rect x="16" y="42" width="32" height="12" rx="3" fill="#f8fafc" />
                  <rect x="21" y="30" width="22" height="12" rx="3" fill="#e2e8f0" />
                  <rect x="26" y="18" width="12" height="12" rx="2" fill="#f8fafc" />
                  <circle cx="32" cy="12" r="5" stroke="#facc15" strokeWidth="3" />
                </svg>
                <div>
                  <p className="text-xs font-extrabold text-sky-400 tracking-wide">
                    3D 타워 오르기 액션 어드벤처
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    스카이 타워 어드벤처
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <PWAInstallButton />
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                  aria-label="소리 켜기/끄기"
                >
                  {saveData.isMuted ? (
                    <VolumeX className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-sky-300" />
                  )}
                </button>
              </div>
            </div>

            {/* 갤럭시 탭 S6 Lite 최적화 설정 바 (1000x600 해상도 & 30FPS 전환 버튼) */}
            <div className="mt-4 rounded-2xl bg-slate-800/90 border border-emerald-500/35 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-white">
                  <Gauge className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>탭 S6 Lite 렉 방지 설정:</span>
                  <span className="text-emerald-300 tabular-nums">
                    {activeRenderSize.width}×{activeRenderSize.height} ·{' '}
                    {saveData.fps30Cap ? '30 FPS' : '60 FPS'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  3D 렌더링 해상도를 절반(1000×600급)으로 줄이고 30FPS로 고정해 렉을 방지합니다.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleLowRes}
                  className={`px-3 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    saveData.lowResMode
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>
                    해상도: {saveData.lowResMode ? '1000×600 (절반)' : '표준 (100%)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleFps30}
                  className={`px-3 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    saveData.fps30Cap
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span>FPS: {saveData.fps30Cap ? '30 FPS 고정' : '60 FPS'}</span>
                </button>
              </div>
            </div>

            {/* 동물 탐험대 3D 캐릭터 선택 패널 */}
            <div className="mt-3 rounded-2xl bg-slate-800/90 border border-sky-400/35 p-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center shrink-0">
                    <Box className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-white">
                      <span>출동 탐험대원 선택:</span>
                      <span className="text-amber-300">
                        {modelLoading
                          ? '3D 캐릭터 불러오는 중...'
                          : customModelName ?? '폴짝 개구리'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sky-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>내 .GLB 파일 직접 올리기</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CHARACTER_PRESETS.map((preset) => {
                  const isSelected = saveData.selectedCharacterId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectCharacterPreset(preset)}
                      className={`text-left rounded-xl p-2.5 border-2 transition-all cursor-pointer flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-sky-950/95 border-amber-400 shadow-md'
                          : 'bg-slate-900/75 border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      <span
                        className="w-3.5 h-8 rounded-full shrink-0"
                        style={{ backgroundColor: preset.badgeColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-black text-white truncate">
                          {preset.name}
                        </div>
                        <div className="text-[11px] font-bold text-sky-300 truncate">
                          {preset.role} · {preset.species}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 층(레벨) 선택 리스트 */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-base font-extrabold text-white">
                  도전할 층 선택 (층별 하늘 시간대 & 고정 패턴 적용)
                </h2>
                <button
                  type="button"
                  onClick={handleToggleTestUnlock}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    saveData.testUnlockAll
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {saveData.testUnlockAll ? (
                    <Unlock className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>
                    테스트용 전체 층 열기: {saveData.testUnlockAll ? '켜짐' : '꺼짐'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {TOWER_FLOORS.map((floor) => {
                  const isUnlocked =
                    saveData.testUnlockAll ||
                    floor.floorNumber <= saveData.maxUnlockedFloor;
                  const isCleared = saveData.clearedFloors.includes(
                    floor.floorNumber
                  );
                  const isSelected = currentFloor === floor.floorNumber;

                  return (
                    <button
                      key={floor.floorNumber}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => setCurrentFloor(floor.floorNumber)}
                      className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                        !isUnlocked
                          ? 'bg-slate-900/60 border-slate-800 opacity-55 cursor-not-allowed'
                          : isSelected
                          ? 'bg-sky-950/90 border-sky-400 shadow-lg'
                          : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm sm:text-base font-black text-white truncate">
                          {floor.title}
                        </span>
                        {isCleared ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            완료
                          </span>
                        ) : isUnlocked ? (
                          <span className="text-[11px] font-bold text-sky-300 shrink-0">
                            도전 가능
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 shrink-0">
                            <Lock className="w-3 h-3" />
                            잠김
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        {floor.floorNumber === 8 ? (
                          <>
                            <Sunset className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-emerald-200 truncate">
                              노을 하늘 · 시간차 2등분 데미지 장판
                            </span>
                          </>
                        ) : floor.floorNumber === 7 ? (
                          <>
                            <Sun className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                            <span className="text-cyan-200 truncate">
                              맑은 하늘 · 3배 점프 버튼 & 수직 고공 타워
                            </span>
                          </>
                        ) : floor.floorNumber === 5 ? (
                          <>
                            <Sunset className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span className="truncate">노을 하늘 · 대형 타일 & 롱 코스</span>
                          </>
                        ) : floor.floorNumber === 6 ? (
                          <>
                            <Moon className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                            <span className="text-indigo-200 truncate">
                              별빛 정상 · 초대형 타일 & 최장 코스
                            </span>
                          </>
                        ) : floor.skyTheme === 'sunset' ? (
                          <>
                            <Sunset className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span className="truncate">황금빛 노을 하늘 & 부유섬</span>
                          </>
                        ) : floor.skyTheme === 'starlight' ? (
                          <>
                            <Moon className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                            <span className="text-indigo-200 truncate">
                              별빛 밤하늘 · 좌회전(ㄱ자) & 가시 바닥
                            </span>
                          </>
                        ) : floor.floorNumber === 3 ? (
                          <>
                            <Sun className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                            <span className="truncate">맑은 한낮 하늘 · 우회전(ㄱ자) & 용암 바닥</span>
                          </>
                        ) : (
                          <>
                            <Sun className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                            <span className="truncate">맑은 한낮 하늘 & 뭉게구름</span>
                          </>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-slate-300 line-clamp-2">
                        {floor.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 하단 시작 CTA 및 진행도 관리 */}
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>WASD / 조이스틱 이동 · Space 점프 · E 앞보기</span>
                <button
                  type="button"
                  onClick={handleResetSave}
                  className="underline hover:text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  저장 기록 초기화
                </button>
              </div>

              <button
                type="button"
                onClick={() => startFloor(currentFloor)}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-sky-500 hover:from-emerald-300 hover:to-sky-400 text-slate-950 font-black text-lg shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform whitespace-nowrap"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>{currentFloor}층 도전 시작하기</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 일시정지 모달 (Paused Modal) */}
      {gameStatus === 'PAUSED' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/70 pointer-events-auto">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-slate-700 p-6 text-white shadow-2xl">
            <h2 className="text-2xl font-black text-center">게임 일시정지</h2>
            <p className="mt-1 text-center text-sm text-slate-300">
              {currentBlueprint.title} 진행 중 ({activeRenderSize.width}×
              {activeRenderSize.height} · {saveData.fps30Cap ? '30FPS' : '60FPS'})
            </p>

            {/* 일시정지 화면 내 해상도 / FPS 즉시 전환 */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleToggleLowRes}
                className={`h-11 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  saveData.lowResMode
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>{saveData.lowResMode ? '해상도: 1000×600' : '해상도: 표준'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFps30}
                className={`h-11 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  saveData.fps30Cap
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Gauge className="w-4 h-4" />
                <span>{saveData.fps30Cap ? '제한: 30 FPS' : '제한: 60 FPS'}</span>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={handleTogglePause}
                className="w-full h-13 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>계속 플레이하기</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>다른 3D 캐릭터(.glb) 파일 불러오기</span>
              </button>

              <button
                type="button"
                onClick={() => startFloor(currentFloor)}
                className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>이 층 처음부터 다시 시작</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setGameStatus('TITLE');
                }}
                className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center cursor-pointer"
              >
                타이틀 및 층 선택 화면으로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 층 클리어 모달 (Floor Clear Modal) */}
      {gameStatus === 'FLOOR_CLEAR' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/65 pointer-events-auto">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-emerald-400/60 p-7 text-white shadow-2xl text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center mx-auto">
              <Sparkles className="w-9 h-9" />
            </div>

            <p className="mt-4 text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
              진행 상황 자동 저장 완료
            </p>
            <h2 className="mt-1 text-3xl font-black text-white">
              {currentFloor}층 클리어 성공!
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              열쇠를 찾아 회전 막대와 움직이는 발판을 멋지게 통과했어요!
            </p>

            <div className="mt-6 space-y-3">
              {hasNextFloor ? (
                <button
                  type="button"
                  onClick={() => startFloor(currentFloor + 1)}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-sky-400 hover:from-emerald-300 hover:to-sky-300 text-slate-950 font-black text-lg shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  <span>다음 층 ({currentFloor + 1}층) 도전하기</span>
                </button>
              ) : (
                <div className="rounded-2xl bg-sky-950/90 border border-sky-400/40 p-4 text-sm text-sky-200 font-bold">
                  현재 준비된 모든 층(1~{TOWER_FLOORS.length}층)을 정복했어요! 같은 층을 다시 플레이하며 더 빠른 타이밍에 도전해 보세요!
                </div>
              )}

              <button
                type="button"
                onClick={() => startFloor(currentFloor)}
                className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>같은 층 다시 플레이 (숙련도 연습)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setGameStatus('TITLE');
                }}
                className="w-full h-11 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-semibold text-sm cursor-pointer"
              >
                층 선택 화면으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 하트 소진 시 해당 층 재시작 모달 (Floor Fail Modal) */}
      {gameStatus === 'FLOOR_FAIL' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75 pointer-events-auto">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-rose-400/60 p-7 text-white shadow-2xl text-center">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-400/40 text-rose-400 flex items-center justify-center mx-auto">
              <Heart className="w-9 h-9" />
            </div>

            <h2 className="mt-4 text-2xl sm:text-3xl font-black text-white">
              아쉬워요! 다시 도전해 볼까요?
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              하트 3개를 모두 사용했어요. 발판이 움직이는 길과 회전 막대의 속도는 언제나 똑같으니 한 번 더 해보면 훨씬 쉽게 넘을 수 있어요!
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => startFloor(currentFloor)}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-lg shadow-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                <span>{currentFloor}층 처음부터 다시 도전</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setGameStatus('TITLE');
                }}
                className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm cursor-pointer"
              >
                타이틀 화면으로
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
