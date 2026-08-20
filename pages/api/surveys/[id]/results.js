import { route, notFound } from "../../../../lib/api";
import { getSurvey, listCandidates, listVotes, listVoters } from "../../../../lib/db";
import { scoreSurvey } from "../../../../lib/scoring";
import { totalPairs, voterGoal } from "../../../../lib/pairing";

export default route({
  GET({ query }) {
    const survey = getSurvey(query.id);
    if (!survey) throw notFound("Survey not found.");

    const candidates = listCandidates(survey.id);
    const active = candidates.filter((c) => c.active);
    const votes = listVotes(survey.id);
    const voters = listVoters(survey.id);
    const results = scoreSurvey(candidates, votes);

    const goal = voterGoal(active.length, survey.target_votes);
    const byVoter = new Map(voters.map((v) => [v.id, 0]));
    for (const v of votes) byVoter.set(v.voter_id, (byVoter.get(v.voter_id) ?? 0) + 1);

    const voterRows = voters.map((v) => {
      const done = byVoter.get(v.id) ?? 0;
      return {
        id: v.id,
        name: v.name,
        completed: done,
        goal,
        done: done >= goal,
        last_seen_at: v.last_seen_at,
      };
    }).sort((a, b) => b.completed - a.completed);

    const pairsPossible = totalPairs(active.length);
    const judgedPairs = new Set(votes.map((v) => v.pair_key)).size;

    return {
      survey,
      results,
      voters: voterRows,
      coverage: {
        pairsPossible,
        judgedPairs,
        pairCoverage: pairsPossible ? judgedPairs / pairsPossible : 0,
        votersStarted: voters.length,
        votersFinished: voterRows.filter((v) => v.done).length,
        goal,
      },
    };
  },
});
