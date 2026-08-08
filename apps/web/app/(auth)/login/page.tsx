"use client";

import { useState } from "react";
import { Button, Card, FormField, Input } from "@senlo/ui";
import { LogIn, Github } from "lucide-react";
import Link from "next/link";
import { loginAction, githubLoginAction } from "../actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    const result = await loginAction(formData);

    if (result?.error) {
      setError(result.error);
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="max-w-md w-full p-8 space-y-6 shadow-xl border-zinc-200">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-zinc-500 text-sm">
            Log in to manage your email campaigns
          </p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <FormField label="Email Address">
            <div className="relative">
              <Input
                name="email"
                type="email"
                placeholder="you@example.com"
                className="pl-10"
                required
              />
            </div>
          </FormField>

          <FormField label="Password">
            <div className="relative">
              <Input
                name="password"
                type="password"
                placeholder="••••••••"
                className="pl-10"
                required
              />
            </div>
          </FormField>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold"
            disabled={isPending}
          >
            {isPending ? "Logging in..." : "Log in"}
            {!isPending && <LogIn size={18} className="ml-2" />}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-zinc-500">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-11"
          onClick={() => githubLoginAction()}
        >
          <Github size={18} className="mr-2" />
          GitHub
        </Button>

        {process.env.NEXT_PUBLIC_ALLOW_REGISTRATION !== "false" && (
          <p className="text-center text-sm text-zinc-500 pt-2">
            Do not have an account?{" "}
            <Link
              href="/register"
              className="text-blue-600 font-semibold hover:underline"
            >
              Sign up
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}
