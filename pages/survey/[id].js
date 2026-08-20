import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Shell, PageHeader, StatusChip, Banner, EmptyState } from "../../components/Shell";
import { Dropzone } from "../../components/Dropzone";
import { CandidateList } from "../../components/CandidateList";
import { ResultsPanel } from "../../components/ResultsPanel";
import { SharePanel } from "../../components/SharePanel";
import { Modal } from "../../components/Modal";
import { Users, Chart, Link as LinkIcon, Spinner, Doc, Trash } from "../../components/Icons";
import { useApi } from "../../lib/useApi";
import { api } from "../../lib/client";

const TABS = [
  { key: "setup", label: "Setup", Icon: Users },
  { key: "results", label: "Results", Icon: Chart },
  { key: "share", label: "Share", Icon: LinkIcon },
];

export default function SurveyPage() {
  const router = useRouter();
  const { id } = router.query;
  const [tab, setTab] = useState("setup");

  const detail = useApi(id ? `/api/surveys/${id}` : null);
  // Results poll while the tab is visible so the dashboard stays live.
  const results = useApi(
    id && tab === "results" ? `/api/surveys/${id}/results` : null,
    { interval: 5000 }
  );

  const survey = detail.data?.survey;
  const candidates = detail.data?.candidates ?? [];
  const activeCount = candidates.filter((c) => c.active).length;

  const reloadDetail = detail.reload;
  const reloadResults = results.reload;
  const reloadAll = useCallback(async () => {
    await Promise.all([reloadDetail({ quiet: true }), reloadResults({ quiet: true })]);
  }, [reloadDetail, reloadResults]);

  if (detail.error) {
    return (
      <Shell>
        <Banner>{detail.error}</Banner>
        <button className="btn-secondary" onClick={() => router.push("/")}>Back to surveys</button>
      </Shell>
    );
  }

  if (!survey) {
    return (
      <Shell>
        <div className="flex justify-center py-20 text-ink-faint"><Spinner size={22} /></div>
      </Shell>
    );
  }

  return (
    <Shell breadcrumb={survey.title}>
      <PageHeader
        title={survey.title}
        subtitle={survey.role || "No role specified"}
        actions={<StatusChip status={survey.status} />}
      />

      <nav className="mb-6 flex gap-1 border-b border-line" role="tablist">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {tab === "setup" ? (
        <SetupTab survey={survey} candidates={candidates} activeCount={activeCount} onChange={reloadAll} />
      ) : null}

      {tab === "results" ? (
        results.data ? (
          <ResultsPanel
            results={results.data.results}
            voters={results.data.voters}
            coverage={results.data.coverage}
            survey={survey}
          />
        ) : (
          <div className="flex justify-center py-16 text-ink-faint"><Spinner size={22} /></div>
        )
      ) : null}

      {tab === "share" ? (
        <SharePanel survey={survey} candidateCount={activeCount} onChange={reloadAll} />
      ) : null}
    </Shell>
  );
}

