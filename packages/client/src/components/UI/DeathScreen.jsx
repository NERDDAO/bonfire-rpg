import useMultiplayerStore from '../../stores/multiplayerStore';

export default function DeathScreen({ onPurchaseLife }) {
  const isDead = useMultiplayerStore((s) => s.isDead);
  const deathInfo = useMultiplayerStore((s) => s.deathInfo);

  if (!isDead || !deathInfo) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80">
      <div className="max-w-lg w-full mx-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="h-1 bg-[var(--ember)]" />
        <div className="p-8 text-center space-y-6">
          <h1 className="font-[Montserrat] text-3xl font-extrabold text-[var(--text)] tracking-tight">
            You Have Fallen
          </h1>
          <p className="text-[var(--text-secondary)] leading-relaxed text-lg font-light">
            {deathInfo.cause}
          </p>
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4">
            <p className="text-sm text-[var(--text-secondary)] italic leading-relaxed">
              {deathInfo.legend}
            </p>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Your story has been etched into the world's memory.
            Future adventurers may find your remains at {deathInfo.locationName}.
          </p>
          <button
            onClick={() => onPurchaseLife?.()}
            className="px-8 py-3 bg-[var(--ember)] text-white font-[Montserrat] font-bold text-sm rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-[var(--ember-glow)]"
          >
            Purchase New Life
          </button>
        </div>
      </div>
    </div>
  );
}
