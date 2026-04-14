export async function register() {
  if (process.env.NODE_ENV !== "production") return;
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set to at least 32 characters before running in production."
    );
  }
}
