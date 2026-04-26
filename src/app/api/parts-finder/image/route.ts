import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  return false;
}

async function assertSafeHost(hostname: string) {
  if (!hostname) throw new Error("INVALID_HOST");
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local")) throw new Error("LOCAL_HOST");
  const resolved = await dns.lookup(lower, { all: true });
  const hasPublic = resolved.some((row) => !isPrivateIp(row.address));
  if (!hasPublic) throw new Error("PRIVATE_HOST");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get("url")?.trim();
    if (!url) return NextResponse.json({ ok: false, error: "Missing image url." }, { status: 400 });
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return new NextResponse("Not found", { status: 404 });
    }

    await assertSafeHost(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const upstream = await fetch(parsed.toString(), {
      method: "GET",
      signal: controller.signal,
      next: { revalidate: 3600 },
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);
    if (!upstream.ok) {
      return new NextResponse("Not found", { status: 404 });
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new NextResponse("Not found", { status: 404 });
    }
    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[parts-finder][image-proxy] failed", error);
    return new NextResponse("Not found", { status: 404 });
  }
}