function SetupTab({ survey, candidates, activeCount, onChange }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [showJd, setShowJd] = useState(false);

  const uploadTo = useCallback(async (files, kind) => {
    setBusy(true);
    setError(null);
    setSkipped([]);
    try {
      const form = new FormData();
      form.append("kind", kind);
      for (const f of files) form.append("files", f);
      const res = await api(`/api/surveys/${survey.id}/documents`, { method: "POST", body: form });
      if (res.skipped?.length) setSkipped(res.skipped);
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [survey.id, onChange]);

  async function patchSurvey(body) {
    setError(null);
    try {
      await api(`/api/surveys/${survey.id}`, { method: "PATCH", body });
      await onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeSurvey() {
    if (!confirm(`Delete "${survey.title}" and all its responses? This cannot be undone.`)) return;
    await api(`/api/surveys/${survey.id}`, { method: "DELETE" });
    router.push("/");
  }

  const locked = survey.status !== "draft";

  return (
    <div className="space-y-6">
      {error ? <Banner onDismiss={() => setError(null)}>{error}</Banner> : null}
      {skipped.length ? (
        <Banner tone="warn" onDismiss={() => setSkipped([])}>
          Skipped {skipped.length} file{skipped.length === 1 ? "" : "s"}:{" "}
          {skipped.map((s) => `${s.filename} (${s.reason})`).join(", ")}
        </Banner>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Job description</h2>
            <p className="text-sm text-ink-muted">
              Voters can open this for reference while comparing.
            </p>
          </div>
          {survey.jd_text ? (
            <button className="btn-secondary" onClick={() => setShowJd(true)}>
              <Doc /> View
            </button>
          ) : null}
        </div>

        {survey.jd_text ? (
          <div className="surface flex items-center gap-3 p-4">
            <span className="text-ink-faint"><Doc /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {survey.jd_filename || "Job description"}
              </p>
              <p className="text-xs text-ink-muted">
                {survey.jd_text.length.toLocaleString()} characters
              </p>
            </div>
            <button
              className="btn-ghost px-2 py-1"
              onClick={() => patchSurvey({ jd_text: "" })}
              aria-label="Remove job description"
            >
              <Trash />
            </button>
          </div>
        ) : (
          <Dropzone
            multiple={false}
            busy={busy}
            onFiles={(files) => uploadTo(files.slice(0, 1), "jd")}
            label="Add the job description"
            hint="PDF, DOCX, or TXT — optional but recommended"
          />
        )}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-ink">
            Candidates{" "}
            <span className="font-normal text-ink-muted">
              ({activeCount} in the pool{candidates.length !== activeCount ? `, ${candidates.length - activeCount} excluded` : ""})
            </span>
          </h2>
          <p className="text-sm text-ink-muted">
            Every card shows the same fields, so check anything the parser missed before you open the survey.
          </p>
        </div>

        {candidates.length ? (
          <div className="space-y-3">
            <CandidateList
              candidates={candidates}
              fields={survey.fields}
              onChange={onChange}
              disabled={busy}
            />
            <Dropzone
              busy={busy}
              onFiles={(files) => uploadTo(files, "candidates")}
              label="Add more résumés"
              hint="PDF, DOCX, or TXT"
            />
          </div>
        ) : (
          <Dropzone
            busy={busy}
            onFiles={(files) => uploadTo(files, "candidates")}
            label="Upload résumés"
            hint="PDF, DOCX, or TXT — drop several at once"
          />
        )}
      </section>

      <Settings survey={survey} onPatch={patchSurvey} activeCount={activeCount} locked={locked} />

      <section className="surface border-danger/20 p-5">
        <h2 className="text-sm font-semibold text-ink">Delete survey</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Removes the survey, its candidates, and every response.
        </p>
        <button className="btn-danger mt-4" onClick={removeSurvey}>
          <Trash /> Delete survey
        </button>
      </section>

      <Modal open={showJd} onClose={() => setShowJd(false)} title="Job description" wide>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft">
          {survey.jd_text}
        </pre>
      </Modal>
    </div>
  );
}

function Settings({ survey, onPatch, activeCount, locked }) {
  const maxPairs = useMemo(() => (activeCount * (activeCount - 1)) / 2, [activeCount]);
  const effective = Math.min(survey.target_votes, Math.max(maxPairs, 1));

  return (
    <section className="surface p-5">
      <h2 className="text-sm font-semibold text-ink">Voting rules</h2>
      <div className="mt-4 space-y-4">
        <div className="max-w-xs">
          <label className="field-label" htmlFor="target">Comparisons per person</label>
          <input
            id="target" type="number" min={1} max={200} className="input"
            value={survey.target_votes}
            onChange={(e) => onPatch({ target_votes: Number(e.target.value) })}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            {maxPairs > 0
              ? `${maxPairs} distinct pair${maxPairs === 1 ? "" : "s"} exist, so each person will be asked for ${effective}.`
              : "Add candidates to see how many pairs are possible."}
          </p>
        </div>

        <Toggle
          checked={survey.allow_skip}
          onChange={(v) => onPatch({ allow_skip: v })}
          label="Allow skipping a pair"
          hint="For when someone genuinely can't tell them apart."
        />
        <Toggle
          checked={survey.allow_neither}
          onChange={(v) => onPatch({ allow_neither: v })}
          label='Allow "neither is qualified"'
          hint="Recorded against both candidates instead of picking a winner."
        />
        <Toggle
          checked={survey.blind}
          onChange={(v) => onPatch({ blind: v })}
          label="Hide candidate names from voters"
          hint="Cards show “Candidate 1”, “Candidate 2” instead. Reduces name bias."
          disabled={locked}
          disabledHint={locked ? "Can't change this once the survey is open." : null}
        />
      </div>
    </section>
  );
}

function Toggle({ checked, onChange, label, hint, disabled, disabledHint }) {
  return (
    <label className={`flex gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-line text-accent focus:ring-accent"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{disabledHint || hint}</span>
      </span>
    </label>
  );
}
