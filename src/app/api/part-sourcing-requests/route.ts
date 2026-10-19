import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "Pay the request fee before this enquiry is sent." }, { status: 402 });
}
