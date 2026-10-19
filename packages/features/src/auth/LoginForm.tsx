"use client";

import React, { useState } from "react";
import { Button, FormField, Input } from "@senlo/ui";
import { LogIn } from "lucide-react";
import { FormErrorBanner } from "../shared";
import { AuthCard, OAuthButtons, type RenderAuthLink, authLinkClassName } from "./AuthCard";

export interface LoginValues {
  email: string;
  password: string;
}

export interface LoginFormProps {
  onSubmit: (values: LoginValues) => void;
  isPending?: boolean;
  error?: string | null;
  /** Shows the GitHub button; leave out when GitHub sign-in is not configured. */
  onGitHubSignIn?: () => void;
  /** Where "Sign up" goes; leave out when registration is closed. */
  registerHref?: string;
  renderLink: RenderAuthLink;
}

export function LoginForm({
  onSubmit,
  isPending = false,
  error,
  onGitHubSignIn,
  registerHref,
  renderLink,
}: LoginFormProps) {
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });

  return (
    <AuthCard title="Welcome back" subtitle="Log in to manage your email campaigns">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <FormField label="Email Address">
          <Input
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
            placeholder="you@example.com"
            required
          />
        </FormField>

        <FormField label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
            placeholder="••••••••"
            required
          />
        </FormField>

        <FormErrorBanner error={error} />

        <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isPending}>
          {isPending ? "Logging in..." : "Log in"}
          {!isPending && <LogIn size={18} className="ml-2" />}
        </Button>
      </form>

      <OAuthButtons onGitHubSignIn={onGitHubSignIn} disabled={isPending} />

      {registerHref && (
        <p className="text-center text-sm text-zinc-500 pt-2">
          Do not have an account? {renderLink(registerHref, "Sign up", authLinkClassName)}
        </p>
      )}
    </AuthCard>
  );
}
