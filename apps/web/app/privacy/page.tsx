import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-blue-100">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/core/logo-light.svg"
                alt="Senlo Logo"
                width={140}
                height={60}
                style={{ maxWidth: "none" }}
              />
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h1 className="text-4xl font-bold text-zinc-900 mb-8 tracking-tight">
          Privacy Policy
        </h1>

        <div className="prose prose-zinc prose-headings:text-zinc-900 prose-p:text-zinc-600 prose-li:text-zinc-600 max-w-none space-y-12">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
            <p className="leading-relaxed">
              Welcome to Senlo ("we," "our," or "us"). We are committed to
              protecting your privacy and ensuring that your personal
              information is handled in a safe and responsible manner. This
              Privacy Policy outlines how we collect, use, and protect your data
              when you use our self-hosted email builder platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Data We Collect</h2>
            <p className="mb-4">
              As an open-source, self-hosted platform, the amount of data we
              &quot;collect&quot; depends on how you use the software.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account Information:</strong> When you register on a
                Senlo instance, we store your email address and an encrypted
                hash of your password.
              </li>
              <li>
                <strong>Campaign Data:</strong> This includes email designs,
                templates, recipient lists, and campaign settings you create
                within the application.
              </li>
              <li>
                <strong>Tracking Data:</strong> If enabled, the platform
                collects data on email opens and link clicks to provide you with
                campaign analytics.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. How We Use Your Data</h2>
            <p className="mb-4">
              We use the information collected primarily to provide and improve
              the platform&apos;s functionality:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide core services (building and sending emails).</li>
              <li>To manage your account and authentication.</li>
              <li>To provide analytics on your email campaigns.</li>
              <li>To improve the user experience and platform performance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">
              4. Self-Hosting & Data Sovereignty
            </h2>
            <p className="leading-relaxed">
              One of Senlo&apos;s core principles is user freedom. When you
              self-host Senlo, you are the data controller. All data (contacts,
              campaigns, settings) is stored on your own infrastructure. We do
              not have access to your database or the emails you send through
              your self-hosted instance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Third-Party Services</h2>
            <p className="leading-relaxed">
              Senlo integrates with third-party email providers (like Resend or
              Mailgun). When you send emails, your data and your
              recipients&apos; data will be processed by these providers
              according to their own privacy policies. We recommend reviewing
              the privacy policies of any third-party services you connect to
              Senlo.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Security</h2>
            <p className="leading-relaxed">
              We implement industry-standard security measures to protect your
              data, including password hashing and secure API key management.
              However, as with any software, the security of a self-hosted
              instance also depends on your own server configuration and
              maintenance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">
              7. Changes to This Policy
            </h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. We will
              notify users of any significant changes by posting the new policy
              on this page and updating the &quot;Last Updated&quot; date.
            </p>
          </section>

          <section className="pt-8 border-t border-zinc-100">
            <p className="text-sm text-zinc-400">
              Last Updated: January 8, 2026
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-12 bg-zinc-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-zinc-500">
            &copy; 2026 Senlo. Open-source under AGPL-3.0.
          </p>
        </div>
      </footer>
    </div>
  );
}
