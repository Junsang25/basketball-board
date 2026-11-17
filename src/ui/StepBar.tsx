import type { Step } from '../lib/types';

export interface StepBarProps {
  steps: Step[];
  stepIndex: number;
  /** 앞에서 몇 개가 윗 갈래와 공유되는 장면인지 */
  sharedCount: number;
  isPlaying: boolean;
  /** 재생 진행률 0~1 */
  progress: number;
  onSelectStep(i: number): void;
  onAddStep(): void;
  onDuplicateStep(): void;
  onRemoveStep(): void;
  onTogglePlay(): void;
  onNote(text: string): void;
  onDuration(ms: number): void;
}

const SPEED_LABELS: Array<{ ms: number; label: string }> = [
  { ms: 800, label: '빠르게' },
  { ms: 1400, label: '보통' },
  { ms: 2200, label: '느리게' },
];

export function StepBar(props: StepBarProps) {
  const {
    steps, stepIndex, sharedCount, isPlaying, progress,
    onSelectStep, onAddStep, onDuplicateStep, onRemoveStep,
    onTogglePlay, onNote, onDuration,
  } = props;

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isShared = stepIndex < sharedCount;
  const canStructure = !isShared;
  const canRemove = canStructure && steps.length - sharedCount > 1;

  return (
    <section className="stepbar">
      <div className="stepbar-track">
        <button
          className={`btn btn-play ${isPlaying ? 'on' : ''}`}
          onClick={onTogglePlay}
          title={isPlaying ? '멈춤' : '처음부터 재생'}
          disabled={steps.length < 2}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>

        <div className="steps">
          {steps.map((s, i) => (
            <button
              key={s.id}
              className={`step-chip ${i === stepIndex ? 'on' : ''} ${i < sharedCount ? 'shared' : ''}`}
              onClick={() => onSelectStep(i)}
              title={
                (i < sharedCount ? '공유 장면 · ' : '') +
                (s.note || (i === 0 ? '시작 배치' : `${i + 1}번 장면`))
              }
            >
              <span className="step-num">{i === 0 ? '시작' : i + 1}</span>
              {s.note.trim() && <span className="step-dot" />}
            </button>
          ))}
          <button
            className="step-chip step-add"
            onClick={onAddStep}
            disabled={!canStructure}
            title={canStructure ? '다음 장면 추가' : '공유 장면 뒤에는 추가할 수 없어요'}
          >
            +
          </button>
        </div>

        <div className="stepbar-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onDuplicateStep}
            disabled={!canStructure}
            title="이 장면 복제"
          >
            복제
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRemoveStep}
            disabled={!canRemove}
            title="이 장면 삭제"
          >
            삭제
          </button>
        </div>
      </div>

      {isPlaying && (
        <div className="progress">
          <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      <div className="note-row">
        <div className="note-wrap">
          <textarea
            className="note"
            value={step?.note ?? ''}
            onChange={(e) => onNote(e.target.value)}
            rows={2}
            placeholder={
              isFirst
                ? '시작 배치 설명 (예: 1-4 하이 셋, 4번이 트레일)'
                : '이 장면 설명 (예: 5번이 하이 스크린, 1번은 오른쪽으로 드리블)'
            }
          />
          {isShared && (
            <p className="shared-hint">
              앞 갈래와 공유되는 장면이에요. 여기서 고치면 다른 갈래에도 똑같이 반영돼요.
            </p>
          )}
        </div>

        {!isFirst && (
          <div className="speed">
            <span className="label">이동 속도</span>
            <div className="seg seg-sm">
              {SPEED_LABELS.map((s) => (
                <button
                  key={s.ms}
                  className={`seg-btn ${step?.duration === s.ms ? 'on' : ''}`}
                  onClick={() => onDuration(s.ms)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
