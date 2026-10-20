export interface SaveData {
  maxUnlockedFloor: number;
  clearedFloors: number[];
  testUnlockAll: boolean;
  isMuted: boolean;
  lastPlayedFloor: number;
  /** true(기본값): 내부 3D 렌더링 해상도를 1000x600 수준으로 절반 축소 */
  lowResMode: boolean;
  /** true(기본값): 초당 프레임을 30FPS로 고정하여 발열 및 렉 방지 */
  fps30Cap: boolean;
  /** 선택된 캐릭터 프리셋 ID */
  selectedCharacterId: string;
}

const SAVE_STORAGE_KEY = 'sky_tower_save_v1';

const DEFAULT_SAVE_DATA: SaveData = {
  maxUnlockedFloor: 1,
  clearedFloors: [],
  testUnlockAll: false,
  isMuted: false,
  lastPlayedFloor: 1,
  lowResMode: true,
  fps30Cap: true,
  selectedCharacterId: 'rae-red-panda',
};

export function loadSaveData(): SaveData {
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE_DATA };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      maxUnlockedFloor:
        typeof parsed.maxUnlockedFloor === 'number' &&
        parsed.maxUnlockedFloor >= 1
          ? parsed.maxUnlockedFloor
          : 1,
      clearedFloors: Array.isArray(parsed.clearedFloors)
        ? parsed.clearedFloors.filter((n): n is number => typeof n === 'number')
        : [],
      testUnlockAll: Boolean(parsed.testUnlockAll),
      isMuted: Boolean(parsed.isMuted),
      lastPlayedFloor:
        typeof parsed.lastPlayedFloor === 'number' &&
        parsed.lastPlayedFloor >= 1
          ? parsed.lastPlayedFloor
          : 1,
      lowResMode:
        typeof parsed.lowResMode === 'boolean' ? parsed.lowResMode : true,
      fps30Cap:
        typeof parsed.fps30Cap === 'boolean' ? parsed.fps30Cap : true,
      selectedCharacterId:
        typeof parsed.selectedCharacterId === 'string' &&
        parsed.selectedCharacterId.length > 0
          ? parsed.selectedCharacterId
          : 'rae-red-panda',
    };
  } catch {
    return { ...DEFAULT_SAVE_DATA };
  }
}

export function writeSaveData(data: SaveData): void {
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors in restricted webviews
  }
}

export function recordFloorCleared(
  currentSave: SaveData,
  clearedFloorNumber: number,
  totalFloorsCount: number
): SaveData {
  const nextUnlocked = Math.min(
    totalFloorsCount,
    Math.max(currentSave.maxUnlockedFloor, clearedFloorNumber + 1)
  );
  const clearedSet = new Set(currentSave.clearedFloors);
  clearedSet.add(clearedFloorNumber);

  const updated: SaveData = {
    ...currentSave,
    maxUnlockedFloor: nextUnlocked,
    clearedFloors: Array.from(clearedSet).sort((a, b) => a - b),
    lastPlayedFloor: nextUnlocked,
  };
  writeSaveData(updated);
  return updated;
}

export function resetSaveData(): SaveData {
  const fresh: SaveData = { ...DEFAULT_SAVE_DATA };
  writeSaveData(fresh);
  return fresh;
}
