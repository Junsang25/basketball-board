// 전술판 데이터 모델
// 코트 좌표계: 피트(feet) 단위.
//   x: -25 ~ +25  (코트 폭 50ft, 0이 중앙)
//   y: 0 ~ 코트 길이 (0 = 공격 바스켓이 있는 베이스라인)

export type CourtType = 'half' | 'full';
export type TeamId = 'offense' | 'defense';
export type TokenKind = 'player' | 'ball' | 'cone';

/** 말이 이전 스텝에서 이번 스텝으로 이동할 때의 표기 방식 */
export type MoveStyle = 'cut' | 'dribble';

export interface Vec {
  x: number;
  y: number;
}

/**
 * 직접 놓는 스크린 마커.
 * 장면마다 따로 가지며, 그 장면에서만 보인다.
 */
export interface ScreenPin {
  id: string;
  pos: Vec;
  /** 막대가 누운 각도(라디안). 0이면 코트 가로 방향 */
  angle: number;
}

export interface Token {
  id: string;
  kind: TokenKind;
  /** kind === 'player' 일 때만 */
  team?: TeamId;
  /** 원 안에 표시되는 글자 (예: "1", "C", "PG") */
  label: string;
}

export interface Step {
  id: string;
  /** 이 스텝이 "끝난" 시점의 말 위치 */
  positions: Record<string, Vec>;
  /** 직선 대신 곡선으로 움직일 때의 중간 경유점 */
  paths: Record<string, Vec[]>;
  /** 이동 표기 방식. 지정 없으면 자동(공 소유자는 드리블, 그 외는 컷) */
  moveStyles: Record<string, MoveStyle>;
  /** 이 장면에만 보이는 스크린 마커들 */
  screens: ScreenPin[];
  /** 이 스텝 끝에서 공을 가진 선수 id. null이면 공이 떠 있는 상태 */
  ballHolder: string | null;
  /** 이 장면에 대한 설명 */
  note: string;
  /** 이 스텝으로 넘어오는 데 걸리는 시간 (ms) */
  duration: number;
}

/**
 * 갈래(분기 선). 전술은 갈래의 트리로 이루어진다.
 *
 * 본선(루트)은 parentId === null 이고 steps[0]이 시작 배치다.
 * 분기 갈래는 부모의 장면을 fromIndex 번째까지 공유하고,
 * 그 다음부터 자기만의 steps 를 이어 붙인다.
 */
export interface Line {
  id: string;
  name: string;
  parentId: string | null;
  /** 부모의 해석된 장면 목록에서 갈라지는 지점 (이 장면까지는 공유) */
  fromIndex: number;
  /** 분기점 다음부터 이 갈래가 가진 장면들 */
  steps: Step[];
}

export interface Play {
  id: string;
  name: string;
  courtType: CourtType;
  tokens: Token[];
  /** 첫 항목이 본선 */
  lines: Line[];
  updatedAt: number;
}

export const BALL_ID = 'ball';
