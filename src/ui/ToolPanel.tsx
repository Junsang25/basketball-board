import { useEffect, useRef, useState } from 'react';
import type { CourtType, Play, TeamId } from '../lib/types';

export interface ToolPanelProps {
  play: Play;
  rotated: boolean;
  canUndo: boolean;
  busy: string | null;
  screenMode: boolean;
  onToggleScreenMode(): void;
  onCourtType(type: CourtType): void;
  onToggleRotate(): void;
  onUndo(): void;
  onAddPlayer(team: TeamId): void;
  onAddCone(): void;
  onExportPNG(): void;
  onExportVideo(): void;
  onExportFile(): void;
  onImportFile(file: File): void;
  onOpenPlaybook(): void;
  onHideChrome(): void;
}

/** 도구판 속 내용. 판 자체(머리말·이동·닫기)는 Panel이 맡는다. */
export function ToolPanel(props: ToolPanelProps) {
  const {
    play, rotated, canUndo, busy, screenMode, onToggleScreenMode,
    onCourtType, onToggleRotate, onUndo, onAddPlayer, onAddCone,
    onExportPNG, onExportVideo, onExportFile, onImportFile, onOpenPlaybook, onHideChrome,
  } = props;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <>
      <div className="tool-group">
        <span className="tool-label">말 추가</span>
        <div className="tool-row">
          <button className="chip" onClick={() => onAddPlayer('offense')}>
            <i className="dot dot-offense" />공격
          </button>
          <button className="chip" onClick={() => onAddPlayer('defense')}>
            <i className="dot dot-defense" />수비
          </button>
          <button className="chip" onClick={onAddCone}>
            <i className="dot dot-cone" />콘
          </button>
        </div>
      </div>

      <div className="tool-group">
        <button
          className={`chip chip-wide ${screenMode ? 'on' : ''}`}
          onClick={onToggleScreenMode}
        >
          <i className="dot dot-screen" />스크린 놓기
        </button>
        {screenMode && (
          <p className="tool-hint">
            클릭해서 놓고, 위아래로 움직여 각도를 맞춘 뒤 다시 클릭.
            코트 밖으로 끌어내면 지워져요.
          </p>
        )}
      </div>

      <div className="tool-sep" />

      <div className="tool-row">
        <div className="seg">
          <button
            className={`seg-btn ${play.courtType === 'half' ? 'on' : ''}`}
            onClick={() => onCourtType('half')}
          >
            하프
          </button>
          <button
            className={`seg-btn ${play.courtType === 'full' ? 'on' : ''}`}
            onClick={() => onCourtType('full')}
          >
            풀코트
          </button>
        </div>
        <div className="spacer" />
        <button
          className="icon-btn"
          onClick={onToggleRotate}
          title={rotated ? '세로로 보기' : '가로로 보기'}
          aria-label={rotated ? '세로로 보기' : '가로로 보기'}
        >
          {rotated ? '⇕' : '⇄'}
        </button>
        <button
          className="icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="되돌리기 (Ctrl+Z)"
          aria-label="되돌리기"
        >
          ↺
        </button>
      </div>

      <div className="tool-sep" />

      <div className="tool-group" ref={menuRef}>
        <div className="tool-row">
          <button className="chip" onClick={onOpenPlaybook}>
            내 전술
          </button>

          <button
            className={`chip ${menuOpen ? 'on' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            disabled={!!busy}
          >
            {busy ?? '내보내기'}
          </button>

          <div className="spacer" />

          <button
            className="icon-btn"
            onClick={onHideChrome}
            title="코트만 보기 — 판을 모두 닫고 전체화면"
            aria-label="코트만 보기"
          >
            ⛶
          </button>
        </div>

        {/* 판 안에서 펼친다. 떠 있는 메뉴로 띄우면 판 밖으로 잘린다. */}
        {menuOpen && !busy && (
          <div className="submenu">
            <button className="menu-item" onClick={() => { setMenuOpen(false); onExportPNG(); }}>
              이 장면 이미지 (PNG)
            </button>
            <button className="menu-item" onClick={() => { setMenuOpen(false); onExportVideo(); }}>
              움직임 영상 (MP4)
            </button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { setMenuOpen(false); onExportFile(); }}>
              전술 파일로 저장
            </button>
            <button className="menu-item" onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}>
              전술 파일 불러오기
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
