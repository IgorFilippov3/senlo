"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { unsubscribeAction } from "../actions";
import { Button, Card } from "@senlo/ui";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();

  const unsubscribeMutation = useMutation({
    mutationFn: async (token: string) => {
      const result = await unsubscribeAction(token);
      if (!result.success) {
        throw new Error(result.error.message || "Something went wrong");
      }
      return result.data;
    },
    retry: 2, // Retry up to 2 times for network issues
    retryDelay: 1000, // Wait 1 second between retries
  });

  useEffect(() => {
    if (token && !unsubscribeMutation.isSuccess && !unsubscribeMutation.isError) {
      unsubscribeMutation.mutate(token);
    }
  }, [token, unsubscribeMutation]);

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

        {unsubscribeMutation.isSuccess && (
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
              onClick={() => {
                unsubscribeMutation.reset();
                if (token) unsubscribeMutation.mutate(token);
              }}
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
