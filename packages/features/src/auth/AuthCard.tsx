"use client";

import React from "react";
import { Button, Card } from "@senlo/ui";
import { Github } from "lucide-react";

export type RenderAuthLink = (
  href: string,
  children: React.ReactNode,
  className: string,
) => React.ReactNode;

export const authLinkClassName = "text-blue-600 font-semibold hover:underline";

/** The centred card both auth pages sit in. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="max-w-md w-full p-8 space-y-6 shadow-xl border-zinc-200">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{title}</h1>
          <p className="text-zinc-500 text-sm">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}

/** "Or continue with" and the GitHub button; renders nothing without a handler. */
export function OAuthButtons({
  onGitHubSignIn,
  disabled,
}: {
  onGitHubSignIn?: () => void;
  disabled?: boolean;
}) {
  if (!onGitHubSignIn) return null;
  return (
    <>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-zinc-500">Or continue with</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full h-11"
        onClick={onGitHubSignIn}
        disabled={disabled}
      >
        <Github size={18} className="mr-2" />
        GitHub
      </Button>
    </>
  );
}
