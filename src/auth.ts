import type { UserRole } from "@prisma/client";
import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { authConfig } from "./auth.config";
import { AccountSuspendedAuthError, OAuthOnlyAuthError } from "@/lib/auth-credentials-errors";
import { getGoogleOAuthCredentials } from "@/lib/auth/provider-flags";
import { getRequestIp } from "@/lib/client-ip";
import { normalizePhone } from "@/lib/phone";
import { recordSecurityObservation } from "@/lib/security-observation";

export {
  getStaffOperationsHref,
  isAdminRole,
  isSuperAdminRole,
  isSupportStaffRole,
} from "@/lib/roles";

const credentialsSchema = z.object({
  identifier: z.string().min(3).max(160),
  password: z.string().min(8).max(128),
});

const googleOAuth = getGoogleOAuthCredentials();
const googleConfigured = Boolean(googleOAuth);
/** Avoid spam during `next build` (many workers; each has a fresh global). */
const GOOGLE_OAUTH_LOG_KEY = "__sda_google_oauth_enabled_logged__";
if (
  process.env.NODE_ENV === "development" &&
  !(globalThis as Record<string, unknown>)[GOOGLE_OAUTH_LOG_KEY]
) {
  console.info(`[auth] Google OAuth enabled: ${googleConfigured}`);
  (globalThis as Record<string, unknown>)[GOOGLE_OAUTH_LOG_KEY] = true;
}

/** Apple is disabled unless explicitly enabled — see `ENABLE_APPLE_OAUTH` in `.env.example`. */
const appleOptIn = process.env.ENABLE_APPLE_OAUTH?.trim() === "1";
const resolvedAppleClientSecret = process.env.AUTH_APPLE_SECRET?.trim();
const appleConfigured =
  appleOptIn &&
  Boolean(process.env.AUTH_APPLE_ID?.trim()) &&
  Boolean(resolvedAppleClientSecret);

