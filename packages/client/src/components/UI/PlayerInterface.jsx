import { Type, CheckCircle, Loader2 } from "lucide-react";
import { useNarrativeStore } from "@/stores/narrativeStore";

const PlayerInterface = ({ bonfireId, agentId, agentApiKey }) => {
  const { isLoading, inputValue, setInputValue, takeTurn } = useNarrativeStore();

  const handleSubmit = () => {
    const text = inputValue.trim();
    if (!text || !agentId || !bonfireId) return;
    takeTurn(agentId, bonfireId, text, agentApiKey);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-400 flex items-center gap-2">
        <Type className="w-4 h-4" />
        What do you do?
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Describe your action..."
          disabled={isLoading}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-amber-600 text-gray-100 placeholder-gray-600 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !inputValue.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 px-5 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default PlayerInterface;
