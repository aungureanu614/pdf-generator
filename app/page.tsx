import { Suspense } from 'react';
import { connection } from 'next/server';
import { CountryCode, Products } from 'plaid/legacy';
import { plaidClient } from '@/lib/plaid';
import { PlaidLinkButton } from '@/app/components/PlaidLinkButton';
import { setAccessToken } from '@/app/actions';

async function LinkSection() {
  await connection();

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: 'demo-user' },
    client_name: 'FL-160 Prototype',
    products: [Products.Transactions],
    required_if_supported_products: [Products.Liabilities, Products.Investments],
    country_codes: [CountryCode.Us],
    language: 'en',
  });

  return <PlaidLinkButton linkToken={response.data.link_token} onLinked={setAccessToken}/>;
}

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main>
        <Suspense fallback={<p>Loading…</p>}>
          <LinkSection />
        </Suspense>
      </main>
    </div>
  );
}

