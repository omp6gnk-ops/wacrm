import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — GNK Edusolution",
  description: "Terms of Service and platform usage rules for GNK Edusolution.",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-slate-400 text-sm mb-8">Last Updated: July 8, 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Agreement to Terms</h2>
            <p>
              By accessing or using the services provided by <strong>GNK Edusolution</strong>, including our student portal and WhatsApp support services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Description of Service</h2>
            <p>
              GNK Edusolution provides educational tools, student support services, class tracking, and notification systems. Some communications are delivered via the official WhatsApp Business Cloud API.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. User Conduct & WhatsApp Usage</h2>
            <p>
              By subscribing to our WhatsApp updates, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the WhatsApp messaging interface solely for genuine educational inquiries, feedback, or support requests.</li>
              <li>Refrain from sending spam, promotional advertisements, or inappropriate content to our official business numbers.</li>
              <li>Acknowledge that messaging charges from your network provider may apply for standard WhatsApp usage.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Intellectual Property</h2>
            <p>
              All content, logo designs, course materials, portal software, and digital assets associated with GNK Edusolution are the intellectual property of GNK Edusolution and are protected by copyright laws. You may not copy, sell, or reuse any part of our platform without prior written consent.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">5. Limitation of Liability</h2>
            <p>
              GNK Edusolution shall not be liable for any direct or indirect damages arising out of the use or inability to use our services, including service disruptions on WhatsApp, Meta Platforms, or network outages.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">6. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to our portal or WhatsApp communications if you violate these Terms of Service or engage in abusive behavior. You can opt-out of our WhatsApp list at any time by replying with the keyword <strong>"STOP"</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">7. Governing Law</h2>
            <p>
              These terms are governed by and construed in accordance with the laws of India. Any legal disputes shall be subject to the exclusive jurisdiction of the courts of Delhi, India.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 bg-slate-950/60">
        <div className="mx-auto max-w-4xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© 2026 GNK Edusolution. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-400">Privacy Policy</Link>
            <Link href="/data-deletion" className="hover:text-slate-400">Data Deletion Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
