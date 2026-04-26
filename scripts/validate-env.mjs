import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  PAYSTACK_SECRET_KEY: z.string().min(10),
  PAYSTACK_PUBLIC_KEY: z.string().min(10),
  PAYSTACK_WEBHOOK_SECRET: z.string().min(10),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10),
  CLOUDINARY_CLOUD_NAME: z.string().min(2),
  CLOUDINARY_API_KEY: z.string().min(2),
  CLOUDINARY_API_SECRET: z.string().min(2),
  SERPER_API_KEY: z.string().min(10),
  OPENAI_API_KEY: z.string().min(10),
  RESEND_API_KEY: z.string().min(10),
  RESET_PASSWORD_FROM_EMAIL: z.string().min(3),
  PUSHER_APP_ID: z.string().min(2),
  PUSHER_KEY: z.string().min(2),
  PUSHER_SECRET: z.string().min(2),
  PUSHER_CLUSTER: z.string().min(2),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_APPLE_ID: z.string().optional(),
  AUTH_APPLE_SECRET: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "anthropic", "none"]).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  console.error("Production env validation failed:\n" + issues);
  process.exit(1);
}

if (!parsed.data.AUTH_SECRET && !parsed.data.NEXTAUTH_SECRET) {
  console.error("Production env validation failed:\nAUTH_SECRET or NEXTAUTH_SECRET is required.");
  process.exit(1);
}

if (!parsed.data.AUTH_URL && !parsed.data.NEXTAUTH_URL) {
  console.error("Production env validation failed:\nAUTH_URL or NEXTAUTH_URL is required.");
  process.exit(1);
}

const optional = [
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "ANTHROPIC_API_KEY",
];
const appleOptional = [
  "ENABLE_APPLE_OAUTH",
  "AUTH_APPLE_ID",
  "AUTH_APPLE_SECRET",
  "APPLE_TEAM_ID",
  "APPLE_KEY_ID",
  "APPLE_PRIVATE_KEY",
];
const missingOptional = optional.filter((key) => !process.env[key]?.trim());
if (missingOptional.length > 0) {
  console.warn("Optional env vars missing (non-blocking):\n" + missingOptional.map((x) => `- ${x}`).join("\n"));
}
if (process.env.ENABLE_APPLE_OAUTH?.trim() === "1") {
  const missingApple = appleOptional.filter((key) => !process.env[key]?.trim());
  if (missingApple.length > 0) {
    console.warn(
      "Apple OAuth is enabled but some related env vars are empty (non-blocking for other features):\n" +
        missingApple.map((x) => `- ${x}`).join("\n"),
    );
  }
}

console.log("Production env validation passed.");
