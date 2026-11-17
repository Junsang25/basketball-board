import { useEffect, useRef, useState } from 'react';
import type { Play } from '../lib/types';
import { orderedLines } from '../lib/play';

export interface LineBarProps {
  play: Play;
  currentLineId: string;
  stepIndex: number;
  /** 방금 만들어서 이름을 바로 고치게 할 갈래 */
  focusLineId: string | null;
  onSelect(lineId: string): void;
  onAddBranch(): void;
  onRename(lineId: string, name: string): void;
  onRemove(lineId: string): void;
}

export function LineBar(props: LineBarProps) {
  const { play, currentLineId, stepIndex, focusLineId, onSelect, onAddBranch, onRename, onRemove } = props;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const lines = orderedLines(play);
  const hasBranches = lines.length > 1;

  useEffect(() => {
    if (!focusLineId) return;
    const line = play.lines.find((l) => l.id === focusLineId);
    if (!line) return;
    setEditingId(focusLineId);
    setDraft(line.name);
  }, [focusLineId, play.lines]);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const commit = () => {
    if (editingId) onRename(editingId, draft.trim() || '갈래');
    setEditingId(null);
  };

  return (
    <div className="linebar">
      {hasBranches && (
        <div className="lines">
          {lines.map(({ line, depth }) => {
            const active = line.id === currentLineId;
            const isRoot = line.parentId === null;

            if (active && editingId === line.id) {
              return (
                <span key={line.id} className="line-chip on editing">
                  <input
                    ref={inputRef}
                    className="line-name-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 20))}
                    onBlur={commit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                </span>
              );
            }

            return (
              <span key={line.id} className={`line-chip ${active ? 'on' : ''}`}>
                <button
                  className="line-open"
                  onClick={() => {
                    if (active) {
                      setEditingId(line.id);
                      setDraft(line.name);
                    } else {
                      onSelect(line.id);
                    }
                  }}
                  title={active ? '눌러서 이름 바꾸기' : `${line.name} 보기`}
                >
                  {depth > 0 && <span className="line-depth">{'↳'.repeat(Math.min(depth, 3))}</span>}
                  {line.name}
                </button>
                {!isRoot && (
                  <button
                    className="line-del"
                    onClick={() => onRemove(line.id)}
                    title="이 갈래 삭제 (하위 갈래도 함께)"
                  >
                    ✕
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      <button
        className={`btn btn-sm btn-branch ${hasBranches ? '' : 'quiet'}`}
        onClick={onAddBranch}
        title={`${stepIndex + 1}번 장면에서 갈라지는 갈래를 만듭니다`}
      >
        ＋ {stepIndex + 1}번 장면에서 분기
      </button>
    </div>
  );
}
