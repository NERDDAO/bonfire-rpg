import { ScrollText, Globe, Activity, Flame, Info, MessageCircle } from "lucide-react";
import { useNarrativeStore } from "@/stores/narrativeStore";

const typeConfig = {
  narrator: { border: "border-amber-700", icon: Globe, label: "Narrator", color: "text-amber-300" },
  player: { border: "border-green-700", icon: Activity, label: "You", color: "text-green-300" },
  gm: { border: "border-purple-700", icon: Flame, label: "Game Master", color: "text-purple-300" },
  npc: { border: "border-blue-700", icon: MessageCircle, label: "NPC", color: "text-blue-300" },
  system: { border: "border-gray-700", icon: Info, label: "", color: "text-gray-500" },
};

const GameHistory = ({ chatEndRef }) => {
  const { history } = useNarrativeStore();

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-amber-900/20 max-h-[50vh] overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3 text-amber-100 flex items-center gap-2 sticky top-0 bg-gray-900 py-1">
        <ScrollText className="w-5 h-5 text-amber-500" />
        Adventure Log
      </h3>
      {history.length === 0 && (
        <p className="text-gray-600 text-center py-8 italic">Your story begins here...</p>
      )}
      {history.map((entry, index) => {
        const cfg = typeConfig[entry.type] || typeConfig.system;
        const Icon = cfg.icon;
        const label = entry.type === "npc" ? (entry.npcName || "NPC") : cfg.label;

        // System messages are compact
        if (entry.type === "system") {
          return (
            <div key={index} className="mb-2 text-sm text-gray-500 italic whitespace-pre-wrap px-2">
              {entry.text}
            </div>
          );
        }

        return (
          <div key={index} className={`mb-2 ${entry.type === "player" ? "ml-8" : ""}`}>
            <div className={`rounded-lg p-3 border-l-4 ${cfg.border} bg-gray-800/50`}>
              {label && (
                <p className={`${cfg.color} text-xs mb-1 flex items-center gap-1 font-medium`}>
                  <Icon className="w-3 h-3" />
                  {label}
                </p>
              )}
              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                {entry.text}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={chatEndRef} />
    </div>
  );
};

export default GameHistory;
