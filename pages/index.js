import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Shell, PageHeader, EmptyState, StatusChip, Banner } from "../components/Shell";
import { Modal } from "../components/Modal";
import { Plus, Chart, Users, Spinner } from "../components/Icons";
import { useApi } from "../lib/useApi";
import { api, relativeTime } from "../lib/client";

export default function Home() {
  const { data, error, loading, reload } = useApi("/api/surveys");
  const [creating, setCreating] = useState(false);
  const surveys = data?.surveys ?? [];

  return (
    <Shell>
      <PageHeader
        title="Surveys"
        subtitle="Upload candidates, share a link, and let your team compare them head to head."
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus /> New survey
          </button>
        }
      />

      {error ? <Banner>{error}</Banner> : null}

      {loading && !data ? (
        <div className="flex justify-center py-16 text-ink-faint"><Spinner size={22} /></div>
      ) : surveys.length === 0 ? (
        <EmptyState
          icon={<Chart size={26} />}
          title="No surveys yet"
          description="Create a survey, upload a few résumés, and send the voting link to your team."
          action={
            <button className="btn-primary btn-lg" onClick={() => setCreating(true)}>
              <Plus /> New survey
            </button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {surveys.map((s) => (
            <li key={s.id}>
              <Link
                href={`/survey/${s.id}`}
                className="surface block h-full p-4 transition-shadow hover:shadow-lift"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="truncate font-medium text-ink">{s.title}</h2>
                  <StatusChip status={s.status} />
                </div>
                {s.role ? <p className="mb-3 truncate text-sm text-ink-muted">{s.role}</p> : null}
                <div className="flex items-center gap-4 text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={13} /> {s.candidateCount} candidate{s.candidateCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Chart size={13} /> {s.voteCount} vote{s.voteCount === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto text-ink-faint">{relativeTime(s.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateSurveyModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </Shell>
  );
}

function CreateSurveyModal({ open, onClose, onCreated }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { survey } = await api("/api/surveys", { method: "POST", body: { title, role } });
      await onCreated?.();
      router.push(`/survey/${survey.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New survey">
      <form onSubmit={submit} className="space-y-4">
        {error ? <Banner onDismiss={() => setError(null)}>{error}</Banner> : null}
        <div>
          <label className="field-label" htmlFor="survey-title">Survey name</label>
          <input
            id="survey-title" className="input" autoFocus required value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Senior Backend Engineer — Q1"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="survey-role">Role (optional)</label>
          <input
            id="survey-role" className="input" value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Senior Backend Engineer"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !title.trim()}>
            {busy ? <Spinner /> : null} Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
