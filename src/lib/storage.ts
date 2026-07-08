import { createHash } from "crypto";

import { getBucketName } from "@/lib/env";

export async function storeArchiveIfConfigured(repoSlug: string, payload: unknown) {
  const bucket = getBucketName();
  if (!bucket) {
    return { archiveKey: null, stored: false };
  }

  const archiveKey = `${repoSlug}/${createHash("sha1").update(JSON.stringify(payload)).digest("hex")}.json`;
  return { archiveKey: `${bucket}/${archiveKey}`, stored: false };
}
