"use client";

import { useState } from "react";
import { Button, Card, FormField, Input } from "@senlo/ui";
import { ArrowRight, Github } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { registerAction, githubLoginAction } from "../actions";

export default function RegisterPage() {
  const [error, setError] = useState<Record<string, string[]>>({});
  const [isPending, setIsPending] = useState(false);

  const allowRegistration =
    process.env.NEXT_PUBLIC_ALLOW_REGISTRATION !== "false";

  if (!allowRegistration) {
    notFound();
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError({});

    const result = await registerAction(formData);

    if (result?.error) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      setError(result.error);
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="max-w-md w-full p-8 space-y-6 shadow-xl border-zinc-200">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Create an account
          </h1>
          <p className="text-zinc-500 text-sm">
            Join Senlo and start building emails
          </p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <FormField label="Full Name" error={error.name?.[0]}>
            <div className="relative">
              <Input
                name="name"
                placeholder="John Doe"
                className="pl-10"
                required
              />
            </div>
          </FormField>

          <FormField label="Email Address" error={error.email?.[0]}>
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

          <FormField label="Password" error={error.password?.[0]}>
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

          {error.general && (
            <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
              {error.general}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold"
            disabled={isPending}
          >
            {isPending ? "Creating account..." : "Sign up"}
            {!isPending && <ArrowRight size={18} className="ml-2" />}
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

        <p className="text-center text-sm text-zinc-500 pt-2">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-blue-600 font-semibold hover:underline"
          >
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
