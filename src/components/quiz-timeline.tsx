'use client';
import '@/styles/quiz-timeline.css';

export function QuizTimeline({
  startedAt,
  deadline,
  clock,
}: {
  startedAt: string;
  deadline: string;
  clock: number;
}) {
  const remaining = Math.max(0, Date.parse(deadline) - clock);
  const duration = Math.max(1, Date.parse(deadline) - Date.parse(startedAt));
  const percent = Math.min(100, (remaining / duration) * 100);
  const seconds = Math.ceil(remaining / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <div className="quiz-timeline" data-urgent={percent < 20}>
      <div
        className="quiz-timeline-track"
        role="progressbar"
        aria-label="Tiempo restante"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={time}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <span className="quiz-timeline-time">
        Tiempo restante <strong>{time}</strong>
      </span>
    </div>
  );
}
