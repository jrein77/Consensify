import fs from "node:fs/promises";
import formidable from "formidable";
import { route, notFound, badRequest } from "../../../../lib/api";
import { getSurvey, createCandidate, updateSurvey, listCandidates } from "../../../../lib/db";
import { extractCandidate, extractText } from "../../../../lib/extract";
import { id } from "../../../../lib/ids";

// formidable needs the raw stream, so Next's JSON body parser must stand down.
export const config = { api: { bodyParser: false } };

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 25;
const ALLOWED = new Set(["pdf", "docx", "doc", "txt", "md", "markdown"]);

const extOf = (name = "") => (name.split(".").pop() || "").toLowerCase();

async function parseUpload(req) {
  const form = formidable({
    maxFileSize: MAX_FILE_BYTES,
    maxFiles: MAX_FILES,
    keepExtensions: true,
    multiples: true,
  });
  try {
    const [fields, files] = await form.parse(req);
    return { fields, files };
  } catch (err) {
    if (String(err?.code) === "1009" || /maxFileSize/i.test(err?.message ?? "")) {
      throw badRequest("That file is larger than the 10 MB limit.");
    }
    throw badRequest("Could not read the upload.");
  }
}

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export default route({
  async POST(req) {
    const survey = getSurvey(req.query.id);
    if (!survey) throw notFound("Survey not found.");

    const { fields, files } = await parseUpload(req);
    const kind = asList(fields.kind)[0] === "jd" ? "jd" : "candidates";
    const uploaded = asList(files.files);
    if (!uploaded.length) throw badRequest("No files were uploaded.");

    const existing = listCandidates(survey.id).length;
    if (kind === "candidates" && existing + uploaded.length > MAX_FILES) {
      throw badRequest(`A survey can hold up to ${MAX_FILES} candidates.`);
    }

    const created = [];
    const skipped = [];
    try {
      for (const file of uploaded) {
        const filename = file.originalFilename || "document";
        if (!ALLOWED.has(extOf(filename))) {
          skipped.push({ filename, reason: "Unsupported file type" });
          continue;
        }
        const buffer = await fs.readFile(file.filepath);

        if (kind === "jd") {
          const text = await extractText(buffer, filename);
          if (!text.trim()) {
            skipped.push({ filename, reason: "No readable text found" });
            continue;
          }
          updateSurvey(survey.id, { jd_text: text, jd_filename: filename });
          created.push({ filename });
          break; // one job description per survey
        }

        const parsed = await extractCandidate(buffer, filename);
        if (!parsed.rawText.trim()) {
          skipped.push({ filename, reason: "No readable text found" });
          continue;
        }
        created.push(createCandidate({
          id: id(),
          survey_id: survey.id,
          name: parsed.name,
          filename,
          raw_text: parsed.rawText,
          fields: parsed.fields,
        }));
      }
    } finally {
      // formidable writes to a temp dir; don't leave the uploads behind.
      await Promise.all(uploaded.map((f) =>
        fs.unlink(f.filepath).catch(() => {})));
    }

    return { kind, created, skipped, survey: getSurvey(survey.id) };
  },
});
