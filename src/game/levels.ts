export type PlatformSurfaceTheme = 'stone' | 'meadow' | 'emerald' | 'gold' | 'royal';
export type SkyTimeTheme = 'day' | 'sunset' | 'starlight';

export interface StaticPlatformSpec {
  id: string;
  /** 플랫폼 상단 표면 중심 좌표 [x, surfaceY, z] */
  position: [number, number, number];
  /** 플랫폼 크기 [가로 width, 두께 height, 세로 depth] */
  size: [number, number, number];
  theme: PlatformSurfaceTheme;
}

export interface MovingPlatformSpec {
  id: string;
  /** 왕복 시작 상단 표면 중심 좌표 [x, surfaceY, z] */
  startPos: [number, number, number];
  /** 왕복 끝 상단 표면 중심 좌표 [x, surfaceY, z] */
  endPos: [number, number, number];
  /** 플랫폼 크기 [가로 width, 두께 height, 세로 depth] */
  size: [number, number, number];
  /** 왕복 속도 (초당 라디안 배수 — 항상 일정하게 작동) */
  speed: number;
  /** 시작 위상 (0 ~ 2, 0이면 startPos에서 출발) */
  phase: number;
  theme?: PlatformSurfaceTheme;
}

export interface RotatingBeamSpec {
  id: string;
  /** 회전 기둥 바닥 중심 좌표 [x, baseSurfaceY, z] */
  center: [number, number, number];
  /** 막대 전체 길이 (양쪽 대칭일 경우 전체 지름, 단방향일 경우 반지름) */
  radius: number;
  /** 바닥으로부터 회전 막대 중심까지의 높이 (점프로 넘을 수 있는 높이 권장: 0.52) */
  beamHeightOffset: number;
  /** 초당 회전 각속도 (rad/s, 양수: 반시계, 음수: 시계 방향 — 항상 동일 속도 유지) */
  angularSpeed: number;
  /** 시작 각도 (rad) */
  initialAngle: number;
  /** 양방향 대칭 막대('double') 또는 단방향 막대('single') */
  armType: 'single' | 'double';
}

export interface DamageZoneSpec {
  id: string;
  /** 위험 바닥(가시/용암) 상단 표면 중심 좌표 [x, surfaceY, z] */
  position: [number, number, number];
  /** 위험 바닥 가로·세로 크기 [가로 width, 세로 depth] */
  size: [number, number];
}

export interface JumpPadSpec {
  id: string;
  /** 점프 버튼 바닥 중심 좌표 [x, surfaceY, z] */
  position: [number, number, number];
  /** 버튼 반지름 (기본값 1.15m) */
  radius?: number;
  /** 수직 상승 속도 (기본값 18.5 — 통상 점프 높이의 3배 이상 수직 상승) */
  boostVelocityY?: number;
}

export interface FloorBlueprint {
  floorNumber: number;
  title: string;
  subtitle: string;
  guideHint: string;
  /** 층별 하늘 시간대 테마 ('day': 맑은 한낮, 'sunset': 황금 노을, 'starlight': 별빛 밤하늘) */
  skyTheme: SkyTimeTheme;
  /** 시작 시 캐릭터 발밑 좌표 [x, y, z] */
  spawnPoint: [number, number, number];
  /** 황금 열쇠 1개 좌표 [x, y, z] */
  keyPosition: [number, number, number];
  /** 열쇠 획득 후 부활할 안전 체크포인트 발밑 좌표 [x, y, z] */
  keyCheckpointSpawn: [number, number, number];
  /** 출구 포털 발밑 좌표 [x, y, z] */
  portalPosition: [number, number, number];
  /** 출구 포털 Y축 회전 각도(rad) — 생략 시 열쇠→출구 진행 방향에 맞춰 넓은 정면이 플레이어를 향하도록 자동 정렬 */
  portalYaw?: number;
  /** 추락 판정 Y 기준선 */
  fallLimitY: number;
  staticPlatforms: StaticPlatformSpec[];
  movingPlatforms: MovingPlatformSpec[];
  rotatingBeams: RotatingBeamSpec[];
  /** 밟으면 데미지를 주는 고정 가시/용암 바닥 목록 */
  damageZones?: DamageZoneSpec[];
  /** 밟으면 즉시 통상 점프의 3배 높이로 솟구치는 점프 버튼 목록 */
  jumpPads?: JumpPadSpec[];
}

