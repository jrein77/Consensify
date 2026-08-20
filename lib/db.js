import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "consensify.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS surveys (
  id           TEXT PRIMARY KEY,
  vote_token   TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT '',
  jd_text      TEXT NOT NULL DEFAULT '',
  jd_filename  TEXT,
  fields       TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'draft',
  allow_skip   INTEGER NOT NULL DEFAULT 1,
  allow_neither INTEGER NOT NULL DEFAULT 1,
  blind        INTEGER NOT NULL DEFAULT 0,
  target_votes INTEGER NOT NULL DEFAULT 10,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id         TEXT PRIMARY KEY,
  survey_id  TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  filename   TEXT,
  raw_text   TEXT NOT NULL DEFAULT '',
  fields     TEXT NOT NULL DEFAULT '{}',
  active     INTEGER NOT NULL DEFAULT 1,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_candidates_survey ON candidates(survey_id);

CREATE TABLE IF NOT EXISTS voters (
  id           TEXT PRIMARY KEY,
  survey_id    TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_voters_survey ON voters(survey_id);

CREATE TABLE IF NOT EXISTS votes (
  id         TEXT PRIMARY KEY,
  survey_id  TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  voter_id   TEXT NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  left_id    TEXT NOT NULL,
  right_id   TEXT NOT NULL,
  pair_key   TEXT NOT NULL,
  winner_id  TEXT,
  outcome    TEXT NOT NULL,
  decided_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_votes_survey ON votes(survey_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_pair ON votes(survey_id, pair_key);
`;

function connect() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);
  return db;
}

// Next.js dev server re-evaluates modules on hot reload; cache the handle so we
// don't leak connections or re-run the schema on every request.
const globalRef = globalThis;
export const db = globalRef.__consensifyDb ?? (globalRef.__consensifyDb = connect());

/** node:sqlite returns null-prototype rows, which Next refuses to serialize. */
const plain = (row) => (row ? { ...row } : null);
const plainAll = (rows) => rows.map((r) => ({ ...r }));

const q = (sql) => db.prepare(sql);

/* ---------------------------------------------------------------- surveys */

export function createSurvey(s) {
  q(`INSERT INTO surveys
       (id, vote_token, title, role, jd_text, jd_filename, fields, status,
        allow_skip, allow_neither, blind, target_votes, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    s.id, s.vote_token, s.title, s.role ?? "", s.jd_text ?? "",
    s.jd_filename ?? null, JSON.stringify(s.fields ?? []), s.status ?? "draft",
    s.allow_skip ? 1 : 0, s.allow_neither ? 1 : 0, s.blind ? 1 : 0,
    s.target_votes ?? 10, Date.now()
  );
  return getSurvey(s.id);
}

const hydrateSurvey = (row) => {
  if (!row) return null;
  const s = plain(row);
  return {
    ...s,
    fields: JSON.parse(s.fields),
    allow_skip: !!s.allow_skip,
    allow_neither: !!s.allow_neither,
    blind: !!s.blind,
  };
};

export const getSurvey = (id) =>
  hydrateSurvey(q(`SELECT * FROM surveys WHERE id = ?`).get(id));

export const getSurveyByToken = (voteToken) =>
  hydrateSurvey(q(`SELECT * FROM surveys WHERE vote_token = ?`).get(voteToken));

export const listSurveys = () =>
  plainAll(q(`SELECT * FROM surveys ORDER BY created_at DESC`).all()).map(hydrateSurvey);

const SURVEY_UPDATABLE = new Set([
  "title", "role", "jd_text", "jd_filename", "status",
  "allow_skip", "allow_neither", "blind", "target_votes", "fields",
]);

export function updateSurvey(id, patch) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!SURVEY_UPDATABLE.has(k)) continue;
    sets.push(`${k} = ?`);
    if (k === "fields") vals.push(JSON.stringify(v));
    else if (typeof v === "boolean") vals.push(v ? 1 : 0);
    else vals.push(v);
  }
  if (sets.length) {
    vals.push(id);
    q(`UPDATE surveys SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
  return getSurvey(id);
}

export const deleteSurvey = (id) => {
  // Explicit child deletes: ON DELETE CASCADE only fires with foreign_keys on,
  // and this keeps the intent obvious.
  q(`DELETE FROM votes WHERE survey_id = ?`).run(id);
  q(`DELETE FROM voters WHERE survey_id = ?`).run(id);
  q(`DELETE FROM candidates WHERE survey_id = ?`).run(id);
  q(`DELETE FROM surveys WHERE id = ?`).run(id);
};

/* ------------------------------------------------------------- candidates */

const hydrateCandidate = (row) => {
  if (!row) return null;
  const c = plain(row);
  return { ...c, fields: JSON.parse(c.fields), active: !!c.active };
};

export function createCandidate(c) {
  const next = q(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM candidates WHERE survey_id = ?`)
    .get(c.survey_id).p;
  q(`INSERT INTO candidates (id, survey_id, name, filename, raw_text, fields, active, position, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`).run(
    c.id, c.survey_id, c.name, c.filename ?? null, c.raw_text ?? "",
    JSON.stringify(c.fields ?? {}), c.active === false ? 0 : 1, next, Date.now()
  );
  return getCandidate(c.id);
}

