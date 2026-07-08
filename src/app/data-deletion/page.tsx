import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion Instructions — GNK Edusolution",
  description: "Detailed instructions on how to request deletion of your personal data from GNK Edusolution.",
};

export default function DataDeletionPage() {
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
          Data Deletion Instructions
        </h1>
        <p className="text-slate-400 text-sm mb-8">Last Updated: July 8, 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">Our Commitment to Your Privacy</h2>
            <p>
              At <strong>GNK Edusolution</strong>, we value your privacy and give you full control over the personal data we store. If you wish to delete your account, contact information, or chat transcripts from our systems, you can request data deletion at any time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">How to Request Data Deletion</h2>
            <p>
              You can submit a data deletion request using one of the following methods:
            </p>

            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-900">
                <h3 className="font-semibold text-white mb-2">Option 1: Email Request 📧</h3>
                <p className="text-sm text-slate-400">
                  Send an email to <strong>support@gnkedusolution.com</strong> with the subject line <strong>"Request Data Deletion"</strong>. Please include:
                </p>
                <ul className="list-disc pl-5 text-xs text-slate-400 mt-2 space-y-1">
                  <li>Your full name</li>
                  <li>The WhatsApp phone number linked to your queries</li>
                  <li>The email address linked to your account</li>
                </ul>
              </div>

              <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-900">
                <h3 className="font-semibold text-white mb-2">Option 2: WhatsApp Opt-out 💬</h3>
                <p className="text-sm text-slate-400">
                  Simply reply with the word <strong>"STOP"</strong> or <strong>"DELETE MY DATA"</strong> to our official WhatsApp Business number. Our automated flow or support agents will mark your contact for deletion.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">What Happens After Your Request?</h2>
            <p>
              Once a request is received, our database administrators will perform the following actions within <strong>7 business days</strong>:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Permanently delete your profile information, contact info, and email records.</li>
              <li>Wipe out all associated WhatsApp chat transcripts from our PostgreSQL database tables.</li>
              <li>Remove any custom fields, tags, and notes linked to your contact profile.</li>
              <li>Send you a confirmation email (or final WhatsApp message) stating that all data has been permanently purged.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">Need Help?</h2>
            <p>
              If you face any issues or have questions regarding the data deletion process, please contact us at:
            </p>
            <p className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 mt-2">
              📧 <strong>Support Email:</strong> support@gnkedusolution.com
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
            <Link href="/terms" className="hover:text-slate-400">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
