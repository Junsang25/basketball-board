import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Vec } from '../lib/types';
import { makeTransform, outsideCourt } from '../lib/court';
import type { Frame } from '../lib/frame';
import type { Play } from '../lib/types';
import { drawScene, hitTest, hitTestScreen } from '../lib/render';

export type BoardTool = 'select' | 'screen';

/** 이만큼 위아래로 움직이면 반 바퀴 돈다 (막대는 반 바퀴면 모든 방향이 나온다) */
const AIM_SPAN_PX = 130;
const AIM_RATE = Math.PI / AIM_SPAN_PX;

export interface BoardProps {
  play: Play;
  frame: Frame;
  rotated: boolean;
  tool: BoardTool;
  selectedId: string | null;
  /** 곡선 조절 핸들 위치 (없으면 null) */
  handlePos: Vec | null;
  /** 재생 중에는 조작을 막는다 */
  interactive: boolean;
  showGhosts: boolean;
  onSize(w: number, h: number): void;
  onSelect(id: string | null): void;
  onDragToken(id: string, pos: Vec): void;
  onDragHandle(pos: Vec): void;
  onDragEnd(): void;
  onEmptyTap(pos: Vec): void;
  /** 새 막대를 놓고 그 id를 돌려준다 */
  onPlaceScreen(pos: Vec): string;
  onMoveScreen(id: string, pos: Vec): void;
  /** 설치 중 각도 맞추기. fresh면 방금 놓은 막대라 되돌리기 기록을 또 남기지 않는다 */
  onAimScreen(id: string, angle: number, fresh: boolean): void;
  onDeleteScreen(id: string): void;
  /** 코트 밖으로 끌어내서 버렸다. 끌기 시작 전 상태로 한 번에 되돌아가야 한다 */
  onTrashScreen(id: string): void;
}

type DragState =
  | { kind: 'token'; id: string; grabOffset: Vec }
  | { kind: 'screen'; id: string; grabOffset: Vec }
  | { kind: 'handle' }
  | null;

/** 각도를 맞추는 중인 막대 */
interface Aim {
  id: string;
  /** 기준이 되는 화면 y */
  originY: number;
  baseAngle: number;
  /** 터치는 손을 떼는 순간 확정, 마우스는 다시 클릭할 때 확정 */
  byTouch: boolean;
  fresh: boolean;
}

