import { ScrollText, Globe, Activity, Flame, Info } from "lucide-react";
import { useNarrativeStore } from "@/stores/narrativeStore";

const typeConfig = {
  narrator: { border: "border-amber-700", icon: Globe, label: "Narrator", color: "text-amber-300" },
  player: { border: "border-green-700", icon: Activity, label: "You", color: "text-green-300" },
  gm: { border: "border-purple-700", icon: Flame, label: "Game Master", color: "text-purple-300" },
  system: { border: "border-gray-600", icon: Info, label: "System", color: "text-gray-400" },
};

const GameHistory = ({ chatEndRef }) => {
  const { history } = useNarrativeStore();

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-amber-900/20 max-h-[60vh] overflow-y-auto">
      <h3 className="text-xl font-semibold mb-4 text-amber-100 flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-amber-500" />
        Adventure Log
      </h3>
      {history.length === 0 && (
        <p className="text-gray-500 text-center py-8">Your story begins here...</p>
      )}
      {history.map((entry, index) => {
        const cfg = typeConfig[entry.type] || typeConfig.system;
        const Icon = cfg.icon;
        return (
          <div key={index} className={`mb-3 ${entry.type === "player" ? "ml-4" : ""}`}>
            <div className={`bg-gray-800 rounded-lg p-3 border-l-4 ${cfg.border}`}>
              <p className={`${cfg.color} text-sm mb-1 flex items-center gap-1`}>
                <Icon className="w-4 h-4" />
                {cfg.label}:
              </p>
              <p className="text-gray-300 whitespace-pre-wrap">{entry.text}</p>
            </div>
          </div>
        );
      })}
      <div ref={chatEndRef} />
    </div>
  );
};

export default GameHistory;
