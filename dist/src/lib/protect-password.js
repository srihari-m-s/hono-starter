import bcrypt from 'bcrypt';
/**
 * Hashes a plain-text password using bcrypt.
 *
 * @param plainText - The plain-text password to be hashed.
 * @returns A promise that resolves to the hashed password.
 *
 * @example
 * hashPassword("myPassword123").then(hash => console.log(hash));
 */
export function hashPassword(plainText) {
    return bcrypt.hash(plainText, 10);
}
/**
 * Compares a plain-text password with a hashed password to check for a match.
 *
 * @param plainText - The plain-text password to verify.
 * @param hash - The hashed password to compare against.
 * @returns A promise that resolves to true if the passwords match, false otherwise.
 *
 * @example
 * comparePassword("myPassword123", hashedPassword).then(isMatch => console.log(isMatch));
 */
export function comparePassword(plainText, hash) {
    return bcrypt.compare(plainText, hash);
}
