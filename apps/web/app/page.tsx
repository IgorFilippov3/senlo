// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button, Card, Badge } from "@senlo/ui";
import {
  Zap,
  ArrowRight,
  Github,
  Monitor,
  Database,
  Send,
  BarChart3,
  Code2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-blue-100">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center">
                <Image
                  src="/core/logo-light.svg"
                  alt="Senlo Logo"
                  width={140}
                  height={60}
                  style={{ maxWidth: "none" }}
                />
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
              <Link
                href="/projects"
                className="hover:text-zinc-900 transition-colors"
              >
                Projects
              </Link>
              <Link
                href="/campaigns"
                className="hover:text-zinc-900 transition-colors"
              >
                Campaigns
              </Link>
              <Link
                href="/audience"
                className="hover:text-zinc-900 transition-colors"
              >
                Audience
              </Link>
              <Link
                href="https://github.com/IgorFilippov3/senlo"
                target="_blank"
                className="hover:text-zinc-900 transition-colors flex items-center gap-2"
              >
                <Github size={16} />
                GitHub
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link href="/projects">
                <Button
                  variant="primary"
                  size="sm"
                  className="px-5 font-semibold"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-4 py-1.5 rounded-full text-xs font-semibold text-zinc-600 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <Badge
                variant="secondary"
                className="bg-blue-500/10 text-blue-600 border-blue-500/20 h-5 px-2"
              >
                MVP
              </Badge>
              <span>Open-Source Email Infrastructure</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-zinc-900 mb-8 bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-500">
              Complete Email Marketing <br className="hidden md:block" />
              Infrastructure
            </h1>

            <p className="text-lg md:text-xl text-zinc-500 mb-12 max-w-3xl mx-auto leading-relaxed">
              Senlo is a modern, self-hosted alternative to Mailchimp and Brevo.
              A powerful platform combining a professional visual editor with
              robust campaign management and transactional API.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/projects">
                <Button
                  size="lg"
                  variant="primary"
                  className="h-12 px-8 text-base font-bold min-w-[200px]"
                >
                  Start Creating
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link
                href="https://github.com/IgorFilippov3/senlo"
                target="_blank"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 h-12 px-8 text-base min-w-[200px]"
                >
                  <Github className="w-5 h-5 mr-2" />
                  Star on GitHub
                </Button>
              </Link>
            </div>

            {/* Value Props */}
            <div className="mt-20 pt-10 border-t border-zinc-100 flex flex-wrap justify-center gap-12 grayscale opacity-60 text-zinc-400">
              <div className="flex items-center gap-2 font-bold text-xl">
                <Monitor size={24} /> Self-hosted
              </div>
              <div className="flex items-center gap-2 font-bold text-xl">
                <Database size={24} /> Private
              </div>
              <div className="flex items-center gap-2 font-bold text-xl">
                <Code2 size={24} /> Open Source
              </div>
            </div>
          </div>
        </section>

        {/* Feature Sections */}
        <section className="py-24 bg-zinc-50/50 border-y border-zinc-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-6">
                  Visual Email Design <br />
                  <span className="text-zinc-400">Without Compromise</span>
                </h2>
                <p className="text-zinc-500 text-lg mb-8 leading-relaxed">
                  Our procedural email editor uses a row-column-block
                  architecture that ensures your designs look perfect on every
                  device. Everything is nondestructive and stored in a
                  predictable JSON format.
                </p>
                <ul className="space-y-4">
                  {[
                    "Drag-and-drop layout builder",
                    "MJML-powered responsive rendering",
                    "Custom merge tags for personalization",
                    "Real-time live preview",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-zinc-600"
                    >
                      <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                <div className="relative aspect-video bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/welcome-to-senlo-hero.png"
                    alt="Senlo Editor"
                    fill
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-zinc-50/50"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Triple Feature Grid */}
        <section className="py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">
              Complete Email Toolbox
            </h2>
            <p className="text-zinc-500 max-w-2xl mx-auto text-lg">
              Senlo is not just an editor. It is a full-stack engine for your
              communication needs.
            </p>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="bg-white border-zinc-200 p-8 hover:border-blue-200 hover:shadow-lg transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Send size={120} />
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 mb-6 group-hover:scale-110 transition-transform">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-4">
                Email Campaigns
              </h3>
              <p className="text-zinc-500 leading-relaxed">
                Create segments, manage recipient lists, and schedule bulk
                broadcasts. Keep your audience engaged with personalized
                announcements.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-white border-zinc-200 p-8 hover:border-amber-200 hover:shadow-lg transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Zap size={120} />
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20 mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-4">
                Transactional API
              </h3>
              <p className="text-zinc-500 leading-relaxed">
                Trigger order confirmations, password resets, and notifications
                directly from your backend using our simple REST API.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-white border-zinc-200 p-8 hover:border-emerald-200 hover:shadow-lg transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <BarChart3 size={120} />
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-4">
                Deep Analytics
              </h3>
              <p className="text-zinc-500 leading-relaxed">
                Track opens, clicks, and bounces in real-time. Gain insights
                into how users interact with your messages with detailed event
                logs.
              </p>
            </Card>
          </div>
        </section>

        {/* CTA Bottom Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/5 blur-[100px] -z-10" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Card
              className="bg-white border-zinc-200 p-12 md:p-20 shadow-2xl relative overflow-hidden"
              style={{ padding: "2rem 1rem" }}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>
              <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-6 tracking-tight">
                Ready to own your <br /> email infrastructure?
              </h2>
              <p className="text-zinc-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                Join the open-source movement. Deploy Senlo in minutes and start
                sending emails without vendor lock-in.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/projects">
                  <Button
                    size="lg"
                    variant="primary"
                    className="h-14 px-10 text-lg font-bold shadow-lg"
                  >
                    Get Started Now
                  </Button>
                </Link>
                <Link
                  href="https://github.com/IgorFilippov3/senlo/blob/main/deploy/vps/README.md"
                  target="_blank"
                >
                  <Button
                    variant="ghost"
                    className="text-zinc-500 hover:text-zinc-900 transition-colors h-14 px-10 text-lg"
                  >
                    Read Documentation
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-100 bg-zinc-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <Image
                  src="/core/logo-light.svg"
                  alt="Senlo Logo"
                  width={140}
                  height={60}
                  style={{ maxWidth: "none" }}
                />
              </div>
              <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
                A modern, self-hosted alternative to Mailchimp and Brevo.
                Open-source email marketing infrastructure for building,
                managing, and sending campaigns.
              </p>
            </div>
            <div>
              <h4 className="text-zinc-900 font-semibold mb-6">Product</h4>
              <ul className="space-y-4 text-sm text-zinc-500">
                <li>
                  <Link href="/projects" className="hover:text-zinc-900">
                    Editor
                  </Link>
                </li>
                <li>
                  <Link href="/campaigns" className="hover:text-zinc-900">
                    Campaigns
                  </Link>
                </li>
                <li>
                  <Link href="/audience" className="hover:text-zinc-900">
                    Audience
                  </Link>
                </li>
                <li>
                  <Link href="/projects" className="hover:text-zinc-900">
                    API
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-zinc-900 font-semibold mb-6">Open Source</h4>
              <ul className="space-y-4 text-sm text-zinc-500">
                <li>
                  <Link
                    href="https://github.com/IgorFilippov3/senlo"
                    className="hover:text-zinc-900"
                  >
                    GitHub
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://github.com/IgorFilippov3/senlo/issues"
                    className="hover:text-zinc-900"
                  >
                    Issues
                  </Link>
                </li>
                {/* <li>
                  <Link
                    href="https://github.com"
                    className="hover:text-zinc-900"
                  >
                    Discussions
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://github.com"
                    className="hover:text-zinc-900"
                  >
                    Contributing
                  </Link>
                </li> */}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-zinc-100 flex justify-between items-center text-xs text-zinc-400 font-medium tracking-wider uppercase">
            <p>&copy; 2026 Senlo. AGPL-3.0 Licensed.</p>
            <div className="flex gap-6">
              <Link
                href="/privacy"
                className="hover:text-zinc-600 transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="hover:text-zinc-600 transition-colors"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface CheckCircleProps {
  className: string | undefined;
  props?: Record<string, unknown>;
}

function CheckCircle({ className, ...props }: CheckCircleProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
