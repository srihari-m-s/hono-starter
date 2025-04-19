import { randomBytes } from 'crypto';
/**
 * Generates a secure random password of a specified length that includes
 * at least one uppercase letter, one number, and one special character.
 *
 * @param length - The length of the generated password. Default is 12 characters.
 * @returns A secure random password meeting complexity requirements.
 *
 * @example
 * const password = generatePassword(12);
 * console.log(password); // Output: Random password with at least one uppercase, one number, and one special char
 */
export function generatePassword(length = 12) {
    if (length < 4) {
        throw new Error('Password length should be at least 4 to meet complexity requirements.');
    }
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    const allChars = lowercase + uppercase + numbers + specialChars;
    let password = '';
    // Ensure at least one character from each required category
    password += uppercase[randomBytes(1)[0] % uppercase.length];
    password += numbers[randomBytes(1)[0] % numbers.length];
    password += specialChars[randomBytes(1)[0] % specialChars.length];
    // Generate the remaining characters
    const bytes = randomBytes(length - 3);
    for (let i = 0; i < bytes.length; i++) {
        password += allChars[bytes[i] % allChars.length];
    }
    // Shuffle the password to randomize character positions
    password = password
        .split('')
        .sort(() => 0.5 - Math.random())
        .join('');
    return password;
}
