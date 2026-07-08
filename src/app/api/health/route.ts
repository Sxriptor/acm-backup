import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, service: "acmhub", date: new Date().toISOString() });
}
