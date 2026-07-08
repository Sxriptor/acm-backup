#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

import { Command } from "commander";

const program = new Command();
const ACM_DIR = ".acm";
const CONFIG_FILE = "config.json";
const INDEX_FILE = "index.json";
const HEAD_FILE = "HEAD.json";
const COMMITS_DIR = "commits";
const CLI_STATE_DIR = path.join(os.homedir(), ".acm");
const CLI_AUTH_FILE = path.join(CLI_STATE_DIR, "auth.json");
const DEFAULT_SITE_URL = process.env.ACM_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const IGNORED = new Set([ACM_DIR, ".git", "node_modules", "dist", "build", ".next", "coverage", "obj", "bin"]);

function slugify(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
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

async function loadCliAuth() {
  return readJson(CLI_AUTH_FILE, null);
}

async function saveCliAuth(data) {
  await writeJson(CLI_AUTH_FILE, data);
}

async function requireCliAuth() {
  const auth = await loadCliAuth();
  if (!auth?.token || !auth?.siteUrl) {
    throw new Error("Run `acm login` first.");
  }
  return auth;
}

function tryOpenBrowser(url) {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
      return true;
    }
    if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
      return true;
    }
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    return true;
  } catch {
    return false;
  }
}

async function apiFetch(siteUrl, pathname, init = {}) {
  const response = await fetch(`${siteUrl}${pathname}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

program.name("acm").description("ACM Hub CLI").version("0.2.0");

program
  .command("login")
  .description("Authorize the CLI through the ACM website")
  .option("--site <url>", "ACM site URL", DEFAULT_SITE_URL)
  .option("--label <label>", "Device label", os.hostname())
  .action(async (options) => {
    const siteUrl = options.site.replace(/\/$/, "");
    const start = await apiFetch(siteUrl, "/api/cli/login/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: options.label || os.hostname() }),
    });

    console.log(`Open this URL to authorize ACM:`);
    console.log(start.verificationUrl);
    console.log(`Code: ${start.userCode}`);
    tryOpenBrowser(start.verificationUrl);

    const deadline = new Date(start.expiresAt).getTime();
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const poll = await apiFetch(siteUrl, "/api/cli/login/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode: start.deviceCode }),
      });

      if (poll.status === "approved" && poll.token) {
        await saveCliAuth({ siteUrl, token: poll.token, loggedInAt: new Date().toISOString() });
        console.log("CLI login complete.");
        return;
      }

      if (poll.status === "expired") {
        throw new Error("Login request expired. Run `acm login` again.");
      }
    }

    throw new Error("Login timed out. Run `acm login` again.");
  });

program
  .command("logout")
  .description("Remove the stored ACM CLI token")
  .action(async () => {
    await fs.rm(CLI_AUTH_FILE, { force: true });
    console.log("CLI login removed.");
  });

program
  .command("storage")
  .description("Show account and repo storage usage")
  .action(async () => {
    const auth = await requireCliAuth();
    const payload = await apiFetch(auth.siteUrl, "/api/cli/storage", {
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    });

    console.log(`${payload.profile.displayName || payload.profile.username} (${payload.profile.username})`);
    console.log(`Used: ${formatBytes(payload.storage.usedBytes)} / ${formatBytes(payload.storage.quotaBytes)}`);
    console.log(`Remaining: ${formatBytes(payload.storage.remainingBytes)}`);

    if (payload.repos.length > 0) {
      console.log("\nRepos:");
      for (const repo of payload.repos) {
        console.log(`- ${repo.name} (${repo.slug}) :: ${formatBytes(repo.usedBytes)} / ${formatBytes(repo.quotaBytes)} :: ${repo.bucket || "unassigned"}`);
      }
    }
  });

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
  .description("Add or replace a remote")
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
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const index = {
      root,
      stagedAt: new Date().toISOString(),
      treeSha: treeSha(files),
      totalBytes,
      files,
    };
    await writeJson(paths.index, index);
    console.log(`Staged ${files.length} files (${formatBytes(totalBytes)}).`);
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
      totalBytes: index.totalBytes,
      files: index.files,
      root,
    };

    await writeJson(path.join(paths.commits, `${commitId}.json`), commit);
    await writeJson(paths.head, commit);
    console.log(`Committed ${commitId} (${formatBytes(index.totalBytes)}).`);
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

    const auth = await requireCliAuth();
    const remote = parseRemote(remoteUrl);
    const repoName = config.repoName || path.basename(root);

    const payload = await apiFetch(remote.baseUrl, "/api/cli/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
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

    console.log(`Pushed ${repoName} to ${remoteUrl}`);
    console.log(`Commit created at ${payload.commit.created_at}`);
    console.log(`Bucket: ${payload.bucketName} (${payload.assetClass})`);
    console.log(`Storage remaining: ${formatBytes(payload.storage.remainingBytes)}`);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
