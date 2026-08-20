import { route, str, badRequest } from "../../../lib/api";
import { createSurvey, listSurveys, surveyCounts } from "../../../lib/db";
import { CANONICAL_FIELDS } from "../../../lib/extract";
import { id, token } from "../../../lib/ids";

export default route({
  GET() {
    const counts = surveyCounts();
    return {
      surveys: listSurveys().map((s) => ({
        ...s,
        candidateCount: counts[s.id]?.candidates ?? 0,
        voteCount: counts[s.id]?.votes ?? 0,
      })),
    };
  },

  POST({ body }) {
    const title = str(body.title, { field: "Title", required: true, max: 140 });
    const role = str(body.role, { max: 140 });
    const targetVotes = Number(body.target_votes) || 10;
    if (targetVotes < 1 || targetVotes > 200) {
      throw badRequest("Comparisons per voter must be between 1 and 200.");
    }
    return {
      survey: createSurvey({
        id: id(),
        vote_token: token(),
        title,
        role,
        fields: CANONICAL_FIELDS,
        status: "draft",
        allow_skip: body.allow_skip !== false,
        allow_neither: body.allow_neither !== false,
        blind: !!body.blind,
        target_votes: targetVotes,
      }),
    };
  },
});
