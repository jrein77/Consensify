import { useRef, useState } from "react";
import { Upload, Spinner } from "./Icons";

const ACCEPT = ".pdf,.docx,.doc,.txt,.md";

/** File picker that also accepts drag-and-drop. */
export function Dropzone({ onFiles, busy, multiple = true, label, hint }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handle(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (list.length) onFiles(list);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      className={`rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
        dragging ? "border-accent bg-accent-soft" : "border-line bg-white"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => { handle(e.target.files); e.target.value = ""; }}
      />
      <div className="mb-2 flex justify-center text-ink-faint">
        {busy ? <Spinner size={22} /> : <Upload size={22} />}
      </div>
      <p className="text-sm font-medium text-ink">{busy ? "Reading documents…" : label}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
      <button
        type="button"
        className="btn-secondary mt-4"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        Choose files
      </button>
    </div>
  );
}
