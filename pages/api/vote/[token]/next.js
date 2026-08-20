import { route, notFound, conflict } from "../../../../lib/api";
import {
  getSurveyByToken, getVoter, listActiveCandidates, listVotesByVoter, pairCounts, touchVoter,
} from "../../../../lib/db";
import { nextPair, voterGoal } from "../../../../lib/pairing";
import { buildCard, publicSurvey } from "../../../../lib/cards";

export default route({
  GET({ query }) {
    const survey = getSurveyByToken(query.token);
    if (!survey) throw notFound("This voting link is not valid.");

    const voter = getVoter(query.voterId);
    if (!voter || voter.survey_id !== survey.id) {
      throw notFound("We couldn't find your session. Enter your name to start again.");
    }
    if (survey.status !== "open") throw conflict("This survey is no longer accepting responses.");
    touchVoter(voter.id);

    const candidates = listActiveCandidates(survey.id);
    const myVotes = listVotesByVoter(voter.id);
    const goal = voterGoal(candidates.length, survey.target_votes);
    const completed = myVotes.length;

    const base = { survey: publicSurvey(survey), completed, goal, voterName: voter.name };

    if (candidates.length < 2) {
      return { ...base, done: true, reason: "This survey doesn't have enough candidates yet." };
    }
    if (completed >= goal) return { ...base, done: true, reason: "complete" };

    const seen = new Set(myVotes.map((v) => v.pair_key));
    const pair = nextPair(candidates, seen, pairCounts(survey.id));
    if (!pair) {
      return { ...base, done: true, reason: "You've compared every possible pair. Thank you!" };
    }

    const position = new Map(candidates.map((c, i) => [c.id, i]));
    return {
      ...base,
      done: false,
      pair: {
        pairKey: pair.pairKey,
        left: buildCard(pair.left, survey, position.get(pair.left.id)),
        right: buildCard(pair.right, survey, position.get(pair.right.id)),
      },
    };
  },
});
