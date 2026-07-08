import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { getWorkRoot } from "@/lib/env";
import type { WorkRepo } from "@/lib/types";

const SKIP_DIRS = new Set([".git", ".acm", "node_modules", "dist", "build", ".next", "obj", "bin"]);

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "repo";
}

async function safeReadmeSummary(folder: string) {
  for (const candidate of ["README.md", "README.txt", "readme.md", "readme.txt"]) {
    const fullPath = path.join(folder, candidate);
    try {
      const content = await fs.readFile(fullPath, "utf8");
      const line = content.split(/\r?\n/).find((entry) => entry.trim().length > 0) ?? null;
      return {
        readmePath: fullPath,
        description: line?.replace(/^#+\s*/, "") ?? null,
      };
    } catch {
      continue;
    }
  }

  return { readmePath: null, description: null };
}

async function countFiles(root: string) {
  let count = 0;
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          queue.push(path.join(current, entry.name));
        }
        continue;
      }
      if (entry.isFile()) {
        count += 1;
      }
    }
  }

  return count;
}

export async function discoverWorkRepos() {
  const workRoot = getWorkRoot();
  const entries = await fs.readdir(workRoot, { withFileTypes: true });
  const repos: WorkRepo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sourcePath = path.join(workRoot, entry.name);
    const children = await fs.readdir(sourcePath, { withFileTypes: true });
    const fileCount = await countFiles(sourcePath);
    const readme = await safeReadmeSummary(sourcePath);

    repos.push({
      slug: slugify(entry.name.replace(/\.acm$/i, "")),
      name: entry.name,
      sourcePath,
      fileCount,
      topLevelEntries: children.length,
      readmePath: readme.readmePath,
      description: readme.description,
    });
  }

  repos.sort((a, b) => a.name.localeCompare(b.name));
  return repos;
}

export async function buildRepoManifest(root: string) {
  const files: Array<{ path: string; size: number; sha1: string }> = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(root, fullPath).split(path.sep).join("/");

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const content = await fs.readFile(fullPath);
      const sha1 = createHash("sha1").update(content).digest("hex");
      files.push({ path: relativePath, size: content.length, sha1 });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  const treeSha = createHash("sha1").update(JSON.stringify(files)).digest("hex");

  return { treeSha, files };
}