function isLikelyEmail(v: string): boolean {
  return v.includes("@");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(appleConfigured
      ? [
          Apple({
            clientId: process.env.AUTH_APPLE_ID!,
            clientSecret: resolvedAppleClientSecret!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(googleConfigured
      ? [
          Google({
            clientId: googleOAuth!.clientId,
            clientSecret: googleOAuth!.clientSecret,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                prompt: "select_account",
                access_type: "online",
              },
            },
          }),
        ]
      : []),
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw, request) => {
        const ip = getRequestIp(request);
        const userAgent = request?.headers?.get("user-agent") ?? null;
        const { rateLimitAuth } = await import("@/lib/rate-limit");
        const rl = await rateLimitAuth(`login:${ip}`);
        if (!rl.success) {
          await recordSecurityObservation({
            severity: "HIGH",
            channel: "RATE_LIMIT",
            title: "Credential login rate-limited (per IP)",
            ipAddress: ip,
            userAgent,
            metadataJson: { scope: "auth:login" },
          });
          return null;
        }

        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          await recordSecurityObservation({
            severity: "LOW",
            channel: "AUTH",
            title: "Credential login rejected (invalid payload)",
            ipAddress: ip,
            userAgent,
          });
          return null;
        }
        const { identifier, password } = parsed.data;
        const { compare } = await import("bcryptjs");
        const { prisma } = await import("@/lib/prisma");
        const id = identifier.trim();
        let user:
          | {
              id: string;
              email: string;
              phone: string | null;
              name: string | null;
              image: string | null;
              role: UserRole;
              passwordHash: string | null;
              accountBlocked: boolean;
            }
          | null = null;

        if (isLikelyEmail(id)) {
          user = await prisma.user.findUnique({
            where: { email: id.toLowerCase() },
            select: {
              id: true,
              email: true,
              phone: true,
              name: true,
              image: true,
              role: true,
              passwordHash: true,
              accountBlocked: true,
            },
          });
        } else {
          const phone = normalizePhone(id);
          user = await prisma.user.findUnique({
            where: { phone },
            select: {
              id: true,
              email: true,
              phone: true,
              name: true,
              image: true,
              role: true,
              passwordHash: true,
              accountBlocked: true,
            },
          });
        }

        if (!user) {
          await recordSecurityObservation({
            severity: "MEDIUM",
            channel: "AUTH",
            title: isLikelyEmail(id) ? "Credential login unknown email" : "Credential login unknown phone",
            email: isLikelyEmail(id) ? id.toLowerCase() : undefined,
            phone: isLikelyEmail(id) ? undefined : normalizePhone(id),
            ipAddress: ip,
            userAgent,
          });
          return null;
        }

        if (!user.passwordHash) {
          await recordSecurityObservation({
            severity: "MEDIUM",
            channel: "AUTH",
            title: "Credential login rejected (OAuth-only account)",
            userId: user.id,
            email: user.email,
            phone: user.phone,
            ipAddress: ip,
            userAgent,
          });
          throw new OAuthOnlyAuthError();
        }

        if (user.accountBlocked) {
          await recordSecurityObservation({
            severity: "HIGH",
            channel: "AUTH",
            title: "Credential login rejected (suspended account)",
            userId: user.id,
            email: user.email,
            phone: user.phone,
            ipAddress: ip,
            userAgent,
          });
          throw new AccountSuspendedAuthError();
        }

        const ok = await compare(password, user.passwordHash);
        if (!ok) {
          await recordSecurityObservation({
            severity: "HIGH",
            channel: "AUTH",
            title: "Credential login failed (wrong password)",
            userId: user.id,
            email: user.email,
            phone: user.phone,
            ipAddress: ip,
            userAgent,
          });
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if ((account?.provider === "google" || account?.provider === "apple") && user.email) {
        const { prisma } = await import("@/lib/prisma");
        const email = user.email.toLowerCase();
        const picture = (profile as { picture?: string } | null | undefined)?.picture;
        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, phone: true, name: true, image: true, accountBlocked: true },
        });
        if (existing?.accountBlocked) {
          await recordSecurityObservation({
            severity: "HIGH",
            channel: "AUTH",
            title: "OAuth sign-in rejected (suspended account)",
            userId: existing.id,
            email: existing.email,
            phone: existing.phone,
            metadataJson: { provider: account?.provider ?? "unknown" },
          });
          return false;
        }
        if (!existing) {
          await prisma.user.create({
            data: {
              email,
              name: profile?.name ?? user.name ?? null,
              image: picture ?? user.image ?? null,
              emailVerified: new Date(),
              role: "CUSTOMER",
            },
          });
        } else {
          await prisma.user.update({
            where: { email },
            data: {
              image: picture ?? existing.image,
              name: profile?.name ?? user.name ?? existing.name,
            },
          });
        }
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      const ROLE_REFRESH_MS = 15_000;
      const now = Date.now();

      if (user) {
        if ((account?.provider === "google" || account?.provider === "apple") && user.email) {
          const { prisma } = await import("@/lib/prisma");
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
            select: { id: true, role: true, accountBlocked: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.accountBlocked = dbUser.accountBlocked;
            token.dbRefreshedAt = now;
          }
        } else {
          token.id = user.id as string;
          token.role = (user as { role: UserRole }).role;
          token.accountBlocked = Boolean((user as { accountBlocked?: boolean }).accountBlocked);
          token.dbRefreshedAt = now;
        }
      }

      const uid = token.id as string | undefined;
      const last = typeof token.dbRefreshedAt === "number" ? token.dbRefreshedAt : 0;
      const shouldSync = Boolean(uid && (user || now - last > ROLE_REFRESH_MS));
      if (shouldSync && uid) {
        const { prisma } = await import("@/lib/prisma");
        const dbUser = await prisma.user.findUnique({
          where: { id: uid },
          select: { role: true, accountBlocked: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.accountBlocked = dbUser.accountBlocked;
          token.dbRefreshedAt = now;
        }
      }

      return token;
    },
  },
});
