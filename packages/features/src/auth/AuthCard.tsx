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

/** The Google "G" in its brand colours; lucide has no brand icons for Google. */
function GoogleIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** "Or continue with" and a button per configured provider; renders nothing without a handler. */
export function OAuthButtons({
  onGitHubSignIn,
  onGoogleSignIn,
  disabled,
}: {
  onGitHubSignIn?: () => void;
  onGoogleSignIn?: () => void;
  disabled?: boolean;
}) {
  if (!onGitHubSignIn && !onGoogleSignIn) return null;
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
      {onGoogleSignIn ? (
        <Button type="button" variant="outline" className="w-full h-11" onClick={onGoogleSignIn} disabled={disabled}>
          <GoogleIcon size={18} className="mr-2" />
          Google
        </Button>
      ) : null}
      {onGitHubSignIn ? (
        <Button type="button" variant="outline" className="w-full h-11" onClick={onGitHubSignIn} disabled={disabled}>
          <Github size={18} className="mr-2" />
          GitHub
        </Button>
      ) : null}
    </>
  );
}
