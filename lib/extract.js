/**
 * Document text extraction and heuristic résumé parsing.
 *
 * Deliberately no LLM: this is rule-based so it runs instantly, offline, and
 * for free. It is right most of the time and obviously wrong the rest of the
 * time, which is why every extracted field is editable before a survey opens.
 */

import mammoth from "mammoth";
import { pdfToText } from "./pdf.js";

export const CANONICAL_FIELDS = [
  "Years of Experience",
  "Most Recent Role",
  "Education",
  "Key Skills",
  "Certifications",
  "Location",
];

/* ------------------------------------------------------------ text layer */

export async function extractText(buffer, filename = "") {
  const ext = (filename.split(".").pop() || "").toLowerCase();

  if (ext === "pdf") {
    return normalise(await pdfToText(buffer));
  }
  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return normalise(value);
  }
  if (ext === "doc") {
    // Legacy binary .doc isn't reliably parseable without a converter; salvage
    // whatever readable ASCII runs exist rather than failing outright.
    const salvaged = buffer.toString("latin1").replace(/[^\x20-\x7E\n]+/g, " ");
    return normalise(salvaged);
  }
  return normalise(buffer.toString("utf8"));
}

function normalise(text) {
  return (text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[‐-―]/g, "-")   // various dashes -> hyphen
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map((l) => l.trim()).join("\n")
    .trim();
}

/* --------------------------------------------------------- section finder */

const SECTIONS = {
  experience: ["experience", "work experience", "professional experience", "employment",
    "employment history", "work history", "career history", "professional background",
    "relevant experience"],
  education: ["education", "academic background", "academics", "education and training",
    "education & training", "academic qualifications"],
  skills: ["skills", "technical skills", "core competencies", "competencies", "technologies",
    "technical expertise", "expertise", "areas of expertise", "proficiencies", "tools"],
  certifications: ["certifications", "certification", "certificates", "licenses",
    "licenses and certifications", "licences", "credentials", "professional certifications"],
  summary: ["summary", "professional summary", "profile", "objective", "about",
    "about me", "overview", "career summary"],
};

const ALL_HEADERS = Object.entries(SECTIONS).flatMap(([key, names]) =>
  names.map((n) => ({ key, n })));

function headerKeyFor(line) {
  const cleaned = line.replace(/[:•▪●\-–—_*]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!cleaned || cleaned.length > 45) return null;
  const hit = ALL_HEADERS.find(({ n }) => cleaned === n);
  if (hit) return hit.key;
  // Allow "EXPERIENCE" style headers with trailing noise, but only if the line
  // is short and mostly the header itself.
  const loose = ALL_HEADERS.find(({ n }) => cleaned.startsWith(n) && cleaned.length <= n.length + 12);
  return loose ? loose.key : null;
}

