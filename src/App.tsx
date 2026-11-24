import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CourtType, MoveStyle, Play, Vec } from './lib/types';
import { BALL_ID } from './lib/types';
import { clampToCourt, makeTransform } from './lib/court';
import { dist } from './lib/geom';
import { frameAt } from './lib/frame';
import {
  addBranch, addScreenAt, addStepAt, addToken, canRemoveStep, createPlay,
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
import { loadUi, lookFrom, saveUi } from './lib/uiState';
import type { UiState } from './lib/uiState';
import { Board } from './ui/Board';
import type { BoardTool, PlaceKind } from './ui/Board';
import { MenuScreen } from './ui/MenuScreen';
import type { MenuPlace } from './ui/MenuScreen';
import { LineBar } from './ui/LineBar';
import { StepBar } from './ui/StepBar';
import { Inspector } from './ui/Inspector';
import { PlaybookPanel } from './ui/PlaybookPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import './styles.css';

/** 말을 놓으려 할 때 코트 위에 띄우는 안내 */
const PLACE_HINT: Record<Exclude<BoardTool, 'select'>, string> = {
  offense: '놓을 자리를 터치하세요 · 공격',
  defense: '놓을 자리를 터치하세요 · 수비',
  cone: '놓을 자리를 터치하세요 · 콘',
  screen: '터치해서 놓고, 위아래로 움직여 각도를 맞추세요',
};

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
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [focusLineId, setFocusLineId] = useState<string | null>(null);
  const [tool, setTool] = useState<BoardTool>('select');
  /** 이 기기의 보기 설정 */
  const [ui, setUi] = useState<UiState>(loadUi);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // ---- 보기 설정 ----
  useEffect(() => {
    saveUi(ui);
  }, [ui]);

  /** 코트 디자인과 말 크기 — 화면·PNG·영상이 같이 쓴다 */
  const look = useMemo(() => lookFrom(ui), [ui]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      // iOS 사파리처럼 지원이 없는 곳에서는 조용히 넘어간다
      void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    }
    setMenuOpen(false);
  }, []);

  /** 메뉴에서 말·스크린을 고르면 메뉴를 닫고, 다음 터치가 코트에 놓인다 */
  const startPlacing = useCallback((kind: MenuPlace) => {
    setTool(kind);
    setSelectedId(null);
    setIsPlaying(false);
    setMenuOpen(false);
  }, []);

  /** 구석 버튼: 재생 중이면 멈춤, 놓는 중이면 취소, 아니면 메뉴 */
  const onCorner = useCallback(() => {
    if (isPlaying) setIsPlaying(false);
    else if (tool !== 'select') setTool('select');
    else setMenuOpen(true);
  }, [isPlaying, tool]);

  // ---- 말 놓기/삭제 ----
  const onPlaceToken = useCallback(
    (kind: PlaceKind, raw: Vec) => {
      const pos = clampToCourt(raw, play.courtType);
      const token =
        kind === 'cone'
          ? ({ kind: 'cone', label: '' } as const)
          : ({ kind: 'player', team: kind, label: nextPlayerLabel(play, kind) } as const);
      const { play: next, tokenId } = addToken(play, token, pos);
      commit(next);
      setSelectedId(tokenId);
      setTool('select');
    },
    [play, commit],
  );

  const removeSelected = useCallback(() => {
    if (!selectedId || selectedId === BALL_ID) return;
    commit(removeToken(play, selectedId));
    setSelectedId(null);
  }, [selectedId, play, commit]);

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
    setMenuOpen(false);
    resetView();
  }, [play.courtType, resetView]);

  const loadSample = useCallback(() => {
    const sample = createSamplePlay();
    setPlays((ps) => [sample, ...ps]);
    setPlayId(sample.id);
    setShowPlaybook(false);
    setMenuOpen(false);
    resetView();
  }, [resetView]);

  const openPlay = useCallback(
    (id: string) => {
      setPlayId(id);
      setShowPlaybook(false);
      setMenuOpen(false);
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
      setMenuOpen(false);
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
      await exportPNG(play, steps, safeIndex, rotated, line.parentId ? line.name : null, true, look);
      showToast('이미지를 저장했어요');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '이미지 저장에 실패했어요');
    } finally {
      setBusy(null);
    }
  }, [play, steps, safeIndex, rotated, line, showToast, look]);

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
        look,
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
  }, [play, steps, rotated, showToast, look]);

  // ---- 키보드 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;

      // 메뉴가 열려 있을 땐 Esc만 받는다 (스페이스가 버튼을 또 누르지 않게)
      if (menuOpen) {
        if (e.key === 'Escape') setMenuOpen(false);
        return;
      }

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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, togglePlay, steps.length, selectedId, removeSelected, menuOpen]);

  // 눌러 둔 말 옆에 띄우되, 말을 가리지 않게 먼 쪽 가장자리에 붙인다
  const inspectorDock = useMemo<'top' | 'bottom'>(() => {
    if (!selectedToken || boardSize.h === 0) return 'bottom';
    const pos = frame.positions[selectedToken.id];
    if (!pos) return 'bottom';
    const c = makeTransform(boardSize.w, boardSize.h, play.courtType, rotated).toCanvas(pos);
    return c.y > boardSize.h / 2 ? 'top' : 'bottom';
  }, [selectedToken, frame, boardSize, play.courtType, rotated]);

  const placeHint = tool !== 'select' && !isPlaying ? PLACE_HINT[tool] : null;

  return (
    <div className={`app ${ui.compact ? 'compact' : ''}`}>
      <main className="stage">
        <Board
          play={play}
          look={look}
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
          onPlaceToken={onPlaceToken}
          onPlaceScreen={onPlaceScreen}
          onMoveScreen={onMoveScreen}
          onAimScreen={onAimScreen}
          onDeleteScreen={onDeleteScreen}
          onTrashScreen={onTrashScreen}
        />
      </main>

      {!menuOpen && (
        <button
          className={`corner-btn ${isPlaying || tool !== 'select' ? 'active' : ''}`}
          onClick={onCorner}
          title={isPlaying ? '멈춤' : tool !== 'select' ? '놓기 끝내기' : '메뉴'}
          aria-label={isPlaying ? '멈춤' : tool !== 'select' ? '놓기 끝내기' : '메뉴'}
        >
          {isPlaying ? '■' : tool !== 'select' ? '✕' : '☰'}
          {tool === 'select' && !isPlaying && steps.length > 1 && (
            <span className="corner-step">
              {safeIndex + 1}/{steps.length}
            </span>
          )}
        </button>
      )}

      {placeHint && !menuOpen && <div className="place-hint">{placeHint}</div>}

      {isPlaying && (
        <div className="play-progress">
          <div className="play-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {selectedToken && selectedToken.kind !== 'ball' && !isPlaying && tool === 'select' && !menuOpen && (
        <Inspector
          token={selectedToken}
          canStyle={selectedToken.kind === 'player' && safeIndex > 0 && selectedMoved}
          moveStyle={effectiveMoveStyle(steps, safeIndex, selectedToken.id)}
          compact={ui.compact}
          dock={inspectorDock}
          onMoveStyle={(s: MoveStyle) =>
            commit(setMoveStyleAt(play, lineId, safeIndex, selectedToken.id, s))
          }
          onRemove={removeSelected}
        />
      )}

      {menuOpen && (
        <MenuScreen
          name={play.name}
          courtType={play.courtType}
          rotated={rotated}
          canUndo={canUndo}
          busy={busy}
          onName={(name) =>
            setPlays((ps) => upsertPlay(ps, { ...play, name, updatedAt: Date.now() }))
          }
          onPlace={startPlacing}
          onCourtType={onCourtType}
          onToggleRotate={() => setRotateOverride(!rotated)}
          onUndo={undo}
          onFullscreen={toggleFullscreen}
          onExportPNG={doExportPNG}
          onExportVideo={doExportVideo}
          onExportFile={() => exportPlayFile(play)}
          onImportFile={onImportFile}
          onOpenPlaybook={() => setShowPlaybook(true)}
          onOpenSettings={() => {
            // 설정은 코트를 보면서 골라야 하니 메뉴는 잠깐 접는다
            setMenuOpen(false);
            setShowSettings(true);
          }}
          onClose={() => setMenuOpen(false)}
          scenes={
            <>
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
                onTogglePlay={() => {
                  // 재생은 코트에서 봐야 하니 메뉴를 닫고 시작한다
                  if (!isPlaying) setMenuOpen(false);
                  togglePlay();
                }}
                onNote={(note) =>
                  setPlays((ps) => upsertPlay(ps, updateStepAt(play, lineId, safeIndex, { note })))
                }
                onDuration={(duration) => commit(updateStepAt(play, lineId, safeIndex, { duration }))}
              />
            </>
          }
        />
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

      {showSettings && (
        <SettingsPanel
          themeId={ui.themeId}
          tokenScale={ui.tokenScale}
          compact={ui.compact}
          onTheme={(themeId) => setUi((u) => ({ ...u, themeId }))}
          onTokenScale={(tokenScale) => setUi((u) => ({ ...u, tokenScale }))}
          onCompact={(compact) => setUi((u) => ({ ...u, compact }))}
          onClose={() => {
            setShowSettings(false);
            setMenuOpen(true);
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
