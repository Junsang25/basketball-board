import { DEFAULT_THEME_ID, DEFAULT_TOKEN_SCALE, clampTokenScale, themeById } from './look';
import type { BoardLook } from './look';

export interface UiState {
  /** 코트 디자인 */
  themeId: string;
  /** 말 크기 배율 */
  tokenScale: number;
  /** 간략 모드 — 말을 눌렀을 때 뜨는 창을 아이콘만으로 줄인다 */
  compact: boolean;
}

const KEY = 'hoopboard.ui.v1';

export const DEFAULT_UI: UiState = {
  themeId: DEFAULT_THEME_ID,
  tokenScale: DEFAULT_TOKEN_SCALE,
  compact: false,
};

/** 이 기기의 보기 설정 — 전술 데이터와는 따로 저장한다 (예전에 저장된 레일 상태는 읽지 않는다) */
export function loadUi(): UiState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_UI;
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      themeId: typeof data.themeId === 'string' ? data.themeId : DEFAULT_THEME_ID,
      tokenScale:
        typeof data.tokenScale === 'number' ? clampTokenScale(data.tokenScale) : DEFAULT_TOKEN_SCALE,
      compact: data.compact === true,
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
