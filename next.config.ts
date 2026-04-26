import path from "path";
import type { NextConfig } from "next";

/**
 * Pin file tracing to this app (avoids wrong root when a parent folder has another lockfile).
 * Do not use `import.meta.url` here — Next can pass a file URL with a `#` fragment, which turns into
 * an invalid directory like `.../Spark and Drive Autos/#` and makes `next dev` fail immediately.
 * Run scripts from the project directory (where package.json lives).
 */
function appRootDir(): string {
  return path.resolve(process.cwd());
}

/**
 * Server Actions CSRF allowlist — must include the host:port users open in the browser.
 * Defaults: local 5173. Merges AUTH_URL / NEXTAUTH_URL at build time, plus optional SERVER_ACTION_ALLOWED_ORIGINS (comma-separated host:port).
 */
function serverActionAllowedOrigins(): string[] {
  const set = new Set<string>(["localhost:5173", "127.0.0.1:5173"]);

  function addFromAppUrl(raw: string | undefined) {
    if (!raw?.trim()) return;
    try {
      const u = new URL(raw.trim());
      const host = u.hostname;
      const port = u.port || (u.protocol === "https:" ? "443" : "80");
      set.add(`${host}:${port}`);
      if (port === "443" || port === "80") {
        set.add(host);
      }
    } catch {
      /* ignore invalid URL */
    }
  }

  addFromAppUrl(process.env.AUTH_URL);
  addFromAppUrl(process.env.NEXTAUTH_URL);

  const extra = process.env.SERVER_ACTION_ALLOWED_ORIGINS;
  if (extra) {
    for (const part of extra.split(",")) {
      const s = part.trim();
      if (s) set.add(s);
    }
  }

  return [...set];
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRootDir(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.simpleicons.org", pathname: "/**" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
      allowedOrigins: serverActionAllowedOrigins(),
    },
  },
};

export default nextConfig;
