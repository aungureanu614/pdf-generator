// app/future-features/page.tsx
// A static snapshot of the "FL-160 prototype: future features" doc, for showing
// alongside the demo. Update it by hand when the doc changes.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { theme } from '@/lib/theme';

export const metadata = { title: 'Future features' };

export default function FutureFeatures() {
  return (
    <div style={theme} className="min-h-screen w-full flex-1 bg-[var(--paper)] font-sans text-[var(--ink)]">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-[var(--accent)] underline underline-offset-2">
          Back to the declaration
        </Link>

        <header className="mb-10 mt-6 border-b border-[var(--ink)] pb-8">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Future features</h1>
          <p className="mt-4 max-w-prose text-[var(--muted)]">
            Planned after the demo. Today the prototype links one institution in Plaid’s sandbox, pulls balances, lets
            you review and classify every line, and fills FL-160 (plus FL-161 when lines overflow) in your browser.
          </p>
        </header>

        <div className="space-y-12">
          <Feature title="Link multiple institutions">
            <p>
              One login rarely covers every bank, card issuer, retirement provider, mortgage servicer and car lender, so
              a real user needs several links. Each is a separate Plaid connection; today a second link replaces the
              first.
            </p>
            <ul>
              <li>Keep every linked institution, with a “Link another account” button and a count of what’s linked.</li>
              <li>Combine the rows from all of them, and still match a home equity loan to a mortgage at another lender.</li>
              <li>Show a warning instead of failing when one institution can’t be loaded.</li>
              <li>Open questions: keeping edits when another account is linked, and catching the same bank linked twice.</li>
            </ul>
            <p className="text-[var(--muted)]">
              Cost: Plaid bills per linked institution, and the free trial allows 10 in total.
            </p>
          </Feature>

          <Feature title="Pull bank statements automatically">
            <p>
              Plaid’s Statements product returns the bank’s own PDF statement, which covers the “latest statement”
              attachment for checking and savings.
            </p>
            <ul>
              <li>Request statements when the account is linked, and offer the newest one as a download.</li>
              <li>Optionally bundle the filled forms and statements into one PDF to serve.</li>
              <li>
                Limits: bank deposit accounts only, at banks covering about 40% of US deposit accounts. Cards, loans and
                investment accounts stay manual.
              </li>
              <li>Plaid charges for statements when the account is linked, whether or not they’re downloaded.</li>
            </ul>
          </Feature>

          <Feature title="Other ideas">
            <ul>
              <li>FL-142 as an alternative form: one form for everything, with a column marking separate property.</li>
              <li>
                Production token storage in a database such as Supabase, with the browser holding only a session ID,
                and the bank connection removed at Plaid when the user is done.
              </li>
              <li>A reminder when lines have no date, without blocking the PDF.</li>
              <li>A fresh blank line appearing once the last one under an item is filled in.</li>
              <li>Folding items you’ve finished reviewing, to shorten the page.</li>
              <li>Notes on a line (“Enter the fair market value”) clearing once they’re done.</li>
            </ul>
          </Feature>
        </div>
      </main>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="max-w-prose space-y-3 leading-relaxed [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
