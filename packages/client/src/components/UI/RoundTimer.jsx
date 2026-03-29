import { useState, useEffect } from 'react';
import useMultiplayerStore from '../../stores/multiplayerStore';

export default function RoundTimer() {
  const roundActive = useMultiplayerStore((s) => s.roundActive);
  const roundStartedAt = useMultiplayerStore((s) => s.roundStartedAt);
  const roundWindowMs = useMultiplayerStore((s) => s.roundWindowMs);
  const roundActions = useMultiplayerStore((s) => s.roundActions);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!roundActive || !roundStartedAt) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - roundStartedAt;
      const left = Math.max(0, roundWindowMs - elapsed);
      setRemaining(left);
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [roundActive, roundStartedAt, roundWindowMs]);

  if (!roundActive) return null;

  const progress = 1 - remaining / roundWindowMs;
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
      <div className="flex-1 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--ember)] transition-all duration-100 ease-linear rounded-full"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="font-[Montserrat] text-xs font-bold text-[var(--ember)] tabular-nums">
        {seconds}s
      </span>
      <span className="text-xs text-[var(--text-secondary)]">
        {roundActions.length} action{roundActions.length !== 1 ? 's' : ''} queued
      </span>
    </div>
  );
}
