/**
 * The side-by-side comparison.
 *
 * Both cards are laid out on ONE grid: column 1 is the left candidate, column
 * 3 the right, and each field gets its own grid row. That makes "Education" on
 * the left sit exactly level with "Education" on the right no matter how long
 * either value is. The alignment is what makes the comparison feel fair.
 * The "or" divider occupies the middle column across every row.
 *
 * Below `md` there isn't room for two columns, so the cards stack instead.
 */

function FieldRow({ label, value }) {
  return (
    <>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 text-sm leading-relaxed ${value ? "text-ink-soft" : "italic text-ink-faint"}`}>
        {value || "Not listed"}
      </dd>
    </>
  );
}

function CardName({ name }) {
  return <h2 className="text-base font-semibold tracking-tight text-ink">{name}</h2>;
}

export function CompareBoard({ pair, onChoose, disabled }) {
  const fields = pair.left.fields.map((f) => f.label);
  // header row + one row per field
  const rows = fields.length + 1;

  const cardShell =
    "rounded-2xl border border-line bg-white shadow-card transition-shadow";
  const overlay =
    "rounded-2xl transition-all focus-visible:ring-2 focus-visible:ring-accent " +
    "focus-visible:ring-offset-2 hover:ring-2 hover:ring-accent-line disabled:pointer-events-none";

  return (
    <>
      {/* ---------- md and up: one aligned grid ---------- */}
      <div
        className="hidden gap-x-5 md:grid"
        style={{
          gridTemplateColumns: "1fr auto 1fr",
          gridTemplateRows: `repeat(${rows}, auto)`,
        }}
      >
        {/* Card surfaces, painted first so the content sits on top of them. */}
        <div className={`${cardShell} col-start-1`} style={{ gridRow: `1 / -1` }} />
        <div className={`${cardShell} col-start-3`} style={{ gridRow: `1 / -1` }} />

        <div
          className="col-start-2 flex items-center justify-center px-1"
          style={{ gridRow: "1 / -1" }}
        >
          <span className="select-none text-sm font-medium text-ink-faint">or</span>
        </div>

        {[pair.left, pair.right].map((card, i) => {
          const col = i === 0 ? "col-start-1" : "col-start-3";
          return (
            <div key={card.id} className={`${col} px-6 pt-6`} style={{ gridRow: 1 }}>
              <CardName name={card.name} />
            </div>
          );
        })}

        {fields.map((label, index) => (
          [pair.left, pair.right].map((card, i) => (
            <dl
              key={`${card.id}-${label}`}
              className={`${i === 0 ? "col-start-1" : "col-start-3"} px-6 ${
                index === fields.length - 1 ? "pb-6 pt-3" : "pt-3"
              }`}
              style={{ gridRow: index + 2 }}
            >
              <FieldRow label={label} value={card.fields[index].value} />
            </dl>
          ))
        ))}

        {/* Transparent hit areas last so the whole column is clickable. */}
        {[pair.left, pair.right].map((card, i) => (
          <button
            key={`pick-${card.id}`}
            onClick={() => onChoose(i === 0 ? "left" : "right")}
            disabled={disabled}
            aria-label={`Choose ${card.name}`}
            className={`${overlay} ${i === 0 ? "col-start-1" : "col-start-3"}`}
            style={{ gridRow: "1 / -1" }}
          />
        ))}
      </div>

      {/* ---------- below md: stacked ---------- */}
      <div className="space-y-3 md:hidden">
        {[pair.left, pair.right].map((card, i) => (
          <div key={card.id}>
            {i === 1 ? (
              <p className="py-2 text-center text-sm font-medium text-ink-faint">or</p>
            ) : null}
            <button
              onClick={() => onChoose(i === 0 ? "left" : "right")}
              disabled={disabled}
              className={`${cardShell} w-full px-5 py-5 text-left ${overlay}`}
            >
              <CardName name={card.name} />
              <dl className="mt-3 space-y-3">
                {card.fields.map((f) => (
                  <div key={f.label}>
                    <FieldRow label={f.label} value={f.value} />
                  </div>
                ))}
              </dl>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
