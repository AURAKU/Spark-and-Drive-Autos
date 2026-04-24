import { CredentialsSignin } from "@auth/core/errors";

/** Thrown when `accountBlocked` is true so the client can show a clear message. */
export class AccountSuspendedAuthError extends CredentialsSignin {
  code = "account-suspended";
}

/** Thrown when the user exists but has no password (OAuth / magic-link only). */
export class OAuthOnlyAuthError extends CredentialsSignin {
  code = "oauth_only";
}

/** Thrown when more than one account shares the normalized phone (legacy data). */
export class AmbiguousPhoneAuthError extends CredentialsSignin {
  code = "ambiguous_phone";
}
