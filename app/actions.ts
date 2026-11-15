'use server';

import { cookies } from 'next/headers';
import { plaidClient } from '@/lib/plaid';

export async function setAccessToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const cookieStore = await cookies();
    cookieStore.set('plaid_access_token', response.data.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return { ok: true };
  } catch (err: any) {
    console.error(err.response?.data ?? err);
    return { ok: false };
  }
}

// TODO: wire this up later
export async function deleteCookie(cookieName: string) {
    const cookieStore = await cookies();
    cookieStore.delete(cookieName);
}