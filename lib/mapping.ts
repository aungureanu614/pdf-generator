// Turns Plaid data into draft FL-160 rows.
//
// What this file decides: which form item each account belongs under, and which
// Plaid number goes in which column. What it never decides: community vs. separate,
// who gets the item, or a value Plaid doesn't have. Those stay null for the user.

import type { AssetCategory, DebtCategory } from './fl160-fields';

// ---------------------------------------------------------------------------
// Minimal shapes of the Plaid responses (only the fields used here), so this
// file doesn't depend on a particular version of the Plaid SDK.
// ---------------------------------------------------------------------------

export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string; // depository | credit | loan | investment | other
  subtype?: string | null;
  holder_category?: string | null;
  balances: { current: number | null; available: number | null };
}

export interface PlaidLiabilities {
  student?: Array<{ account_id: string | null; origination_date?: string | null; loan_name?: string | null }> | null;
  mortgage?: Array<{
    account_id: string;
    origination_date?: string | null;
    property_address?: { street?: string | null; city?: string | null; region?: string | null; postal_code?: string | null } | null;
  }> | null;
  // Plaid's newer "loan" bucket (auto, personal, etc.)
  loan?: Array<{ account_id: string; origination_date?: string | null }> | null;
}

export interface PlaidData {
  institutionName?: string | null; // item.institution_name
  accounts: PlaidAccount[]; // accountsGet → data.accounts
  liabilities?: PlaidLiabilities | null; // liabilitiesGet → data.liabilities
}

// ---------------------------------------------------------------------------
// The app's own row model. One of these becomes one line on the form.
// ---------------------------------------------------------------------------

export type Character = 'community' | 'separate';

interface RowBase {
  id: string;
  source: 'plaid' | 'manual';
  plaidAccountId: string | null;
  /** Column A. */
  description: string;
  /** Never set by the mapper. The PDF can't be generated while any row is null. */
  character: Character | null;
  /** ISO date the Plaid numbers were fetched; null for manual rows. */
  asOf: string | null;
  /** Things the user still has to supply or check, shown on the review screen. */
  todo: string[];
}

export interface AssetRow extends RowBase {
  kind: 'asset';
  category: AssetCategory;
  /** Column B, ISO date. Plaid doesn't know when an account was opened. */
  dateAcquired: string | null;
  /** Column C. */
  grossValue: number | null;
  /** Column D. */
  debt: number | null;
}

export interface DebtRow extends RowBase {
  kind: 'debt';
  category: DebtCategory;
  /** Column B, ISO date. */
  dateIncurred: string | null;
  /** Column C. */
  totalOwing: number | null;
}

export type FormRow = AssetRow | DebtRow;

/** Column E. Blank until there is a value to subtract from. */
export function netValue(row: AssetRow): number | null {
  if (row.grossValue == null) return null;
  return round2(row.grossValue - (row.debt ?? 0));
}

// ---------------------------------------------------------------------------
// Subtype → form item. Plaid subtypes are compared in lower case.
// ---------------------------------------------------------------------------

const DEPOSITORY: Record<string, AssetCategory> = {
  checking: 'checking', // item 6
  savings: 'savings', // item 5
  'money market': 'savings', // item 5: a savings-type deposit account
  // everything else falls through to item 7, "credit union, other depository accounts"
};

/** Item 12, "Retirement and pensions": employer plans. */
const RETIREMENT = new Set([
  '401a', '401k', 'roth 401k', '403b', '457b', 'pension', 'retirement', 'thrift savings plan', 'keogh',
]);

/** Item 13, "Profit-sharing, IRAs, deferred compensation, annuities". */
const IRA_ANNUITY = new Set([
  'ira', 'roth', 'sep ira', 'simple ira', 'sarsep', 'profit sharing plan',
  'fixed annuity', 'variable annuity', 'other annuity',
]);

/** Investment-type accounts that aren't securities; item 16, "Other assets". */
const OTHER_INVESTMENT = new Set([
  '529', 'education savings account', 'ugma', 'utma', 'trust', 'hsa',
  'health reimbursement arrangement', 'crypto exchange', 'non-custodial wallet', 'other',
]);

function investmentCategory(subtype: string): AssetCategory {
  if (RETIREMENT.has(subtype)) return 'retirement';
  if (IRA_ANNUITY.has(subtype)) return 'iraAnnuities';
  if (subtype === 'life insurance') return 'lifeInsurance'; // item 10
  if (OTHER_INVESTMENT.has(subtype)) return 'otherAssets';
  return 'stocksBonds'; // item 11: brokerage, stock plan, mutual fund, ...
}

// ---------------------------------------------------------------------------
// The mapper
// ---------------------------------------------------------------------------

/**
 * @param data  what came back from Plaid for one linked institution
 * @param asOf  ISO date of the fetch, e.g. new Date().toISOString().slice(0, 10)
 */