/** Splits the document into { experience: "...", education: "...", ... }. */
function splitSections(text) {
  const lines = text.split("\n");
  const out = { head: [] };
  let current = "head";
  for (const line of lines) {
    const key = headerKeyFor(line);
    if (key) {
      current = key;
      if (!out[current]) out[current] = [];
      continue;
    }
    if (!out[current]) out[current] = [];
    out[current].push(line);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n").trim()]));
}

/* ------------------------------------------------------------- name/contact */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
const PHONE_RE = /(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const LOCATION_RE = /\b([A-Z][a-zA-Z.'-]+(?:[ \t][A-Z][a-zA-Z.'-]+){0,2}),[ \t]*([A-Z]{2}\b|[A-Z][a-z]+\b)/;

const US_STATES = new Set(("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO " +
  "MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR").split(" "));
const PLACES = new Set(["usa", "us", "united states", "canada", "uk", "united kingdom", "england",
  "scotland", "ireland", "australia", "germany", "france", "spain", "india", "singapore",
  "netherlands", "japan", "brazil", "mexico", "remote"]);

const NAME_NOISE = /\b(resume|resumes|cv|curriculum|vitae|final|draft|copy|updated|new|v\d+|20\d\d|19\d\d)\b/gi;

export function nameFromFilename(filename = "") {
  const base = filename.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(/[_\-.]+/g, " ")
    .replace(NAME_NOISE, " ")
    .replace(/[^A-Za-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const words = cleaned.split(" ")
    .filter((w) => w.length > 1)
    // "Chen_Wei_Nurse.pdf" is a name plus a role, not a three-part name.
    .filter((w) => !JOB_WORDS.includes(w.toLowerCase()));
  // A single token is as likely to be "sparse" or "final" as a real name.
  if (words.length < 2 || words.length > 4) return "";
  return words.map(titleCase).join(" ");
}

const titleCase = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

function nameFromText(text) {
  const lines = text.split("\n").slice(0, 12);
  for (const line of lines) {
    const l = line.trim();
    if (!l || l.length > 45) continue;
    if (EMAIL_RE.test(l) || PHONE_RE.test(l) || /\d/.test(l)) continue;
    if (headerKeyFor(l)) continue;
    if (/[|,@/]/.test(l)) continue;
    const words = l.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 4) continue;
    // Accept "Jane Doe" and "JANE DOE", reject "senior software engineer"
    const looksLikeName = words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w) || /^[A-Z.'-]+$/.test(w));
    if (!looksLikeName) continue;
    if (JOB_WORD_RE.test(l)) continue;
    return words.map((w) => (w === w.toUpperCase() ? titleCase(w) : w)).join(" ");
  }
  return "";
}

/* ------------------------------------------------------------- experience */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
const DATE_RANGE_RE = new RegExp(
  `(?:(${MONTH_RE})\\s*)?((?:19|20)\\d{2})\\s*(?:-|–|to|through|until)\\s*` +
  `(?:(?:(${MONTH_RE})\\s*)?((?:19|20)\\d{2})|(present|current|now|today))`,
  "gi"
);

function monthIndex(token) {
  if (!token) return null;
  return MONTHS[token.slice(0, 3).toLowerCase()] ?? null;
}

/**
 * Total months of experience, counting overlapping roles only once. Résumés
 * routinely list concurrent positions; naively summing durations inflates
 * people who held two jobs at the same time.
 */
function experienceMonths(text) {
  const now = new Date();
  const intervals = [];
  for (const m of text.matchAll(DATE_RANGE_RE)) {
    const [, startMon, , startYear, endMon, , endYear, present] = m;
    const sY = parseInt(startYear, 10);
    const sM = monthIndex(startMon) ?? 0;
    let eY, eM;
    if (present) {
      eY = now.getFullYear(); eM = now.getMonth();
    } else {
      eY = parseInt(endYear, 10);
      eM = monthIndex(endMon) ?? 11;
    }
    const start = sY * 12 + sM;
    const end = eY * 12 + eM;
    if (end < start) continue;
    if (sY < 1960 || eY > now.getFullYear() + 1) continue;
    intervals.push([start, end]);
  }
  if (!intervals.length) return null;

  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = intervals[0];
  for (const [s, e] of intervals.slice(1)) {
    if (s <= curEnd) curEnd = Math.max(curEnd, e);
    else { total += curEnd - curStart; curStart = s; curEnd = e; }
  }
  total += curEnd - curStart;
  return total;
}

const STATED_YEARS_RE = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:relevant\s+|professional\s+|industry\s+|hands-on\s+)?experience/i;

function yearsOfExperience(text, sections) {
  const stated = (sections.summary || text.slice(0, 900)).match(STATED_YEARS_RE);
  if (stated) return `${stated[1]}+ years (stated)`;
  const months = experienceMonths(sections.experience || text);
  if (months == null || months < 2) return null;
  const years = months / 12;
  if (years < 1) return `${months} months`;
  return `${years >= 10 ? Math.round(years) : Math.round(years * 10) / 10} years`;
}

/* ------------------------------------------------------------------ roles */

const JOB_WORDS = ["engineer", "developer", "manager", "designer", "analyst", "director",
  "scientist", "architect", "consultant", "specialist", "coordinator", "administrator",
  "lead", "head of", "president", "officer", "associate", "intern", "researcher",
  "technician", "accountant", "recruiter", "strategist", "producer", "editor",
  "supervisor", "partner", "counsel", "nurse", "teacher", "professor", "chief"];
const JOB_WORD_RE = new RegExp(`\\b(${JOB_WORDS.join("|")})\\b`, "i");

function mostRecentRole(sections, text) {
  const source = sections.experience || text;
  const candidates = [];
  for (const raw of source.split("\n")) {
    const line = raw.replace(/^[•▪●*\-–—\s]+/, "").trim();
    if (!line || line.length > 90) continue;
    if (!JOB_WORD_RE.test(line)) continue;
    if (EMAIL_RE.test(line)) continue;
    // Strip trailing date ranges: "Senior Engineer, Acme  2019 - Present"
    const cleaned = line
      .replace(new RegExp(`\\s*[|(]?\\s*(?:${MONTH_RE}\\s*)?(?:19|20)\\d{2}\\s*(?:-|–|to).*$`, "i"), "")
      .replace(/\s*[|,]\s*$/, "")
      .trim();
    if (cleaned.length < 3) continue;
    candidates.push(cleaned);
  }
  // Also consider a headline role right under the name.
  if (!candidates.length) {
    const head = (sections.head || "").split("\n").find((l) => JOB_WORD_RE.test(l) && l.length < 70);
    if (head) return head.trim();
  }
  return candidates[0] || null;
}

/* -------------------------------------------------------------- education */

const DEGREES = [
  { rank: 4, re: /\b(ph\.?d|doctor(ate|al)?|d\.?phil|m\.?d\b|j\.?d\b|ed\.?d)\b/i, label: "Doctorate" },
  { rank: 3, re: /\b(master'?s?|m\.?s\.?c?\b|m\.?eng\b|m\.?b\.?a\b|m\.?a\b|m\.?p\.?h\b|msc)\b/i, label: "Master's" },
  { rank: 2, re: /\b(bachelor'?s?|b\.?s\.?c?\b|b\.?a\b|b\.?eng\b|b\.?tech\b|undergraduate degree)\b/i, label: "Bachelor's" },
  { rank: 1, re: /\b(associate'?s?\s+degree|a\.?a\.?s?\b)\b/i, label: "Associate" },
];

const DEGREE_ACRONYM_RE = /\b(MBA|J\.?D|M\.?D|Ph\.?D|Ed\.?D|M\.?P\.?H|MFA|MSc|BSc)\b/i;
const SCHOOL_RE = /\b((?:[A-Z][\w.'-]+[ \t]){0,3}(?:University|College|Institute|Academy|Polytechnic)(?:[ \t]of[ \t][A-Z][\w.'-]+(?:[ \t](?:at|of)[ \t][A-Z][\w.'-]+)?)?)/;
const FIELD_RE = /\b(?:in|of)[ \t]+([A-Z][A-Za-z&' -]{2,40})/;
// "Master of Science in Computer Science" -> the degree type, then the real field
const FIELD_PREFIX_RE = /^(?:Science|Arts|Engineering|Business Administration|Fine Arts|Public Health|Philosophy)[ \t]+in[ \t]+/i;

const DEGREE_CASING = { PHD: "PhD", MD: "MD", JD: "JD", MBA: "MBA", EDD: "EdD",
  MPH: "MPH", MFA: "MFA", MSC: "MSc", BSC: "BSc" };

const prettyDegree = (raw) => {
  const key = raw.toUpperCase().replace(/\./g, "");
  return DEGREE_CASING[key] || key;
};

function education(sections, text) {
  const source = sections.education || text;
  let best = null;
  let bestLine = "";
  for (const raw of source.split("\n")) {
    const line = raw.replace(/^[•▪●*\-–—\s]+/, "").trim();
    if (!line) continue;
    for (const deg of DEGREES) {
      if (deg.re.test(line) && (!best || deg.rank > best.rank)) {
        best = deg;
        bestLine = line;
      }
    }
  }
  if (!best) return null;

  // Prefer the actual acronym on the page ("MBA") over a generic label.
  const acronym = bestLine.match(DEGREE_ACRONYM_RE);
  const label = acronym ? prettyDegree(acronym[1]) : best.label;

  // Degree and field sit before the first comma; the school comes after it.
  // Searching the whole line would match the "of" inside "University of Texas".
  const beforeComma = bestLine.split(",")[0];
  let field = (beforeComma.match(FIELD_RE) || [])[1] || null;
  if (field) {
    field = field.replace(FIELD_PREFIX_RE, "").replace(/[\s-]+$/, "").trim();
    if (field.length < 3 || new RegExp(`^${label}$`, "i").test(field)) field = null;
  }

  const school = (bestLine.match(SCHOOL_RE) || [])[1]?.trim() || null;

  let out = label;
  if (field) out += ` in ${field}`;
  if (school) out += ` — ${school}`;
  return out;
}

/* ----------------------------------------------------------------- skills */

const SKILL_HINTS = ["javascript", "typescript", "python", "java", "c++", "c#", "go", "rust",
  "ruby", "php", "swift", "kotlin", "sql", "react", "angular", "vue", "node.js", "django",
  "rails", "spring", "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "graphql",
  "postgresql", "mysql", "mongodb", "redis", "kafka", "spark", "hadoop", "tensorflow",
  "pytorch", "excel", "tableau", "power bi", "salesforce", "figma", "sketch", "jira",
  "agile", "scrum", "git", "ci/cd", "machine learning", "data analysis", "project management"];

function skills(sections) {
  const source = sections.skills;
  if (source) {
    const items = source
      .split(/[\n,;|•▪●]|\s{2,}/)
      .map((s) => s.replace(/^[\s*\-–—:]+/, "").replace(/[.\s]+$/, "").trim())
      .filter((s) => s.length > 1 && s.length < 34 && !headerKeyFor(s))
      // Drop prose lines that happen to sit in the skills block
      .filter((s) => s.split(/\s+/).length <= 4);
    const unique = [...new Set(items)];
    if (unique.length) return unique.slice(0, 12).join(", ");
  }
  return null;
}

function skillsFallback(text) {
  const lower = text.toLowerCase();
  const found = SKILL_HINTS.filter((s) => lower.includes(s));
  if (!found.length) return null;
  return found.slice(0, 12).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).join(", ");
}

/* --------------------------------------------------------- certifications */

function certifications(sections) {
  if (!sections.certifications) return null;
  const items = sections.certifications
    .split(/[\n;•▪●]/)
    .map((s) => s.replace(/^[\s*\-–—:]+/, "").trim())
    .filter((s) => s.length > 2 && s.length < 80 && !headerKeyFor(s));
  const unique = [...new Set(items)];
  return unique.length ? unique.slice(0, 6).join("; ") : null;
}

function findLocation(text) {
  // Contact details live in the first handful of lines; scanning line by line
  // stops a name on one line pairing with a city on the next.
  for (const line of text.split("\n").slice(0, 15)) {
    // Contact lines often read "San Francisco, CA | jane@x.com", so an email
    // on the line is no reason to skip it, the region check below is the guard.
    if (headerKeyFor(line)) continue;
    const m = line.match(LOCATION_RE);
    if (!m) continue;
    const region = m[2].trim();
    // Without this check "Data Scientist, Netflix" reads as a city and a state.
    const valid = US_STATES.has(region.toUpperCase()) || PLACES.has(region.toLowerCase());
    if (valid) return `${m[1].trim()}, ${region}`;
  }
  return null;
}

/* ------------------------------------------------------------------ entry */

/**
 * Parses raw text into the canonical comparison fields. Every canonical field
 * is always present in the result. Missing ones are empty strings, never
 * absent, so both cards in a comparison always render the same rows.
 */
export function parseResume(text, filename = "") {
  const sections = splitSections(text);
  const fields = {
    "Years of Experience": yearsOfExperience(text, sections) || "",
    "Most Recent Role": mostRecentRole(sections, text) || "",
    "Education": education(sections, text) || "",
    "Key Skills": skills(sections) || skillsFallback(text) || "",
    "Certifications": certifications(sections) || "",
    "Location": findLocation(text) || "",
  };
  const name = nameFromText(text) || nameFromFilename(filename) || "Unnamed candidate";
  return { name, fields, sections };
}

export async function extractCandidate(buffer, filename) {
  const text = await extractText(buffer, filename);
  const { name, fields } = parseResume(text, filename);
  return { name, fields, rawText: text };
}
