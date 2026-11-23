/*
 * 보드의 생김새.
 *
 * 색을 한곳에 모아두고 코트·말·움직임 선이 전부 여기서 꺼내 쓴다.
 * 화면과 PNG와 영상이 같은 그리기 코드를 쓰기 때문에, 테마를 바꾸면
 * 내보낸 결과물도 같이 바뀐다.
 */

export type ThemeId = 'wood' | 'chalk' | 'paper' | 'night';

export interface BoardTheme {
  id: ThemeId;
  name: string;
  hint: string;

  /** 코트 */
  floor: string;
  paint: string;
  line: string;
  lineSoft: string;
  rim: string;
  /** 기본 선 두께 (피트) */
  lineFeet: number;

  /** 코트 바깥 — 내보낸 이미지의 여백과 캡션 자리 */
  page: string;
  pageText: string;
  pageTextSoft: string;

  /** 말 */
  offense: string;
  offenseText: string;
  /** 공격 말을 채울지(fill) 테두리만 그릴지(outline) */
  offenseStyle: 'fill' | 'outline';
  defense: string;
  defenseFill: string;
  ball: string;
  cone: string;

  /** 움직임 기호 */
  screen: string;
  pass: string;

  /** 보조 */
  select: string;
  ghost: string;
  handle: string;
}

export const THEMES: BoardTheme[] = [
  {
    id: 'wood',
    name: '마루',
    hint: '체육관 바닥',
    floor: '#e9ded0',
    paint: '#dccdb4',
    line: '#8f7f6a',
    lineSoft: 'rgba(143, 127, 106, 0.45)',
    rim: '#c2541f',
    lineFeet: 0.16,
    page: '#faf7f2',
    pageText: '#3b332a',
    pageTextSoft: '#7d7266',
    offense: '#23527c',
    offenseText: '#f6f3ec',
    offenseStyle: 'fill',
    defense: '#a63a32',
    defenseFill: '#faf6f0',
    ball: '#cf6a24',
    cone: '#c0952c',
    screen: '#2f4a63',
    pass: '#a8571c',
    select: '#2a2521',
    ghost: 'rgba(70, 58, 44, 0.2)',
    handle: '#1d6b60',
  },
  {
    id: 'chalk',
    name: '칠판',
    hint: '코치 보드',
    floor: '#21302b',
    paint: '#28392f',
    line: 'rgba(236, 240, 233, 0.6)',
    lineSoft: 'rgba(236, 240, 233, 0.28)',
    rim: '#e8a35c',
    lineFeet: 0.17,
    page: '#1a2521',
    pageText: '#e7ece5',
    pageTextSoft: 'rgba(231, 236, 229, 0.6)',
    offense: '#eef1ea',
    offenseText: '#21302b',
    offenseStyle: 'fill',
    defense: '#f2a69b',
    defenseFill: 'rgba(33, 48, 43, 0.55)',
    ball: '#e8a35c',
    cone: '#d8c57a',
    screen: '#cfe3d6',
    pass: '#e5c47c',
    select: '#ffffff',
    ghost: 'rgba(236, 240, 233, 0.22)',
    handle: '#8fd9c4',
  },
  {
    id: 'paper',
    name: '종이',
    hint: '전술 노트',
    floor: '#fbfaf7',
    paint: '#f0eee8',
    line: '#8b9096',
    lineSoft: 'rgba(139, 144, 150, 0.42)',
    rim: '#b4542a',
    lineFeet: 0.14,
    page: '#ffffff',
    pageText: '#1f2937',
    pageTextSoft: '#6b7280',
    offense: '#1f2937',
    offenseText: '#1f2937',
    offenseStyle: 'outline',
    defense: '#b3312a',
    defenseFill: '#ffffff',
    ball: '#d9762c',
    cone: '#a8831d',
    screen: '#374151',
    pass: '#4b5563',
    select: '#111827',
    ghost: 'rgba(31, 41, 55, 0.18)',
    handle: '#0f766e',
  },
  {
    id: 'night',
    name: '야간',
    hint: '어두운 화면',
    floor: '#161a1f',
    paint: '#1d232a',
    line: 'rgba(226, 232, 240, 0.36)',
    lineSoft: 'rgba(226, 232, 240, 0.17)',
    rim: '#e0701d',
    lineFeet: 0.16,
    page: '#11151a',
    pageText: '#e8ebee',
    pageTextSoft: 'rgba(232, 235, 238, 0.6)',
    offense: '#4a8fe0',
    offenseText: '#0d1117',
    offenseStyle: 'fill',
    defense: '#e8766a',
    defenseFill: 'rgba(22, 26, 31, 0.62)',
    ball: '#e0943d',
    cone: '#d3b45c',
    screen: '#9fc0e8',
    pass: '#e0a35c',
    select: '#ffffff',
    ghost: 'rgba(226, 232, 240, 0.16)',
    handle: '#5eead4',
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'wood';

export function themeById(id: string): BoardTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** 말 크기 배율 — 코트 대비 말이 얼마나 큰지 */
export const TOKEN_SCALES: Array<{ value: number; label: string }> = [
  { value: 0.8, label: '작게' },
  { value: 1, label: '보통' },
  { value: 1.2, label: '크게' },
  { value: 1.45, label: '아주 크게' },
];

export const DEFAULT_TOKEN_SCALE = 1;

export function clampTokenScale(v: number): number {
  return Math.max(0.6, Math.min(1.8, v));
}

/** 그릴 때 넘기는 한 벌 */
export interface BoardLook {
  theme: BoardTheme;
  tokenScale: number;
}

export const DEFAULT_LOOK: BoardLook = {
  theme: THEMES[0],
  tokenScale: DEFAULT_TOKEN_SCALE,
};
