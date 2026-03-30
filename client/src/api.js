const API_BASE = '/api';

async function fetchJson(url) {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function getTeams() {
  return fetchJson('/teams');
}

export function getTeamBySlug(slug) {
  return fetchJson(`/teams/by-slug/${slug}`);
}

export function getTeam(orgId, teamId) {
  return fetchJson(`/teams/${orgId}/${teamId}`);
}

export function getSchedule(orgId, teamId) {
  return fetchJson(`/teams/${orgId}/${teamId}/schedule`);
}

export function getTournaments(orgId, teamId) {
  return fetchJson(`/teams/${orgId}/${teamId}/tournaments`);
}

export function getGame(gameId) {
  return fetchJson(`/games/${gameId}`);
}

export function getGamePitchCounts(gameId) {
  return fetchJson(`/games/${gameId}/pitchcounts`);
}

export function getDailyPitchTotals(gameId) {
  return fetchJson(`/games/${gameId}/daily-totals`);
}

export function getOpponentPitchers(gameId) {
  return fetchJson(`/games/${gameId}/opponent-pitchers`);
}

export function getTournamentPitchingReport(eventId) {
  return fetchJson(`/tournaments/${eventId}/pitching-report`);
}

export function getTournamentFullSchedule(eventId) {
  return fetchJson(`/tournaments/${eventId}/full-schedule`);
}

export function searchTeams(query) {
  return fetchJson(`/teams/search?q=${encodeURIComponent(query)}`);
}

export function getPitchRules(ageGroup) {
  return fetchJson(`/pitch-rules/${ageGroup}`);
}

export function triggerScrape(slug) {
  return fetch(`${API_BASE}/scrape/${slug}`, { method: 'POST' }).then(r => r.json());
}

// Pitch count severity helper
export function pitchSeverity(pitches, dailyMax = 95) {
  const pct = pitches / dailyMax;
  if (pct >= 0.9) return 'danger';
  if (pct >= 0.7) return 'warning';
  return 'ok';
}

// ── Live Scorebook ────────────────────────────────────────────────────────────

async function mutate(method, url, body, pin) {
  const headers = { 'Content-Type': 'application/json' };
  if (pin) headers['x-scorekeeper-pin'] = pin;
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// Viewer (no PIN)
export function getScorebookState(gameId) {
  return fetchJson(`/games/${gameId}/scorebook`).catch(() => null);
}

export function getLivePitchCounts(gameId) {
  return fetchJson(`/games/${gameId}/live-pitch-counts`);
}

// Scorekeeper (PIN required)
export function initScorebookGame(gameId, body, pin) {
  return mutate('POST', `/games/${gameId}/scorebook/init`, body, pin);
}

export function saveLineup(gameId, body, pin) {
  return mutate('PUT', `/games/${gameId}/scorebook/lineup`, body, pin);
}

export function startScorebookGame(gameId, pin) {
  return mutate('POST', `/games/${gameId}/scorebook/start`, {}, pin);
}

export function updateScorebookState(gameId, body, pin) {
  return mutate('PUT', `/games/${gameId}/scorebook/state`, body, pin);
}

export function updateInningScore(gameId, inning, half, body, pin) {
  return mutate('PUT', `/games/${gameId}/scorebook/inning/${inning}/${half}`, body, pin);
}

export function startPlateAppearance(gameId, body, pin) {
  return mutate('POST', `/games/${gameId}/scorebook/plate-appearance`, body, pin);
}

export function recordPlateAppearanceOutcome(gameId, paId, body, pin) {
  return mutate('PUT', `/games/${gameId}/scorebook/plate-appearance/${paId}`, body, pin);
}

export function logPitch(gameId, body, pin) {
  return mutate('POST', `/games/${gameId}/scorebook/pitch`, body, pin);
}

export function undoLastPitch(gameId, pin) {
  return mutate('DELETE', `/games/${gameId}/scorebook/pitch/last`, null, pin);
}

export function recordSubstitution(gameId, body, pin) {
  return mutate('POST', `/games/${gameId}/scorebook/substitution`, body, pin);
}

export function endScorebookGame(gameId, body, pin) {
  return mutate('POST', `/games/${gameId}/scorebook/end`, body, pin);
}
