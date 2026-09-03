"use server";

import { db, users, seedNewUser } from "@senlo/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut } from "../../auth";
import { logger } from "../../lib";
import { AuthError } from "next-auth";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function registerAction(formData: FormData) {
  // Check if registration is allowed
  const allowRegistration = process.env.ALLOW_REGISTRATION !== "false";
  if (!allowRegistration) {
    return { error: { general: "Registration is disabled on this instance." } };
  }

  const values = Object.fromEntries(formData);
  const validatedFields = RegisterSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, password } = validatedFields.data;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existingUser) {
      return { error: { email: ["Email already in use"] } };
    }

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
      })
      .returning();

    // Fill the account so the dashboard is not empty on arrival. A failed
    // seed must not fail the registration — the user exists either way, and
    // an empty workspace is recoverable where a dead sign-up form is not.
    if (user) {
      try {
        await seedNewUser(user.id);
      } catch (seedError) {
        logger.error("Failed to seed a new account", {
          userId: user.id,
          error:
            seedError instanceof Error ? seedError.message : String(seedError),
        });
      }
    }

    // Sign in the user
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/home",
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: { general: "Invalid credentials." } };
        default:
          return { error: { general: "Something went wrong." } };
      }
    }
    throw error;
  }
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/home",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials." };
        default:
          return { error: "Something went wrong." };
      }
    }
    throw error;
  }
}

export async function githubLoginAction() {
  await signIn("github", { redirectTo: "/home" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
