/**
 * Deletes the local database so you can start from an empty app.
 *
 *   npm run reset
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data");
if (!fs.existsSync(dir)) {
  console.log("Nothing to reset — no data/ directory.");
} else {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("Local database removed. Restart the dev server to start fresh.");
}
