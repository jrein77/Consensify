import { route, str, notFound, badRequest } from "../../../../lib/api";
import {
  getSurvey, updateSurvey, deleteSurvey, listCandidates, listVoters, listVotes,
} from "../../../../lib/db";

const STATUSES = new Set(["draft", "open", "closed"]);

export default route({
  GET({ query }) {
    const survey = getSurvey(query.id);
    if (!survey) throw notFound("Survey not found.");
    return {
      survey,
      candidates: listCandidates(survey.id),
      voters: listVoters(survey.id),
      voteCount: listVotes(survey.id).length,
    };
  },

  PATCH({ query, body }) {
    const survey = getSurvey(query.id);
    if (!survey) throw notFound("Survey not found.");

    const patch = {};
    if (body.title !== undefined) patch.title = str(body.title, { field: "Title", required: true, max: 140 });
    if (body.role !== undefined) patch.role = str(body.role, { max: 140 });
    if (body.jd_text !== undefined) patch.jd_text = str(body.jd_text, { max: 60000 });
    if (body.allow_skip !== undefined) patch.allow_skip = !!body.allow_skip;
    if (body.allow_neither !== undefined) patch.allow_neither = !!body.allow_neither;
    if (body.blind !== undefined) patch.blind = !!body.blind;
    if (body.fields !== undefined) {
      if (!Array.isArray(body.fields)) throw badRequest("fields must be an array.");
      patch.fields = body.fields.map((f) => String(f).trim()).filter(Boolean).slice(0, 12);
    }
    if (body.target_votes !== undefined) {
      const n = Number(body.target_votes);
      if (!Number.isFinite(n) || n < 1 || n > 200) {
        throw badRequest("Comparisons per voter must be between 1 and 200.");
      }
      patch.target_votes = Math.round(n);
    }
    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) throw badRequest("Unknown status.");
      if (body.status === "open") {
        const active = listCandidates(survey.id).filter((c) => c.active);
        if (active.length < 2) {
          throw badRequest("Add at least two active candidates before opening the survey.");
        }
      }
      patch.status = body.status;
    }
    return { survey: updateSurvey(survey.id, patch) };
  },

  DELETE({ query }) {
    if (!getSurvey(query.id)) throw notFound("Survey not found.");
    deleteSurvey(query.id);
    return { ok: true };
  },
});
