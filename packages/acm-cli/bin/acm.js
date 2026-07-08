#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import { Command } from "commander";
import { createClient } from "@supabase/supabase-js";

const program = new Command();
const ACM_DIR = ".acm";
const CONFIG_FILE = "config.json";
const INDEX_FILE = "index.json";
const HEAD_FILE = "HEAD.json";
const COMMITS_DIR = "commits";
const IGNORED = new Set([ACM_DIR, ".git", "node_modules", "dist", "build", ".next", "coverage", "obj", "bin"]);

function slugify(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function readJson(file, fallback = null) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function acmPaths(root) {
  const dir = path.join(root, ACM_DIR);
  return {
    dir,
    config: path.join(dir, CONFIG_FILE),
    index: path.join(dir, INDEX_FILE),
    head: path.join(dir, HEAD_FILE),
    commits: path.join(dir, COMMITS_DIR),
  };
}

async function resolveRepoRoot(inputPath) {
  return path.resolve(process.cwd(), inputPath || ".");
}

async function loadConfig(root) {
  const paths = acmPaths(root);
  const config = await readJson(paths.config);
  if (!config) {
    throw new Error("This folder is not initialized. Run `acm init .` first.");
  }
  return { paths, config };
}

async function collectFiles(root) {
  const files = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(root, fullPath).split(path.sep).join("/");

      if (entry.isDirectory()) {
        if (!IGNORED.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const content = await fs.readFile(fullPath);
      files.push({
        path: relativePath,
        size: content.length,
        sha1: createHash("sha1").update(content).digest("hex"),
      });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function treeSha(files) {
  return createHash("sha1").update(JSON.stringify(files)).digest("hex");
}

async function getSupabaseSession() {
  const url = process.env.ACM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.ACM_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.ACM_EMAIL;
  const password = process.env.ACM_PASSWORD;

  if (!url || !key || !email || !password) {
    throw new Error("Set ACM_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, ACM_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ACM_EMAIL, and ACM_PASSWORD before pushing.");
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message || "Supabase sign-in failed.");
  }

  return data.session;
}

function parseRemote(remoteUrl) {
  const parsed = new URL(remoteUrl);
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Remote URL is invalid: ${remoteUrl}`);
  }

  const ownerUsername = parts[0];
  const repoSlug = parts[1].replace(/\.acm$/i, "");
  return {
    baseUrl: `${parsed.protocol}//${parsed.host}`,
    ownerUsername,
    repoSlug,
  };
}

program.name("acm").description("ACM Hub CLI").version("0.1.0");

program
  .command("init [target]")
  .description("Initialize ACM metadata in the target folder")
  .action(async (target = ".") => {
    const root = await resolveRepoRoot(target);
    const paths = acmPaths(root);
    await ensureDir(paths.commits);

    const repoName = path.basename(root);
    const config = {
      repoName,
      repoSlug: slugify(repoName),
      defaultBranch: "main",
      remotes: {},
      initializedAt: new Date().toISOString(),
    };

    await writeJson(paths.config, config);
    console.log(`Initialized ACM repo in ${root}`);
  });

const remoteCommand = program.command("remote").description("Manage remotes");
remoteCommand
  .command("add <name> <url>")
  .action(async (name, url) => {
    const root = await resolveRepoRoot(".");
    const { paths, config } = await loadConfig(root);
    config.remotes ||= {};
    config.remotes[name] = url;
    await writeJson(paths.config, config);
    console.log(`Remote ${name} set to ${url}`);
  });

program
  .command("add [target]")
  .description("Stage files into the ACM index")
  .action(async (target = ".") => {
    const root = await resolveRepoRoot(target);
    const { paths } = await loadConfig(root);
    const files = await collectFiles(root);
    const index = {
      root,
      stagedAt: new Date().toISOString(),
      treeSha: treeSha(files),
      files,
    };
    await writeJson(paths.index, index);
    console.log(`Staged ${files.length} files.`);
  });

program
  .command("commit")
  .description("Create a local ACM commit from the staged index")
  .requiredOption("-m, --message <message>")
  .action(async (options) => {
    const root = await resolveRepoRoot(".");
    const { paths } = await loadConfig(root);
    const index = await readJson(paths.index);
    if (!index) {
      throw new Error("Nothing staged. Run `acm add .` first.");
    }

    const commitId = `${Date.now()}-${index.treeSha.slice(0, 10)}`;
    const commit = {
      id: commitId,
      message: options.message,
      createdAt: new Date().toISOString(),
      treeSha: index.treeSha,
      files: index.files,
      root,
    };

    await writeJson(path.join(paths.commits, `${commitId}.json`), commit);
    await writeJson(paths.head, commit);
    console.log(`Committed ${commitId}`);
  });

program
  .command("push [remoteName] [branch]")
  .description("Push the latest local commit manifest to ACM Hub")
  .action(async (remoteName = "origin", branch = "main") => {
    const root = await resolveRepoRoot(".");
    const { paths, config } = await loadConfig(root);
    const remoteUrl = config.remotes?.[remoteName];
    if (!remoteUrl) {
      throw new Error(`Remote '${remoteName}' is not configured.`);
    }

    const head = await readJson(paths.head);
    if (!head) {
      throw new Error("No local commit found. Run `acm commit -m ...` first.");
    }

    const session = await getSupabaseSession();
    const remote = parseRemote(remoteUrl);
    const repoName = config.repoName || path.basename(root);

    const response = await fetch(`${remote.baseUrl}/api/cli/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        ownerUsername: remote.ownerUsername,
        repoSlug: remote.repoSlug,
        repoName,
        branch,
        message: head.message,
        treeSha: head.treeSha,
        files: head.files,
        remoteUrl,
        sourcePath: root,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Push failed.");
    }

    console.log(`Pushed ${repoName} to ${remoteUrl}`);
    console.log(`Commit created at ${payload.commit.created_at}`);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
