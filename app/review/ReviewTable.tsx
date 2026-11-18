// app/review/ReviewTable.tsx
'use client';

import { useState, type ReactNode } from 'react';
import { ITEM_NUMBER, type AssetCategory, type DebtCategory } from '@/lib/fl160-fields';
import { netValue, type AssetRow, type Character, type DebtRow, type FormRow } from '@/lib/mapping';
import { allocateRows, rowsMissingValue } from '@/lib/allocate';
import { generateDeclaration, type CaseDetails } from '@/lib/fill';
import { clearAccessToken } from '../actions';

// ---------------------------------------------------------------------------
// Labels, in form order
// ---------------------------------------------------------------------------

const ASSET_LABELS: Record<AssetCategory, string> = {
  realEstate: 'Real estate',
  household: 'Household furniture, furnishings, appliances',
  jewelryArt: 'Jewelry, antiques, art, coin collections',
  vehicles: 'Vehicles, boats, trailers',
  savings: 'Savings accounts',
  checking: 'Checking accounts',
  otherDepository: 'Credit union, other depository accounts',
  cash: 'Cash',
  taxRefund: 'Tax refund',
  lifeInsurance: 'Life insurance with cash surrender or loan value',
  stocksBonds: 'Stocks, bonds, secured notes, mutual funds',
  retirement: 'Retirement and pensions',
  iraAnnuities: 'Profit-sharing, IRAs, deferred compensation, annuities',
  accountsReceivable: 'Accounts receivable, unsecured notes',
  businessInterests: 'Partnership, other business interests',
  otherAssets: 'Other assets',
};

const DEBT_LABELS: Record<DebtCategory, string> = {
  studentLoans: 'Student loans',
  taxes: 'Taxes',
  supportArrears: 'Support arrearages',
  unsecuredLoans: 'Loans, unsecured',
  creditCards: 'Credit cards',
  otherDebts: 'Other debts',
};

const ASSET_ORDER = Object.keys(ASSET_LABELS) as AssetCategory[];
const DEBT_ORDER = Object.keys(DEBT_LABELS) as DebtCategory[];

/** What the form says to attach when served with a Declaration of Disclosure. */
const ATTACHMENTS: Partial<Record<AssetCategory | DebtCategory, string>> = {
  realEstate: 'Real estate: deed with legal description and the latest lender statement',
  vehicles: 'Vehicles: title or registration',
  savings: 'Savings: latest statement',
  checking: 'Checking: latest statement',
  otherDepository: 'Other deposit accounts: latest statement',
  lifeInsurance: 'Life insurance: latest declaration page',
  stocksBonds: 'Stocks and funds: certificate or latest statement',
  retirement: 'Retirement: latest summary plan document and benefit statement',
  iraAnnuities: 'IRAs and annuities: latest statement',
  accountsReceivable: 'Accounts receivable: the note or documentation',
  businessInterests: 'Business interests: latest K-1 or Schedule C',
  studentLoans: 'Student loans: latest statement',
  taxes: 'Taxes: latest notice or statement',
  supportArrears: 'Support arrearages: orders and statements',
  unsecuredLoans: 'Unsecured loans: latest statement',
  creditCards: 'Credit cards: latest statement',
  otherDebts: 'Other debts: latest statement',
};

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (n: number | null) => (n == null ? '—' : usd.format(n));
/** 2026-11-14 → 11/14/2026, without Date so server and browser render the same text. */
const usDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};

// ---------------------------------------------------------------------------
// Blank lines
//
// The screen shows every item on FL-160. Lines nobody has typed into are
// "blank": they're left out of the totals, the checks and the PDF. A line stops
// being blank as soon as it has a description, an amount or a date, and from then
// on it needs everything a real row needs, including community or separate.
// ---------------------------------------------------------------------------

function isBlank(row: FormRow): boolean {
  if (row.description.trim() !== '') return false;
  return row.kind === 'asset'
    ? row.grossValue == null && row.debt == null && row.dateAcquired == null
    : row.totalOwing == null && row.dateIncurred == null;
}

function blankAsset(category: AssetCategory, id: string): AssetRow {
  return {
    id, kind: 'asset', category, source: 'manual', plaidAccountId: null,
    description: '', dateAcquired: null, grossValue: null, debt: null, character: null, asOf: null, todo: [],
  };
}

