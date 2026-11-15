This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as # PDF Generator — FL-160 / FL-161 Auto-Fill

A Next.js app that links a user's financial accounts via [Plaid](https://plaid.com/), pulls account, liability, and investment data, maps it into draft rows, and auto-fills California Judicial Council forms **FL-160** (Property Declaration) and **FL-161** (Continuation of Property Declaration).

## How it works

1. **Link accounts** — the user connects a bank via Plaid Link (`PlaidLinkButton`), and a `public_token` is exchanged for an `access_token`, stored in an HTTP-only cookie.
2. **Fetch & map** — on the `/review` page, Plaid account, liability, and investment data are fetched and mapped (`lib/mapping.ts`) into `FormRow`s (assets/debts), categorized by FL-160 item number.
3. **Allocate rows to form lines** — `lib/allocate.ts` assigns each row to a fixed FL-160 line, or overflows extra rows onto FL-161 when a category has more entries than the form allows, computing the continuation sums (FL-160 items 17/25) and grand totals (items 18/26).
4. **Review & fill** — the user reviews/edits the draft rows in `ReviewTable`, then the data is used to fill the actual PDF form fields (sourced from `lib/fl160-fields.ts` and `lib/fl161-fields.ts`, generated from the real PDF's own field names).

## Key files

- `lib/mapping.ts` — turns raw Plaid data into draft `FormRow`s.
- `lib/fl160-fields.ts` / `lib/fl161-fields.ts` — PDF field name constants and row/category types, generated from the official JC forms.
- `lib/allocate.ts` — decides which printed line (FL-160 vs FL-161) each row lands on, and computes totals.
- `app/components/PlaidLinkButton.tsx` — Plaid Link UI.
- `app/actions.ts` — server actions for exchanging/storing/clearing the Plaid access token cookie.
- `app/review/` — server component that fetches Plaid data and renders the editable review table.

## Getting Started

First, set up environment variables for Plaid (client ID, secret, env) in `.env.local`, then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [react-plaid-link](https://github.com/plaid/react-plaid-link)
- [pdf-lib](https://pdf-lib.js.org/) for filling PDF form fields
- TypeScript throughout

## Deploy on Vercel

The easiest way to deploy this app is via the [Vercel Platform](https://vercel.com/new). Be sure to configure Plaid environment variables (and switch from Plaid's `sandbox`/`development` env to `production` as appropriate) before deploying.you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
