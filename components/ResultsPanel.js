import { useState } from "react";
import { EmptyState } from "./Shell";
import { Chart } from "./Icons";
import { relativeTime } from "../lib/client";

const pct = (n) => `${Math.round(n * 100)}%`;

export function ResultsPanel({ results, voters, coverage, survey }) {
  const [showMatrix, setShowMatrix] = useState(false);
  const rows = results.rows.filter((r) => r.active);
  const { totals } = results;

  if (totals.votes === 0) {
    return (
      <EmptyState
        icon={<Chart size={26} />}
        title="No responses yet"
        description={
          survey.status === "open"
            ? "Share the voting link with your team — results appear here as they come in."
            : "Open the survey and share the voting link to start collecting comparisons."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Comparisons" value={totals.votes}
          hint={`${totals.decisive} decisive · ${totals.neithers} neither · ${totals.skips} skipped`} />
        <Stat label="Participants" value={`${coverage.votersFinished} / ${coverage.votersStarted}`}
          hint={`finished all ${coverage.goal}`} />
        <Stat label="Pair coverage" value={pct(coverage.pairCoverage)}
          hint={`${coverage.judgedPairs} of ${coverage.pairsPossible} pairs judged`} />
        <Stat
          label="Team agreement"
          value={totals.consensus == null ? "—" : pct(totals.consensus)}
          hint={consensusHint(totals.consensus)}
        />
      </div>

      <section className="surface overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Ranking</h2>
          <span className="text-xs text-ink-muted">Score = chance of beating a typical candidate</span>
        </header>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-4 px-4 py-3">
              <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-ink-faint">{r.rank}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{r.name}</span>
                  {r.provisional ? (
                    <span className="chip chip-draft" title="Fewer than 3 decisive comparisons">Provisional</span>
                  ) : null}
                  {r.flagged ? (
                    <span className="chip border-warn/20 bg-warn-soft text-warn"
                      title="Often marked as not qualified">
                      {pct(r.neitherRate)} not qualified
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full ${r.provisional ? "bg-ink-faint" : "bg-accent"}`}
                      style={{ width: `${r.score}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                    {r.score.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="hidden w-28 shrink-0 text-right text-xs text-ink-muted sm:block">
                <div className="tabular-nums">{r.wins}W · {r.losses}L</div>
                <div className="text-ink-faint">
                  {r.winRate == null ? "no decisions" : `${pct(r.winRate)} win rate`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface overflow-hidden">
          <header className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Participants</h2>
          </header>
          {voters.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">Nobody has opened the link yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {voters.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{v.name}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full ${v.done ? "bg-positive" : "bg-accent"}`}
                      style={{ width: `${Math.min(100, (v.completed / v.goal) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs tabular-nums text-ink-muted">
                    {v.completed}/{v.goal}
                  </span>
                  <span className="hidden w-16 text-right text-xs text-ink-faint sm:block">
                    {relativeTime(v.last_seen_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Head to head</h2>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setShowMatrix((v) => !v)}>
              {showMatrix ? "Hide" : "Show"}
            </button>
          </header>
          {showMatrix ? (
            <HeadToHead results={results} />
          ) : (
            <p className="px-4 py-6 text-sm text-ink-muted">
              Every direct matchup, row versus column.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function HeadToHead({ results }) {
  const order = results.rows.filter((r) => r.active).map((r) => r.id);
  const byId = new Map(results.headToHead.map((r) => [r.id, r]));
  const names = new Map(results.rows.map((r) => [r.id, r.name]));
  // Column position of each candidate within a headToHead row's `cells`.
  const cellIndex = new Map(results.headToHead.map((r, i) => [r.id, i]));

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-1.5" />
            {order.map((id) => (
              <th key={id} className="p-1.5 text-left font-medium text-ink-muted">
                <span className="block max-w-[72px] truncate">{names.get(id)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((rowId) => {
            const row = byId.get(rowId);
            return (
              <tr key={rowId}>
                <th className="p-1.5 text-left font-medium text-ink-muted">
                  <span className="block max-w-[110px] truncate">{names.get(rowId)}</span>
                </th>
                {order.map((colId) => {
                  const cell = row?.cells?.[cellIndex.get(colId)];
                  if (rowId === colId) return <td key={colId} className="bg-line-soft p-1.5" />;
                  if (!cell || cell.total === 0) {
                    return <td key={colId} className="p-1.5 text-center text-ink-faint">–</td>;
                  }
                  const share = cell.wins / cell.total;
                  return (
                    <td
                      key={colId}
                      className="p-1.5 text-center tabular-nums"
                      style={{
                        background: `rgba(79,70,229,${(share * 0.22).toFixed(3)})`,
                        color: share > 0.5 ? "#312e81" : "#71717a",
                      }}
                      title={`${names.get(rowId)} beat ${names.get(colId)} ${cell.wins} of ${cell.total}`}
                    >
                      {cell.wins}/{cell.total}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

function consensusHint(c) {
  if (c == null) return "needs decisive votes";
  if (c >= 0.7) return "strong agreement";
  if (c >= 0.4) return "moderate agreement";
  return "the team is split";
}
