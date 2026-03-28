import { Type, CheckCircle, Loader2, MessageCircle, X } from "lucide-react";
import { useNarrativeStore } from "@/stores/narrativeStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useGameStore } from "@/stores/gameStore";

const PlayerInterface = ({ bonfireId }) => {
  const { isLoading, inputValue, setInputValue, sendAction, talkToNpc, talkingToNpc, endNpcDialogue } =
    useNarrativeStore();
  const { agentId, agentApiKey } = usePlayerStore();
  const refreshMap = useGameStore((s) => s.refreshMap);

  const handleSubmit = async () => {
    const text = inputValue.trim();
    if (!text || !agentId) return;

    if (talkingToNpc) {
      await talkToNpc(text, agentId, talkingToNpc.npc_id);
    } else {
      const result = await sendAction(text, agentId, bonfireId, agentApiKey);
      if (result) refreshMap();
    }
  };

  return (
    <div className="space-y-3">
      {talkingToNpc && (
        <div className="flex items-center justify-between bg-purple-900/30 border border-purple-800/50 rounded-lg px-3 py-2">
          <span className="text-purple-300 text-sm flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            Speaking to {talkingToNpc.name}
          </span>
          <button type="button" onClick={endNpcDialogue} className="text-purple-400 hover:text-purple-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={talkingToNpc ? `Say something to ${talkingToNpc.name}...` : "What do you do?"}
          disabled={isLoading}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-600 text-gray-100 placeholder-gray-600 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !inputValue.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 px-5 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 shrink-0"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

export default PlayerInterface;
