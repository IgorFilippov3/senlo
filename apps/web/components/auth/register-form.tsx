"use client";

import { useState, useTransition } from "react";
import { RegisterForm as SharedRegisterForm } from "@senlo/features";
import {
  type AuthFormResult,
  githubLoginAction,
  registerAction,
} from "@/app/(auth)/actions";
import { renderLink } from "@/components/link";

export function RegisterForm({
  passwordMinLength,
  githubEnabled,
}: {
  passwordMinLength: number;
  githubEnabled: boolean;
}) {
  const [result, setResult] = useState<AuthFormResult>({});
  const [isPending, startTransition] = useTransition();

  return (
    <SharedRegisterForm
      brandName="Senlo"
      passwordMinLength={passwordMinLength}
      isPending={isPending}
      error={result.error}
      fieldErrors={result.fieldErrors}
      onSubmit={(values) =>
        startTransition(async () => {
          setResult({});
          setResult((await registerAction(values)) ?? {});
        })
      }
      onGitHubSignIn={githubEnabled ? () => startTransition(() => githubLoginAction()) : undefined}
      loginHref="/login"
      renderLink={renderLink}
    />
  );
}
