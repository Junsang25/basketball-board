import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CourtType, MoveStyle, Play, TeamId, Vec } from './lib/types';
import { BALL_ID } from './lib/types';
import { clampToCourt, courtLength } from './lib/court';
import { dist } from './lib/geom';
import { frameAt } from './lib/frame';
import {
  addBranch, addScreenAt, addStepAt, addToken, ballOffsetFor, canRemoveStep, createPlay,
  duplicateStepAt, effectiveMoveStyle, getLine, moveScreenAt, moveTokenAt, nextPlayerLabel,
  removeLine, removeScreenAt, removeStepAt, removeToken, renameLine, resolveSteps, rootLine,
  setScreenAngleAt, setMoveStyleAt, setWaypointAt, sharedCount, uid, updateStepAt,
} from './lib/play';
import { buildTimeline, sampleTimeline } from './lib/timeline';
import { canExportVideo, exportPNG, exportVideo, preferRotated } from './lib/exportMedia';
import {
  ensurePlaybook, exportPlayFile, exportPlaybookFile, importFromFile,
  savePlaybook, upsertPlay,
} from './lib/storage';
import { createSamplePlay } from './lib/sample';
import { Board } from './ui/Board';
import type { BoardTool } from './ui/Board';
import { Toolbar } from './ui/Toolbar';
import { LineBar } from './ui/LineBar';
import { StepBar } from './ui/StepBar';
import { Inspector } from './ui/Inspector';
import { PlaybookPanel } from './ui/PlaybookPanel';
import './styles.css';

/** 새 말을 놓을 후보 자리 (겹치지 않는 곳을 고른다) */
const SPOTS: Record<string, Vec[]> = {
  offense: [
    { x: 0, y: 38 }, { x: -15, y: 35 }, { x: 15, y: 35 },
    { x: -22, y: 31 }, { x: 22, y: 31 }, { x: 0, y: 24 },
  ],
  defense: [
    { x: 0, y: 17 }, { x: -7, y: 21 }, { x: 7, y: 21 },
    { x: -15, y: 18 }, { x: 15, y: 18 }, { x: 0, y: 9 },
  ],
  cone: [
    { x: -21, y: 41 }, { x: 21, y: 41 }, { x: 0, y: 43 },
    { x: -21, y: 28 }, { x: 21, y: 28 },
  ],
};

function freeSpot(play: Play, taken: Vec[], group: keyof typeof SPOTS): Vec {
  for (const spot of SPOTS[group]) {
    const p = clampToCourt(spot, play.courtType);
    if (taken.every((t) => dist(t, p) > 3.4)) return p;
  }
  const L = courtLength(play.courtType);
  return clampToCourt(
    { x: (Math.random() - 0.5) * 40, y: 6 + Math.random() * (L - 12) },
    play.courtType,
  );
}

