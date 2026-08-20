import Link from "next/link";

export function Shell({ children, breadcrumb }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-content items-center gap-3 px-5">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/ConsensifyIcon.png" alt="" className="h-6 w-6 object-contain" />
            <span className="text-sm font-semibold tracking-tight">Consensify</span>
          </Link>
          {breadcrumb ? (
            <>
              <span className="text-ink-faint">/</span>
              <span className="truncate text-sm text-ink-muted">{breadcrumb}</span>
            </>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-content px-5 py-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-ink-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatusChip({ status }) {
  const map = { draft: "chip-draft", open: "chip-open", closed: "chip-closed" };
  const label = { draft: "Draft", open: "Collecting", closed: "Closed" };
  return <span className={map[status] ?? "chip-draft"}>{label[status] ?? status}</span>;
}

export function Banner({ tone = "danger", children, onDismiss }) {
  const tones = {
    danger: "bg-danger-soft text-danger border-danger/20",
    warn: "bg-warn-soft text-warn border-warn/20",
    info: "bg-accent-soft text-accent border-accent-line",
  };
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      <div className="flex-1">{children}</div>
      {onDismiss ? (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100" aria-label="Dismiss">×</button>
      ) : null}
    </div>
  );
}
