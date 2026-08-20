/**
 * PDF text extraction via Mozilla's pdf.js.
 *
 * Text items come back as positioned fragments, not lines, so we regroup them
 * by vertical position. Keeping real line breaks matters: the résumé parser
 * finds section headers ("EXPERIENCE", "EDUCATION") by looking at whole lines,
 * and a wall of run-together text defeats it.
 */

const Y_TOLERANCE = 2.5; // points; anything larger is a new line

let pdfjsPromise = null;
function loadPdfjs() {
  // Loaded lazily so the (large) library only costs anything when a PDF is
  // actually uploaded, and cached so repeat uploads don't re-parse it.
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
}

export async function pdfToText(buffer) {
  const pdfjs = await loadPdfjs();

  const doc = await pdfjs.getDocument({
    // A fresh copy: pdf.js takes ownership of the buffer it is handed.
    data: new Uint8Array(buffer),
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(itemsToLines(content.items));
      page.cleanup();
    }
    return pages.join("\n\n");
  } finally {
    await doc.destroy();
  }
}

function itemsToLines(items) {
  const lines = [];
  let current = "";
  let lastY = null;

  for (const item of items) {
    if (typeof item.str !== "string") continue;
    const y = item.transform?.[5];

    if (lastY !== null && y != null && Math.abs(y - lastY) > Y_TOLERANCE) {
      lines.push(current.trimEnd());
      current = "";
    }
    current += item.str;
    if (item.hasEOL) {
      lines.push(current.trimEnd());
      current = "";
    }
    if (y != null) lastY = y;
  }
  if (current.trim()) lines.push(current.trimEnd());

  return lines.filter((l, i, arr) => l.trim() || (i > 0 && arr[i - 1].trim())).join("\n");
}
