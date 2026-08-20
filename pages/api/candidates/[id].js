import { route, str, notFound, badRequest } from "../../../lib/api";
import { getCandidate, updateCandidate, deleteCandidate } from "../../../lib/db";

export default route({
  PATCH({ query, body }) {
    const candidate = getCandidate(query.id);
    if (!candidate) throw notFound("Candidate not found.");

    const patch = {};
    if (body.name !== undefined) {
      patch.name = str(body.name, { field: "Name", required: true, max: 120 });
    }
    if (body.active !== undefined) patch.active = !!body.active;
    if (body.fields !== undefined) {
      if (typeof body.fields !== "object" || Array.isArray(body.fields)) {
        throw badRequest("fields must be an object.");
      }
      patch.fields = Object.fromEntries(
        Object.entries(body.fields).map(([k, v]) => [k, String(v ?? "").slice(0, 600)])
      );
    }
    return { candidate: updateCandidate(candidate.id, patch) };
  },

  DELETE({ query }) {
    if (!getCandidate(query.id)) throw notFound("Candidate not found.");
    deleteCandidate(query.id);
    return { ok: true };
  },
});