export const getCandidate = (id) =>
  hydrateCandidate(q(`SELECT * FROM candidates WHERE id = ?`).get(id));

export const listCandidates = (surveyId) =>
  plainAll(q(`SELECT * FROM candidates WHERE survey_id = ? ORDER BY position, created_at`).all(surveyId))
    .map(hydrateCandidate);

export const listActiveCandidates = (surveyId) =>
  listCandidates(surveyId).filter((c) => c.active);

export function updateCandidate(id, patch) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!["name", "fields", "active", "raw_text"].includes(k)) continue;
    sets.push(`${k} = ?`);
    if (k === "fields") vals.push(JSON.stringify(v));
    else if (typeof v === "boolean") vals.push(v ? 1 : 0);
    else vals.push(v);
  }
  if (sets.length) {
    vals.push(id);
    q(`UPDATE candidates SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
  return getCandidate(id);
}

export const deleteCandidate = (id) => {
  q(`DELETE FROM votes WHERE left_id = ? OR right_id = ?`).run(id, id);
  q(`DELETE FROM candidates WHERE id = ?`).run(id);
};

/* ------------------------------------------------------------ voters/votes */

export function createVoter(v) {
  const now = Date.now();
  q(`INSERT INTO voters (id, survey_id, name, created_at, last_seen_at) VALUES (?,?,?,?,?)`)
    .run(v.id, v.survey_id, v.name, now, now);
  return getVoter(v.id);
}

export const getVoter = (id) => plain(q(`SELECT * FROM voters WHERE id = ?`).get(id));

export const touchVoter = (id) =>
  q(`UPDATE voters SET last_seen_at = ? WHERE id = ?`).run(Date.now(), id);

export const listVoters = (surveyId) =>
  plainAll(q(`SELECT * FROM voters WHERE survey_id = ? ORDER BY created_at`).all(surveyId));

export function recordVote(v) {
  q(`INSERT INTO votes (id, survey_id, voter_id, left_id, right_id, pair_key, winner_id, outcome, decided_ms, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    v.id, v.survey_id, v.voter_id, v.left_id, v.right_id, v.pair_key,
    v.winner_id ?? null, v.outcome, v.decided_ms ?? 0, Date.now()
  );
}

export const listVotes = (surveyId) =>
  plainAll(q(`SELECT * FROM votes WHERE survey_id = ? ORDER BY created_at`).all(surveyId));

export const listVotesByVoter = (voterId) =>
  plainAll(q(`SELECT * FROM votes WHERE voter_id = ? ORDER BY created_at`).all(voterId));

export const countVotesByVoter = (voterId) =>
  q(`SELECT COUNT(*) AS n FROM votes WHERE voter_id = ?`).get(voterId).n;

/**
 * Candidate and vote counts for every survey in two queries, rather than two
 * queries per survey. Returns { [surveyId]: { candidates, votes } }.
 */
export function surveyCounts() {
  const out = {};
  const bump = (row, key) => {
    out[row.survey_id] ??= { candidates: 0, votes: 0 };
    out[row.survey_id][key] = row.n;
  };
  for (const row of q(`SELECT survey_id, COUNT(*) AS n FROM candidates WHERE active = 1 GROUP BY survey_id`).all()) {
    bump(row, "candidates");
  }
  for (const row of q(`SELECT survey_id, COUNT(*) AS n FROM votes GROUP BY survey_id`).all()) {
    bump(row, "votes");
  }
  return out;
}

/** How many times each unordered pair has been judged, as a { pairKey: n } map. */
export function pairCounts(surveyId) {
  const rows = q(`SELECT pair_key, COUNT(*) AS n FROM votes WHERE survey_id = ? GROUP BY pair_key`)
    .all(surveyId);
  return Object.fromEntries(rows.map((r) => [r.pair_key, r.n]));
}
