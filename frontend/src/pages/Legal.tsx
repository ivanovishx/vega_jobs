import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

const CONTACT_EMAIL = 'prociudad1@gmail.com';
const LAST_UPDATED = 'November 21, 2026';

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0b0b0e] text-gray-700 dark:text-zinc-300">
      <header className="border-b border-gray-100 dark:border-white/[0.07]">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">
            Vega
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{title}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500">Last updated: {LAST_UPDATED}</p>
        <div className="mt-8 space-y-6 leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-900 dark:[&_h2]:text-zinc-100 [&_h2]:mt-10 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-indigo-600 dark:[&_a]:text-indigo-400 [&_a]:underline">
          {children}
        </div>
      </main>

      <footer className="border-t border-gray-100 dark:border-white/[0.07] py-6 text-center text-xs text-gray-400 dark:text-zinc-500 space-x-4">
        <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
        <Link to="/terms" className="hover:underline">Terms of Service</Link>
      </footer>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        Vega ("we", "us") is a job search assistant that helps you track job applications, analyze job
        descriptions against your profile and fill out job application forms. This policy explains what
        information we collect, how we use it and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> your email address, name and profile picture. If you sign in
          with Google, we receive these from your Google account along with your Google account ID. If you
          register with email and password, we store your password only as a secure hash.
        </li>
        <li>
          <strong>Candidate profile:</strong> information you choose to enter, such as target roles, skills,
          experience, education, work authorization, location preferences, salary expectations, phone number,
          and links to LinkedIn, GitHub or a portfolio.
        </li>
        <li>
          <strong>Resume content:</strong> text and keywords extracted from resumes you upload.
        </li>
        <li>
          <strong>Optional self-identification data:</strong> gender, race/ethnicity, veteran status and
          disability status, only if you provide them, and used only to fill the equivalent voluntary
          questions on job applications.
        </li>
        <li>
          <strong>Job search activity:</strong> jobs you save, job descriptions you analyze, applications,
          their status, notes, events and contacts you record.
        </li>
        <li>
          <strong>Browser extension data:</strong> if you use the Vega Smart Autofill extension, it reads the
          fields of job application forms on pages where you use it, so it can fill them with your profile
          and remember answers to new questions you choose to save.
        </li>
      </ul>

      <h2>Google user data</h2>
      <p>When you sign in with Google, we request only:</p>
      <ul>
        <li>
          <strong>Basic profile and email</strong> (<code>profile</code>, <code>email</code>): to create your
          account and sign you in.
        </li>
        <li>
          <strong>Google Drive, per-file access</strong> (<code>drive.file</code>): only if you use the
          "save CV template to my Drive" feature, to create a copy of our CV template in your Drive. This
          permission only gives access to files created by Vega, not to the rest of your Drive. The access
          token is used once for that copy and is not stored.
        </li>
      </ul>
      <p>
        Vega's use and transfer of information received from Google APIs adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We do not use Google user data for advertising, we do not
        sell it, and we do not use it to train AI models.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the service: sign-in, application tracking, job description scoring and form autofill.</li>
        <li>To keep the service secure and to fix problems.</li>
        <li>To contact you about your account when necessary.</li>
      </ul>
      <p>We do not sell your personal information and we do not show ads.</p>

      <h2>How we share information</h2>
      <p>
        We share information only with service providers that host and run Vega on our behalf: Vercel
        (website hosting), Render (application server) and Supabase (database). We may also disclose
        information if required by law.
      </p>

      <h2>Cookies</h2>
      <p>
        We use a single authentication cookie to keep you signed in. We do not use advertising or
        third-party tracking cookies.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We keep your information while your account is active. You can edit your profile at any time, and
        you can ask us to delete your account and all associated data by writing to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You can also revoke Vega's access to your
        Google account at any time from{' '}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          your Google account permissions
        </a>
        .
      </p>

      <h2>Security</h2>
      <p>
        Data is transmitted over HTTPS and passwords are stored hashed. No method of storage or transmission
        is completely secure, but we take reasonable measures to protect your information.
      </p>

      <h2>Children</h2>
      <p>Vega is not intended for people under 16 and we do not knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we will update the date at the top of this page. Significant changes will
        be communicated through the app or by email.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalLayout>
  );
}

export function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        These terms govern your use of Vega, a job search assistant available at vega-jobs.vercel.app and
        through the Vega Smart Autofill browser extension. By creating an account or using Vega, you agree
        to these terms.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for the information you provide and for keeping your login credentials secure.
        You must be at least 16 years old to use Vega.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use Vega only for your own job search and in compliance with applicable laws.</li>
        <li>Do not attempt to access other users' data or disrupt the service.</li>
        <li>
          Do not use the autofill extension to submit false information or to violate the terms of the
          job sites where you use it.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of the information you add to Vega, such as your profile, resume and
        application records. You give us permission to store and process it only to provide the service
        to you, as described in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>No guarantees</h2>
      <p>
        Job description scores and suggestions are automated estimates to help you decide, not guarantees
        of any hiring outcome. Always review information that Vega fills into application forms before
        submitting it. Vega is provided "as is", without warranties of any kind, and may change or be
        unavailable at times.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, Vega is not liable for indirect or consequential damages, or for
        lost opportunities, arising from your use of the service.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using Vega at any time and ask us to delete your account. We may suspend accounts that
        violate these terms.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. We will update the date at the top of this page, and continued use of
        Vega after a change means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalLayout>
  );
}
