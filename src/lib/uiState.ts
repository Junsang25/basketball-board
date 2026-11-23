import { DEFAULT_THEME_ID, DEFAULT_TOKEN_SCALE, clampTokenScale, themeById } from './look';
import type { BoardLook } from './look';

export interface UiState {
  /** 도구 레일을 펼쳐 뒀는가 */
  tools: boolean;
  /** 장면 레일을 펼쳐 뒀는가 */
  scenes: boolean;
  /** 코트 디자인 */
  themeId: string;
  /** 말 크기 배율 */
  tokenScale: number;
}

const KEY = 'hoopboard.ui.v1';

export const DEFAULT_UI: UiState = {
  tools: true,
  scenes: true,
  themeId: DEFAULT_THEME_ID,
  tokenScale: DEFAULT_TOKEN_SCALE,
};

/** 예전 판 위치까지 들어 있던 모양도 읽어준다 ({ tools: { open, pos } }) */
function readOpen(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (raw && typeof raw === 'object') return (raw as { open?: unknown }).open !== false;
  return true;
}

/** 레일을 펼쳐 뒀는지 — 전술 데이터와는 따로 저장한다 */
export function loadUi(): UiState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_UI;
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      tools: readOpen(data.tools),
      scenes: readOpen(data.scenes),
      themeId: typeof data.themeId === 'string' ? data.themeId : DEFAULT_THEME_ID,
      tokenScale:
        typeof data.tokenScale === 'number' ? clampTokenScale(data.tokenScale) : DEFAULT_TOKEN_SCALE,
    };
  } catch {
    return DEFAULT_UI;
  }
}

export function saveUi(ui: UiState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ui));
  } catch {
    // 저장이 막혀 있어도(사생활 보호 모드 등) 쓰는 데는 지장 없다
  }
}

/** 그릴 때 넘기는 한 벌로 바꾼다 */
export function lookFrom(ui: UiState): BoardLook {
  return { theme: themeById(ui.themeId), tokenScale: clampTokenScale(ui.tokenScale) };
}
