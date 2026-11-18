'use server';

import { cookies } from 'next/headers';
import { plaidClient } from '@/lib/plaid';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 4, // the browser deletes it after 4 hours
};

export async function setAccessToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const cookieStore = await cookies();
    cookieStore.set('plaid_access_token', response.data.access_token, COOKIE_OPTIONS);

    return { ok: true };
  } catch (err: any) {
    console.error(err.response?.data ?? err);
    return { ok: false };
  }
}

export async function clearAccessToken() {
  const cookieStore = await cookies();
  cookieStore.delete('plaid_access_token');
}