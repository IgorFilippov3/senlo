"use client";

import React, { useState } from "react";
import { Button, FormField, Input } from "@senlo/ui";
import { ArrowRight } from "lucide-react";
import { FormErrorBanner } from "../shared";
import { AuthCard, OAuthButtons, type RenderAuthLink, authLinkClassName } from "./AuthCard";

export interface RegisterValues {
  name: string;
  email: string;
  password: string;
}

export type RegisterFieldErrors = Partial<Record<keyof RegisterValues, string[]>>;

export interface RegisterFormProps {
  /** Product name in the subtitle ("Join …"). */
  brandName: string;
  /** Shown as a hint and enforced by the browser; the server checks it again. */
  passwordMinLength: number;
  onSubmit: (values: RegisterValues) => void;
  isPending?: boolean;
  /** A message not tied to one field (registration closed, rate limited). */
  error?: string | null;
  fieldErrors?: RegisterFieldErrors;
  onGitHubSignIn?: () => void;
  loginHref: string;
  renderLink: RenderAuthLink;
}

export function RegisterForm({
  brandName,
  passwordMinLength,
  onSubmit,
  isPending = false,
  error,
  fieldErrors = {},
  onGitHubSignIn,
  loginHref,
  renderLink,
}: RegisterFormProps) {
  const [values, setValues] = useState<RegisterValues>({ name: "", email: "", password: "" });
  const set = (patch: Partial<RegisterValues>) => setValues({ ...values, ...patch });

  return (
    <AuthCard title="Create an account" subtitle={`Join ${brandName} and start building emails`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <FormField label="Full Name" error={fieldErrors.name?.[0]}>
          <Input
            autoComplete="name"
            value={values.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="John Doe"
            required
          />
        </FormField>

        <FormField label="Email Address" error={fieldErrors.email?.[0]}>
          <Input
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="you@example.com"
            required
          />
        </FormField>

        <FormField
          label="Password"
          error={fieldErrors.password?.[0]}
          hint={`At least ${passwordMinLength} characters`}
        >
          <Input
            type="password"
            autoComplete="new-password"
            minLength={passwordMinLength}
            value={values.password}
            onChange={(e) => set({ password: e.target.value })}
            placeholder="••••••••"
            required
          />
        </FormField>

        <FormErrorBanner error={error} />

        <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isPending}>
          {isPending ? "Creating account..." : "Sign up"}
          {!isPending && <ArrowRight size={18} className="ml-2" />}
        </Button>
      </form>

      <OAuthButtons onGitHubSignIn={onGitHubSignIn} disabled={isPending} />

      <p className="text-center text-sm text-zinc-500 pt-2">
        Already have an account? {renderLink(loginHref, "Log in", authLinkClassName)}
      </p>
    </AuthCard>
  );
}
