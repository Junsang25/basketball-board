import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CourtType } from '../lib/types';

export type MenuPlace = 'offense' | 'defense' | 'cone' | 'screen';

export interface MenuScreenProps {
  name: string;
  courtType: CourtType;
  rotated: boolean;
  canUndo: boolean;
  busy: string | null;
  /** 장면 갈래·장면 띠·설명 — 한 덩어리로 받는다 */
  scenes: ReactNode;
  onName(name: string): void;
  onPlace(kind: MenuPlace): void;
  onCourtType(type: CourtType): void;
  onToggleRotate(): void;
  onUndo(): void;
  onFullscreen(): void;
  onExportPNG(): void;
  onExportVideo(): void;
  onExportFile(): void;
  onImportFile(file: File): void;
  onOpenPlaybook(): void;
  onOpenSettings(): void;
  onClose(): void;
}

const PLACES: Array<{ kind: MenuPlace; label: string; dot: string }> = [
  { kind: 'offense', label: '공격', dot: 'dot-offense' },
  { kind: 'defense', label: '수비', dot: 'dot-defense' },
  { kind: 'cone', label: '콘', dot: 'dot-cone' },
  { kind: 'screen', label: '스크린', dot: 'dot-screen' },
];

/**
 * 코트와 따로 노는 메뉴 화면.
 * 코트 위에 떠 있지 않으니 가릴 일이 없고, 말을 놓으면 닫혀서 코트로 돌아간다.
 */
export function MenuScreen(props: MenuScreenProps) {
  const {
    name, courtType, rotated, canUndo, busy, scenes,
    onName, onPlace, onCourtType, onToggleRotate, onUndo, onFullscreen,
    onExportPNG, onExportVideo, onExportFile, onImportFile, onOpenPlaybook, onOpenSettings, onClose,
  } = props;

  const [exportOpen, setExportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const done = (fn: () => void) => () => {
    setExportOpen(false);
    fn();
  };
  const pickFile = () => {
    setExportOpen(false);
    fileRef.current?.click();
  };

  return (
    <div className="menu-screen" role="dialog" aria-label="메뉴">
      <div className="menu-inner">
        <div className="menu-top">
          <input
            className="name-input"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="전술 이름"
            aria-label="전술 이름"
          />
          <button className="btn btn-primary" onClick={onClose}>
            코트로
          </button>
        </div>

        <section className="menu-section">
          <span className="label">말 놓기</span>
          <div className="place-grid">
            {PLACES.map((p) => (
              <button key={p.kind} className="place-tile" onClick={() => onPlace(p.kind)}>
                <i className={`dot ${p.dot}`} />
                {p.label}
              </button>
            ))}
          </div>
          <p className="hint-sm">누르면 코트로 돌아가요. 놓고 싶은 자리를 터치하세요.</p>
        </section>

        <section className="menu-section">
          <span className="label">장면</span>
          {scenes}
        </section>

        <section className="menu-section">
          <span className="label">코트</span>
          <div className="menu-row">
            <div className="seg">
              <button
                className={`seg-btn ${courtType === 'half' ? 'on' : ''}`}
                onClick={() => onCourtType('half')}
              >
                하프
              </button>
              <button
                className={`seg-btn ${courtType === 'full' ? 'on' : ''}`}
                onClick={() => onCourtType('full')}
              >
                풀코트
              </button>
            </div>
            <button className="chip" onClick={onToggleRotate}>
              {rotated ? '세로로 보기' : '가로로 보기'}
            </button>
            <button className="chip" onClick={onUndo} disabled={!canUndo}>
              되돌리기
            </button>
            <button className="chip" onClick={onFullscreen}>
              전체화면
            </button>
          </div>
        </section>

        <section className="menu-section">
          <span className="label">전술</span>
          <div className="menu-row">
            <button className="chip" onClick={onOpenPlaybook}>
              내 전술
            </button>
            <button
              className={`chip ${exportOpen ? 'on' : ''}`}
              onClick={() => setExportOpen((v) => !v)}
              disabled={!!busy}
            >
              {busy ?? '내보내기'}
            </button>
            <button className="chip" onClick={onOpenSettings}>
              설정
            </button>
          </div>

          {exportOpen && !busy && (
            <div className="submenu">
              <button className="menu-item" onClick={done(onExportPNG)}>
                이 장면 이미지 (PNG)
              </button>
              <button className="menu-item" onClick={done(onExportVideo)}>
                움직임 영상 (MP4)
              </button>
              <div className="menu-sep" />
              <button className="menu-item" onClick={done(onExportFile)}>
                전술 파일로 저장
              </button>
              <button className="menu-item" onClick={pickFile}>
                전술 파일 불러오기
              </button>
            </div>
          )}
        </section>
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
    </div>
  );
}
