/**
 * Password hashing backed by Bun's native implementation.
 *
 * `Bun.password` uses argon2id by default, is written in native code, and
 * exposes timing-safe verification.
 */

/**
 * Applies Unicode NFC normalisation.
 *
 * The same accented character can be encoded two different ways ("é" as one
 * code point, or "e" + a combining accent). Without normalising first, a
 * password entered on one keyboard could fail to verify on another. NIST
 * SP 800-63B-4 §3.1.1 recommends this, and doing it inside the hash/verify pair
 * guarantees every caller is consistent.
 */
function normalise(plainText: string): string {
  return plainText.normalize("NFC");
}

/**
 * Hashes a plain-text password.
 *
 * @param plainText - The plain-text password to be hashed.
 * @returns A promise that resolves to the argon2id hash.
 *
 * @example hashPassword("myPassword123").then(hash => ...);
 */
export function hashPassword(plainText: string): Promise<string> {
  return Bun.password.hash(normalise(plainText));
}

/**
 * Compares a plain-text password with a stored hash.
 *
 * @param plainText - The plain-text password to verify.
 * @param hash - The stored hash to compare against.
 * @returns A promise that resolves to true when the password matches.
 *
 * @example await verifyPassword("myPassword123", storedHash);
 */
export function verifyPassword(
  plainText: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(normalise(plainText), hash);
}
