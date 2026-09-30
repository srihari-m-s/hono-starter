import { connection, db } from "./index";
import { notesTable, usersTable } from "./schema";
import { hashPassword } from "../lib/password";

const SEED_PASSWORD = "AdminPassphrase123!";

async function seed() {
  console.log("🌱 Seeding the database...");

  // Clear existing data (optional and dangerous in prod)
  await db.delete(notesTable);
  await db.delete(usersTable);

  // One verified admin and one verified regular user, so the authorization
  // rules can be exercised straight away.
  const [admin] = await db
    .insert(usersTable)
    .values({
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      mobile: "1234567890",
      password: await hashPassword(SEED_PASSWORD),
      role: "admin",
      emailVerifiedAt: new Date().toISOString(),
    })
    .returning();

  const [member] = await db
    .insert(usersTable)
    .values({
      firstName: "Regular",
      lastName: "User",
      email: "user@example.com",
      mobile: "0987654321",
      password: await hashPassword(SEED_PASSWORD),
      role: "user",
      emailVerifiedAt: new Date().toISOString(),
    })
    .returning();

  const notes = Array.from({ length: 5 }).map((_, i) => ({
    userId: member.id,
    content: `This is note ${i + 1}`,
  }));

  notes.push({ userId: admin.id, content: "Admin's private note" });

  await db.insert(notesTable).values(notes);

  console.log("✅ Seeding complete.");
  console.log(`   admin@example.com / user@example.com  (password: ${SEED_PASSWORD})`);

  await connection.end();
}

seed().catch((err) => {
  console.error("❌ Error seeding database:", err);
  process.exit(1);
});
