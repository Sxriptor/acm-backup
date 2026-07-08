import { NextRequest } from "next/server";

import { getCliTokenUser } from "@/lib/cli-login";

export async function getCliUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return null;
  }

  const data = await getCliTokenUser(token);
  if (!data) {
    return null;
  }

  return {
    tokenId: data.id,
    ownerId: data.owner_id,
    profile: data.profile,
  };
}
