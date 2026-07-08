import {
  getLargeFileAssetsBucketName,
  getReleasesBucketName,
  getReposBucketName,
  LARGE_FILE_ASSET_THRESHOLD_BYTES,
  MAX_ACCOUNT_STORAGE_BYTES,
  MAX_REPO_STORAGE_BYTES,
  MAX_SINGLE_UPLOAD_BYTES,
} from "@/lib/env";

const RELEASE_BRANCHES = new Set(["release", "stable", "production"]);

export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function classifyStorageTarget(branch: string, files: Array<{ size: number }>) {
  const largestFileBytes = files.reduce((max, file) => Math.max(max, file.size), 0);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (largestFileBytes > MAX_SINGLE_UPLOAD_BYTES) {
    throw new Error(`Single file exceeds the 2 GB upload limit. Largest file: ${formatBytes(largestFileBytes)}.`);
  }

  if (totalBytes > MAX_REPO_STORAGE_BYTES) {
    throw new Error(`Repo snapshot exceeds the 5 GB repo limit. Snapshot size: ${formatBytes(totalBytes)}.`);
  }

  if (largestFileBytes >= LARGE_FILE_ASSET_THRESHOLD_BYTES) {
    return {
      bucketName: getLargeFileAssetsBucketName(),
      assetClass: "lfa" as const,
      totalBytes,
      largestFileBytes,
    };
  }

  if (RELEASE_BRANCHES.has(branch.toLowerCase())) {
    return {
      bucketName: getReleasesBucketName(),
      assetClass: "release" as const,
      totalBytes,
      largestFileBytes,
    };
  }

  return {
    bucketName: getReposBucketName(),
    assetClass: "repo" as const,
    totalBytes,
    largestFileBytes,
  };
}

export async function storeArchiveIfConfigured(
  repoSlug: string,
  branch: string,
  payload: { files: Array<{ size: number }> },
) {
  const classification = classifyStorageTarget(branch, payload.files);
  const archiveKey = `${classification.bucketName}/${repoSlug}/${Date.now()}.json`;
  return {
    archiveKey,
    stored: false,
    bucketName: classification.bucketName,
    assetClass: classification.assetClass,
    totalBytes: classification.totalBytes,
    largestFileBytes: classification.largestFileBytes,
  };
}

export function computeRemainingStorage(usedBytes: number, quotaBytes: number) {
  return Math.max(0, quotaBytes - usedBytes);
}

export { MAX_ACCOUNT_STORAGE_BYTES, MAX_REPO_STORAGE_BYTES, MAX_SINGLE_UPLOAD_BYTES };
