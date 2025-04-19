import db from '@/db';
import { usersTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
/**
 * Returns an object containing the fields to select from the users table.
 */
export function getUserSelectFields() {
    return {
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        mobile: usersTable.mobile,
        emailVerifiedAt: usersTable.emailVerifiedAt,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
    };
}
/**
 * Fetches a user by their ID with selected fields.
 *
 * @param userId - The ID of the user to fetch.
 * @returns A promise that resolves to the user object with selected fields or `undefined` if the user is not found.
 */
export async function getUserWithId(userId) {
    const [user] = await db
        .select(getUserSelectFields())
        .from(usersTable)
        .where(eq(usersTable.id, userId));
    return user;
}
/**
 * Fetches a list of all users with selected fields.
 *
 * @returns A promise that resolves to an array of user objects, each containing selected fields.
 */
export async function getUserList() {
    const users = await db.select(getUserSelectFields()).from(usersTable);
    return users;
}
/**
 * Retrieves a user from the database by either email or mobile number.
 *
 * @param {string} identifier - The user's identifier, either an email address or mobile number.
 * @param {boolean} isEmail - A flag indicating if the identifier is an email (`true`) or a mobile number (`false`).
 * @returns {Promise<Object | undefined>} A promise that resolves to the user object if found, otherwise `undefined`.
 */
export async function getUserByIdentifier(identifier, isEmail) {
    return await db
        .select()
        .from(usersTable)
        .where(isEmail
        ? eq(usersTable.email, identifier)
        : eq(usersTable.mobile, identifier))
        .then((rows) => rows[0]);
}
/**
 * Updates a user's email verification date in the database.
 *
 * @param {number} userId - The unique identifier of the user to update.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the update is successful, otherwise `false`.
 */
export async function updateUserEmailVerification(userId) {
    try {
        await db
            .update(usersTable)
            .set({ emailVerifiedAt: new Date().toISOString() })
            .where(eq(usersTable.id, userId))
            .returning();
        return true;
    }
    catch (error) {
        console.error('Error updating email verification date:', error);
        return false;
    }
}