function blankDebt(category: DebtCategory, id: string): DebtRow {
  return {
    id, kind: 'debt', category, source: 'manual', plaidAccountId: null,
    description: '', dateIncurred: null, totalOwing: null, character: null, asOf: null, todo: [],
  };
}

/**
 * Gives every item that has nothing in it one blank line, so the user sees it and
 * can fill it in. Items with rows get none: "Add a line" adds more when needed.
 * How many lines the screen shows doesn't matter to the PDF: allocateRows() puts
 * filled lines on the printed lines in order and sends extras to FL-161.
 */
function padToForm(rows: FormRow[]): FormRow[] {
  const padded = [...rows];
  const isEmpty = (category: string) => !rows.some((r) => r.category === category);
  // Fixed ids, so the server render and the browser agree.
  for (const category of ASSET_ORDER) if (isEmpty(category)) padded.push(blankAsset(category, `line-${category}`));
  for (const category of DEBT_ORDER) if (isEmpty(category)) padded.push(blankDebt(category, `line-${category}`));
  return padded;
}

// ---------------------------------------------------------------------------
// Look. A green ledger sheet: pale paper, dark green ink, ruled lines.
// Colors are CSS variables set on the wrapper in page.tsx.
// ---------------------------------------------------------------------------

/** Ledger-line field: no box, just a rule that darkens on hover and turns green on focus. */
const field =
  'w-full rounded-none border-0 border-b border-[var(--rule)] bg-transparent px-0 py-1.5 text-[var(--ink)] ' +
  'placeholder:text-[var(--muted)]/70 hover:border-[var(--muted)] ' +
  'focus:border-[var(--accent)] focus:outline-none focus:ring-0 focus:shadow-[0_1px_0_0_var(--accent)]';
const needsInput = 'border-[var(--warn)] shadow-[0_1px_0_0_var(--warn)]';
const smallLabel = 'block text-xs text-[var(--muted)]';

/** Column template shared by the header and every row so the amounts line up. */
const ASSET_GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem_8.5rem] md:gap-x-6';
const DEBT_GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_9.5rem] md:gap-x-6';

