export type RepoRecord = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string | null;
  source_path: string | null;
  created_at: string;
  updated_at: string;
  visibility: "private" | "public";
};

export type CommitRecord = {
  id: string;
  repository_id: string;
  commit_message: string;
  branch_name: string;
  tree_sha: string;
  archive_key: string | null;
  file_count: number;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type WorkRepo = {
  slug: string;
  name: string;
  sourcePath: string;
  fileCount: number;
  topLevelEntries: number;
  readmePath: string | null;
  description: string | null;
};
