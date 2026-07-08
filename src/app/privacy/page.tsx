import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GNK Edusolution",
  description: "Privacy Policy and user data protection details for GNK Edusolution.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-teal-500 selection:text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/gnk_crm_favicon.png"
              alt="GNK Logo"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
              GNK Edusolution
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Go to Portal
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          Privacy Policy
        </h1>
        <p className="text-slate-400 text-sm mb-8">Last Updated: July 8, 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Introduction</h2>
            <p>
              Welcome to <strong>GNK Edusolution</strong>. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you interact with our platform, including our WhatsApp-based CRM and communications.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Information We Collect</h2>
            <p>
              When you use our services or contact us via WhatsApp, we may collect the following information:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Contact Information:</strong> Your name, phone number, and email address.</li>
              <li><strong>Chat Transcripts:</strong> WhatsApp message content sent to and received from our official WhatsApp Business account for query resolution and updates.</li>
              <li><strong>System Logs:</strong> Device type, login sessions, and interaction timestamps.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. How We Use Your Data</h2>
            <p>
              We use your personal data solely for the following business and educational purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide customer support and answer educational inquiries.</li>
              <li>To send updates about classes, courses, schedules, and fee invoices.</li>
              <li>To manage your sales pipeline and interaction history within our secure internal CRM.</li>
              <li>To deliver automated messages, system alerts, and notification broadcasts.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. WhatsApp API & Messaging Data</h2>
            <p>
              Our CRM integrates with the official <strong>Meta WhatsApp Cloud API</strong>. All WhatsApp messaging interactions are transmitted securely and encrypted in transit (using AES-256-GCM). We do not use your WhatsApp messaging data for target marketing, nor do we sell it to third-party services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">5. Data Retention & Deletion</h2>
            <p>
              We retain your information only as long as necessary to provide you with our educational solutions or as required by law. Users can request deletion of their data at any time. For detailed instructions on requesting data deletion, please visit our <Link href="/data-deletion" className="text-teal-400 hover:underline">Data Deletion Policy page</Link>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">6. Security</h2>
            <p>
              We use industry-standard security measures (such as Row Level Security in databases and strict authorization headers) to protect your personal data from unauthorized access, modification, or disclosure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">7. Contact Us</h2>
            <p>
              If you have any questions, feedback, or concerns regarding this Privacy Policy, feel free to contact our support team:
            </p>
            <p className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 mt-2">
              📧 <strong>Email:</strong> support@gnkedusolution.com<br />
              🌐 <strong>Website:</strong> <a href="https://gnkedusolution.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">gnkedusolution.com</a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 bg-slate-950/60">
        <div className="mx-auto max-w-4xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© 2026 GNK Edusolution. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-slate-400">Terms of Service</Link>
            <Link href="/data-deletion" className="hover:text-slate-400">Data Deletion Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
