import { useEffect } from "react";
import { Flame, Users, MapPin, Scroll } from "lucide-react";
import { useGameStore } from "@/stores/gameStore";
import { useLocation } from "wouter";

const Welcome = () => {
  const { activeGames, loadActiveGames, isLoading } = useGameStore();
  const [, navigate] = useLocation();

  useEffect(() => {
    loadActiveGames();
  }, []);

  const joinGame = (bonfireId) => {
    navigate(`/play/${encodeURIComponent(bonfireId)}`);
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-12">
        <Flame className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-4xl font-bold text-amber-100 mb-2">Bonfire RPG</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          Explore AI-driven fantasy worlds. Every NPC remembers you. Every choice shapes the story.
        </p>
      </div>

      {/* Active Games */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-amber-900/20">
        <h3 className="text-xl font-semibold text-amber-100 mb-4 flex items-center gap-2">
          <Scroll className="w-5 h-5 text-amber-500" />
          Active Worlds
        </h3>

        {isLoading && (
          <p className="text-gray-500 text-center py-8">Loading worlds...</p>
        )}

        {!isLoading && (!activeGames || activeGames.length === 0) && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">No active worlds found.</p>
            <p className="text-gray-600 text-sm">
              Make sure the game engine is running on port 9997.
            </p>
          </div>
        )}

        {!isLoading && activeGames && activeGames.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {activeGames.map((game) => {
              const bonfireId = game.bonfire_id || game.bonfireId;
              const prompt = game.game_prompt || game.gamePrompt || "";
              const playerCount = game.player_count || game.playerCount || 0;
              const roomCount = game.room_count || game.roomCount || 0;

              return (
                <button
                  key={bonfireId}
                  type="button"
                  onClick={() => joinGame(bonfireId)}
                  className="text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-amber-800/50 rounded-xl p-5 transition-all duration-200"
                >
                  <h4 className="font-semibold text-amber-100 mb-2 line-clamp-1">
                    {prompt || bonfireId}
                  </h4>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {playerCount} players
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {roomCount} rooms
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Welcome;
