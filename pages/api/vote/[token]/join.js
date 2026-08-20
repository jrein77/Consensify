import { route, str, notFound, conflict } from "../../../../lib/api";
import { getSurveyByToken, createVoter, listActiveCandidates } from "../../../../lib/db";
import { publicSurvey } from "../../../../lib/cards";
import { voterGoal } from "../../../../lib/pairing";
import { id } from "../../../../lib/ids";

export default route({
  POST({ query, body }) {
    const survey = getSurveyByToken(query.token);
    if (!survey) throw notFound("This voting link is not valid.");
    if (survey.status !== "open") {
      throw conflict(
        survey.status === "closed"
          ? "This survey has been closed."
          : "This survey has not opened yet."
      );
    }
    const name = str(body.name, { field: "Your name", required: true, max: 80 });
    const voter = createVoter({ id: id(), survey_id: survey.id, name });
    const active = listActiveCandidates(survey.id);

    return {
      voterId: voter.id,
      name: voter.name,
      survey: publicSurvey(survey),
      goal: voterGoal(active.length, survey.target_votes),
    };
  },
});
