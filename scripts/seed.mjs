/**
 * Seeds a demo survey: the sample job description, six sample résumés parsed
 * exactly as an upload would parse them, and simulated votes from a small
 * team, so the dashboard has something real to show.
 *
 *   npm run seed
 */
import fs from "node:fs";
import path from "node:path";
import {
  createSurvey, createCandidate, createVoter, recordVote, listActiveCandidates,
} from "../lib/db.js";
import { extractCandidate, extractText, CANONICAL_FIELDS } from "../lib/extract.js";
import { nextPair, voterGoal } from "../lib/pairing.js";
import { id, token } from "../lib/ids.js";
import { pairKey } from "../lib/scoring.js";

const SAMPLES = path.join(process.cwd(), "samples");
const TEAM = ["Alex Rivera", "Dana Osei", "Priya Raman", "Michael Chen",
  "Sam Whitfield", "Rosa Delgado", "Ben Kowalski", "Ife Adeyemi"];
const COMPARISONS_EACH = 12;

// A fixed seed keeps `npm run seed` reproducible, so the demo looks the same
// every time you show it. Mulberry32, small, fast, and good enough for sampling.
function mulberry32(a) {
  return function random() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260820);

// How strong each candidate is in the eyes of the simulated team. Votes are
// drawn from these weights, so the ranking that comes out is a real recovery
// of a known truth rather than a hardcoded leaderboard.
const OPINION = {
  "Nadia Rahman": 0.95,
  "Jane Doe": 0.74,
  "Tomas Alvarez": 0.58,
  "Devin Park": 0.42,
  "Sofia Marchetti": 0.28,
  "Owen Fitzgerald": 0.10,
};

async function main() {
  if (!fs.existsSync(SAMPLES)) {
    console.error(`No samples/ directory found at ${SAMPLES}`);
    process.exit(1);
  }

  const jdPath = path.join(SAMPLES, "Job_Description.txt");
  const jdText = fs.existsSync(jdPath)
    ? await extractText(fs.readFileSync(jdPath), "Job_Description.txt")
    : "";

  const survey = createSurvey({
    id: id(),
    vote_token: token(),
    title: "Senior Backend Engineer — Payments",
    role: "Senior Backend Engineer, Payments Platform",
    jd_text: jdText,
    jd_filename: jdText ? "Job_Description.txt" : null,
    fields: CANONICAL_FIELDS,
    status: "open",
    allow_skip: true,
    allow_neither: true,
    blind: false,
    target_votes: COMPARISONS_EACH,
  });

  const files = fs.readdirSync(SAMPLES)
    .filter((f) => f !== "Job_Description.txt" && /\.(pdf|docx|txt|md)$/i.test(f));

  for (const file of files) {
    const parsed = await extractCandidate(fs.readFileSync(path.join(SAMPLES, file)), file);
    createCandidate({
      id: id(),
      survey_id: survey.id,
      name: parsed.name,
      filename: file,
      raw_text: parsed.rawText,
      fields: parsed.fields,
    });
  }

  const candidates = listActiveCandidates(survey.id);
  const goal = voterGoal(candidates.length, survey.target_votes);
  const counts = {};
  let cast = 0;

  for (const name of TEAM) {
    const voter = createVoter({ id: id(), survey_id: survey.id, name });
    const seen = new Set();

    for (let i = 0; i < goal; i++) {
      const pair = nextPair(candidates, seen, counts, rand);
      if (!pair) break;
      seen.add(pair.pairKey);
      counts[pair.pairKey] = (counts[pair.pairKey] ?? 0) + 1;

      const outcome = simulate(pair);
      recordVote({
        id: id(),
        survey_id: survey.id,
        voter_id: voter.id,
        left_id: pair.left.id,
        right_id: pair.right.id,
        pair_key: pairKey(pair.left.id, pair.right.id),
        winner_id: outcome === "left" ? pair.left.id
          : outcome === "right" ? pair.right.id : null,
        outcome,
        decided_ms: 4000 + Math.floor(rand() * 12000),
      });
      cast++;
    }
  }

  console.log(`Seeded "${survey.title}"`);
  console.log(`  ${candidates.length} candidates · ${TEAM.length} voters · ${cast} comparisons`);
  console.log(`  dashboard:   /survey/${survey.id}`);
  console.log(`  voting link: /v/${survey.vote_token}`);
}

function simulate(pair) {
  const l = OPINION[pair.left.name] ?? 0.5;
  const r = OPINION[pair.right.name] ?? 0.5;

  // Occasionally a reviewer rejects both weak candidates outright, or can't decide.
  if (l < 0.35 && r < 0.35 && rand() < 0.45) return "neither";
  if (rand() < 0.04) return "skip";

  return rand() < l / (l + r) ? "left" : "right";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
