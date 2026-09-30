import env from "@/env";
import { commonPasswords } from "./data/common-passwords";

export type PasswordRejection = "common" | "breached";

export interface PasswordPolicyContext {
  email?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Change these to your product name so a password built from it ("acme1234")
 * is rejected. NIST SP 800-63B-4 §3.1.1.2 calls these "context-specific words".
 */
const SERVICE_TERMS = ["hono-starter", "honostarter"];

/** Shown to the user. NIST requires the reason for rejection to be given. */
export const PASSWORD_REJECTION_MESSAGES: Record<PasswordRejection, string> = {
  common:
    "That password is too easy to guess. Try a longer passphrase made of several unrelated words.",
  breached:
    "That password has appeared in a known data breach. Please choose a different one.",
};

/**
 * Collapses a password into a comparable form so trivial edits of a common
 * password are still recognised: "Password1!", "p@ssw0rd" and "password123"
 * all reduce to "password".
 *
 * Comparison stays whole-string — NIST requires the *entire* password to be
 * compared, "not substrings or words that might be contained therein", so a
 * good passphrase that merely contains a common word is not rejected.
 */
function canonicalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+$/g, "") // trailing punctuation
    .replace(/[0-9]+$/g, "") // trailing digits
    .replace(/[@4]/g, "a")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z]/g, ""); // compare letters only
}

function contextTerms(context?: PasswordPolicyContext): string[] {
  if (!context) return SERVICE_TERMS.map(canonicalise);

  const raw = [
    ...SERVICE_TERMS,
    context.email,
    context.email?.split("@")[0],
    context.firstName,
    context.lastName,
  ];

  return raw
    .filter((term): term is string => Boolean(term))
    .map(canonicalise)
    .filter(Boolean);
}

/**
 * Whole-string comparison against the bundled list plus the caller's own
 * details. Numeric entries like "123456" reduce to an empty string when
 * canonicalised, so the raw lowercase form is checked too.
 */
export function isCommonPassword(
  password: string,
  context?: PasswordPolicyContext,
): boolean {
  const lower = password.toLowerCase();
  const canonical = canonicalise(password);

  if (commonPasswords.has(lower)) return true;
  if (canonical && commonPasswords.has(canonical)) return true;

  return contextTerms(context).some(
    (term) => lower === term || canonical === term,
  );
}

/**
 * Checks a password against Have I Been Pwned's Pwned Passwords range API.
 *
 * Uses k-anonymity: only the first five characters of the SHA-1 hash leave the
 * process, and the candidate is matched against the returned suffixes locally.
 * The full password (or its full hash) is never transmitted.
 *
 * @see https://haveibeenpwned.com/API/v3#PwnedPasswords
 */
async function isBreachedPassword(password: string): Promise<boolean> {
  const digest = new Bun.CryptoHasher("sha1")
    .update(password.normalize("NFC"))
    .digest("hex")
    .toUpperCase();

  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    {
      // Asks the API to pad responses so the payload size does not leak
      // whether the prefix had any hits.
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    },
  );

  if (!response.ok) {
    throw new Error(`Pwned Passwords responded with ${response.status}`);
  }

  const body = await response.text();

  return body
    .split("\n")
    .some((line) => line.split(":")[0]?.trim() === suffix);
}

/**
 * Returns the reason a password is unacceptable, or `null` when it is fine.
 *
 * Call this on every path that sets a password: signup, reset and change.
 */
export async function checkPassword(
  password: string,
  context?: PasswordPolicyContext,
): Promise<PasswordRejection | null> {
  if (isCommonPassword(password, context)) return "common";

  if (env.PASSWORD_BREACH_LOOKUP === "hibp") {
    try {
      if (await isBreachedPassword(password)) return "breached";
    } catch (error) {
      // Fail open. The blocklist is defence in depth sitting behind rate
      // limiting, and rejecting every signup because a third party is having
      // an outage would be a worse trade.
      console.warn(
        "Pwned Passwords lookup failed; skipping breach screening:",
        error,
      );
    }
  }

  return null;
}
