import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function TermsPage() {
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
          Terms and Conditions
        </h1>

        <div className="prose prose-zinc prose-headings:text-zinc-900 prose-p:text-zinc-600 prose-li:text-zinc-600 max-w-none space-y-12">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing or using Senlo, you agree to be bound by these Terms
              and Conditions. If you do not agree with any part of these terms,
              you may not use the software or services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. License</h2>
            <p className="leading-relaxed">
              Senlo is open-source software licensed under the **AGPL-3.0 (GNU
              Affero General Public License v3.0)**. You are free to use,
              modify, and distribute the software according to the terms of this
              license. Any managed or hosted version of Senlo provided by us may
              be subject to additional service-specific terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Use of the Software</h2>
            <p className="mb-4">
              You agree to use Senlo only for lawful purposes. You are
              prohibited from:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Sending unsolicited bulk emails (SPAM) in violation of
                applicable laws (e.g., CAN-SPAM Act, GDPR).
              </li>
              <li>
                Hosting or transmitting illegal, harmful, or offensive content.
              </li>
              <li>
                Attempting to interfere with the security or integrity of the
                platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">
              4. Self-Hosting Responsibility
            </h2>
            <p className="leading-relaxed">
              If you choose to self-host Senlo, you are solely responsible for
              the installation, maintenance, security, and operation of your
              instance. We are not liable for any data loss, security breaches,
              or service interruptions occurring on your self-hosted
              infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">
              5. Disclaimer of Warranties
            </h2>
            <p className="leading-relaxed italic text-zinc-500">
              The software is provided "AS IS", without warranty of any kind,
              express or implied, including but not limited to the warranties of
              merchantability, fitness for a particular purpose and
              noninfringement. In no event shall the authors or copyright
              holders be liable for any claim, damages or other liability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">
              6. Limitation of Liability
            </h2>
            <p className="leading-relaxed">
              To the maximum extent permitted by law, Senlo and its contributors
              shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages, including loss of profits,
              data, or use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Termination</h2>
            <p className="leading-relaxed">
              We reserve the right to terminate or suspend access to our hosted
              services immediately, without prior notice or liability, for any
              reason whatsoever, including without limitation if you breach the
              Terms.
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
