import { db } from "./index"; // adjust path if needed
import { notesTable, usersTable } from "./schema"; // adjust path if needed
import { hashPassword } from "../lib/protect-password";

async function seed() {
  console.log("🌱 Seeding the database...");

  // Clear existing data (optional and dangerous in prod)
  await db.delete(notesTable);
  await db.delete(usersTable);

  // Insert one admin user
  await db
    .insert(usersTable)
    .values({
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      mobile: "1234567890",
      password: await hashPassword("Admin1234$%"),
      emailVerifiedAt: new Date().toISOString(),
    })
    .returning();

  // Insert 5 notes for the admin user
  const notes = Array.from({ length: 5 }).map((_, i) => ({
    content: `This is note ${i + 1}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  await db.insert(notesTable).values(notes);

  console.log("✅ Seeding complete.");
}

seed().catch((err) => {
  console.error("❌ Error seeding database:", err);
  process.exit(1);
});
