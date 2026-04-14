/** UX-only preference: where staff prefer navigation emphasis (role unchanged). */
export const VIEW_MODE_COOKIE = "sda_view_mode";

export type ViewModePreference = "admin" | "user";

/**
 * `user` = admin is browsing in “customer preview” (storefront/dashboard emphasis).
 * `admin` or unset = default staff context.
 */
export function parseViewMode(cookie: string | undefined | null): ViewModePreference {
  if (cookie === "user") return "user";
  return "admin";
}