interface Download {
  name: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewTable({ initialRows }: { initialRows: FormRow[] }) {
  const [rows, setRowsState] = useState<FormRow[]>(() => padToForm(initialRows));
  const [details, setDetailsState] = useState<CaseDetails>({
    petitioner: '', respondent: '', caseNumber: '', filedBy: null,
  });
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');

  // -- state updates ---------------------------------------------------------

  /** Any edit makes previously generated PDFs stale, so drop them. */
  function clearDownloads() {
    setDownloads((prev) => {
      prev.forEach((d) => URL.revokeObjectURL(d.url));
      return [];
    });
    setStatus('idle');
  }

  function setRows(next: (prev: FormRow[]) => FormRow[]) {
    setRowsState(next);
    clearDownloads();
  }

  function setDetails(patch: Partial<CaseDetails>) {
    setDetailsState((prev) => ({ ...prev, ...patch }));
    clearDownloads();
  }

  function update(id: string, patch: Partial<AssetRow> | Partial<DebtRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...patch } as FormRow) : r)));
  }

  function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  /** Copy a row directly beneath itself, e.g. to split one account into a community part and a separate part. */
  function duplicate(id: string) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === id);
      if (i < 0) return prev;
      const copy: FormRow = {
        ...prev[i],
        id: crypto.randomUUID(),
        character: null,
        todo: ['Copied row: adjust the amounts so the two rows add up to the account total.'],
      };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  }

  /** One more blank line under an item, for when the printed lines run out (extras go on FL-161). */
  function addLine(category: AssetCategory | DebtCategory) {
    const id = crypto.randomUUID();
    const row = (ASSET_ORDER as string[]).includes(category)
      ? blankAsset(category as AssetCategory, id)
      : blankDebt(category as DebtCategory, id);
    setRows((prev) => [...prev, row]);
  }

  // -- derived ---------------------------------------------------------------

  /** Everything that will go on the forms. */
  const filled = rows.filter((r) => !isBlank(r));

  const unclassified = filled.filter((r) => r.character == null).length;
  const missingValue = rowsMissingValue(filled).length;
  const missingDescription = filled.filter((r) => r.description.trim() === '').length;
  const ready = filled.length > 0 && unclassified === 0 && missingValue === 0 && missingDescription === 0;

  const blockers = [
    filled.length === 0 ? 'Fill in at least one line' : null,
    unclassified > 0 ? `${unclassified} ${unclassified === 1 ? 'line needs' : 'lines need'} community or separate` : null,
    missingValue > 0 ? `${missingValue} ${missingValue === 1 ? 'asset needs' : 'assets need'} a value` : null,
    missingDescription > 0
      ? `${missingDescription} ${missingDescription === 1 ? 'line needs' : 'lines need'} a description`
      : null,
  ].filter((b): b is string => b != null);

  const declarations = (['community', 'separate'] as const)
    .map((character) => ({ character, allocation: allocateRows(filled.filter((r) => r.character === character)) }))
    .filter((d) => d.allocation.fl160.assets.length + d.allocation.fl160.debts.length > 0);

  const attachments = Array.from(new Set(filled.map((r) => ATTACHMENTS[r.category]).filter(Boolean)));

  /** Fills the court PDFs in the browser and offers them as download links. */
  async function handleGenerate() {
    setStatus('working');
    try {
      const [fl160, fl161] = await Promise.all(
        ['/fl160-template.pdf', '/fl161-template.pdf'].map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Could not load ${url}`);
          return res.arrayBuffer();
        }),
      );

      const next: Download[] = [];
      for (const { character, allocation } of declarations) {
        const files = await generateDeclaration(character, allocation, details, { fl160, fl161 });
        for (const file of files) {
          const blob = new Blob([file.bytes as BlobPart], { type: 'application/pdf' });
          next.push({ name: file.name, url: URL.createObjectURL(blob) });
        }
      }

      clearDownloads();
      setDownloads(next);
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }

  // -- row renderers ----------------------------------------------------------

  function renderAsset(row: AssetRow) {
    const blank = isBlank(row);
    return (
      <LedgerRow
        key={row.id}
        row={row}
        blank={blank}
        main={
          <div className={ASSET_GRID}>
            <DescriptionInput
              value={row.description}
              blank={blank}
              onChange={(description) => update(row.id, { description })}
            />
            <div className="mt-3 grid grid-cols-3 gap-x-4 md:contents">
              <MoneyInput
                label="Fair market value"
                shortLabel="Value"
                value={row.grossValue}
                required={!blank}
                onChange={(grossValue) => update(row.id, { grossValue })}
              />
              <MoneyInput
                label="Debt against it"
                shortLabel="Debt"
                value={row.debt}
                onChange={(debt) => update(row.id, { debt })}
              />
              <div>
                <span className={`${smallLabel} text-right md:hidden`}>Net</span>
                <p className="py-1.5 text-right font-medium tabular-nums">{blank ? '' : money(netValue(row))}</p>
              </div>
            </div>
          </div>
        }
        controls={
          <RowControls
            category={
              <CategorySelect
                value={row.category}
                labels={ASSET_LABELS}
                onChange={(category) => update(row.id, { category })}
              />
            }
            date={
              <DateInput
                label="Date acquired"
                value={row.dateAcquired}
                onChange={(dateAcquired) => update(row.id, { dateAcquired })}
              />
            }
            character={row.character}
            onCharacter={(character) => update(row.id, { character })}
            onDuplicate={() => duplicate(row.id)}
            onRemove={() => remove(row.id)}
          />
        }
      />
    );
  }

  function renderDebt(row: DebtRow) {
    const blank = isBlank(row);
    return (
      <LedgerRow
        key={row.id}
        row={row}
        blank={blank}
        main={
          <div className={DEBT_GRID}>
            <DescriptionInput
              value={row.description}
              blank={blank}
              onChange={(description) => update(row.id, { description })}
            />
            <div className="mt-3 md:contents">
              <MoneyInput
                label="Total owing"
                value={row.totalOwing}
                onChange={(totalOwing) => update(row.id, { totalOwing })}
              />
            </div>
          </div>
        }
        controls={
          <RowControls
            category={
              <CategorySelect
                value={row.category}
                labels={DEBT_LABELS}
                onChange={(category) => update(row.id, { category })}
              />
            }
            date={
              <DateInput
                label="Date incurred"
                value={row.dateIncurred}
                onChange={(dateIncurred) => update(row.id, { dateIncurred })}
              />
            }
            character={row.character}
            onCharacter={(character) => update(row.id, { character })}
            onDuplicate={() => duplicate(row.id)}
            onRemove={() => remove(row.id)}
          />
        }
      />
    );
  }

  // -- render ----------------------------------------------------------------

  return (
    <div className="space-y-12 pb-10">
       <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer" onClick={clearAccessToken}>Start Over</button>
      {/* Case details ------------------------------------------------------- */}
      <section aria-labelledby="case-heading">
        <SectionHeading id="case-heading" title="Case details" />
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className={smallLabel}>Petitioner</span>
            <input
              className={field}
              value={details.petitioner}
              onChange={(e) => setDetails({ petitioner: e.target.value })}
            />
          </label>
          <label>
            <span className={smallLabel}>Respondent</span>
            <input
              className={field}
              value={details.respondent}
              onChange={(e) => setDetails({ respondent: e.target.value })}
            />
          </label>
          <label>
            <span className={smallLabel}>Case number</span>
            <input
              className={field}
              value={details.caseNumber}
              onChange={(e) => setDetails({ caseNumber: e.target.value })}
            />
          </label>
          <label>
            <span className={smallLabel}>Whose declaration is this?</span>
            <select
              className={field}
              value={details.filedBy ?? ''}
              onChange={(e) => setDetails({ filedBy: (e.target.value || null) as CaseDetails['filedBy'] })}
            >
              <option value="">Not chosen</option>
              <option value="petitioner">Petitioner’s</option>
              <option value="respondent">Respondent’s</option>
            </select>
          </label>
        </div>
      </section>

      {/* Assets ------------------------------------------------------------- */}
      <section aria-labelledby="assets-heading">
        <SectionHeading
          id="assets-heading"
          title="Assets"
          hint="Every item on the form is listed. Fill in what applies to you; empty lines are left out of the PDF."
        />
        <Sheet>
          <div className={`hidden px-5 py-2 text-xs text-[var(--muted)] ${ASSET_GRID}`}>
            <span>Description</span>
            <span className="text-right">Fair market value</span>
            <span className="text-right">Debt against it</span>
            <span className="text-right">Net</span>
          </div>
          {ASSET_ORDER.map((category) => (
            <ItemGroup
              key={category}
              number={ITEM_NUMBER[category]}
              label={ASSET_LABELS[category]}
              onAddLine={() => addLine(category)}
            >
              {rows
                .filter((r): r is AssetRow => r.kind === 'asset' && r.category === category)
                .map(renderAsset)}
            </ItemGroup>
          ))}
        </Sheet>
      </section>

      {/* Debts -------------------------------------------------------------- */}
      <section aria-labelledby="debts-heading">
        <SectionHeading
          id="debts-heading"
          title="Debts"
          hint="A loan secured by a house or car belongs in “Debt against it” on that asset, not here."
        />
        <Sheet>
          <div className={`hidden px-5 py-2 text-xs text-[var(--muted)] ${DEBT_GRID}`}>
            <span>Description and who it’s owed to</span>
            <span className="text-right">Total owing</span>
          </div>
          {DEBT_ORDER.map((category) => (
            <ItemGroup
              key={category}
              number={ITEM_NUMBER[category]}
              label={DEBT_LABELS[category]}
              onAddLine={() => addLine(category)}
            >
              {rows
                .filter((r): r is DebtRow => r.kind === 'debt' && r.category === category)
                .map(renderDebt)}
            </ItemGroup>
          ))}
        </Sheet>
      </section>

      {/* Outcome ------------------------------------------------------------ */}
      {declarations.length > 0 && (
        <section aria-labelledby="outcome-heading">
          <SectionHeading
            id="outcome-heading"
            title="What you’ll get"
            hint="Community and separate property go on separate forms, so each gets its own PDF."
          />
          <div className="grid gap-6 md:grid-cols-2">
            {declarations.map(({ character, allocation }) => (
              <Sheet key={character}>
                <div className="p-5">
                  <h3 className="font-semibold">
                    {character === 'community' ? 'Community and quasi-community property' : 'Separate property'}
                  </h3>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 tabular-nums">
                    <dt className="text-[var(--muted)]">Assets</dt>
                    <dd className="text-right">{money(allocation.totals.assets.grossValue)}</dd>
                    <dt className="text-[var(--muted)]">Debt against assets</dt>
                    <dd className="text-right">{money(allocation.totals.assets.debt)}</dd>
                    <dt className="border-t border-[var(--ink)] pt-1.5 font-medium">Net assets</dt>
                    <dd className="border-t border-[var(--ink)] pt-1.5 text-right font-medium">
                      {money(allocation.totals.assets.netValue)}
                    </dd>
                    <dt className="pt-3 text-[var(--muted)]">Debts</dt>
                    <dd className="pt-3 text-right">{money(allocation.totals.debts.totalOwing)}</dd>
                  </dl>
                  {allocation.needsContinuation && (
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      {allocation.fl161.assets.length + allocation.fl161.debts.length === 1
                        ? '1 line doesn’t'
                        : `${allocation.fl161.assets.length + allocation.fl161.debts.length} lines don’t`}{' '}
                      fit on the main form and will go on a continuation sheet (FL-161).
                    </p>
                  )}
                  {allocation.unplaced.length > 0 && (
                    <p className="mt-3 text-sm text-[var(--warn)]">
                      {allocation.unplaced.length} line(s) don’t fit on either form and will be left out.
                    </p>
                  )}
                </div>
              </Sheet>
            ))}
          </div>
        </section>
      )}

      {attachments.length > 0 && (
        <section aria-labelledby="attach-heading">
          <SectionHeading
            id="attach-heading"
            title="Documents to attach"
            hint="Attach copies when you serve this on the other party. Don’t file them with the court."
          />
          <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {attachments.map((a) => (
              <li key={a} className="border-b border-[var(--rule)] py-1.5">
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sticky action bar --------------------------------------------------- */}
      <div className="sticky bottom-0 -mx-6 border-t border-[var(--ink)] bg-[var(--paper)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <div className="min-w-0 text-sm" aria-live="polite">
            {downloads.length > 0 ? (
              <ul className="space-y-1">
                {downloads.map((d) => (
                  <li key={d.url}>
                    <a
                      href={d.url}
                      download={d.name}
                      className="font-medium text-[var(--accent)] underline underline-offset-2"
                    >
                      Download {d.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : status === 'error' ? (
              <p className="text-[var(--warn)]">
                The PDF couldn’t be generated. Open the browser console to see the error, then try again.
              </p>
            ) : ready ? (
              <p>
                {filled.length} {filled.length === 1 ? 'line' : 'lines'} ready. You sign the form under penalty of
                perjury, so check each amount first.
              </p>
            ) : (
              <ul className="space-y-0.5 text-[var(--warn)]">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!ready || status === 'working'}
            // className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
            className="bg-blue-500 hover:bg-blue-700 rounded-sm bg-[var(--accent)] px-5 py-2.5 font-semibold text-white enabled:cursor-pointer enabled:hover:bg-blue-700 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {status === 'working' ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function SectionHeading({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {hint && <p className="mt-0.5 max-w-prose text-sm text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

/** The white sheet the ledger rows sit on. */
function Sheet({ children }: { children: ReactNode }) {
  return <div className="border-y border-[var(--ink)] bg-[var(--sheet)]">{children}</div>;
}

/** One numbered item from the form, with its lines underneath. */
function ItemGroup({
  number, label, onAddLine, children,
}: { number: number; label: string; onAddLine: () => void; children: ReactNode }) {
  return (
    <div className="border-t border-[var(--rule)] first:border-t-0">
      <div className="flex items-baseline justify-between gap-4 bg-[var(--paper)]/60 px-5 pb-1.5 pt-4">
        <h3 className="font-semibold">
          <span className="tabular-nums text-[var(--muted)]">{number}.</span> {label}
        </h3>
        <button
          type="button"
          onClick={onAddLine}
          className="shrink-0 cursor-pointer text-sm text-[var(--accent)] underline underline-offset-2 hover:text-[var(--ink)]"
        >
          Add a line
        </button>
      </div>
      <div className="divide-y divide-[var(--rule)]">{children}</div>
    </div>
  );
}

/**
 * One line of the ledger. A blank line shows only its description and amounts;
 * once anything is typed it grows a second line with date, property type and
 * actions. The first line keeps the same elements either way, so typing never
 * loses focus.
 */
function LedgerRow({
  row, blank, main, controls,
}: { row: FormRow; blank: boolean; main: ReactNode; controls: ReactNode }) {
  const incomplete =
    !blank &&
    (row.character == null || row.description.trim() === '' || (row.kind === 'asset' && row.grossValue == null));
  return (
    <div className={`border-l-4 px-5 ${blank ? 'py-2' : 'py-4'} ${incomplete ? 'border-l-[var(--warn)]' : 'border-l-transparent'}`}>
      {main}
      {!blank && controls}
      {!blank && (row.asOf != null || row.todo.length > 0) && (
        <p className="mt-3 text-xs leading-relaxed">
          {row.asOf != null && (
            <span className="text-[var(--muted)]">Balance from your linked account on {usDate(row.asOf)}. </span>
          )}
          {row.todo.map((t) => (
            <span key={t} className="text-[var(--warn)]">
              {t}{' '}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function DescriptionInput({
  value, blank, onChange,
}: { value: string; blank: boolean; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      aria-label="Description"
      placeholder={blank ? 'Blank line' : 'Describe this item'}
      className={`${field} text-base ${blank ? '' : 'font-medium'} ${!blank && value.trim() === '' ? needsInput : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function MoneyInput({
  label, shortLabel, value, required, onChange,
}: {
  label: string;
  /** Shown above the box on small screens, where the column header is hidden. */
  shortLabel?: string;
  value: number | null;
  required?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className={`${smallLabel} text-right md:hidden`}>{shortLabel ?? label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          aria-label={label}
          placeholder={required ? 'Enter' : ''}
          className={`${field} pl-4 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${required && value == null ? needsInput : ''}`}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      </span>
    </label>
  );
}

function DateInput({
  label, value, onChange,
}: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="block">
      <span className={smallLabel}>{label}</span>
      <input type="date" className={field} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    </label>
  );
}

function CategorySelect<C extends AssetCategory | DebtCategory>({
  value, labels, onChange,
}: { value: C; labels: Record<C, string>; onChange: (c: C) => void }) {
  return (
    <label className="block">
      <span className={smallLabel}>Line on the form</span>
      <select className={field} value={value} onChange={(e) => onChange(e.target.value as C)}>
        {(Object.keys(labels) as C[]).map((c) => (
          <option key={c} value={c}>
            {ITEM_NUMBER[c]}. {labels[c]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Two-way switch with nothing selected to begin with: the user has to choose. */
function CharacterToggle({ value, onChange }: { value: Character | null; onChange: (c: Character | null) => void }) {
  const options: Array<{ key: Character; label: string }> = [
    { key: 'community', label: 'Community' },
    { key: 'separate', label: 'Separate' },
  ];
  return (
    <div>
      <span className={smallLabel}>Property type</span>
      <div
        role="group"
        aria-label="Property type"
        className={`mt-1 inline-flex rounded-sm border ${value == null ? 'border-[var(--warn)]' : 'border-[var(--ink)]'}`}
      >
        {options.map((o, i) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            // Clicking the selected side again clears it.
            onClick={() => onChange(value === o.key ? null : o.key)}
            className={`cursor-pointer px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              i > 0 ? `border-l ${value == null ? 'border-[var(--warn)]' : 'border-[var(--ink)]'}` : ''
            } ${value === o.key ? 'bg-[var(--ink)] font-medium text-[var(--paper)]' : 'hover:bg-[var(--paper)]'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Second line of a row: where it goes on the form, its date, its type, and row actions. */
function RowControls({
  category, date, character, onCharacter, onDuplicate, onRemove,
}: {
  category: ReactNode;
  date: ReactNode;
  character: Character | null;
  onCharacter: (c: Character | null) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
      <div className="w-full sm:w-64">{category}</div>
      <div className="w-40">{date}</div>
      <CharacterToggle value={character} onChange={onCharacter} />
      <div className="ml-auto flex gap-4 pb-1.5 text-sm">
        <button
          type="button"
          onClick={onDuplicate}
          className="cursor-pointer text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)]"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer text-[var(--muted)] underline underline-offset-2 hover:text-[var(--warn)]"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
