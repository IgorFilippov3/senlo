"use client";

import React, { useState } from "react";
import { Button, Card, Input } from "@senlo/ui";
import { CheckCircle2, XCircle, MailQuestion } from "lucide-react";
import { Spinner } from "../shared/Loading";

export type UnsubscribeState =
  | { status: "pending" }
  /** A link from mail sent before links were signed: the recipient confirms the address. */
  | { status: "needs_email" }
  | { status: "done"; alreadyUnsubscribed?: boolean }
  | { status: "error"; message: string };

export interface UnsubscribeViewProps {
  state: UnsubscribeState;
  onConfirmEmail: (email: string) => void;
  /** Starts over: for a legacy link that means asking for the address again. */
  onRetry: () => void;
  /** Under the card, e.g. the sender's copyright line. */
  footer?: React.ReactNode;
}

/** The page a recipient lands on from an unsubscribe link. No session, no app shell. */
export function UnsubscribeView({ state, onConfirmEmail, onRetry, footer }: UnsubscribeViewProps) {
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        {state.status === "pending" && (
          <div role="status" className="space-y-4">
            <Spinner size={48} className="mx-auto" />
            <h1 className="text-2xl font-bold text-zinc-900">Processing...</h1>
            <p className="text-zinc-600">Please wait while we process your request.</p>
          </div>
        )}

        {state.status === "needs_email" && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const value = email.trim();
              if (value) onConfirmEmail(value);
            }}
          >
            <MailQuestion className="w-12 h-12 text-blue-500 mx-auto" />
            <h1 className="text-2xl font-bold text-zinc-900">Confirm your address</h1>
            <p className="text-zinc-600">
              Enter the email address this message was sent to, and we will unsubscribe it.
            </p>
            <Input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" className="w-full">
              Unsubscribe
            </Button>
          </form>
        )}

        {state.status === "done" && (
          <div className="space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-zinc-900">
              {state.alreadyUnsubscribed ? "Already unsubscribed" : "Unsubscribed"}
            </h1>
            <p className="text-zinc-600">
              {state.alreadyUnsubscribed
                ? "This address was already unsubscribed from this mailing list."
                : "You have been unsubscribed from this mailing list. You will no longer receive these emails."}
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div role="alert" className="space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-2xl font-bold text-zinc-900">We could not unsubscribe you</h1>
            <p className="text-zinc-600">{state.message}</p>
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}

        {footer && <div className="pt-6 border-t border-zinc-100 text-sm text-zinc-400">{footer}</div>}
      </Card>
    </div>
  );
}
