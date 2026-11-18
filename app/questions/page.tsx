import type { ReactNode } from 'react';
import Link from 'next/link';
import { theme } from '@/lib/theme';

export const metadata = { title: 'Questions for a lawyer' };

interface Question {
  ask: string;
  /** What the prototype does today, until there's an answer. */
  now: string;
}

const GROUPS: Array<{ title: string; questions: Question[] }> = [
  {
    title: 'Which form, and how to fill it in',
    questions: [
      {
        ask: 'For a disclosure, should we target FL-142 or FL-160? Which do people actually use?',
        now: 'Fills FL-160. FL-142 would list everything on one form with a separate-property column.',
      },
      {
        ask: 'FL-160 says not to combine community and separate property. Is producing two FL-160s, one of each, the right way to handle that?',
        now: 'Generates one FL-160 per property type, each with its own totals.',
      },
      {
        ask: 'Are blank dates acceptable in the “date acquired” and “date incurred” columns? Is a year alone, or “various”, acceptable?',
        now: 'Dates are optional and must be full dates when given. Plaid doesn’t know when an account was opened.',
      },
      {
        ask: 'Should one of the “Petitioner’s” and “Respondent’s” boxes always be ticked?',
        now: 'Optional. Left blank, neither box is ticked.',
      },
      {
        ask: 'Is one line per investment or retirement account, at its total balance, enough? Or should holdings be listed separately?',
        now: 'One line per account at its total balance.',
      },
    ],
  },
  {
    title: 'Values and classification',
    questions: [
      {
        ask: 'What valuation date should each balance and debt use: today, the date of separation, or something else?',
        now: 'Uses the balance on the day the account is linked and shows that date beside each line.',
      },
      {
        ask: 'Plaid gives a “current” and an “available” balance. Which belongs on the form?',
        now: 'Uses the current (ledger) balance.',
      },
      {
        ask: 'How should an account with both premarital and marital contributions appear?',
        now: 'The user can duplicate a line and split the amount into a community line and a separate line.',
      },
      {
        ask: 'Is it acceptable for the app to create a house or car line from a mortgage or auto loan, with the value left for the user?',
        now: 'Does this, flagged as needing a value and date.',
      },
      {
        ask: 'When there is one property, is it reasonable to add a home equity line to that property’s debt automatically?',
        now: 'Does this, with a note asking the user to confirm.',
      },
      {
        ask: 'Business accounts can come through with a personal bank link. How should they be handled?',
        now: 'Includes them with a note asking the user to confirm they belong.',
      },
    ],
  },
  {
    title: 'Attachments',
    questions: [
      {
        ask: 'Should bank statements be redacted (for example account numbers) before they’re served on the other party?',
        now: 'Lists which documents to attach; nothing is redacted or attached yet.',
      },
      {
        ask: 'Would a Plaid-generated summary of balances and transactions satisfy “latest statement”, or must it be the bank’s own statement?',
        now: 'Not used. Pulling the bank’s own statements is a planned feature.',
      },
    ],
  },
  {
    title: 'The app itself',
    questions: [
      {
        ask: 'Who should classify items as community or separate and propose the division? Could pre-filling either cross into legal advice?',
        now: 'Never pre-fills either: every line starts unclassified and the division columns stay blank.',
      },
      {
        ask: 'If this were offered for a fee, do California’s rules for legal document assistants or other form-preparation rules apply?',
        now: 'A free sandbox prototype with no real data.',
      },
      {
        ask: 'Are there rules about storing or transmitting this financial data that a product like this must follow?',
        now: 'Stores nothing except the bank connection in a browser cookie; the PDF is filled in the browser.',
      },
    ],
  },
];

/** Where each group's numbering starts, so numbers run on across groups. */
const STARTS = GROUPS.map((_, i) => 1 + GROUPS.slice(0, i).reduce((sum, g) => sum + g.questions.length, 0));

export default function Questions() {
  return (
    <div style={theme} className="min-h-screen w-full flex-1 bg-[var(--paper)] font-sans text-[var(--ink)]">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-[var(--accent)] underline underline-offset-2">
          Back to the declaration
        </Link>

        <header className="mb-10 mt-6 border-b border-[var(--ink)] pb-8">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Questions for a lawyer</h1>
          <p className="mt-4 max-w-prose text-[var(--muted)]">
            These came up while building the prototype. Each one notes what the app does today, so your answer can
            change it.
          </p>
        </header>

        <div className="space-y-12">
          {GROUPS.map((group, g) => (
            <Group key={group.title} title={group.title}>
              {group.questions.map((q, i) => (
                <QuestionItem key={q.ask} number={STARTS[g] + i} question={q} />
              ))}
            </Group>
          ))}
        </div>
      </main>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold tracking-tight">{title}</h2>
      <ol className="divide-y divide-[var(--rule)] border-y border-[var(--ink)] bg-[var(--sheet)]">{children}</ol>
    </section>
  );
}

/** Numbered so a question can be referred to in conversation ("on number 6…"). */
function QuestionItem({ number, question }: { number: number; question: Question }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 px-5 py-4">
      <span className="pt-px tabular-nums text-[var(--muted)]">{number}.</span>
      <div className="max-w-prose">
        <p className="font-medium leading-relaxed">{question.ask}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">Today: {question.now}</p>
      </div>
    </li>
  );
}
