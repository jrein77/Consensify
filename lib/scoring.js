/**
 * Turns raw pairwise votes into rankings.
 *
 * Ranking uses a regularised Bradley–Terry model fitted with MM iteration.
 * BT is chosen over Elo because it is *order-independent*: the same set of
 * votes always yields the same ranking, whereas Elo depends on the arbitrary
 * order votes happened to arrive in. The regularisation (pseudo-games against
 * a virtual average opponent) keeps an undefeated candidate from diverging to
 * infinite strength on a handful of votes.
 *
 * "neither" votes are deliberately NOT fed into BT, since they carry no information
 * about which of the two is stronger. They are tracked separately as a
 * disqualification signal.
 */

export const pairKey = (a, b) => [a, b].sort().join("|");

const PRIOR = 0.5; // pseudo-wins and pseudo-losses vs a virtual average candidate
const ITERATIONS = 300;
const EPSILON = 1e-9;

export function scoreSurvey(candidates, votes) {
  const ids = candidates.map((c) => c.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;

  const wins = new Array(n).fill(0);
  const losses = new Array(n).fill(0);
  const neither = new Array(n).fill(0);
  const skipped = new Array(n).fill(0);
  const appearances = new Array(n).fill(0);
  // games[i][j] = decisive comparisons between i and j; beat[i][j] = i beat j
  const games = Array.from({ length: n }, () => new Array(n).fill(0));
  const beat = Array.from({ length: n }, () => new Array(n).fill(0));

  let decisive = 0;
  let skips = 0;
  let neithers = 0;

  for (const v of votes) {
    const l = index.get(v.left_id);
    const r = index.get(v.right_id);
    if (l === undefined || r === undefined) continue; // candidate since removed
    appearances[l]++;
    appearances[r]++;

    if (v.outcome === "skip") {
      skipped[l]++; skipped[r]++; skips++;
      continue;
    }
    if (v.outcome === "neither") {
      neither[l]++; neither[r]++; neithers++;
      continue;
    }
    const w = index.get(v.winner_id);
    if (w === undefined) continue;
    const loser = w === l ? r : l;
    wins[w]++;
    losses[loser]++;
    games[w][loser]++;
    games[loser][w]++;
    beat[w][loser]++;
    decisive++;
  }

  // ---- Bradley–Terry MM iteration -----------------------------------------
  const strength = new Array(n).fill(1);
  for (let iter = 0; iter < ITERATIONS; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      let denom = (2 * PRIOR) / (strength[i] + 1); // virtual opponent, strength 1
      for (let j = 0; j < n; j++) {
        if (i === j || games[i][j] === 0) continue;
        denom += games[i][j] / (strength[i] + strength[j]);
      }
      const next = (wins[i] + PRIOR) / Math.max(denom, EPSILON);
      maxDelta = Math.max(maxDelta, Math.abs(next - strength[i]));
      strength[i] = next;
    }
    // Normalise to geometric mean 1 so scores stay comparable across surveys.
    let logSum = 0;
    for (let i = 0; i < n; i++) logSum += Math.log(Math.max(strength[i], EPSILON));
    const geo = Math.exp(logSum / Math.max(n, 1));
    for (let i = 0; i < n; i++) strength[i] /= geo;
    if (maxDelta < 1e-10) break;
  }

  // ---- Copeland: how many opponents this candidate beats head-to-head -----
  const copeland = new Array(n).fill(0);
  const opponents = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || games[i][j] === 0) continue;
      opponents[i]++;
      if (beat[i][j] > beat[j][i]) copeland[i] += 1;
      else if (beat[i][j] === beat[j][i]) copeland[i] += 0.5;
    }
  }

  const rows = candidates.map((c, i) => {
    const decided = wins[i] + losses[i];
    return {
      id: c.id,
      name: c.name,
      active: c.active,
      wins: wins[i],
      losses: losses[i],
      neither: neither[i],
      skipped: skipped[i],
      appearances: appearances[i],
      decided,
      // Probability this candidate beats a typical candidate, as 0–100.
      score: Math.round((strength[i] / (strength[i] + 1)) * 1000) / 10,
      strength: strength[i],
      winRate: decided ? wins[i] / decided : null,
      copeland: opponents[i] ? copeland[i] / opponents[i] : null,
      neitherRate: appearances[i] ? neither[i] / appearances[i] : 0,
      // Enough evidence to trust the score? Below this it's noise.
      provisional: decided < 3,
      flagged: appearances[i] >= 3 && neither[i] / appearances[i] >= 0.34,
    };
  });

  rows.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.wins - a.wins;
  });
  rows.forEach((r, i) => { r.rank = i + 1; });

  return {
    rows,
    headToHead: buildHeadToHead(candidates, index, beat, games),
    totals: {
      votes: votes.length,
      decisive,
      skips,
      neithers,
      consensus: consensusStrength(votes, index),
    },
  };
}

function buildHeadToHead(candidates, index, beat, games) {
  return candidates.map((row) => ({
    id: row.id,
    name: row.name,
    cells: candidates.map((col) => {
      const i = index.get(row.id);
      const j = index.get(col.id);
      if (row.id === col.id) return null;
      return { wins: beat[i][j], total: games[i][j] };
    }),
  }));
}

/**
 * How lopsided the decisive votes are, 0–1. A pair split 5–0 contributes 1;
 * a pair split 3–2 contributes 0.2. Averaged over every pair that was judged.
 * Low values mean the team genuinely disagrees, which is worth surfacing.
 */
function consensusStrength(votes, index) {
  const pairs = new Map();
  for (const v of votes) {
    if (v.outcome !== "left" && v.outcome !== "right") continue;
    if (!index.has(v.left_id) || !index.has(v.right_id)) continue;
    const key = pairKey(v.left_id, v.right_id);
    const entry = pairs.get(key) ?? { total: 0, forFirst: 0 };
    entry.total++;
    if (v.winner_id === key.split("|")[0]) entry.forFirst++;
    pairs.set(key, entry);
  }
  if (!pairs.size) return null;
  let sum = 0;
  for (const { total, forFirst } of pairs.values()) {
    sum += Math.abs((2 * forFirst) / total - 1);
  }
  return sum / pairs.size;
}
