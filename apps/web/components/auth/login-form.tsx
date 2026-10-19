"use client";

import { useState, useTransition } from "react";
import { LoginForm as SharedLoginForm } from "@senlo/features";
import { githubLoginAction, loginAction } from "apps/web/app/(auth)/actions";
import { renderLink } from "apps/web/components/link";

export function LoginForm({
  allowRegistration,
  githubEnabled,
}: {
  allowRegistration: boolean;
  githubEnabled: boolean;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <SharedLoginForm
      isPending={isPending}
      error={error}
      onSubmit={(values) =>
        startTransition(async () => {
          setError(undefined);
          const result = await loginAction(values);
          setError(result?.error);
        })
      }
      onGitHubSignIn={githubEnabled ? () => startTransition(() => githubLoginAction()) : undefined}
      registerHref={allowRegistration ? "/register" : undefined}
      renderLink={renderLink}
    />
  );
}
