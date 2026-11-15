'use client'
import React, { useCallback} from 'react';
import { usePlaidLink, PlaidLinkOnSuccess } from 'react-plaid-link';
import { useRouter } from 'next/navigation';

interface LinkProps {
  linkToken: string;
  onLinked: (publicToken: string) => Promise<{ ok: boolean }>;
}
export const PlaidLinkButton: React.FC<LinkProps> = ({linkToken , onLinked}: LinkProps) => {
  const router = useRouter();
 const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => {
  if(!public_token) return;
  const result = await onLinked(public_token);
  if(result.ok) {
    router.push('/review');
  }
}, [onLinked, router]);

  const config: Parameters<typeof usePlaidLink>[0] = {
    token: linkToken,
    onSuccess,
  };
  const { open, ready } = usePlaidLink(config);

  return (
    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer" onClick={() => open()} disabled={!ready}>
      Link account
    </button>
  );
};
