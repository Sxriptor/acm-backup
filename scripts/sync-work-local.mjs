import { promises as fs } from "node:fs";
import path from "node:path";

const workRoot = process.env.ACM_WORK_ROOT || "C:/anglertools/work";
const outFile = path.join(process.cwd(), "scripts", "work-manifest.json");
const skip = new Set([".git", ".acm", "node_modules", "dist", "build", ".next", "obj", "bin"]);

async function countFiles(root) {
  let count = 0;
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) queue.push(full);
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }
  return count;
}

const entries = await fs.readdir(workRoot, { withFileTypes: true });
const repos = [];
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const folder = path.join(workRoot, entry.name);
  repos.push({ name: entry.name, sourcePath: folder, fileCount: await countFiles(folder) });
}
repos.sort((a, b) => a.name.localeCompare(b.name));
await fs.writeFile(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), repos }, null, 2));
console.log(`Wrote ${repos.length} repos to ${outFile}`);
