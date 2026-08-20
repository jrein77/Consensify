import { useState } from "react";
import { Doc, Trash, Check, Spinner } from "./Icons";
import { api } from "../lib/client";

export function CandidateList({ candidates, fields, onChange, disabled }) {
  if (!candidates.length) return null;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
      {candidates.map((c) => (
        <CandidateRow key={c.id} candidate={c} fields={fields} onChange={onChange} disabled={disabled} />
      ))}
    </ul>
  );
}

function CandidateRow({ candidate, fields, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  const editing = draft !== null;
  const filled = fields.filter((f) => (candidate.fields?.[f] ?? "").trim()).length;

  function startEdit() {
    setDraft({
      name: candidate.name,
      fields: Object.fromEntries(fields.map((f) => [f, candidate.fields?.[f] ?? ""])),
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/candidates/${candidate.id}`, { method: "PATCH", body: draft });
      setDraft(null);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function patch(body) {
    setBusy(true);
    try {
      await api(`/api/candidates/${candidate.id}`, { method: "PATCH", body });
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${candidate.name} and any votes involving them?`)) return;
    setBusy(true);
    try {
      await api(`/api/candidates/${candidate.id}`, { method: "DELETE" });
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={candidate.active ? "" : "bg-line-soft/60"}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span className="text-ink-faint"><Doc /></span>
          <span className="min-w-0">
            <span className={`block truncate text-sm font-medium ${candidate.active ? "text-ink" : "text-ink-faint line-through"}`}>
              {candidate.name}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              {candidate.filename} · {filled} of {fields.length} fields found
            </span>
          </span>
        </button>

        {filled < fields.length ? (
          <span className="chip border-warn/20 bg-warn-soft text-warn">Incomplete</span>
        ) : null}

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={candidate.active}
            disabled={disabled || busy}
            onChange={(e) => patch({ active: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent"
          />
          In pool
        </label>

        <button className="btn-ghost px-2 py-1" onClick={remove} disabled={busy} aria-label={`Remove ${candidate.name}`}>
          {busy ? <Spinner /> : <Trash />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-canvas px-4 py-4">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="field-label">Name</label>
                <input
                  className="input" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              {fields.map((f) => (
                <div key={f}>
                  <label className="field-label">{f}</label>
                  <input
                    className="input" value={draft.fields[f]}
                    placeholder="Leave blank if not listed"
                    onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, [f]: e.target.value } })}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setDraft(null)}>Cancel</button>
                <button className="btn-primary" onClick={save} disabled={busy}>
                  {busy ? <Spinner /> : <Check />} Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {fields.map((f) => {
                  const value = (candidate.fields?.[f] ?? "").trim();
                  return (
                    <div key={f}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{f}</dt>
                      <dd className={`text-sm ${value ? "text-ink-soft" : "text-ink-faint italic"}`}>
                        {value || "Not listed"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <div className="mt-4 flex justify-end">
                <button className="btn-secondary" onClick={startEdit}>Edit details</button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
