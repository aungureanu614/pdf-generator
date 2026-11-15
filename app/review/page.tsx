// app/review/page.tsx
// Server component: reads the access token cookie, pulls the data from Plaid,
// maps it to draft form rows, and hands those to the client-side review table.

import { Suspense } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { plaidClient } from '@/lib/plaid';
import { mapPlaidToRows, type FormRow } from '@/lib/mapping';
import { ReviewTable } from './ReviewTable';

/** Fetches from Plaid and maps to draft rows. Returns null if Plaid couldn't be reached. */
async function loadRows(accessToken: string): Promise<FormRow[] | null> {
  try {
    // Accounts are required. Liabilities add loan details (origination dates,
    // the mortgage's property address) but not every bank supports them, so a
    // failure there just means fewer prefilled fields.
    const [accounts, liabilities] = await Promise.all([
      plaidClient.accountsGet({ access_token: accessToken }),
      plaidClient.liabilitiesGet({ access_token: accessToken }).catch(() => null),
    ]);

    // Today's date in California, as YYYY-MM-DD (toISOString would give the UTC date).
    const asOf = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
    return mapPlaidToRows(
      {
        institutionName: accounts.data.item.institution_name,
        accounts: accounts.data.accounts,
        liabilities: liabilities?.data.liabilities ?? null,
      },
      asOf,
    );
  } catch (err: unknown) {
    // The Plaid client is built on axios: Plaid's own error is in response.data.
    console.error((err as { response?: { data?: unknown } }).response?.data ?? err);
    return null;
  }
}

async function Review() {
  const accessToken = (await cookies()).get('plaid_access_token')?.value;
  if (!accessToken) {
    return (
      <p>
        No linked account yet.{' '}
        <Link href="/" className="font-medium text-[var(--accent)] underline underline-offset-2">
          Link one first
        </Link>
        .
      </p>
    );
  }

  const rows = await loadRows(accessToken);
  if (!rows) return <p>Couldn’t load your accounts from Plaid. Check the server log for the error.</p>;

  return <ReviewTable initialRows={rows} />;
}

/** The page sets its own colors so it reads the same whether the device is in light or dark mode. */
const theme = {
  '--paper': '#F1F5EF', // pale ledger green
  '--sheet': '#FFFFFF',
  '--ink': '#14231B',
  '--muted': '#55665C',
  '--rule': '#D3DDD4',
  '--accent': '#1E5E45',
  '--warn': '#A8530A',
  colorScheme: 'light',
} as React.CSSProperties;

export default function ReviewPage() {
  return (
    <div style={theme} className="min-h-screen w-full flex-1 bg-[var(--paper)] font-sans text-[var(--ink)]">
      <main className="mx-auto w-full max-w-5xl px-6 pt-12">
        <header className="mb-12 border-b border-[var(--ink)] pb-8">
          <p className="text-sm text-[var(--muted)]">Form FL-160, for service with a Declaration of Disclosure</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Review your property declaration</h1>
          <p className="mt-4 max-w-prose text-[var(--muted)]">
            Balances came from your linked accounts. Check every row, fill in what’s missing, and mark each item as
            community or separate. Descriptions, dates and amounts go on the form; the proposed division is left blank.
            Nothing is saved, so leaving this page discards your edits.
          </p>
        </header>
        <Suspense fallback={<p className="pb-12 text-[var(--muted)]">Loading your accounts…</p>}>
          <Review />
        </Suspense>
      </main>
    </div>
  );
}
