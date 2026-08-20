import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { CompareBoard } from "../../components/CompareBoard";
import { Modal } from "../../components/Modal";
import { Doc, Help, Spinner, Check } from "../../components/Icons";
import { api } from "../../lib/client";

const sessionKey = (token) => `consensify:voter:${token}`;

export default function VotePage() {
  const router = useRouter();
  const { token } = router.query;

  const [session, setSession] = useState(null);   // { voterId, name }
  const [state, setState] = useState(null);       // latest /next payload
  const [status, setStatus] = useState("loading");// loading | name | voting | done | error
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false); // guards against double-fire within a single tick
  const [showJd, setShowJd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const shownAt = useRef(Date.now());

  // Restore a previous session so a refresh doesn't lose someone's progress.
  useEffect(() => {
    if (!token) return;
    try {
      const raw = localStorage.getItem(sessionKey(token));
      if (raw) {
        setSession(JSON.parse(raw));
        return;
      }
    } catch {
      // ignore unreadable storage
    }
    setStatus("name");
  }, [token]);

  const loadNext = useCallback(async (voterId) => {
    try {
      const next = await api(`/api/vote/${token}/next?voterId=${encodeURIComponent(voterId)}`);
      setState(next);
      setStatus(next.done ? "done" : "voting");
      shownAt.current = Date.now();
      setError(null);
    } catch (err) {
      // A stale session id (database reset, survey deleted) sends them back to
      // the name screen rather than a dead end.
      if (/session/i.test(err.message)) {
        localStorage.removeItem(sessionKey(token));
        setSession(null);
        setStatus("name");
        setError(err.message);
      } else {
        setError(err.message);
        setStatus("error");
      }
    }
  }, [token]);

  useEffect(() => {
    if (session?.voterId && token) loadNext(session.voterId);
  }, [session, token, loadNext]);

  async function join(name) {
    const res = await api(`/api/vote/${token}/join`, { method: "POST", body: { name } });
    const next = { voterId: res.voterId, name: res.name };
    localStorage.setItem(sessionKey(token), JSON.stringify(next));
    setSession(next);
  }

  const respond = useCallback(async (outcome) => {
    if (lock.current || !state?.pair) return;
    lock.current = true;
    setSubmitting(true);
    try {
      await api(`/api/vote/${token}/submit`, {
        method: "POST",
        body: {
          voterId: session.voterId,
          leftId: state.pair.left.id,
          rightId: state.pair.right.id,
          outcome,
          decidedMs: Date.now() - shownAt.current,
        },
      });
      await loadNext(session.voterId);
    } catch (err) {
      setError(err.message);
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }, [state, token, session, loadNext]);

  // Keyboard shortcuts, documented in the help dialog.
  useEffect(() => {
    if (status !== "voting") return undefined;
    const onKey = (e) => {
      if (showJd || showHelp) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Key auto-repeat would otherwise burn through several comparisons.
      if (e.repeat) return;
      const survey = state?.survey;
      if (e.key === "ArrowLeft") { e.preventDefault(); respond("left"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); respond("right"); }
      else if (e.key.toLowerCase() === "n" && survey?.allowNeither) respond("neither");
      else if (e.key.toLowerCase() === "s" && survey?.allowSkip) respond("skip");
      else if (e.key === "?") setShowHelp(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, respond, state, showJd, showHelp]);

  if (status === "loading") {
    return <Centered><Spinner size={24} /></Centered>;
  }

  if (status === "error") {
    return (
      <Centered>
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-ink">This link isn&apos;t available</h1>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
        </div>
      </Centered>
    );
  }

  if (status === "name") {
    return <NameGate token={token} onJoin={join} notice={error} />;
  }

  const survey = state.survey;

  return (
    <div className="vote-stage min-h-screen">
      <header className="border-b border-line bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{survey.title}</p>
            {survey.role ? <p className="truncate text-xs text-ink-muted">{survey.role}</p> : null}
          </div>
          {survey.jdText ? (
            <button className="btn-secondary" onClick={() => setShowJd(true)}>
              <Doc /> <span className="hidden sm:inline">Job description</span>
            </button>
          ) : null}
          <button className="btn-ghost px-2" onClick={() => setShowHelp(true)} aria-label="How this works">
            <Help size={18} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        <Progress completed={state.completed} goal={state.goal} name={state.voterName} />

        {error ? (
          <p className="mb-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {status === "done" ? (
          <DoneScreen state={state} />
        ) : (
          <>
            <p className="mb-5 text-center text-sm text-ink-muted">
              Which candidate is the stronger fit for this role?
            </p>

            <CompareBoard pair={state.pair} onChoose={respond} disabled={submitting} />

            <div className="mt-5 flex flex-col items-center gap-2">
              {survey.allowNeither ? (
                <button
                  className="btn-secondary btn-lg w-full max-w-sm"
                  onClick={() => respond("neither")}
                  disabled={submitting}
                >
                  Neither is qualified for the role
                </button>
              ) : null}
              {survey.allowSkip ? (
                <button
                  className="btn-ghost text-sm"
                  onClick={() => respond("skip")}
                  disabled={submitting}
                >
                  Skip this pair
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      <Modal open={showJd} onClose={() => setShowJd(false)} title="Job description" wide>
        <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft">
          {survey.jdText}
        </pre>
      </Modal>

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} survey={survey} />
    </div>
  );
}

function Centered({ children }) {
  return (
    <div className="vote-stage flex min-h-screen items-center justify-center p-6 text-ink-faint">
      {children}
    </div>
  );
}

function Progress({ completed, goal, name }) {
  const done = Math.min(completed, goal);
  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-ink-muted">
        <span>{name ? `Voting as ${name}` : ""}</span>
        <span className="tabular-nums">{done} of {goal}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${goal ? (done / goal) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function DoneScreen({ state }) {
  const finished = state.reason === "complete";
  return (
    <div className="surface mx-auto max-w-md px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-positive-soft text-positive">
        <Check size={22} />
      </div>
      <h1 className="text-lg font-semibold text-ink">
        {finished ? "All done — thank you!" : "That's everything for now"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {finished
          ? `You compared ${state.completed} pair${state.completed === 1 ? "" : "s"}. Your responses have been recorded.`
          : state.reason}
      </p>
      <p className="mt-4 text-xs text-ink-faint">You can close this tab.</p>
    </div>
  );
}

function NameGate({ token, onJoin, notice }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onJoin(name.trim());
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="vote-stage flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src="/images/ConsensifyIcon.png" alt="" className="h-7 w-7 object-contain" />
          <span className="text-sm font-semibold tracking-tight">Consensify</span>
        </div>

        <div className="surface p-6">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Before you start</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Add your name so your colleagues&apos; responses can be told apart. You&apos;ll then
            compare candidates two at a time.
          </p>

          {notice ? (
            <p className="mt-4 rounded-lg border border-warn/20 bg-warn-soft px-3 py-2 text-xs text-warn">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="field-label" htmlFor="voter-name">Your name</label>
              <input
                id="voter-name" className="input" autoFocus required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
              />
            </div>
            <button type="submit" className="btn-primary btn-lg w-full" disabled={busy || !name.trim()}>
              {busy ? <Spinner /> : null} Start comparing
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function HelpModal({ open, onClose, survey }) {
  return (
    <Modal open={open} onClose={onClose} title="How this works">
      <div className="space-y-4 text-sm leading-relaxed text-ink-soft">
        <p>
          You&apos;ll see two candidates at a time, side by side. Both cards show the
          same details, so you&apos;re always comparing like for like. Pick whichever
          one you think is the stronger fit for the role.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
          <dt className="font-medium text-ink">Click a card</dt>
          <dd className="text-ink-muted">to choose that candidate.</dd>
          {survey.allowNeither ? (
            <>
              <dt className="font-medium text-ink">Neither</dt>
              <dd className="text-ink-muted">
                if you wouldn&apos;t move either of them forward. Counts against both.
              </dd>
            </>
          ) : null}
          {survey.allowSkip ? (
            <>
              <dt className="font-medium text-ink">Skip</dt>
              <dd className="text-ink-muted">
                if you genuinely can&apos;t call it. Skipped pairs don&apos;t affect scores.
              </dd>
            </>
          ) : null}
        </dl>

        <div className="rounded-lg border border-line bg-canvas p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Keyboard shortcuts
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt><Key>←</Key></dt><dd className="text-ink-muted">Choose the left candidate</dd>
            <dt><Key>→</Key></dt><dd className="text-ink-muted">Choose the right candidate</dd>
            {survey.allowNeither ? (<><dt><Key>N</Key></dt><dd className="text-ink-muted">Neither is qualified</dd></>) : null}
            {survey.allowSkip ? (<><dt><Key>S</Key></dt><dd className="text-ink-muted">Skip this pair</dd></>) : null}
            <dt><Key>?</Key></dt><dd className="text-ink-muted">Open this help</dd>
          </dl>
        </div>

        <p className="text-xs text-ink-muted">
          Pairs are chosen at random and each one is shown once. Your progress is saved
          as you go, so you can close the tab and come back to the same link.
        </p>
      </div>
    </Modal>
  );
}

const Key = ({ children }) => (
  <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-sans text-[11px] text-ink-soft shadow-sm">
    {children}
  </kbd>
);
