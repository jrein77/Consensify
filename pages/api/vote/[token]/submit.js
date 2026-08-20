import { route, notFound, conflict, badRequest } from "../../../../lib/api";
import {
  getSurveyByToken, getVoter, getCandidate, listVotesByVoter, recordVote, touchVoter,
} from "../../../../lib/db";
import { pairKey as makePairKey } from "../../../../lib/scoring";
import { id } from "../../../../lib/ids";

const OUTCOMES = new Set(["left", "right", "skip", "neither"]);

export default route({
  POST({ query, body }) {
    const survey = getSurveyByToken(query.token);
    if (!survey) throw notFound("This voting link is not valid.");
    if (survey.status !== "open") throw conflict("This survey is no longer accepting responses.");

    const voter = getVoter(body.voterId);
    if (!voter || voter.survey_id !== survey.id) throw notFound("We couldn't find your session.");

    const { outcome, leftId, rightId } = body;
    if (!OUTCOMES.has(outcome)) throw badRequest("Unknown response.");
    if (outcome === "skip" && !survey.allow_skip) throw badRequest("Skipping is turned off.");
    if (outcome === "neither" && !survey.allow_neither) {
      throw badRequest('The "neither" option is turned off.');
    }

    // Trust the ids, not the client's pair key, and confirm both candidates
    // really belong to this survey before recording anything.
    const left = getCandidate(leftId);
    const right = getCandidate(rightId);
    if (!left || !right || left.survey_id !== survey.id || right.survey_id !== survey.id) {
      throw badRequest("Those candidates aren't part of this survey.");
    }
    if (left.id === right.id) throw badRequest("A candidate cannot be compared with themselves.");

    const pair_key = makePairKey(left.id, right.id);

    // Double-submits (impatient clicking, a retried request) must not count twice.
    if (listVotesByVoter(voter.id).some((v) => v.pair_key === pair_key)) {
      return { ok: true, duplicate: true };
    }

    recordVote({
      id: id(),
      survey_id: survey.id,
      voter_id: voter.id,
      left_id: left.id,
      right_id: right.id,
      pair_key,
      winner_id: outcome === "left" ? left.id : outcome === "right" ? right.id : null,
      outcome,
      decided_ms: Math.max(0, Math.min(Number(body.decidedMs) || 0, 3_600_000)),
    });
    touchVoter(voter.id);
    return { ok: true };
  },
});
