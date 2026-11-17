import { BALL_ID } from './types';
import type { Line, MoveStyle, Play, Step, Token, Vec } from './types';
import { MAIN_LINE_NAME, uid } from './play';

/**
 * 기본 제공 샘플 전술: 하이 픽앤롤.
 *
 * 스크린 / 드리블 / 컷 / 패스 / 슛 표기가 모두 한 번씩 나오고,
 * 수비 대응에 따라 갈라지는 분기 세 갈래가 들어 있다.
 */

const O = (n: number) => `po${n}`;
const D = (n: number) => `pd${n}`;

const HOOP: Vec = { x: 0, y: 5.25 };

interface Scene {
  note: string;
  duration: number;
  /** 이 장면에서 위치가 바뀐 말만 적는다 */
  move?: Record<string, Vec>;
  /** 곡선 경유점 */
  curve?: Record<string, Vec>;
  /** 표기 방식 직접 지정 */
  style?: Record<string, MoveStyle>;
  /** 이 장면에 놓을 스크린 마커 [x, y, 각도(도)] */
  screens?: Array<[number, number, number]>;
  /** 공 소유자 변경 (null이면 공이 손을 떠난다) */
  ball?: string | null;
  /** ball이 null일 때 공이 도착하는 곳 */
  ballTo?: Vec;
}

interface State {
  positions: Record<string, Vec>;
  holder: string | null;
}

const START: Record<string, Vec> = {
  // 1번을 살짝 왼쪽에 두면 공이 스크리너 반대쪽에 놓여 화면이 덜 겹친다
  [O(1)]: { x: -1.5, y: 31 },
  [O(2)]: { x: 23.2, y: 9 },
  [O(3)]: { x: -23.2, y: 9 },
  [O(4)]: { x: -17, y: 27 },
  [O(5)]: { x: 10, y: 22 },

  [D(1)]: { x: -1.3, y: 26 },
  [D(2)]: { x: 18.8, y: 8.3 },
  [D(3)]: { x: -18.8, y: 8.3 },
  [D(4)]: { x: -13.9, y: 23.1 },
  [D(5)]: { x: 7.7, y: 18.1 },

  [BALL_ID]: { x: -4, y: 33 },
};

/** 본선 */
const MAIN: Scene[] = [
  {
    note: '1-4 스프레드. 2·3번이 코너를 넓게 벌려 도움수비를 묶어둔다.',
    duration: 1400,
  },
  {
    note: '5번이 올라와 1번 오른쪽 어깨에 스크린을 건다.',
    duration: 1300,
    move: {
      [O(5)]: { x: 4, y: 30.5 },
      [D(5)]: { x: 5.5, y: 26 },
    },
    // 1번과 5번 사이에 세로로 선 벽
    screens: [[1.4, 30.8, 90]],
  },
  {
    note: '1번은 스크린을 타고 오른쪽으로 드리블. 5번은 곧바로 림으로 롤한다.',
    duration: 1800,
    move: {
      [O(1)]: { x: 13, y: 22 },
      [O(5)]: { x: 4, y: 14 },
      [D(1)]: { x: 6, y: 26.5 },
      [D(5)]: { x: 11.5, y: 27.5 },
    },
    curve: {
      [O(1)]: { x: 7.5, y: 28.5 },
      [O(5)]: { x: 7, y: 22 },
    },
  },
  // ↑ 여기(2번 인덱스)에서 수비 대응에 따라 갈라진다
  {
    note: '5번 수비가 헤지로 나왔다면 그 뒤로 포켓 패스.',
    duration: 1300,
    move: {
      [O(1)]: { x: 15, y: 20 },
      [O(5)]: { x: 2, y: 9 },
      [D(1)]: { x: 12, y: 23 },
      [D(5)]: { x: 9, y: 18 },
    },
    ball: O(5),
  },
  {
    note: '코너가 벌어져 있어 도움수비가 올 수 없다. 그대로 마무리.',
    duration: 900,
    ball: null,
    ballTo: HOOP,
  },
];

/** 분기 1 — 빅맨이 처질 때 */
const DROP: Scene[] = [
  {
    note: '5번 수비가 림으로 처진다. 1번은 뒤로 빼면서 공간을 만든다.',
    duration: 1300,
    move: {
      [O(1)]: { x: 15, y: 25 },
      [O(5)]: { x: 3, y: 10 },
      [D(5)]: { x: 5, y: 13 },
      [D(1)]: { x: 11, y: 24.5 },
    },
  },
  {
    note: '앞에 아무도 없으니 그대로 풀업 3점.',
    duration: 900,
    ball: null,
    ballTo: HOOP,
  },
];

