// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { UnsubscribeView, type ActionTransport, type UnsubscribeState } from "@senlo/features";
import type { SenloPublicActions } from "./actions";

type UnsubscribeResult = Awaited<ReturnType<SenloPublicActions["unsubscribe"]["process"]>>;

// Answers that a repeat would only get again: a bad link, a wrong address, a limit.
const FINAL_CODES = new Set(["VALIDATION_ERROR", "NOT_FOUND", "RATE_LIMITED"]);
const ATTEMPTS = 3;

export interface UnsubscribeScreenProps {
  token: string;
  /** The host's public action transport (its `senloPublicAction` Server Action). */
  call: ActionTransport;
  /** Below the card: copyright, links. */
  footer?: React.ReactNode;
}

/**
 * The page a recipient opens from an email's unsubscribe link: processes
 * the token at once, asks for the address on a legacy link, retries a
 * transient failure twice. Public: needs no session and no app provider.
 */
export function UnsubscribeScreen({ token, call, footer }: UnsubscribeScreenProps) {
  const [state, setState] = useState<UnsubscribeState>({ status: "pending" });

  const run = useCallback(
    async (email?: string) => {
      setState({ status: "pending" });
      for (let attempt = 1; ; attempt++) {
        const result = (await call("unsubscribe.process", [token, email]).catch(
          () => null,
        )) as UnsubscribeResult | null;
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
          setState({ status: "error", message: result?.error.message || "We could not process your request." });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
    [call, token],
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
      footer={footer}
    />
  );
}
