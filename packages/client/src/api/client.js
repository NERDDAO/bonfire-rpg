/**
 * Quest game API client.
 * All endpoints proxy through Vite dev server to the Python backend.
 */

const API_BASE = "/game";

async function request(method, path, body = null, headers = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Game lifecycle ---

export function listActiveGames() {
  return request("GET", "/list-active");
}

export function getGameState(bonfireId) {
  return request("GET", `/state?bonfire_id=${encodeURIComponent(bonfireId)}`);
}

export function getGameFeed(bonfireId) {
  return request("GET", `/feed?bonfire_id=${encodeURIComponent(bonfireId)}`);
}

export function getGameDetails(bonfireId) {
  return request("GET", `/details?bonfire_id=${encodeURIComponent(bonfireId)}`);
}

export function createGame(body) {
  return request("POST", "/create", body);
}

// --- Player actions ---

export function takeTurn(body, agentApiKey = "") {
  const headers = agentApiKey ? { "X-Agent-Api-Key": agentApiKey } : {};
  return request("POST", "/turn", body, headers);
}

export function completeChat(body, agentApiKey = "") {
  const headers = agentApiKey ? { "X-Agent-Api-Key": agentApiKey } : {};
  return request("POST", "/agents/complete", body, headers);
}

export function claimQuest(body, agentApiKey = "") {
  const headers = agentApiKey ? { "X-Agent-Api-Key": agentApiKey } : {};
  return request("POST", "/quests/claim", body, headers);
}

// --- Agent registration ---

export function purchaseAgent(bonfireId, body) {
  return request("POST", `/purchase-agent/${encodeURIComponent(bonfireId)}`, body);
}

export function registerPurchase(body) {
  return request("POST", "/agents/register-purchase", body);
}

export function restorePlayer(body) {
  return request("POST", "/player/restore", body);
}

// --- Wallet ---

export function getWalletBonfires(walletAddress) {
  return request("GET", `/wallet/bonfires?wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function getWalletPurchasedAgents(walletAddress, bonfireId) {
  return request(
    "GET",
    `/wallet/purchased-agents?wallet_address=${encodeURIComponent(walletAddress)}&bonfire_id=${encodeURIComponent(bonfireId)}`,
  );
}

export function getBonfirePricing(bonfireId) {
  return request("GET", `/bonfire/pricing?bonfire_id=${encodeURIComponent(bonfireId)}`);
}

// --- Backend processing ---

export function processStack(body, agentApiKey = "") {
  const headers = agentApiKey ? { "X-Agent-Api-Key": agentApiKey } : {};
  return request("POST", "/agents/process-stack", body, headers);
}

export function getGameConfig() {
  return request("GET", "/config");
}
