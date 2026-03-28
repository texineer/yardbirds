const API_BASE = '/api';

async function fetchJson(url) {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function getConfig() {
  return fetchJson('/config');
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

export function triggerScrape(orgId, teamId) {
  return fetch(`${API_BASE}/scrape/${orgId}/${teamId}`, { method: 'POST' }).then(r => r.json());
}

// Pitch count severity helper
export function pitchSeverity(pitches, dailyMax = 95) {
  const pct = pitches / dailyMax;
  if (pct >= 0.9) return 'danger';
  if (pct >= 0.7) return 'warning';
  return 'ok';
}
