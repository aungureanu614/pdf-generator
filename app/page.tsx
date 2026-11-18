import { Suspense } from 'react';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { CountryCode, Products } from 'plaid/legacy';
import { plaidClient } from '@/lib/plaid';
import { mapPlaidToRows, type FormRow } from '@/lib/mapping';
import { PlaidLinkButton } from '@/app/components/PlaidLinkButton';
import { setAccessToken } from '@/app/actions';
import { ReviewTable } from './review/ReviewTable';
import Link from 'next/link';
import { theme } from '@/lib/theme';

export async function LinkSection() {
  await connection();

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: 'demo-user' },
    client_name: 'FL-160 Prototype',
    products: [Products.Transactions],
    required_if_supported_products: [Products.Liabilities, Products.Investments],
    country_codes: [CountryCode.Us],
    language: 'en',
  });

  return <PlaidLinkButton linkToken={response.data.link_token} onLinked={setAccessToken} />;
}

/** Fetches from Plaid and maps to draft rows. Returns null if Plaid couldn't be reached. */
async function loadRows(accessToken: string): Promise<FormRow[] | null> {
  try {
    const [accounts, liabilities] = await Promise.all([
      plaidClient.accountsGet({ access_token: accessToken }),
      plaidClient.liabilitiesGet({ access_token: accessToken }).catch(() => null),
    ]);

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
    console.error((err as { response?: { data?: unknown } }).response?.data ?? err);
    return null;
  }
}

async function Review() {
  const accessToken = (await cookies()).get('plaid_access_token')?.value;
  if (!accessToken) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-[var(--muted)]">No linked account yet</p>
        <LinkSection />
      </div>
    );
  }

  const rows = await loadRows(accessToken);
  if (!rows) return <p>Couldn’t load your accounts from Plaid. Check the server log for the error.</p>;

  return <ReviewTable initialRows={rows} />;
}

export default function Home() {
  return (
    <div style={theme} className="min-h-screen w-full flex-1 bg-[var(--paper)] font-sans text-[var(--ink)]">
      <main className="mx-auto w-full max-w-5xl px-6 pt-12">
        <header className="mb-12 border-b border-[var(--ink)] pb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="text-sm text-[var(--muted)]">Form FL-160, for service with a Declaration of Disclosure</p>
            <div className="flex gap-2">
              <Link
                href="/future-features"
                className="rounded-sm border border-[var(--ink)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--ink)] hover:text-[var(--paper)]"
              >
                Future features
              </Link>
              <Link
                href="/questions"
                className="rounded-sm border border-[var(--ink)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--ink)] hover:text-[var(--paper)]"
              >
                Questions for a lawyer
              </Link>
            </div>
          </div>
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