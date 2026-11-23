import type { PanelPos } from '../ui/Panel';

export interface PanelState {
  open: boolean;
  /** 옮긴 적이 없으면 null (기본 자리) */
  pos: PanelPos | null;
}

export interface UiState {
  tools: PanelState;
  scenes: PanelState;
}

const KEY = 'hoopboard.ui.v1';

export const DEFAULT_UI: UiState = {
  tools: { open: true, pos: null },
  scenes: { open: true, pos: null },
};

function readPanel(raw: unknown, fallback: PanelState): PanelState {
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as Record<string, unknown>;
  const p = o.pos as Record<string, unknown> | null | undefined;
  const pos =
    p && typeof p.x === 'number' && typeof p.y === 'number' ? { x: p.x, y: p.y } : null;
  return { open: o.open !== false, pos };
}

/** 판을 어디에 뒀고 열어뒀는지 — 전술 데이터와는 따로 저장한다 */
export function loadUi(): UiState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_UI;
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      tools: readPanel(data.tools, DEFAULT_UI.tools),
      scenes: readPanel(data.scenes, DEFAULT_UI.scenes),
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
