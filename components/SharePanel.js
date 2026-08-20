import { useEffect, useState } from "react";
import { Link as LinkIcon, Check } from "./Icons";
import { api } from "../lib/client";
import { Banner } from "./Shell";

export function SharePanel({ survey, candidateCount, onChange }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // The share URL depends on where the app is actually being served from.
  useEffect(() => setOrigin(window.location.origin), []);

  const url = origin ? `${origin}/v/${survey.vote_token}` : "";
  const canOpen = candidateCount >= 2;

  async function setStatus(status) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/surveys/${survey.id}`, { method: "PATCH", body: { status } });
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return; // clipboard blocked; the input is selectable as a fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-6">
      {error ? <Banner onDismiss={() => setError(null)}>{error}</Banner> : null}

      <section className="surface p-5">
        <h2 className="text-sm font-semibold text-ink">Voting link</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Anyone with this link can vote. They&apos;ll be asked for their name first — no account needed.
        </p>
        <div className="mt-4 flex gap-2">
          <input readOnly value={url} onFocus={(e) => e.target.select()} className="input font-mono text-xs" />
          <button className="btn-secondary shrink-0" onClick={copy} disabled={!url}>
            {copied ? <Check /> : <LinkIcon />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {survey.status !== "open" ? (
          <p className="mt-3 text-xs text-warn">
            This link won&apos;t accept responses until the survey is open.
          </p>
        ) : null}
      </section>

      <section className="surface p-5">
        <h2 className="text-sm font-semibold text-ink">Status</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {survey.status === "draft" && "Still in draft — open it when the candidate list is final."}
          {survey.status === "open" && "Collecting responses."}
          {survey.status === "closed" && "Closed. The link no longer accepts responses."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {survey.status !== "open" ? (
            <button className="btn-primary" disabled={busy || !canOpen} onClick={() => setStatus("open")}>
              {survey.status === "closed" ? "Reopen survey" : "Open survey"}
            </button>
          ) : (
            <button className="btn-secondary" disabled={busy} onClick={() => setStatus("closed")}>
              Close survey
            </button>
          )}
        </div>
        {!canOpen ? (
          <p className="mt-3 text-xs text-warn">Add at least two candidates before opening.</p>
        ) : null}
      </section>
    </div>
  );
}