export function mapPlaidToRows(data: PlaidData, asOf: string): FormRow[] {
  const liab = data.liabilities ?? {};
  const student = byAccountId(liab.student);
  const mortgage = byAccountId(liab.mortgage);
  const loan = byAccountId(liab.loan);

  const rows: FormRow[] = [];

  for (const acct of data.accounts) {
    const subtype = (acct.subtype ?? '').toLowerCase();
    const label = describe(data.institutionName, acct);
    const base = {
      id: `plaid:${acct.account_id}`,
      source: 'plaid' as const,
      plaidAccountId: acct.account_id,
      character: null,
      asOf,
    };
    const todo: string[] = [];
    if (acct.holder_category === 'business') todo.push('Business account: confirm it belongs on this declaration.');

    switch (acct.type) {
      // -- Assets the bank holds: the balance is the value. ------------------
      case 'depository':
      case 'investment':
      case 'other': {
        const category: AssetCategory =
          acct.type === 'depository' ? DEPOSITORY[subtype] ?? 'otherDepository'
          : acct.type === 'investment' ? investmentCategory(subtype)
          : 'otherAssets';
        // `current` is the ledger balance. `available` nets out pending items,
        // so it's only a fallback for banks that don't report `current`.
        const value = acct.balances.current ?? acct.balances.available;
        if (value == null) todo.push('Plaid returned no balance: enter the value.');
        rows.push({
          ...base, kind: 'asset', category, description: label,
          dateAcquired: null, grossValue: money(value), debt: null, todo,
        });
        break;
      }

      // -- Credit cards: item 23. `current` is the amount owed. --------------
      case 'credit':
        rows.push({
          ...base, kind: 'debt', category: 'creditCards', description: label,
          dateIncurred: null, totalOwing: money(acct.balances.current), todo,
        });
        break;

      // -- Loans. Secured loans aren't lines in the debt section: the form puts
      //    them in column D of the asset they're secured by. -------------------
      case 'loan': {
        const owed = money(acct.balances.current);

        if (subtype === 'mortgage') {
          const addr = mortgage.get(acct.account_id)?.property_address;
          const where = [addr?.street, addr?.city, addr?.region].filter(Boolean).join(', ');
          rows.push({
            ...base, kind: 'asset', category: 'realEstate', // item 1
            description: where || `Real property (${label})`,
            dateAcquired: null, // loan origination ≠ purchase date (refinances)
            grossValue: null, debt: owed,
            todo: [...todo, 'Enter the fair market value and the date acquired.'],
          });
        } else if (subtype === 'auto') {
          rows.push({
            ...base, kind: 'asset', category: 'vehicles', // item 4
            description: `Vehicle (${label})`,
            dateAcquired: null, grossValue: null, debt: owed,
            todo: [...todo, 'Enter the year/make/model, fair market value and date acquired.'],
          });
        } else if (subtype === 'student') {
          rows.push({
            ...base, kind: 'debt', category: 'studentLoans', // item 19
            description: label,
            dateIncurred: student.get(acct.account_id)?.origination_date ?? null,
            totalOwing: owed, todo,
          });
        } else if (subtype === 'home equity') {
          // Secured by a property, but Plaid doesn't say which one. Parked under
          // item 24 here; attachHomeEquity() below moves it if there's one property.
          rows.push({
            ...base, kind: 'debt', category: 'otherDebts',
            description: label,
            dateIncurred: loan.get(acct.account_id)?.origination_date ?? null,
            totalOwing: owed,
            todo: [...todo, HOME_EQUITY_TODO],
          });
        } else {
          // consumer, line of credit, overdraft, generic "loan" → item 22;
          // business/commercial/construction → item 24.
          const unsecured = ['consumer', 'loan', 'line of credit', 'overdraft', 'other', ''].includes(subtype);
          rows.push({
            ...base, kind: 'debt', category: unsecured ? 'unsecuredLoans' : 'otherDebts',
            description: label,
            dateIncurred: loan.get(acct.account_id)?.origination_date ?? null,
            totalOwing: owed, todo,
          });
        }
        break;
      }
    }
  }

  return attachHomeEquity(rows);
}

const HOME_EQUITY_TODO = 'Secured by real estate: move this amount into that property’s debt column.';

/**
 * A home equity loan belongs in column D of the property it's secured by. When the
 * mapper produced exactly one real estate row, add it there and drop the debt row.
 * With zero or several properties we can't tell which, so it stays under item 24.
 */
function attachHomeEquity(rows: FormRow[]): FormRow[] {
  const properties = rows.filter((r): r is AssetRow => r.kind === 'asset' && r.category === 'realEstate');
  if (properties.length !== 1) return rows;
  const property = properties[0];

  return rows.filter((r) => {
    if (r.kind !== 'debt' || !r.todo.includes(HOME_EQUITY_TODO)) return true;
    property.debt = round2((property.debt ?? 0) + (r.totalOwing ?? 0));
    property.todo.push(`Debt includes ${r.description} (${usd(r.totalOwing)}). Confirm it is secured by this property.`);
    return false;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "Tartan Bank Plaid Checking x0000". Kept short: the box fits ~35 characters at 9pt. */
function describe(institution: string | null | undefined, acct: PlaidAccount): string {
  return [institution, acct.name, acct.mask ? `x${acct.mask}` : null].filter(Boolean).join(' ');
}

function byAccountId<T extends { account_id: string | null }>(list: T[] | null | undefined): Map<string, T> {
  return new Map((list ?? []).filter((x) => x.account_id).map((x) => [x.account_id as string, x]));
}

function money(n: number | null | undefined): number | null {
  return n == null ? null : round2(n);
}

function usd(n: number | null): string {
  return (n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
