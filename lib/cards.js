/**
 * Builds the comparison card payload sent to voters.
 *
 * Both cards are built from the survey's single field list, so every card
 * shows the same rows in the same order whether or not that candidate had
 * the information. Missing values become empty strings and the client renders
 * a placeholder. A candidate must never look better simply because their
 * résumé was parsed more successfully.
 */
export function buildCard(candidate, survey, position) {
  return {
    id: candidate.id,
    name: survey.blind ? `Candidate ${position + 1}` : candidate.name,
    fields: survey.fields.map((label) => ({
      label,
      value: (candidate.fields?.[label] ?? "").trim(),
    })),
  };
}

/** Everything a voter is allowed to know about the survey itself. */
export function publicSurvey(survey) {
  return {
    title: survey.title,
    role: survey.role,
    status: survey.status,
    jdText: survey.jd_text,
    jdFilename: survey.jd_filename,
    allowSkip: survey.allow_skip,
    allowNeither: survey.allow_neither,
    fields: survey.fields,
  };
}
