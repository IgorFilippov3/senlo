"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UnsubscribeView, type UnsubscribeState } from "@senlo/features";
import { unsubscribeAction } from "apps/web/app/(public)/unsubscribe/actions";

// Answers that a repeat would only get again: a bad link, a wrong address, a limit.
const FINAL_CODES = new Set(["VALIDATION_ERROR", "NOT_FOUND", "RATE_LIMITED"]);
const ATTEMPTS = 3;

export function Unsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<UnsubscribeState>({ status: "pending" });

  const run = useCallback(
    async (email?: string) => {
      setState({ status: "pending" });
      for (let attempt = 1; ; attempt++) {
        const result = await unsubscribeAction(token, email).catch(() => null);
        if (result?.success) {
          setState(
            result.data.needsEmail
              ? { status: "needs_email" }
              : { status: "done", alreadyUnsubscribed: result.data.alreadyUnsubscribed },
          );
          return;
        }
        const final = result && FINAL_CODES.has(result.error.code);
        if (final || attempt >= ATTEMPTS) {
          setState({
            status: "error",
            message: result?.error.message || "We could not process your request.",
          });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
    [token],
  );

  // Once per mount, also under Strict Mode's double effect: every call counts
  // against the per-link rate limit.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  return (
    <UnsubscribeView
      state={state}
      onConfirmEmail={(email) => void run(email)}
      onRetry={() => void run()}
      footer={<p>&copy; {new Date().getFullYear()} Senlo Email Builder. All rights reserved.</p>}
    />
  );
}
