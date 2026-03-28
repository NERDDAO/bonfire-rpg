"""Game Master decision logic."""

from __future__ import annotations

import json

import game_config as config
import http_client
from game_store import GameStore


def _safe_json_object(text: str) -> dict[str, object] | None:
    """Attempt to parse a JSON object from LLM text, tolerating markdown fences."""
    if not text:
        return None
    candidate = text.strip()
    try:
        obj = json.loads(candidate)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start >= 0 and end > start:
        try:
            obj = json.loads(candidate[start : end + 1])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            return None
    return None


def _make_gm_decision(
    store: GameStore,
    agent_id: str,
    episode_summary: str,
    episode_id: str,
    episode_payload: dict[str, object] | None,
) -> dict[str, object]:
    """Run GM decision for a processed episode and return the raw parsed response.

    The engine no longer applies room/NPC/object mutations server-side.
    The caller broadcasts the raw GM decision to connected clients.
    """
    player = store.get_player(agent_id)
    if not player:
        return {
            "extension_awarded": 0,
            "reaction": "No registered player found.",
            "world_state_update": "",
            "source": "fallback",
        }

    owner_agent_id = store.get_owner_agent_id(player.bonfire_id)
    if owner_agent_id and config.DELVE_API_KEY:
        game = store.get_game(player.bonfire_id)
        game_context: dict[str, object] = {
            "bonfire_id": player.bonfire_id,
            "game_prompt": game.game_prompt if game else "",
            "world_state_summary": game.world_state_summary if game else "",
            "last_gm_reaction": game.last_gm_reaction if game else "",
        }
        gm_url = f"{config.DELVE_BASE_URL}/agents/{owner_agent_id}/chat"
        gm_status, gm_payload = http_client._agent_json_request(
            "POST",
            gm_url,
            config.DELVE_API_KEY,
            body={
                "message": (
                    "You are the Game Master for a shared world. Read the episode and return strict JSON "
                    '{"extension_awarded": int, "reaction": string, "world_state_update": string}. '
                    "extension_awarded must be between 0 and 3. "
                    f"Episode id: {episode_id}. Episode summary: {episode_summary}."
                ),
                "chat_history": [],
                "graph_mode": "adaptive",
                "context": {
                    "role": "game_master",
                    "bonfire_id": player.bonfire_id,
                    "episode_id": episode_id,
                    "episode": episode_payload or {"summary": episode_summary},
                    "game": game_context,
                },
            },
        )
        if gm_status == 200:
            reply = gm_payload.get("reply")
            if isinstance(reply, str):
                parsed = _safe_json_object(reply)
                if parsed:
                    ext_obj = parsed.get("extension_awarded", 0)
                    extension = ext_obj if isinstance(ext_obj, int) else 0
                    extension = max(0, min(extension, 3))
                    reaction_obj = parsed.get("reaction", "GM reviewed the episode.")
                    reaction = str(reaction_obj).strip() or "GM reviewed the episode."
                    world_update_obj = parsed.get("world_state_update", "")
                    world_update = str(world_update_obj).strip()
                    return {
                        "extension_awarded": extension,
                        "reaction": reaction,
                        "world_state_update": world_update,
                        "source": "gm_llm",
                    }

    lowered = episode_summary.lower()
    extension = 0
    if any(token in lowered for token in ["quest", "artifact", "discovery", "completed"]):
        extension = 1
    if "major" in lowered or "milestone" in lowered:
        extension = 2
    return {
        "extension_awarded": extension,
        "reaction": "GM auto-reviewed the episode and applied fallback rules.",
        "world_state_update": episode_summary,
        "source": "fallback",
    }
