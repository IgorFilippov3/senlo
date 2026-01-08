import { db, users, seedUserData } from "./index";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

interface InitialUser {
  name: string;
  email: string;
  password?: string;
  role?: "ADMIN" | "USER";
}

async function main() {
  const initialUsersJson = process.env.INITIAL_USERS;

  if (!initialUsersJson) {
    console.log("No INITIAL_USERS provided. Skipping provisioning.");
    return;
  }

  let initialUsers: InitialUser[] = [];
  try {
    initialUsers = JSON.parse(initialUsersJson);
  } catch (error) {
    console.error(
      "Failed to parse INITIAL_USERS environment variable. Ensure it is valid JSON."
    );
    process.exit(1);
  }

  console.log(`Starting provisioning for ${initialUsers.length} users...`);

  for (const user of initialUsers) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email));

    if (existing.length > 0) {
      console.log(`User ${user.email} already exists. Skipping.`);
      continue;
    }

    if (!user.password) {
      console.warn(`User ${user.email} has no password defined. Skipping.`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);

    const [newUser] = await db.insert(users).values({
      name: user.name,
      email: user.email,
      password: hashedPassword,
      role: user.role || "USER",
    }).returning();

    if (newUser) {
      console.log(`User ${user.email} created successfully. Seeding data...`);
      await seedUserData(newUser.id);
      console.log(`Data seeded for ${user.email}.`);
    }
  }

  console.log("Provisioning completed.");
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
