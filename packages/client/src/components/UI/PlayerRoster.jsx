import useMultiplayerStore from '../../stores/multiplayerStore';

export default function PlayerRoster() {
  const roster = useMultiplayerStore((s) => s.roster);

  if (!roster.length) return null;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
      <h3 className="font-[Montserrat] text-xs font-bold uppercase tracking-widest text-[var(--ember)] mb-3">
        Players
      </h3>
      <div className="space-y-2">
        {roster.map((player) => (
          <div key={player.id} className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                player.isAlive === false ? 'bg-[var(--text-dim)]' : 'bg-emerald-500'
              }`}
            />
            <span className="text-sm text-[var(--text)] font-medium">
              {player.name}
            </span>
            {player.locationId && (
              <span className="text-xs text-[var(--text-dim)] ml-auto truncate max-w-[120px]">
                {player.locationName || player.locationId}
              </span>
            )}
            {player.isAlive === false && (
              <span className="text-xs text-[var(--text-dim)] italic">dead</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
