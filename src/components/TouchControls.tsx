import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Compass } from 'lucide-react';

export interface TouchInputRef {
  /** 좌우 이동 (-1: 왼쪽, +1: 오른쪽) */
  right: number;
  /** 전후 이동 (-1: 뒤로, +1: 앞으로) */
  forward: number;
  /** 점프 버튼 눌림 (엣지 트리거 버퍼용 타임스탬프) */
  jumpPressedAt: number;
  /** 점프 버튼 유지 여부 */
  jumpHeld: boolean;
  /** 카메라 정면 정렬 요청 타임스탬프 */
  alignCameraAt: number;
  /** 우측 화면 드래그를 통한 수평 시점 회전 변화량 (rad) */
  lookYawDelta: number;
  /** 우측 화면 드래그를 통한 상하 시점 각도 변화량 (rad) */
  lookPitchDelta: number;
  /** 현재 우측 화면 시점 드래그 중인지 여부 */
  isDraggingCamera: boolean;
}

interface TouchControlsProps {
  inputRef: React.MutableRefObject<TouchInputRef>;
  visible: boolean;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  inputRef,
  visible,
}) => {
  const joyZoneRef = useRef<HTMLDivElement | null>(null);
  const activeJoyPointerId = useRef<number | null>(null);
  const joyOriginClient = useRef<{ x: number; y: number } | null>(null);

  const activeLookPointerId = useRef<number | null>(null);
  const lastLookClient = useRef<{ x: number; y: number } | null>(null);

  // 다이나믹 조이스틱 중심점 (터치 시 손가락 위치, 대기 시 null -> 좌하단 기본 위치)
  const [dynamicOrigin, setDynamicOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isJumpActive, setIsJumpActive] = useState(false);

  const maxRadius = 36;

  const resetAllTouches = useCallback(() => {
    activeJoyPointerId.current = null;
    joyOriginClient.current = null;
    activeLookPointerId.current = null;
    lastLookClient.current = null;

    setDynamicOrigin(null);
    setKnobOffset({ x: 0, y: 0 });
    setIsJumpActive(false);

    inputRef.current.right = 0;
    inputRef.current.forward = 0;
    inputRef.current.jumpHeld = false;
    inputRef.current.lookYawDelta = 0;
    inputRef.current.lookPitchDelta = 0;
    inputRef.current.isDraggingCamera = false;
  }, [inputRef]);

  // 1) 스테이지 클리어(게이트 진입), 실패, 일시정지 등으로 visible이 바뀔 때 조이스틱 상태 즉시 리셋
  useEffect(() => {
    if (!visible) {
      resetAllTouches();
    }
  }, [visible, resetAllTouches]);

  // 2) 전역 포인터 해제 / 창 포커스 이탈 시에도 안전하게 리셋
  useEffect(() => {
    const onGlobalPointerEnd = (e: PointerEvent) => {
      if (activeJoyPointerId.current === e.pointerId) {
        activeJoyPointerId.current = null;
        joyOriginClient.current = null;
        setDynamicOrigin(null);
        setKnobOffset({ x: 0, y: 0 });
        inputRef.current.right = 0;
        inputRef.current.forward = 0;
      }
      if (activeLookPointerId.current === e.pointerId) {
        activeLookPointerId.current = null;
        lastLookClient.current = null;
        inputRef.current.isDraggingCamera = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        resetAllTouches();
      }
    };

    window.addEventListener('pointerup', onGlobalPointerEnd);
    window.addEventListener('pointercancel', onGlobalPointerEnd);
    window.addEventListener('blur', resetAllTouches);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pointerup', onGlobalPointerEnd);
      window.removeEventListener('pointercancel', onGlobalPointerEnd);
      window.removeEventListener('blur', resetAllTouches);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resetAllTouches();
    };
  }, [inputRef, resetAllTouches]);

  if (!visible) return null;

  const updateJoystickFromPoint = (clientX: number, clientY: number) => {
    const origin = joyOriginClient.current;
    if (!origin) return;

    let dx = clientX - origin.x;
    let dy = clientY - origin.y;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });

    const normX = dx / maxRadius;
    const normY = dy / maxRadius;
    const deadzone = 0.12;

    inputRef.current.right = Math.abs(normX) > deadzone ? normX : 0;
    inputRef.current.forward = Math.abs(normY) > deadzone ? -normY : 0;
  };

  // 좌측 1/3 × 하단 2/3 다이나믹 조이스틱 터치 시작
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeJoyPointerId.current !== null) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors on synthetic events
    }

    activeJoyPointerId.current = e.pointerId;
    joyOriginClient.current = { x: e.clientX, y: e.clientY };

    const zoneEl = joyZoneRef.current;
    if (zoneEl) {
      const rect = zoneEl.getBoundingClientRect();
      // Clamp visual ring inside the zone so it stays cleanly visible
      const localX = Math.max(
        52,
        Math.min(rect.width - 52, e.clientX - rect.left)
      );
      const localY = Math.max(
        52,
        Math.min(rect.height - 52, e.clientY - rect.top)
      );
      setDynamicOrigin({ x: localX, y: localY });
    }

    setKnobOffset({ x: 0, y: 0 });
    inputRef.current.right = 0;
    inputRef.current.forward = 0;
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeJoyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystickFromPoint(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeJoyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    activeJoyPointerId.current = null;
    joyOriginClient.current = null;
    setDynamicOrigin(null);
    setKnobOffset({ x: 0, y: 0 });
    inputRef.current.right = 0;
    inputRef.current.forward = 0;
  };

  // 우측 절반(1/2) 시점 전환 드래그 핸들러
  const handleLookPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeLookPointerId.current !== null) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors
    }
    activeLookPointerId.current = e.pointerId;
    lastLookClient.current = { x: e.clientX, y: e.clientY };
    inputRef.current.isDraggingCamera = true;
  };

  const handleLookPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeLookPointerId.current !== e.pointerId || !lastLookClient.current)
      return;
    const dx = e.clientX - lastLookClient.current.x;
    const dy = e.clientY - lastLookClient.current.y;
    lastLookClient.current = { x: e.clientX, y: e.clientY };

    // 수평 드래그 -> 좌우 시점 회전(Yaw), 수직 드래그 -> 상하 각도 조절(Pitch)
    inputRef.current.lookYawDelta -= dx * 0.0075;
    inputRef.current.lookPitchDelta += dy * 0.006;
  };

  const handleLookPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeLookPointerId.current !== e.pointerId) return;
    activeLookPointerId.current = null;
    lastLookClient.current = null;
    inputRef.current.isDraggingCamera = false;
  };

  const handleJumpPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    setIsJumpActive(true);
    inputRef.current.jumpPressedAt = performance.now();
    inputRef.current.jumpHeld = true;
  };

  const handleJumpPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsJumpActive(false);
    inputRef.current.jumpHeld = false;
  };

  const handleAlignPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    inputRef.current.alignCameraAt = performance.now();
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* 1. 좌측 1/3 × 하단 2/3 (전체 화면의 2/9) 광역 다이나믹 조이스틱 터치 영역 */}
      <div
        ref={joyZoneRef}
        onPointerDown={handleJoystickPointerDown}
        onPointerMove={handleJoystickPointerMove}
        onPointerUp={handleJoystickPointerUp}
        onPointerCancel={handleJoystickPointerUp}
        className="fixed left-0 bottom-0 w-1/3 h-2/3 z-20 pointer-events-auto touch-none"
        aria-label="이동 조이스틱 터치 영역 (좌측 1/3 · 하단 2/3)"
      >
        {/* 컴팩트 미니 조이스틱 UI (평소엔 좌하단 작게 표시, 터치 시 터치 지점으로 이동) */}
        <div
          style={
            dynamicOrigin
              ? {
                  left: `${dynamicOrigin.x}px`,
                  top: `${dynamicOrigin.y}px`,
                  transform: 'translate(-50%, -50%)',
                }
              : undefined
          }
          className={`${
            dynamicOrigin
              ? 'absolute'
              : 'absolute left-6 bottom-6 sm:left-8 sm:bottom-8'
          } w-24 h-24 rounded-full bg-slate-900/45 border-2 ${
            dynamicOrigin ? 'border-sky-300/80 scale-105' : 'border-white/30'
          } shadow-xl flex items-center justify-center pointer-events-none transition-opacity`}
        >
          {/* 상하좌우 방향 가이드 마크 */}
          <span className="absolute top-1.5 text-[9px] font-bold text-white/55">
            ▲
          </span>
          <span className="absolute bottom-1.5 text-[9px] font-bold text-white/55">
            ▼
          </span>
          <span className="absolute left-2 text-[9px] font-bold text-white/55">
            ◀
          </span>
          <span className="absolute right-2 text-[9px] font-bold text-white/55">
            ▶
          </span>

          {/* 중앙 스틱 노브 (컴팩트 사이즈) */}
          <div
            style={{
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
            }}
            className="w-10 h-10 rounded-full bg-gradient-to-b from-white to-sky-200 border-2 border-sky-400 shadow-md flex items-center justify-center"
          >
            <div className="w-3.5 h-3.5 rounded-full bg-sky-500/45" />
          </div>
        </div>
      </div>

      {/* 2. 우측 절반(1/2) 드래그 시점 전환 영역 */}
      <div
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerUp}
        className="fixed right-0 inset-y-0 w-1/2 z-10 pointer-events-auto touch-none cursor-grab active:cursor-grabbing"
        aria-label="시점 회전 드래그 영역 (우측 절반)"
      />

      {/* 중앙 하단 키보드 & 터치 조작 안내 라인 */}
      <div className="fixed inset-x-0 bottom-5 z-20 pointer-events-none flex justify-center">
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-slate-900/55 border border-white/15 text-xs font-semibold text-white/90">
          <span>좌하단 터치/WASD: 이동</span>
          <span aria-hidden="true">·</span>
          <span>우측 화면 드래그: 시점 회전</span>
          <span aria-hidden="true">·</span>
          <span>Space: 점프</span>
          <span aria-hidden="true">·</span>
          <span>E: 앞보기</span>
        </div>
      </div>

      {/* 3. 우측 하단 점프 및 앞보기 버튼 클러스터 (드래그 존 위에 독립 작동) */}
      <div className="fixed right-5 bottom-5 sm:right-8 sm:bottom-7 z-30 flex items-end gap-3.5 sm:gap-5 pointer-events-auto">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onPointerDown={handleAlignPointerDown}
            className="w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-slate-900/70 hover:bg-slate-800/85 active:scale-90 border-2 border-sky-300/60 text-white shadow-lg flex flex-col items-center justify-center gap-0.5 transition-transform cursor-pointer touch-none"
            aria-label="시점 정면 정렬"
          >
            <Compass className="w-5 h-5 text-sky-300" />
            <span className="text-[10px] font-extrabold tracking-tight">
              앞보기
            </span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onPointerDown={handleJumpPointerDown}
            onPointerUp={handleJumpPointerUp}
            onPointerCancel={handleJumpPointerUp}
            className={`w-22 h-22 sm:w-26 sm:h-26 rounded-full border-4 border-white shadow-2xl flex flex-col items-center justify-center gap-0.5 transition-transform cursor-pointer touch-none ${
              isJumpActive
                ? 'scale-90 bg-emerald-400 text-slate-950'
                : 'bg-gradient-to-b from-emerald-400 to-teal-600 text-white hover:from-emerald-300 hover:to-teal-500'
            }`}
            aria-label="점프"
          >
            <ArrowUp className="w-8 h-8 stroke-[3]" />
            <span className="text-sm sm:text-base font-black tracking-tight">
              점프
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