/** 분기 2 — 스위치할 때 */
const SWITCH: Scene[] = [
  {
    note: '수비가 스위치. 5번에게 작은 1번 수비가 붙는다.',
    duration: 1300,
    move: {
      [O(5)]: { x: 6, y: 11 },
      [D(1)]: { x: 7, y: 15 },
      [D(5)]: { x: 16, y: 25.5 },
    },
  },
  {
    note: '5번이 미스매치. 엔트리 패스를 넣고 1번은 위로 빠진다.',
    duration: 1300,
    move: {
      [O(1)]: { x: 8, y: 30 },
      [D(5)]: { x: 10, y: 28 },
    },
    ball: O(5),
  },
];

/** 분기 2에서 다시 갈라지는 분기 — 더블팀이 올 때 */
const DOUBLE: Scene[] = [
  {
    note: '더블팀이 붙으면 비어 있는 코너 2번에게 킥아웃.',
    duration: 1300,
    move: {
      [D(2)]: { x: 9, y: 11 },
    },
    ball: O(2),
  },
];

function fold(initial: State, scenes: Scene[]): { steps: Step[]; states: State[] } {
  const steps: Step[] = [];
  const states: State[] = [];

  let positions = { ...initial.positions };
  let holder = initial.holder;

  for (const sc of scenes) {
    positions = { ...positions, ...(sc.move ?? {}) };
    if (sc.ball !== undefined) holder = sc.ball;
    if (sc.ballTo) positions = { ...positions, [BALL_ID]: sc.ballTo };

    const paths: Record<string, Vec[]> = {};
    for (const [id, point] of Object.entries(sc.curve ?? {})) paths[id] = [point];

    steps.push({
      id: uid('s'),
      positions: { ...positions },
      paths,
      moveStyles: { ...(sc.style ?? {}) },
      screens: (sc.screens ?? []).map(([x, y, deg]) => ({
        id: uid('sc'),
        pos: { x, y },
        angle: (deg * Math.PI) / 180,
      })),
      ballHolder: holder,
      note: sc.note,
      duration: sc.duration,
    });
    states.push({ positions: { ...positions }, holder });
  }

  return { steps, states };
}

export function createSamplePlay(): Play {
  const tokens: Token[] = [];
  for (let n = 1; n <= 5; n++) {
    tokens.push({ id: O(n), kind: 'player', team: 'offense', label: String(n) });
  }
  for (let n = 1; n <= 5; n++) {
    tokens.push({ id: D(n), kind: 'player', team: 'defense', label: String(n) });
  }
  tokens.push({ id: BALL_ID, kind: 'ball', label: '' });

  const main = fold({ positions: START, holder: O(1) }, MAIN);

  // 본선 2번 인덱스(= 3번 장면)에서 갈라진다
  const BRANCH_AT = 2;
  const atBranch = main.states[BRANCH_AT];

  const drop = fold(atBranch, DROP);
  const sw = fold(atBranch, SWITCH);
  // 스위치 갈래의 마지막 장면에서 한 번 더 갈라진다
  const double = fold(sw.states[sw.states.length - 1], DOUBLE);

  const rootId = uid('ln');
  const switchId = uid('ln');

  const lines: Line[] = [
    { id: rootId, name: MAIN_LINE_NAME, parentId: null, fromIndex: 0, steps: main.steps },
    {
      id: uid('ln'),
      name: '드롭이면',
      parentId: rootId,
      fromIndex: BRANCH_AT,
      steps: drop.steps,
    },
    {
      id: switchId,
      name: '스위치하면',
      parentId: rootId,
      fromIndex: BRANCH_AT,
      steps: sw.steps,
    },
    {
      id: uid('ln'),
      name: '더블팀 오면',
      parentId: switchId,
      // 스위치 갈래의 해석된 장면 기준 마지막 번호
      fromIndex: BRANCH_AT + sw.steps.length,
      steps: double.steps,
    },
  ];

  return {
    id: uid('play'),
    name: '하이 픽앤롤 (샘플)',
    courtType: 'half',
    tokens,
    lines,
    updatedAt: Date.now(),
  };
}
