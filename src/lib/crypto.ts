/**
 * Generates a high-entropy, URL-safe random token.
 *
 * Used for session ids and for one-time email tokens. 32 bytes = 256 bits,
 * which makes guessing and brute-forcing infeasible.
 */
export function generateToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Digests a token for storage.
 *
 * Tokens are never stored in plaintext: a leaked database snapshot then
 * contains only hashes, which cannot be replayed. A plain SHA-256 is enough
 * here (unlike passwords) because the input is already 256 bits of entropy,
 * so there is nothing to brute-force.
 */
export function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}