/**
 * 층(레벨) 생성 데이터 목록 (1층 ~ 4층)
 * - 같은 층을 다시 플레이할 때 항상 동일한 발판 경로와 막대 회전 속도를 유지합니다.
 * - 3층과 4층은 중간 코너(황금 열쇠 섬)에서 90도로 꺾이는 'ㄱ'자 구조와 위험 바닥(damageZones)이 적용됩니다.
 */
export const TOWER_FLOORS: FloorBlueprint[] = [
  {
    floorNumber: 1,
    title: '1층 · 시작의 징검다리',
    subtitle: '맑은 한낮의 하늘 아래 움직이는 발판과 회전 막대를 넘어 황금 열쇠를 찾으세요!',
    guideHint: '황금 열쇠 1개를 획득하면 꼭대기의 출구 포털이 열립니다.',
    skyTheme: 'day',
    spawnPoint: [0, 0, 0],
    keyPosition: [0, 2.5, -24],
    keyCheckpointSpawn: [0, 1.6, -24],
    portalPosition: [0, 3.6, -49],
    fallLimitY: -5,
    staticPlatforms: [
      {
        id: 'f1-start',
        position: [0, 0, 0],
        size: [6.5, 1.2, 6.5],
        theme: 'meadow',
      },
      {
        id: 'f1-step-1',
        position: [0, 0.5, -7.2],
        size: [5.0, 1.2, 4.5],
        theme: 'stone',
      },
      {
        id: 'f1-beam-arena-1',
        position: [0, 1.0, -15.5],
        size: [7.2, 1.4, 7.2],
        theme: 'stone',
      },
      {
        id: 'f1-key-island',
        position: [0, 1.6, -24.0],
        size: [6.2, 1.4, 6.2],
        theme: 'gold',
      },
      {
        id: 'f1-beam-arena-2',
        position: [0, 2.8, -39.5],
        size: [7.4, 1.4, 7.4],
        theme: 'stone',
      },
      {
        id: 'f1-goal-island',
        position: [0, 3.6, -49.0],
        size: [7.0, 1.6, 7.5],
        theme: 'royal',
      },
    ],
    movingPlatforms: [
      {
        id: 'f1-move-1',
        startPos: [-2.2, 2.2, -31.5],
        endPos: [2.2, 2.2, -31.5],
        size: [4.6, 0.9, 4.6],
        speed: 0.75,
        phase: 0,
        theme: 'emerald',
      },
    ],
    rotatingBeams: [
      {
        id: 'f1-beam-1',
        center: [0, 1.0, -15.5],
        radius: 3.1,
        beamHeightOffset: 0.52,
        angularSpeed: 1.35,
        initialAngle: 0,
        armType: 'single',
      },
      {
        id: 'f1-beam-2',
        center: [0, 2.8, -39.5],
        radius: 3.2,
        beamHeightOffset: 0.52,
        angularSpeed: -1.55,
        initialAngle: Math.PI / 2,
        armType: 'double',
      },
    ],
  },
  {
    floorNumber: 2,
    title: '2층 · 바람개비 노을 회랑',
    subtitle: '황금빛 노을 하늘 위에서 움직이는 발판과 쌍둥이 회전 막대의 타이밍을 익혀보세요!',
    guideHint: '중간 섬의 황금 열쇠를 먼저 획득한 뒤 정상 포털로 올라가세요.',
    skyTheme: 'sunset',
    spawnPoint: [0, 0, 0],
    keyPosition: [0, 3.5, -33.5],
    keyCheckpointSpawn: [0, 2.6, -33.5],
    portalPosition: [0, 5.4, -66.0],
    fallLimitY: -5,
    staticPlatforms: [
      {
        id: 'f2-start',
        position: [0, 0, 0],
        size: [6.5, 1.2, 6.5],
        theme: 'meadow',
      },
      {
        id: 'f2-arena-1',
        position: [0, 1.2, -16.5],
        size: [7.4, 1.4, 7.4],
        theme: 'stone',
      },
      {
        id: 'f2-key-island',
        position: [0, 2.6, -33.5],
        size: [6.5, 1.5, 6.5],
        theme: 'gold',
      },
      {
        id: 'f2-arena-2',
        position: [-3.5, 3.8, -48.5],
        size: [7.0, 1.4, 7.0],
        theme: 'stone',
      },
      {
        id: 'f2-arena-3',
        position: [3.5, 4.6, -56.5],
        size: [7.0, 1.4, 7.0],
        theme: 'stone',
      },
      {
        id: 'f2-goal-island',
        position: [0, 5.4, -66.0],
        size: [7.2, 1.6, 7.8],
        theme: 'royal',
      },
    ],
    movingPlatforms: [
      {
        id: 'f2-move-1',
        startPos: [0, 0.6, -6.5],
        endPos: [0, 0.6, -10.0],
        size: [4.4, 0.9, 4.2],
        speed: 0.85,
        phase: 0,
        theme: 'emerald',
      },
      {
        id: 'f2-move-2',
        startPos: [-2.6, 1.9, -25.0],
        endPos: [2.6, 1.9, -25.0],
        size: [4.4, 0.9, 4.4],
        speed: 0.95,
        phase: 0.5,
        theme: 'emerald',
      },
      {
        id: 'f2-move-3',
        startPos: [0, 3.2, -40.2],
        endPos: [-3.5, 3.2, -41.5],
        size: [4.4, 0.9, 4.4],
        speed: 0.9,
        phase: 1.0,
        theme: 'emerald',
      },
      {
        id: 'f2-move-4',
        startPos: [-1.5, 4.2, -52.5],
        endPos: [1.5, 4.2, -52.5],
        size: [4.2, 0.9, 4.2],
        speed: 1.05,
        phase: 0.25,
        theme: 'emerald',
      },
    ],
    rotatingBeams: [
      {
        id: 'f2-beam-1',
        center: [0, 1.2, -16.5],
        radius: 3.25,
        beamHeightOffset: 0.52,
        angularSpeed: 1.65,
        initialAngle: 0,
        armType: 'double',
      },
      {
        id: 'f2-beam-2',
        center: [-3.5, 3.8, -48.5],
        radius: 3.0,
        beamHeightOffset: 0.52,
        angularSpeed: -1.8,
        initialAngle: Math.PI / 4,
        armType: 'double',
      },
      {
        id: 'f2-beam-3',
        center: [3.5, 4.6, -56.5],
        radius: 3.0,
        beamHeightOffset: 0.52,
        angularSpeed: 1.85,
        initialAngle: Math.PI / 3,
        armType: 'double',
      },
    ],
  },
  {
    floorNumber: 3,
    title: '3층 · 꺾이는 용암 다리',
    subtitle: '붉은 가시 용암 바닥을 점프로 뛰어넘고, 코너에서 오른쪽(ㄱ자)으로 꺾어 출구로 향하세요!',
    guideHint: '코너의 황금 열쇠를 먹으면 오른쪽 출구 방향으로 시점이 자동 안내됩니다.',
    skyTheme: 'day',
    spawnPoint: [0, 0, 0],
    keyPosition: [0, 3.1, -28.0],
    keyCheckpointSpawn: [0, 2.2, -28.0],
    portalPosition: [32.5, 4.2, -28.0],
    fallLimitY: -5,
    staticPlatforms: [
      {
        id: 'f3-start',
        position: [0, 0, 0],
        size: [6.5, 1.2, 6.5],
        theme: 'meadow',
      },
      {
        id: 'f3-lava-step-1',
        position: [0, 0.7, -9.8],
        size: [5.8, 1.3, 8.2],
        theme: 'stone',
      },
      {
        id: 'f3-corner-key-island',
        position: [0, 2.2, -28.0],
        size: [7.4, 1.5, 7.4],
        theme: 'gold',
      },
      {
        id: 'f3-east-beam-arena',
        position: [10.8, 2.8, -28.0],
        size: [7.4, 1.4, 7.4],
        theme: 'stone',
      },
      {
        id: 'f3-east-lava-bridge',
        position: [21.8, 3.5, -28.0],
        size: [8.4, 1.4, 5.8],
        theme: 'stone',
      },
      {
        id: 'f3-goal-island',
        position: [32.5, 4.2, -28.0],
        size: [7.4, 1.6, 7.4],
        theme: 'royal',
      },
    ],
    movingPlatforms: [
      {
        id: 'f3-move-1',
        startPos: [-2.2, 1.45, -19.2],
        endPos: [2.2, 1.45, -19.2],
        size: [4.6, 0.9, 4.6],
        speed: 0.85,
        phase: 0,
        theme: 'emerald',
      },
    ],
    rotatingBeams: [
      {
        id: 'f3-beam-1',
        center: [10.8, 2.8, -28.0],
        radius: 3.1,
        beamHeightOffset: 0.52,
        angularSpeed: 1.55,
        initialAngle: 0,
        armType: 'double',
      },
    ],
    damageZones: [
      {
        id: 'f3-dmg-1',
        position: [0, 0.7, -9.8],
        size: [5.2, 2.0],
      },
      {
        id: 'f3-dmg-2',
        position: [21.8, 3.5, -28.0],
        size: [2.0, 5.2],
      },
    ],
  },
  {
    floorNumber: 4,
    title: '4층 · 별빛 협곡의 미로',
    subtitle: '신비로운 별빛 밤하늘 아래 넓은 가시 다리와 회전 봉을 넘어 왼쪽(ㄱ자) 출구 포털을 정복하세요!',
    guideHint: '코너의 안전한 황금 열쇠 섬에서 열쇠를 얻으면 왼쪽 출구 방향으로 시점이 자동 안내됩니다.',
    skyTheme: 'starlight',
    spawnPoint: [0, 0, 0],
    keyPosition: [0, 4.0, -38.0],
    keyCheckpointSpawn: [0, 3.1, -38.0],
    portalPosition: [-37.2, 5.5, -38.0],
    fallLimitY: -5,
    staticPlatforms: [
      {
        id: 'f4-start',
        position: [0, 0, 0],
        size: [6.5, 1.2, 6.5],
        theme: 'meadow',
      },
      {
        id: 'f4-north-lava-bridge',
        position: [0, 1.5, -16.2],
        size: [5.8, 1.4, 8.4],
        theme: 'stone',
      },
      {
        id: 'f4-north-arena',
        position: [0, 2.3, -27.2],
        size: [7.4, 1.4, 7.4],
        theme: 'stone',
      },
      {
        id: 'f4-corner-key-island',
        position: [0, 3.1, -38.0],
        size: [7.6, 1.5, 7.6],
        theme: 'gold',
      },
      {
        id: 'f4-west-lava-bridge',
        position: [-11.2, 3.7, -38.0],
        size: [8.4, 1.4, 5.8],
        theme: 'stone',
      },
      {
        id: 'f4-west-beam-arena',
        position: [-27.5, 4.9, -38.0],
        size: [7.4, 1.4, 7.4],
        theme: 'stone',
      },
      {
        id: 'f4-goal-island',
        position: [-37.2, 5.5, -38.0],
        size: [7.4, 1.6, 7.4],
        theme: 'royal',
      },
    ],
    movingPlatforms: [
      {
        id: 'f4-move-1',
        startPos: [0, 0.75, -6.5],
        endPos: [0, 0.75, -9.2],
        size: [4.6, 0.9, 4.4],
        speed: 0.85,
        phase: 0,
        theme: 'emerald',
      },
      {
        id: 'f4-move-2',
        startPos: [-19.4, 4.3, -35.8],
        endPos: [-19.4, 4.3, -40.2],
        size: [4.6, 0.9, 4.6],
        speed: 0.92,
        phase: 0.5,
        theme: 'emerald',
      },
    ],
    rotatingBeams: [
      {
        id: 'f4-beam-1',
        center: [0, 2.3, -27.2],
        radius: 3.15,
        beamHeightOffset: 0.52,
        angularSpeed: -1.65,
        initialAngle: 0,
        armType: 'double',
      },
      {
        id: 'f4-beam-2',
        center: [-27.5, 4.9, -38.0],
        radius: 3.05,
        beamHeightOffset: 0.52,
        angularSpeed: 1.7,
        initialAngle: Math.PI / 4,
        armType: 'double',
      },
    ],
    damageZones: [
      {
        id: 'f4-dmg-1',
        position: [0, 1.5, -16.2],
        size: [5.2, 2.0],
      },
      {
        id: 'f4-dmg-2',
        position: [-11.2, 3.7, -38.0],
        size: [2.0, 5.2],
      },
    ],
  },
  {
    floorNumber: 5,
    title: '5층 · 황금 노을의 대회랑',
    subtitle: '훨씬 넓어진 대형 타일 위에서 긴 직선 회랑과 오른쪽(ㄱ자) 대교를 돌파하는 롱 코스!',
    guideHint: '타일이 넓어져 착지가 여유롭습니다! 코너의 황금 열쇠를 먹고 오른쪽 긴 회랑 끝 출구로 향하세요.',
    skyTheme: 'sunset',
    spawnPoint: [0, 0, 0],
    keyPosition: [0, 5.0, -55.5],
    keyCheckpointSpawn: [0, 4.0, -55.5],
    portalPosition: [58.5, 7.8, -55.5],
    fallLimitY: -5,
    staticPlatforms: [
      {
        id: 'f5-start',
        position: [0, 0, 0],
        size: [8.8, 1.4, 8.8],
        theme: 'meadow',
      },
      {
        id: 'f5-north-bridge-1',
        position: [0, 1.6, -22.0],
        size: [7.6, 1.5, 11.2],
        theme: 'stone',
      },
      {
        id: 'f5-north-arena-1',
        position: [0, 2.5, -35.5],
        size: [9.4, 1.6, 9.4],
        theme: 'stone',
      },
      {
        id: 'f5-corner-key-island',
        position: [0, 4.0, -55.5],
        size: [9.6, 1.7, 9.6],
        theme: 'gold',
      },
      {
        id: 'f5-east-bridge-1',
        position: [13.2, 4.8, -55.5],
        size: [11.2, 1.5, 7.6],
        theme: 'stone',
      },
      {
        id: 'f5-east-arena-2',
        position: [27.0, 5.6, -55.5],
        size: [9.4, 1.6, 9.4],
        theme: 'stone',
      },
      {
        id: 'f5-east-arena-3',
        position: [46.5, 7.1, -55.5],
        size: [9.4, 1.6, 9.4],
        theme: 'stone',
      },
      {
        id: 'f5-goal-island',
        position: [58.5, 7.8, -55.5],
        size: [9.6, 1.8, 9.6],
        theme: 'royal',
      },
    ],
    movingPlatforms: [
      {
        id: 'f5-move-1',
        startPos: [-2.4, 0.8, -10.5],
        endPos: [2.4, 0.8, -10.5],
        size: [5.8, 1.0, 5.8],
        speed: 0.85,
        phase: 0,
        theme: 'emerald',
      },
      {
        id: 'f5-move-2',
        startPos: [0, 3.25, -43.8],
        endPos: [0, 3.25, -47.0],
        size: [5.8, 1.0, 5.8],
        speed: 0.9,
        phase: 0.5,
        theme: 'emerald',
      },
      {
        id: 'f5-move-3',
        startPos: [36.8, 6.35, -53.0],
        endPos: [36.8, 6.35, -58.0],
        size: [5.8, 1.0, 5.8],
        speed: 0.95,
        phase: 0.25,
        theme: 'emerald',
      },
    ],
    rotatingBeams: [
      {
        id: 'f5-beam-1',
        center: [0, 2.5, -35.5],
        radius: 3.9,
        beamHeightOffset: 0.52,
        angularSpeed: 1.55,
        initialAngle: 0,
        armType: 'double',
      },
      {
        id: 'f5-beam-2',
        center: [27.0, 5.6, -55.5],
        radius: 3.9,
        beamHeightOffset: 0.52,
        angularSpeed: -1.65,
        initialAngle: Math.PI / 4,
        armType: 'double',
      },
      {
        id: 'f5-beam-3',
        center: [46.5, 7.1, -55.5],
        radius: 3.9,
        beamHeightOffset: 0.52,
        angularSpeed: 1.7,
        initialAngle: Math.PI / 2,
        armType: 'double',
      },
    ],
    damageZones: [
      {
        id: 'f5-dmg-1',
        position: [0, 1.6, -22.0],
        size: [6.8, 2.2],
      },
      {
        id: 'f5-dmg-2',
        position: [13.2, 4.8, -55.5],
        size: [2.2, 6.8],
      },
    ],
  },
  {
    floorNumber: 6,
    title: '6층 · 별빛 천공의 정상',
    subtitle: '초대형 타일과 긴 별빛 다리가 이어지는 최종 관문! 왼쪽(ㄱ자) 천공 회랑을 넘어 정상에 오르세요!',
    guideHint: '넓은 발판 위에서 호흡을 가다듬고, 코너 열쇠 획득 후 이어지는 왼쪽 별빛 대교를 완주하세요.',
    skyTheme: 'starlight',
    spawnPoint: [0, 0, 0],
    keyPosition: [0, 5.3, -57.0],
    keyCheckpointSpawn: [0, 4.3, -57.0],
    portalPosition: [-76.0, 9.2, -57.0],
    fallLimitY: -5,
    staticPlatforms: [
      {
        id: 'f6-start',
        position: [0, 0, 0],
        size: [9.2, 1.4, 9.2],
        theme: 'meadow',
      },
      {
        id: 'f6-north-bridge-1',
        position: [0, 0.9, -12.8],
        size: [7.8, 1.5, 11.4],
        theme: 'stone',
      },
      {
        id: 'f6-north-arena-1',
        position: [0, 2.7, -35.8],
        size: [9.6, 1.6, 9.6],
        theme: 'stone',
      },
      {
        id: 'f6-corner-key-island',
        position: [0, 4.3, -57.0],
        size: [9.8, 1.7, 9.8],
        theme: 'gold',
      },
      {
        id: 'f6-west-bridge-1',
        position: [-13.6, 5.1, -57.0],
        size: [11.6, 1.5, 7.8],
        theme: 'stone',
      },
      {
        id: 'f6-west-arena-2',
        position: [-36.8, 6.7, -57.0],
        size: [9.6, 1.6, 9.6],
        theme: 'stone',
      },
      {
        id: 'f6-west-bridge-2',
        position: [-50.4, 7.5, -57.0],
        size: [11.6, 1.5, 7.8],
        theme: 'stone',
      },
      {
        id: 'f6-west-arena-3',
        position: [-63.6, 8.4, -57.0],
        size: [9.6, 1.6, 9.6],
        theme: 'stone',
      },
      {
        id: 'f6-goal-island',
        position: [-76.0, 9.2, -57.0],
        size: [9.8, 1.8, 9.8],
        theme: 'royal',
      },
    ],
    movingPlatforms: [
      {
        id: 'f6-move-1',
        startPos: [-2.6, 1.8, -24.2],
        endPos: [2.6, 1.8, -24.2],
        size: [6.0, 1.0, 6.0],
        speed: 0.85,
        phase: 0,
        theme: 'emerald',
      },
      {
        id: 'f6-move-2',
        startPos: [0, 3.5, -44.6],
        endPos: [0, 3.5, -47.8],
        size: [6.0, 1.0, 6.0],
        speed: 0.9,
        phase: 0.5,
        theme: 'emerald',
      },
      {
        id: 'f6-move-3',
        startPos: [-25.2, 5.9, -54.4],
        endPos: [-25.2, 5.9, -59.6],
        size: [6.0, 1.0, 6.0],
        speed: 0.92,
        phase: 0.25,
        theme: 'emerald',
      },
    ],
    rotatingBeams: [
      {
        id: 'f6-beam-1',
        center: [0, 2.7, -35.8],
        radius: 4.0,
        beamHeightOffset: 0.52,
        angularSpeed: -1.6,
        initialAngle: 0,
        armType: 'double',
      },
      {
        id: 'f6-beam-2',
        center: [-36.8, 6.7, -57.0],
        radius: 4.0,
        beamHeightOffset: 0.52,
        angularSpeed: 1.68,
        initialAngle: Math.PI / 3,
        armType: 'double',
      },
      {
        id: 'f6-beam-3',
        center: [-63.6, 8.4, -57.0],
        radius: 4.0,
        beamHeightOffset: 0.52,
        angularSpeed: -1.72,
        initialAngle: Math.PI / 6,
        armType: 'double',
      },
    ],
    damageZones: [
      {
        id: 'f6-dmg-1',
        position: [0, 0.9, -12.8],
        size: [7.0, 2.2],
      },
      {
        id: 'f6-dmg-2',
        position: [-13.6, 5.1, -57.0],
        size: [2.2, 7.0],
      },
      {
        id: 'f6-dmg-3',
        position: [-50.4, 7.5, -57.0],
        size: [2.2, 7.0],
      },
    ],
  },
  {
    floorNumber: 7,
    title: '7층 · 슈퍼 점프 스카이 타워',
    subtitle: '타일 끝의 빛나는 점프 버튼을 밟아 통상 점프의 3배 높이로 솟구쳐 오르세요!',
    guideHint: '각 타일의 진행 방향 끝에 있는 점프 버튼을 밟으면 머리 위 고공 타일이나 먼 거리 타일로 단숨에 날아오릅니다!',
    skyTheme: 'day',
    spawnPoint: [0, 0, 0],
    keyPosition: [0, 13.2, -35.0],
    keyCheckpointSpawn: [0, 12.2, -35.0],
    portalPosition: [46.5, 22.8, -35.0],
    fallLimitY: -6,
    staticPlatforms: [
      {
        id: 'f7-start',
        position: [0, 0, 0],
        size: [9.6, 1.4, 9.6],
        theme: 'meadow',
      },
      {
        id: 'f7-vertical-step-1',
        position: [0, 5.2, -7.8],
        size: [9.8, 1.5, 9.8],
        theme: 'stone',
      },
      {
        id: 'f7-far-arena-1',
        position: [0, 6.8, -26.8],
        size: [10.0, 1.6, 10.0],
        theme: 'stone',
      },
      {
        id: 'f7-corner-key-island',
        position: [0, 12.2, -35.0],
        size: [10.2, 1.7, 10.2],
        theme: 'gold',
      },
      {
        id: 'f7-east-far-arena',
        position: [19.2, 13.8, -35.0],
        size: [10.0, 1.6, 10.0],
        theme: 'stone',
      },
      {
        id: 'f7-east-vertical-2',
        position: [27.5, 19.2, -35.0],
        size: [10.0, 1.6, 9.8],
        theme: 'stone',
      },
      {
        id: 'f7-goal-island',
        position: [46.5, 22.8, -35.0],
        size: [10.2, 1.8, 10.2],
        theme: 'royal',
      },
    ],
    movingPlatforms: [],
    rotatingBeams: [
      {
        id: 'f7-beam-1',
        center: [0, 6.8, -26.8],
        radius: 3.9,
        beamHeightOffset: 0.52,
        angularSpeed: 1.5,
        initialAngle: 0,
        armType: 'double',
      },
      {
        id: 'f7-beam-2',
        center: [19.2, 13.8, -35.0],
        radius: 3.9,
        beamHeightOffset: 0.52,
        angularSpeed: -1.6,
        initialAngle: Math.PI / 3,
        armType: 'double',
      },
    ],
    damageZones: [
      {
        id: 'f7-dmg-1',
        position: [27.5, 19.2, -35.0],
        size: [2.0, 6.8],
      },
    ],
    jumpPads: [
      {
        // 1번 타일 북쪽(-Z) 진행 방향 끝 -> 바로 위(+5.2m 수직 상승) 2번 타일로 점프
        id: 'f7-pad-1',
        position: [0, 0, -3.5],
        radius: 1.15,
        boostVelocityY: 18.5,
      },
      {
        // 2번 타일 북쪽(-Z) 진행 방향 끝 -> 멀리 떨어진(15.4m 거리) 3번 아레나 타일로 장거리 점프
        id: 'f7-pad-2',
        position: [0, 5.2, -11.4],
        radius: 1.15,
        boostVelocityY: 18.5,
      },
      {
        // 3번 타일 북쪽(-Z) 진행 방향 끝 -> 바로 위(+5.4m 수직 상승) 4번 황금 열쇠 코너 섬으로 점프
        id: 'f7-pad-3',
        position: [0, 6.8, -30.5],
        radius: 1.15,
        boostVelocityY: 18.5,
      },
      {
        // 4번 코너 섬 동쪽(+X) 진행 방향 끝 -> 멀리 떨어진(15.4m 거리) 5번 동쪽 아레나로 장거리 점프
        id: 'f7-pad-4',
        position: [3.8, 12.2, -35.0],
        radius: 1.15,
        boostVelocityY: 18.5,
      },
      {
        // 5번 타일 동쪽(+X) 진행 방향 끝 -> 바로 위(+5.4m 수직 상승) 6번 고공 타일로 점프
        id: 'f7-pad-5',
        position: [22.9, 13.8, -35.0],
        radius: 1.15,
        boostVelocityY: 18.5,
      },
      {
        // 6번 타일 동쪽(+X) 진행 방향 끝 -> 멀리 위쪽(+3.6m & 15.3m 거리) 7번 최정상 출구 섬으로 점프
        id: 'f7-pad-6',
        position: [31.2, 19.2, -35.0],
        radius: 1.15,
        boostVelocityY: 18.5,
      },
    ],
  },
];

export function getFloorBlueprint(floorNumber: number): FloorBlueprint {
  const found = TOWER_FLOORS.find((f) => f.floorNumber === floorNumber);
  return found ?? TOWER_FLOORS[0];
}

export function evaluateMovingPlatformPos(
  spec: MovingPlatformSpec,
  floorTime: number,
  out: [number, number, number]
): void {
  const t = 0.5 - 0.5 * Math.cos((floorTime * spec.speed + spec.phase) * Math.PI);
  out[0] = spec.startPos[0] + (spec.endPos[0] - spec.startPos[0]) * t;
  out[1] = spec.startPos[1] + (spec.endPos[1] - spec.startPos[1]) * t;
  out[2] = spec.startPos[2] + (spec.endPos[2] - spec.startPos[2]) * t;
}

export function evaluateRotatingBeamAngle(
  spec: RotatingBeamSpec,
  floorTime: number
): number {
  return spec.initialAngle + floorTime * spec.angularSpeed;
}