export function Board(props: BoardProps) {
  const {
    play, frame, rotated, tool, selectedId, handlePos, interactive, showGhosts,
    onSize, onSelect, onDragToken, onDragHandle, onDragEnd, onEmptyTap,
    onPlaceScreen, onMoveScreen, onAimScreen, onDeleteScreen, onTrashScreen,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverScreenId, setHoverScreenId] = useState<string | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  /** 지금 손을 떼면 버려지는 막대 */
  const [trashId, setTrashId] = useState<string | null>(null);
  const dragRef = useRef<DragState>(null);
  const movedRef = useRef(false);

  const tf = useMemo(
    () => makeTransform(size.w, size.h, play.courtType, rotated),
    [play.courtType, rotated, size.w, size.h],
  );

  // 캔버스 크기를 컨테이너에 맞춘다
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const apply = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(80, Math.floor(rect.width));
      const h = Math.max(80, Math.floor(rect.height));
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      onSize(w, h);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [onSize]);

  // 모드에서 나가거나 재생이 시작되면 설치를 끝낸다 (막대는 그대로 남는다)
  useEffect(() => {
    if (tool !== 'screen' || !interactive) {
      setAim(null);
      setHoverScreenId(null);
      setTrashId(null);
    }
  }, [tool, interactive]);

  // 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = size;
    if (w === 0 || h === 0) return;

    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const screenMode = interactive && tool === 'screen';

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawScene(ctx, tf, play, frame, {
      selectedId: interactive && tool === 'select' ? selectedId : null,
      ghosts: showGhosts,
      handleFor: interactive && tool === 'select' ? selectedId : null,
      handlePos: interactive && tool === 'select' ? handlePos : null,
      activeScreenId: screenMode ? aim?.id ?? hoverScreenId : null,
      trashScreenId: screenMode ? trashId : null,
    });
    ctx.restore();
  }, [
    play, frame, tf, size, selectedId, handlePos, interactive, showGhosts,
    tool, hoverScreenId, aim, trashId,
  ]);

  const localFromClient = useCallback((clientX: number, clientY: number): Vec => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const toLocal = useCallback(
    (e: React.PointerEvent | React.MouseEvent): Vec => localFromClient(e.clientX, e.clientY),
    [localFromClient],
  );

  /**
   * 위로 올리면 화면에서 반시계로 돈다.
   * 가로 코트는 좌표가 전치되면서 회전 방향이 뒤집히기 때문에 부호를 맞춰준다.
   */
  const angleFor = useCallback(
    (a: Aim, y: number) => a.baseAngle + (a.originY - y) * AIM_RATE * (rotated ? 1 : -1),
    [rotated],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive) return;
      if (e.button === 2) return; // 우클릭은 contextmenu에서 처리
      const local = toLocal(e);
      movedRef.current = false;

      if (tool === 'screen') {
        // 각도를 맞추는 중이면 이 클릭은 확정이다
        if (aim) {
          setAim(null);
          onDragEnd();
          return;
        }

        const hit = hitTestScreen(frame, tf, local, e.pointerType === 'mouse' ? 10 : 16);
        if (hit) {
          const mark = frame.screens.find((s) => s.id === hit)!;
          const c = tf.toCanvas(mark.pos);
          dragRef.current = {
            kind: 'screen',
            id: hit,
            grabOffset: { x: c.x - local.x, y: c.y - local.y },
          };
          setHoverScreenId(hit);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }

        // 빈 자리 -> 바로 놓고, 손/커서를 위아래로 움직이는 동안 각도를 맞춘다
        dragRef.current = null;
        const id = onPlaceScreen(tf.toCourt(local));
        if (!id) return;
        setAim({
          id,
          originY: local.y,
          baseAngle: 0,
          byTouch: e.pointerType !== 'mouse',
          fresh: true,
        });
        setHoverScreenId(null);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      // 1) 곡선 핸들
      if (selectedId && handlePos) {
        const hc = tf.toCanvas(handlePos);
        if (Math.hypot(hc.x - local.x, hc.y - local.y) <= Math.max(14, tf.px(1.2))) {
          dragRef.current = { kind: 'handle' };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
      }

      // 2) 말
      const hitId = hitTest(play, frame, tf, local, e.pointerType === 'mouse' ? 4 : 12);
      if (hitId) {
        const p = frame.positions[hitId];
        const c = tf.toCanvas(p);
        dragRef.current = {
          kind: 'token',
          id: hitId,
          grabOffset: { x: c.x - local.x, y: c.y - local.y },
        };
        onSelect(hitId);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      // 3) 빈 코트
      dragRef.current = null;
      onEmptyTap(tf.toCourt(local));
    },
    [
      interactive, tool, toLocal, selectedId, handlePos, tf, play, frame, aim,
      onSelect, onEmptyTap, onPlaceScreen, onDragEnd,
    ],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive) return;
      const local = toLocal(e);

      // 설치 중이면 위아래로 움직인 만큼 돌린다 (가로 움직임은 무시)
      if (aim) {
        onAimScreen(aim.id, angleFor(aim, local.y), aim.fresh);
        return;
      }

      const drag = dragRef.current;
      if (!drag) {
        // 커서 아래 막대를 밝게 해서 뭘 집게 되는지 보여준다
        if (tool === 'screen') {
          setHoverScreenId(hitTestScreen(frame, tf, local));
        } else if (hoverScreenId) {
          setHoverScreenId(null);
        }
        return;
      }

      movedRef.current = true;
      const target = {
        x: local.x + ('grabOffset' in drag ? drag.grabOffset.x : 0),
        y: local.y + ('grabOffset' in drag ? drag.grabOffset.y : 0),
      };

      if (drag.kind === 'handle') {
        onDragHandle(tf.toCourt(local));
        return;
      }
      if (drag.kind === 'screen') {
        // 코트 밖으로 끌고 나가면 버리기 예고 (막대는 코트 가장자리에 붙어 있는다)
        const court = tf.toCourt(target);
        setTrashId(outsideCourt(court, play.courtType) ? drag.id : null);
        onMoveScreen(drag.id, court);
        return;
      }
      onDragToken(drag.id, tf.toCourt(target));
    },
    [
      interactive, toLocal, tool, frame, tf, hoverScreenId, aim, angleFor, play.courtType,
      onAimScreen, onDragHandle, onMoveScreen, onDragToken,
    ],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      // 터치는 손을 떼면 확정
      if (aim) {
        if (aim.byTouch) {
          setAim(null);
          onDragEnd();
        }
        return;
      }

      const drag = dragRef.current;
      const moved = movedRef.current;
      dragRef.current = null;
      movedRef.current = false;

      // 코트 밖으로 끌어냈으면 버린다
      if (drag?.kind === 'screen' && trashId === drag.id) {
        setTrashId(null);
        onTrashScreen(drag.id);
        return;
      }
      setTrashId(null);

      // 마우스로 기존 막대를 끌지 않고 그냥 눌렀다 떼면 각도를 다시 맞춘다
      if (drag?.kind === 'screen' && !moved && e.pointerType === 'mouse' && tool === 'screen') {
        const mark = frame.screens.find((s) => s.id === drag.id);
        if (mark) {
          setAim({
            id: drag.id,
            originY: toLocal(e).y,
            baseAngle: mark.angle,
            byTouch: false,
            fresh: false,
          });
          return;
        }
      }

      if (drag && moved) onDragEnd();
    },
    [aim, tool, frame, toLocal, trashId, onDragEnd, onTrashScreen],
  );

  // 제스처가 끊긴 것뿐이니 버리지는 않는다
  const onPointerCancel = useCallback(() => {
    setTrashId(null);
    if (aim) {
      setAim(null);
      onDragEnd();
      return;
    }
    if (dragRef.current && movedRef.current) onDragEnd();
    dragRef.current = null;
    movedRef.current = false;
  }, [aim, onDragEnd]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || tool !== 'screen') return;
      e.preventDefault();

      // 설치 중이면 그 막대를 버린다
      if (aim) {
        setAim(null);
        onDeleteScreen(aim.id);
        return;
      }

      const id = hitTestScreen(frame, tf, toLocal(e), 12);
      if (id) {
        onDeleteScreen(id);
        setHoverScreenId(null);
      }
    },
    [interactive, tool, frame, tf, toLocal, aim, onDeleteScreen],
  );

  const cls = [
    'board-canvas',
    interactive && tool === 'screen' ? 'placing' : '',
    aim ? 'aiming' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="board" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className={cls}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => { if (!aim) setHoverScreenId(null); }}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}
