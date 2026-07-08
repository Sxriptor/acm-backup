"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type RepoOption = {
  id: string;
  name: string;
  slug: string;
};

type OwnerStudioProps = {
  ownerUsername: string;
  repos: RepoOption[];
};

const folderPickerProps: Record<string, string> = {
  webkitdirectory: "",
  directory: "",
};

export function OwnerStudio({ ownerUsername, repos }: OwnerStudioProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const [selectedRepoId, setSelectedRepoId] = useState<string>(repos[0]?.id || "");
  const [createForm, setCreateForm] = useState({ name: "", slug: "", description: "" });

  const selectedRepo = useMemo(() => repos.find((repo) => repo.id === selectedRepoId) || repos[0] || null, [repos, selectedRepoId]);

  async function handleCreateRepo(formData: FormData) {
    setBusy("create");
    setStatus("");

    const name = String(formData.get("name") || "").trim();
    const slug = String(formData.get("slug") || "").trim().toLowerCase();
    const description = String(formData.get("description") || "").trim();

    const response = await fetch("/api/repos/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description }),
    });
    const payload = await response.json();

    setBusy("");

    if (!response.ok) {
      setStatus(payload.error?.message || "Could not create repository.");
      return;
    }

    setCreateForm({ name: "", slug: "", description: "" });
    setStatus(`Created ${payload.repository.name}.`);
    router.refresh();
  }

  async function handleUploadFolder(formData: FormData) {
    setBusy("upload");
    setStatus("");

    const repoId = String(formData.get("repoId") || "").trim();
    const branch = String(formData.get("branch") || "main").trim() || "main";
    const sourceLabel = String(formData.get("sourceLabel") || "").trim() || "Website upload";
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (!repoId) {
      setBusy("");
      setStatus("Pick a repo first.");
      return;
    }

    if (files.length === 0) {
      setBusy("");
      setStatus("Choose a folder to upload.");
      return;
    }

    const uploadForm = new FormData();
    uploadForm.set("repoId", repoId);
    uploadForm.set("branch", branch);
    uploadForm.set("sourceLabel", sourceLabel);
    for (const file of files) {
      uploadForm.append("files", file);
    }

    const response = await fetch("/api/repos/upload", {
      method: "POST",
      body: uploadForm,
    });
    const payload = await response.json();
    setBusy("");

    if (!response.ok) {
      setStatus(payload.error || "Could not upload folder.");
      return;
    }

    setStatus(`Uploaded ${payload.fileCount} files to ${payload.repository.name}.`);
    router.refresh();
  }

  return (
    <div className="studio-grid">
      <section className="panel detail-stack">
        <div className="meta-label">Create repo</div>
        <form
          className="form-stack"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            handleCreateRepo(new FormData(event.currentTarget));
          }}
        >
          <label>
            Repo name
            <input
              className="input"
              name="name"
              value={createForm.name}
              onChange={(event) => {
                const name = event.target.value;
                setCreateForm((current) => ({
                  ...current,
                  name,
                  slug: current.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
                }));
              }}
              placeholder="Unlimited Rod Holders"
            />
          </label>
          <label>
            Repo slug
            <input
              className="input"
              name="slug"
              value={createForm.slug}
              onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="unlimited-rod-holders"
            />
          </label>
          <label>
            Description
            <textarea
              className="textarea"
              name="description"
              rows={3}
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Backup repo for the rod holder runtime mod."
            />
          </label>
          <button className="primary-button" type="submit" disabled={busy === "create"}>
            {busy === "create" ? "Creating..." : "Create repository"}
          </button>
        </form>
      </section>

      <section className="panel detail-stack">
        <div className="meta-label">Upload folder</div>
        <form
          className="form-stack"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            handleUploadFolder(new FormData(event.currentTarget));
          }}
        >
          <label>
            Target repo
            <select
              className="input"
              name="repoId"
              value={selectedRepoId}
              onChange={(event) => setSelectedRepoId(event.target.value)}
            >
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name} ({repo.slug})
                </option>
              ))}
            </select>
          </label>
          <label>
            Commit label
            <input className="input" name="sourceLabel" defaultValue="Website upload" />
          </label>
          <label>
            Branch
            <input className="input" name="branch" defaultValue="main" />
          </label>
          <label>
            Folder contents
            <input
              className="input"
              type="file"
              name="files"
              multiple
              {...folderPickerProps}
            />
          </label>
          <div className="caption">
            Pick a folder from your computer. ACM will treat it like a repo snapshot and route large files to the proper bucket.
          </div>
          <button className="primary-button" type="submit" disabled={busy === "upload"}>
            {busy === "upload" ? "Uploading..." : "Upload folder"}
          </button>
        </form>
      </section>

      <section className="panel detail-stack">
        <div className="meta-label">Active target</div>
        {selectedRepo ? (
          <>
            <div className="inline-code-pill">
              {ownerUsername}/{selectedRepo.slug}.acm
            </div>
            <div className="caption">Uploads land in this repo unless you switch it first.</div>
          </>
        ) : (
          <div className="warning">Create a repo first to enable folder uploads.</div>
        )}
        {status ? <div className="flash">{status}</div> : null}
      </section>
    </div>
  );
}
