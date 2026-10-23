"use server";

import { AuthError } from "next-auth";
import type { LoginValues, RegisterFieldErrors, RegisterValues } from "@senlo/features";
import { FormValidationError, RateLimitedError } from "@senlo/core";
import { RegistrationClosedError } from "@senlo/core/server";
import { signIn, signOut } from "../../auth";
import { getConfig } from "../../lib/config";
import { getServices } from "../../lib/services";
import { rateLimit } from "../../lib/rate-limit";

/** What a failed sign-in or sign-up tells the form. A success redirects instead. */
export interface AuthFormResult {
  error?: string;
  fieldErrors?: RegisterFieldErrors;
}

/** A message for every Auth.js failure that is not a redirect. */
function authErrorMessage(error: AuthError): string {
  return error.type === "CredentialsSignin" ? "Invalid credentials." : "Something went wrong.";
}

export async function registerAction(values: RegisterValues): Promise<AuthFormResult> {
  try {
    await rateLimit.limitAction("register");
    await getServices().user.register(values, getConfig());
  } catch (error) {
    if (error instanceof RegistrationClosedError || error instanceof RateLimitedError) {
      return { error: error.message };
    }
    if (error instanceof FormValidationError) {
      const { general, ...fieldErrors } = error.fieldErrors as Record<string, string[] | undefined>;
      return { error: general?.[0], fieldErrors };
    }
    throw error;
  }

  try {
    // Redirects on success (rethrown below).
    await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirectTo: "/home",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: authErrorMessage(error) };
    throw error;
  }
}

export async function loginAction({ email, password }: LoginValues): Promise<AuthFormResult> {
  // Only failed attempts count: see assertLoginAllowed.
  try {
    await rateLimit.assertLoginAllowed(email);
  } catch (error) {
    if (error instanceof RateLimitedError) return { error: error.message };
    throw error;
  }

  try {
    // Redirects on success (rethrown below).
    await signIn("credentials", { email, password, redirectTo: "/home" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") await rateLimit.recordLoginFailure(email);
      return { error: authErrorMessage(error) };
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
