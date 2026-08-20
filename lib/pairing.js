import { pairKey } from "./scoring.js";

/**
 * Picks the next pair to show a voter.
 *
 * Two competing goals: every pair should end up with roughly equal coverage
 * (so the ranking isn't built on a lopsided sample), and the voter shouldn't
 * be able to predict what comes next. So we bucket the unseen pairs by how
 * many times they have been judged across the whole survey, then pick at
 * random from the least-judged bucket. Left/right position is a separate coin
 * flip on every serve, which cancels out any side bias in the results.
 *
 * `random` is injectable so the seed script can produce a reproducible demo.
 */
export function nextPair(candidates, seenPairKeys, globalPairCounts, random = Math.random) {
  const available = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const key = pairKey(candidates[i].id, candidates[j].id);
      if (seenPairKeys.has(key)) continue;
      available.push({ key, a: candidates[i], b: candidates[j], count: globalPairCounts[key] ?? 0 });
    }
  }
  if (!available.length) return null;

  const min = Math.min(...available.map((p) => p.count));
  const leastJudged = available.filter((p) => p.count === min);
  const pick = leastJudged[Math.floor(random() * leastJudged.length)];

  const flip = random() < 0.5;
  return {
    pairKey: pick.key,
    left: flip ? pick.a : pick.b,
    right: flip ? pick.b : pick.a,
    remaining: available.length,
  };
}

/** Total unordered pairs for n candidates. */
export const totalPairs = (n) => (n * (n - 1)) / 2;

/**
 * How many comparisons this voter is being asked for: their target, capped by
 * the number of distinct pairs that actually exist.
 */
export function voterGoal(candidateCount, targetVotes) {
  return Math.max(1, Math.min(targetVotes || 10, totalPairs(candidateCount)));
}