export default function App() {
  const [plays, setPlays] = useState<Play[]>(ensurePlaybook);
  const [playId, setPlayId] = useState<string>('');
  const play = plays.find((p) => p.id === playId) ?? plays[0];

  const [lineIdState, setLineIdState] = useState<string>('');
  const line = getLine(play, lineIdState) ?? rootLine(play);
  const lineId = line.id;

  const [stepIndex, setStepIndexRaw] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState({ stepIndex: 0, t: 1 });
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });
  const [rotateOverride, setRotateOverride] = useState<boolean | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [focusLineId, setFocusLineId] = useState<string | null>(null);
  const [tool, setTool] = useState<BoardTool>('select');
  /** 메뉴를 숨기고 코트만 남긴 상태 */
  const [bare, setBare] = useState(false);

  const historyRef = useRef<Play[]>([]);
  const dragSnapshot = useRef<Play | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const steps = useMemo(() => resolveSteps(play, lineId), [play, lineId]);
  const shared = sharedCount(play, lineId);
  const safeIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const step = steps[safeIndex];

  const rotated = rotateOverride ?? preferRotated(play.courtType, boardSize.w, boardSize.h);

  const setStepIndex = useCallback((i: number) => setStepIndexRaw(Math.max(0, i)), []);

  // 자동 저장
  useEffect(() => {
    const id = setTimeout(() => savePlaybook(plays), 300);
    return () => clearTimeout(id);
  }, [plays]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2800);
  }, []);

  const pushHistory = useCallback((snapshot: Play) => {
    historyRef.current = [...historyRef.current.slice(-40), snapshot];
    setCanUndo(true);
  }, []);

  const commit = useCallback(
    (next: Play, snapshot: Play | null = play) => {
      if (snapshot) pushHistory(snapshot);
      setPlays((ps) => upsertPlay(ps, { ...next, updatedAt: Date.now() }));
    },
    [play, pushHistory],
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    if (!prev) return;
    setPlays((ps) => upsertPlay(ps, prev));
  }, []);

  const resetView = useCallback(() => {
    setStepIndexRaw(0);
    setSelectedId(null);
    setLineIdState('');
    setIsPlaying(false);
    historyRef.current = [];
    setCanUndo(false);
  }, []);

  // ---- 재생 ----
  const timeline = useMemo(
    () => buildTimeline(steps, { holdMs: 550, startHoldMs: 600, endHoldMs: 900 }),
    [steps],
  );

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const started = performance.now();

    const tick = () => {
      const elapsed = performance.now() - started;
      const s = sampleTimeline(timeline, elapsed);
      setPlayhead(s);
      setStepIndexRaw(s.stepIndex);
      if (elapsed >= timeline.total) {
        setIsPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, timeline]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    setSelectedId(null);
    setPlayhead({ stepIndex: 0, t: 1 });
    setIsPlaying(true);
  }, [isPlaying]);

  const progress = useMemo(() => {
    if (!isPlaying) return 0;
    const seg = timeline.segments.find(
      (s) => s.stepIndex === playhead.stepIndex && s.kind === (playhead.t < 1 ? 'move' : 'hold'),
    );
    const at = seg ? seg.start + seg.duration * playhead.t : 0;
    return timeline.total > 0 ? at / timeline.total : 0;
  }, [isPlaying, playhead, timeline]);

  // ---- 현재 프레임 ----
  const frame = useMemo(
    () =>
      isPlaying
        ? frameAt(play, steps, playhead.stepIndex, playhead.t, true)
        : frameAt(play, steps, safeIndex, 1, true),
    [play, steps, isPlaying, playhead, safeIndex],
  );

  const selectedToken = selectedId ? play.tokens.find((t) => t.id === selectedId) ?? null : null;

  // 곡선 조절 핸들
  const handlePos = useMemo<Vec | null>(() => {
    if (!selectedId || safeIndex === 0 || isPlaying) return null;
    const prev = steps[safeIndex - 1]?.positions[selectedId];
    const cur = step?.positions[selectedId];
    if (!prev || !cur || dist(prev, cur) < 2) return null;
    const wp = step.paths[selectedId]?.[0];
    return wp ?? { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
  }, [selectedId, safeIndex, isPlaying, steps, step]);

  const selectedMoved = useMemo(() => {
    if (!selectedId || safeIndex === 0) return false;
    const prev = steps[safeIndex - 1]?.positions[selectedId];
    const cur = step?.positions[selectedId];
    return !!prev && !!cur && dist(prev, cur) > 0.6;
  }, [selectedId, safeIndex, steps, step]);

  // ---- 보드 조작 ----
  const onBoardSize = useCallback((w: number, h: number) => {
    setBoardSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  const onDragToken = useCallback(
    (id: string, pos: Vec) => {
      if (!dragSnapshot.current) dragSnapshot.current = play;
      // 공을 직접 끌면 소유를 풀어준다
      if (id === BALL_ID && step?.ballHolder) {
        const released = updateStepAt(play, lineId, safeIndex, { ballHolder: null });
        setPlays((ps) => upsertPlay(ps, moveTokenAt(released, lineId, safeIndex, BALL_ID, pos)));
        return;
      }
      setPlays((ps) => upsertPlay(ps, moveTokenAt(play, lineId, safeIndex, id, pos)));
    },
    [play, lineId, safeIndex, step],
  );

  const onDragHandle = useCallback(
    (pos: Vec) => {
      if (!selectedId) return;
      if (!dragSnapshot.current) dragSnapshot.current = play;

      const prev = steps[safeIndex - 1]?.positions[selectedId];
      const cur = step?.positions[selectedId];
      if (!prev || !cur) return;

      // 직선 중간점에 가까우면 곡선을 없앤다
      const mid = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
      const next = dist(pos, mid) < 1.2
        ? setWaypointAt(play, lineId, safeIndex, selectedId, null)
        : setWaypointAt(play, lineId, safeIndex, selectedId, pos);
      setPlays((ps) => upsertPlay(ps, next));
    },
    [selectedId, play, lineId, safeIndex, steps, step],
  );

  const onDragEnd = useCallback(() => {
    if (dragSnapshot.current) {
      pushHistory(dragSnapshot.current);
      dragSnapshot.current = null;
    }
  }, [pushHistory]);

  // ---- 스크린 마커 ----
  const onPlaceScreen = useCallback(
    (pos: Vec): string => {
      const { play: next, screenId } = addScreenAt(play, lineId, safeIndex, pos);
      if (next === play) return '';
      commit(next);
      return screenId;
    },
    [play, lineId, safeIndex, commit],
  );

  const onMoveScreen = useCallback(
    (id: string, pos: Vec) => {
      if (!dragSnapshot.current) dragSnapshot.current = play;
      setPlays((ps) => upsertPlay(ps, moveScreenAt(play, lineId, safeIndex, id, pos)));
    },
    [play, lineId, safeIndex],
  );

  const onAimScreen = useCallback(
    (id: string, angle: number, fresh: boolean) => {
      // 방금 놓은 막대는 설치 기록에 각도까지 묶여 있으니 기록을 또 남기지 않는다
      if (!fresh && !dragSnapshot.current) dragSnapshot.current = play;
      setPlays((ps) => upsertPlay(ps, setScreenAngleAt(play, lineId, safeIndex, id, angle)));
    },
    [play, lineId, safeIndex],
  );

  const onDeleteScreen = useCallback(
    (id: string) => commit(removeScreenAt(play, lineId, safeIndex, id)),
    [play, lineId, safeIndex, commit],
  );

  const onTrashScreen = useCallback(
    (id: string) => {
      // 끌고 나간 자취까지 한 번에 되돌아가도록 끌기 전 상태를 기록해둔다
      const base = dragSnapshot.current ?? play;
      dragSnapshot.current = null;
      commit(removeScreenAt(play, lineId, safeIndex, id), base);
      showToast('스크린을 코트 밖으로 버렸어요');
    },
    [play, lineId, safeIndex, commit, showToast],
  );

  // ---- 메뉴 숨김 ----
  // 숨길 때 브라우저 전체화면도 같이 요청한다.
  // iOS 사파리처럼 지원이 없는 곳에서는 조용히 넘어가고 메뉴만 숨는다.
  const toggleBare = useCallback(() => {
    setBare((on) => {
      const next = !on;
      const root = document.documentElement;
      if (next) {
        void root.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
      } else if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
    setSelectedId(null);
  }, []);

  // Esc 등으로 전체화면에서 빠져나오면 메뉴도 같이 돌아온다
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setBare(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleScreenMode = useCallback(() => {
    setTool((t) => (t === 'screen' ? 'select' : 'screen'));
    setSelectedId(null);
    setIsPlaying(false);
  }, []);

  // ---- 말 추가/삭제 ----
  const addPlayer = useCallback(
    (team: TeamId) => {
      const pos = freeSpot(play, Object.values(step?.positions ?? {}), team);
      const { play: next, tokenId } = addToken(
        play,
        { kind: 'player', team, label: nextPlayerLabel(play, team) },
        pos,
      );
      commit(next);
      setSelectedId(tokenId);
    },
    [play, step, commit],
  );

  const addCone = useCallback(() => {
    const pos = freeSpot(play, Object.values(step?.positions ?? {}), 'cone');
    const { play: next, tokenId } = addToken(play, { kind: 'cone', label: '' }, pos);
    commit(next);
    setSelectedId(tokenId);
  }, [play, step, commit]);

  const removeSelected = useCallback(() => {
    if (!selectedId || selectedId === BALL_ID) return;
    commit(removeToken(play, selectedId));
    setSelectedId(null);
  }, [selectedId, play, commit]);

  // ---- 공 ----
  const giveBall = useCallback(() => {
    if (!selectedId) return;
    commit(updateStepAt(play, lineId, safeIndex, { ballHolder: selectedId }));
  }, [selectedId, play, lineId, safeIndex, commit]);

  const dropBall = useCallback(() => {
    if (!step?.ballHolder) return;
    const holderPos = step.positions[step.ballHolder];
    const off = ballOffsetFor(holderPos);
    commit(
      updateStepAt(play, lineId, safeIndex, {
        ballHolder: null,
        positions: {
          ...step.positions,
          [BALL_ID]: clampToCourt(
            { x: holderPos.x + off.x, y: holderPos.y + off.y },
            play.courtType,
          ),
        },
      }),
    );
  }, [step, play, lineId, safeIndex, commit]);

  // ---- 장면 ----
  const onAddStep = useCallback(() => {
    const { play: next, index } = addStepAt(play, lineId, safeIndex);
    if (next === play) return;
    commit(next);
    setStepIndex(index);
  }, [play, lineId, safeIndex, commit, setStepIndex]);

  const onDuplicateStep = useCallback(() => {
    const { play: next, index } = duplicateStepAt(play, lineId, safeIndex);
    if (next === play) return;
    commit(next);
    setStepIndex(index);
  }, [play, lineId, safeIndex, commit, setStepIndex]);

  const onRemoveStep = useCallback(() => {
    if (!canRemoveStep(play, lineId, safeIndex)) return;
    const { play: next, index } = removeStepAt(play, lineId, safeIndex);
    commit(next);
    setStepIndex(index);
  }, [play, lineId, safeIndex, commit, setStepIndex]);

  // ---- 갈래 ----
  const onAddBranch = useCallback(() => {
    const name = `갈래 ${play.lines.length + 1}`;
    const { play: next, lineId: newId } = addBranch(play, lineId, safeIndex, name);
    if (next === play) return;
    commit(next);
    setLineIdState(newId);
    setStepIndex(safeIndex + 1);
    setSelectedId(null);
    setFocusLineId(newId);
    setIsPlaying(false);
  }, [play, lineId, safeIndex, commit, setStepIndex]);

  const onRemoveLine = useCallback(
    (id: string) => {
      const next = removeLine(play, id);
      if (next === play) return;
      commit(next);
      if (!getLine(next, lineIdState)) {
        setLineIdState('');
        setStepIndexRaw(0);
      }
      setIsPlaying(false);
    },
    [play, lineIdState, commit],
  );

  const onSelectLine = useCallback(
    (id: string) => {
      setLineIdState(id);
      setIsPlaying(false);
      setSelectedId(null);
      const len = resolveSteps(play, id).length;
      setStepIndexRaw((i) => Math.max(0, Math.min(i, len - 1)));
    },
    [play],
  );

  // ---- 전술 단위 ----
  const onCourtType = useCallback(
    (type: CourtType) => {
      if (type === play.courtType) return;
      commit({
        ...play,
        courtType: type,
        lines: play.lines.map((l) => ({
          ...l,
          steps: l.steps.map((s) => ({
            ...s,
            positions: Object.fromEntries(
              Object.entries(s.positions).map(([k, v]) => [k, clampToCourt(v, type)]),
            ),
          })),
        })),
      });
      setRotateOverride(null);
    },
    [play, commit],
  );

  const newPlay = useCallback(() => {
    const p = createPlay('새 전술', play.courtType);
    setPlays((ps) => [p, ...ps]);
    setPlayId(p.id);
    setShowPlaybook(false);
    resetView();
  }, [play.courtType, resetView]);

  const loadSample = useCallback(() => {
    const sample = createSamplePlay();
    setPlays((ps) => [sample, ...ps]);
    setPlayId(sample.id);
    setShowPlaybook(false);
    resetView();
  }, [resetView]);

  const openPlay = useCallback(
    (id: string) => {
      setPlayId(id);
      setShowPlaybook(false);
      resetView();
    },
    [resetView],
  );

  const duplicatePlay = useCallback(
    (id: string) => {
      const src = plays.find((p) => p.id === id);
      if (!src) return;
      const copy: Play = {
        ...structuredClone(src),
        id: uid('play'),
        name: `${src.name} 사본`,
        updatedAt: Date.now(),
      };
      setPlays((ps) => [copy, ...ps]);
      setPlayId(copy.id);
      setShowPlaybook(false);
      resetView();
    },
    [plays, resetView],
  );

  const deletePlay = useCallback(
    (id: string) => {
      if (plays.length < 2) return;
      const rest = plays.filter((p) => p.id !== id);
      setPlays(rest);
      if (id === play.id) {
        setPlayId(rest[0].id);
        resetView();
      }
    },
    [plays, play.id, resetView],
  );

  const onImportFile = useCallback(
    async (file: File) => {
      try {
        const imported = await importFromFile(file);
        setPlays((ps) => [...imported, ...ps]);
        setPlayId(imported[0].id);
        resetView();
        showToast(`${imported.length}개 전술을 불러왔어요`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : '파일을 읽지 못했어요');
      }
    },
    [showToast, resetView],
  );

  // ---- 내보내기 ----
  const doExportPNG = useCallback(async () => {
    setBusy('이미지 만드는 중…');
    try {
      await exportPNG(play, steps, safeIndex, rotated, line.parentId ? line.name : null, true);
      showToast('이미지를 저장했어요');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '이미지 저장에 실패했어요');
    } finally {
      setBusy(null);
    }
  }, [play, steps, safeIndex, rotated, line, showToast]);

  const doExportVideo = useCallback(async () => {
    if (steps.length < 2) {
      showToast('장면을 2개 이상 만들면 영상으로 저장할 수 있어요');
      return;
    }
    if (!canExportVideo()) {
      showToast('이 브라우저는 영상 저장을 지원하지 않아요 (Chrome·Edge 권장)');
      return;
    }
    setIsPlaying(false);
    setBusy('영상 0%');
    try {
      await exportVideo(play, {
        rotated,
        withCaption: true,
        holdMs: 900,
        onProgress: (r) => setBusy(`영상 ${Math.round(r * 100)}%`),
      });
      showToast(
        play.lines.length > 1
          ? `${play.lines.length}개 갈래를 이어 붙인 영상을 저장했어요`
          : '영상을 저장했어요',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : '영상 저장에 실패했어요');
    } finally {
      setBusy(null);
    }
  }, [play, steps, rotated, showToast]);

  // ---- 키보드 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStepIndexRaw((i) => Math.min(i + 1, steps.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStepIndexRaw((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && selectedId !== BALL_ID) {
          e.preventDefault();
          removeSelected();
        }
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setTool('select');
        // 전체화면이 안 걸린 채로 숨어 있을 때도 Esc 한 번이면 메뉴가 돌아온다
        if (!document.fullscreenElement) setBare(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, togglePlay, steps.length, selectedId, removeSelected]);

  return (
    <div className={`app ${bare ? 'bare' : ''}`}>
      {bare && (
        <button
          className="fab-menu"
          onClick={toggleBare}
          title="메뉴 보이기 (Esc)"
          aria-label="메뉴 보이기"
        >
          ☰
        </button>
      )}

      {!bare && (
      <Toolbar
        play={play}
        rotated={rotated}
        canUndo={canUndo}
        busy={busy}
        screenMode={tool === 'screen'}
        onToggleScreenMode={toggleScreenMode}
        onRename={(name) => setPlays((ps) => upsertPlay(ps, { ...play, name, updatedAt: Date.now() }))}
        onCourtType={onCourtType}
        onToggleRotate={() => setRotateOverride(!rotated)}
        onUndo={undo}
        onAddPlayer={addPlayer}
        onAddCone={addCone}
        onExportPNG={doExportPNG}
        onExportVideo={doExportVideo}
        onExportFile={() => exportPlayFile(play)}
        onImportFile={onImportFile}
        onOpenPlaybook={() => setShowPlaybook(true)}
        onHideChrome={toggleBare}
      />
      )}

      <main className="stage">
        <Board
          play={play}
          frame={frame}
          rotated={rotated}
          tool={tool}
          selectedId={selectedId}
          handlePos={handlePos}
          interactive={!isPlaying}
          showGhosts={!isPlaying && safeIndex > 0}
          onSize={onBoardSize}
          onSelect={setSelectedId}
          onDragToken={onDragToken}
          onDragHandle={onDragHandle}
          onDragEnd={onDragEnd}
          onEmptyTap={() => setSelectedId(null)}
          onPlaceScreen={onPlaceScreen}
          onMoveScreen={onMoveScreen}
          onAimScreen={onAimScreen}
          onDeleteScreen={onDeleteScreen}
          onTrashScreen={onTrashScreen}
        />

        {selectedToken && !isPlaying && !bare && (
          <Inspector
            token={selectedToken}
            stepIndex={safeIndex}
            moved={selectedMoved}
            moveStyle={effectiveMoveStyle(steps, safeIndex, selectedToken.id)}
            hasWaypoint={!!step?.paths[selectedToken.id]?.length}
            isBallHolder={step?.ballHolder === selectedToken.id}
            onRelabel={(label) =>
              commit({
                ...play,
                tokens: play.tokens.map((t) => (t.id === selectedToken.id ? { ...t, label } : t)),
              })
            }
            onGiveBall={giveBall}
            onDropBall={dropBall}
            onMoveStyle={(s: MoveStyle) =>
              commit(setMoveStyleAt(play, lineId, safeIndex, selectedToken.id, s))
            }
            onClearWaypoint={() =>
              commit(setWaypointAt(play, lineId, safeIndex, selectedToken.id, null))
            }
            onRemove={removeSelected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </main>

      {!bare && (
      <div className="bottom">
        <LineBar
          play={play}
          currentLineId={lineId}
          stepIndex={safeIndex}
          focusLineId={focusLineId}
          onSelect={onSelectLine}
          onAddBranch={onAddBranch}
          onRename={(id, name) => {
            commit(renameLine(play, id, name));
            setFocusLineId(null);
          }}
          onRemove={onRemoveLine}
        />

        <StepBar
          steps={steps}
          stepIndex={safeIndex}
          sharedCount={shared}
          isPlaying={isPlaying}
          progress={progress}
          onSelectStep={(i) => {
            setIsPlaying(false);
            setStepIndex(i);
          }}
          onAddStep={onAddStep}
          onDuplicateStep={onDuplicateStep}
          onRemoveStep={onRemoveStep}
          onTogglePlay={togglePlay}
          onNote={(note) =>
            setPlays((ps) => upsertPlay(ps, updateStepAt(play, lineId, safeIndex, { note })))
          }
          onDuration={(duration) => commit(updateStepAt(play, lineId, safeIndex, { duration }))}
        />
      </div>
      )}

      {showPlaybook && (
        <PlaybookPanel
          plays={plays}
          currentId={play.id}
          onOpen={openPlay}
          onNew={newPlay}
          onDuplicate={duplicatePlay}
          onDelete={deletePlay}
          onExportAll={() => exportPlaybookFile(plays)}
          onLoadSample={loadSample}
          onClose={() => setShowPlaybook(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
