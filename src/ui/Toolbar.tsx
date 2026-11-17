import { useEffect, useRef, useState } from 'react';
import type { CourtType, Play, TeamId } from '../lib/types';

export interface ToolbarProps {
  play: Play;
  rotated: boolean;
  canUndo: boolean;
  busy: string | null;
  screenMode: boolean;
  onToggleScreenMode(): void;
  onRename(name: string): void;
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

export function Toolbar(props: ToolbarProps) {
  const {
    play, rotated, canUndo, busy, screenMode, onToggleScreenMode,
    onRename, onCourtType, onToggleRotate, onUndo,
    onAddPlayer, onAddCone,
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
    <header className="toolbar">
      <div className="toolbar-row">
        <button className="btn btn-ghost btn-icon" onClick={onOpenPlaybook} title="전술 목록">
          ☰
        </button>

        <input
          className="name-input"
          value={play.name}
          onChange={(e) => onRename(e.target.value)}
          placeholder="전술 이름"
          aria-label="전술 이름"
        />

        <div className="spacer" />

        <button
          className="btn btn-ghost btn-icon"
          onClick={onToggleRotate}
          title={rotated ? '세로로 보기' : '가로로 보기'}
        >
          {rotated ? '⇕' : '⇄'}
        </button>

        <button
          className="btn btn-ghost btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="되돌리기 (Ctrl+Z)"
        >
          ↺
        </button>

        <button
          className="btn btn-ghost btn-icon"
          onClick={onHideChrome}
          title="메뉴 숨기기 — 코트만 보기"
          aria-label="메뉴 숨기기"
        >
          ⛶
        </button>

        <div className="menu-wrap" ref={menuRef}>
          <button className="btn btn-primary" onClick={() => setMenuOpen((v) => !v)} disabled={!!busy}>
            {busy ?? '내보내기'}
          </button>
          {menuOpen && (
            <div className="menu">
              <button className="menu-item" onClick={() => { setMenuOpen(false); onExportPNG(); }}>
                <span>이 장면 이미지 (PNG)</span>
              </button>
              <button className="menu-item" onClick={() => { setMenuOpen(false); onExportVideo(); }}>
                <span>움직임 영상 (MP4)</span>
              </button>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => { setMenuOpen(false); onExportFile(); }}>
                <span>전술 파일로 저장</span>
              </button>
              <button className="menu-item" onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}>
                <span>전술 파일 불러오기</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-row toolbar-row-2">
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

        <span className="label sep-left">말 추가</span>
        <button className="btn btn-chip chip-offense" onClick={() => onAddPlayer('offense')}>
          + 공격
        </button>
        <button className="btn btn-chip chip-defense" onClick={() => onAddPlayer('defense')}>
          + 수비
        </button>
        <button className="btn btn-chip chip-cone" onClick={onAddCone}>
          + 콘
        </button>

        <button
          className={`btn btn-chip chip-screen ${screenMode ? 'on' : ''}`}
          onClick={onToggleScreenMode}
          title="스크린 놓기 모드 (클릭해서 놓고, 위아래로 움직여 각도를 맞춘 뒤 다시 클릭)"
        >
          스크린
        </button>

        <span className="hint">
          {screenMode
            ? '클릭 설치 → 위아래로 움직여 회전 → 다시 클릭해 확정 · 우클릭 삭제 · Esc로 끝내기'
            : '말을 끌어서 배치하고, 장면을 추가해 움직임을 만들어요'}
        </span>
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
    </header>
  );
}
