"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { unsubscribeAction } from "../actions";
import { Button, Card, Input } from "@senlo/ui";
import { CheckCircle2, XCircle, Loader2, MailQuestion } from "lucide-react";

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();

  const [email, setEmail] = useState("");

  const unsubscribeMutation = useMutation({
    mutationFn: async (vars: { token: string; email?: string }) => {
      const result = await unsubscribeAction(vars.token, vars.email);
      if (!result.success) {
        throw new Error(result.error.message || "Something went wrong");
      }
      return result.data;
    },
    // Retrying a wrong address would only repeat the same answer.
    retry: (count, error) =>
      count < 2 && !/does not match|not valid/.test(error.message),
    retryDelay: 1000,
  });

  useEffect(() => {
    if (token && unsubscribeMutation.isIdle) {
      unsubscribeMutation.mutate({ token });
    }
  }, [token, unsubscribeMutation]);

  // A link from mail sent before links were signed: the address is the
  // only proof that the person asking is the recipient.
  const needsEmail =
    unsubscribeMutation.isSuccess && unsubscribeMutation.data?.needsEmail;
  const done = unsubscribeMutation.isSuccess && !needsEmail;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        {unsubscribeMutation.isPending && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Processing...</h1>
            <p className="text-gray-600">
              Please wait while we process your request.
            </p>
          </div>
        )}

        {needsEmail && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (token && email.trim()) {
                unsubscribeMutation.mutate({ token, email: email.trim() });
              }
            }}
          >
            <MailQuestion className="w-12 h-12 text-blue-500 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">
              Confirm your address
            </h1>
            <p className="text-gray-600">
              Enter the email address this message was sent to, and we will
              unsubscribe it.
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

        {done && (
          <div className="space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Unsubscribed</h1>
            <p className="text-gray-600">
              You have been successfully unsubscribed from this mailing list.
              You will no longer receive these emails.
            </p>
          </div>
        )}

        {unsubscribeMutation.isError && (
          <div className="space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Oops!</h1>
            <p className="text-gray-600">
              {unsubscribeMutation.error?.message || "We couldn't process your unsubscription."}
            </p>
            <Button 
              variant="outline" 
              // Back to idle: the effect above starts over, and a legacy
              // link shows the address form again.
              onClick={() => unsubscribeMutation.reset()}
              disabled={unsubscribeMutation.isPending}
            >
              {unsubscribeMutation.isPending ? "Retrying..." : "Try Again"}
            </Button>
          </div>
        )}

        <div className="pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Senlo Email Builder. All rights
            reserved.
          </p>
        </div>
      </Card>
    </div>
  );
}
