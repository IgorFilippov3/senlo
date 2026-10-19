"use server";

import { AuthError } from "next-auth";
import { FormValidationError, RateLimitedError } from "@senlo/core";
import { RegistrationClosedError } from "@senlo/core/server";
import { signIn, signOut } from "../../auth";
import { getConfig } from "../../lib/config";
import { getServices } from "../../lib/services";
import {
  assertLoginAllowed,
  limitAction,
  recordLoginFailure,
} from "../../lib/rate-limit";

type RegisterResult = { success?: true; error?: Record<string, string[] | string> };

export async function registerAction(formData: FormData): Promise<RegisterResult | void> {
  const values = Object.fromEntries(formData);

  try {
    await limitAction("register");
    await getServices().user.register(values, getConfig());
  } catch (error) {
    if (error instanceof RegistrationClosedError || error instanceof RateLimitedError) {
      return { error: { general: error.message } };
    }
    if (error instanceof FormValidationError) {
      return { error: error.fieldErrors as Record<string, string[]> };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirectTo: "/home",
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: {
          general:
            error.type === "CredentialsSignin" ? "Invalid credentials." : "Something went wrong.",
        },
      };
    }
    throw error;
  }
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = formData.get("password");

  // Only failed attempts count: see assertLoginAllowed.
  try {
    await assertLoginAllowed(email);
  } catch (error) {
    if (error instanceof RateLimitedError) return { error: error.message };
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/home" });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        await recordLoginFailure(email);
        return { error: "Invalid credentials." };
      }
      return { error: "Something went wrong." };
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
