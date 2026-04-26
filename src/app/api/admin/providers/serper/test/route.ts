import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  await requireAdmin();
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "SERPER_API_KEY is missing." }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: "Toyota Corolla 2015 engine oil filter", num: 10 }),
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("[parts-finder][serper-test] non-200 response", { status: res.status });
      return NextResponse.json({ ok: false, error: "Serper request failed." }, { status: 502 });
    }
    const json = (await res.json()) as { organic?: unknown[] };
    return NextResponse.json({
      ok: true,
      resultsCount: Array.isArray(json.organic) ? json.organic.length : 0,
    });
  } catch (error) {
    console.error("[parts-finder][serper-test] request failed", error);
    return NextResponse.json({ ok: false, error: "Serper request failed." }, { status: 502 });
  }
}
