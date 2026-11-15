// Decides which printed line each row goes on.
//
// FL-160 has a fixed number of lines per category (e.g. three for item 7). Rows that
// don't fit spill onto the FL-161 continuation sheet, and their sums come back onto
// FL-160 at item 17 (assets) and item 25 (debts).
//
// Call this once per declaration, with the rows already filtered to one character:
//   allocateRows(rows.filter((r) => r.character === 'community'))

import {
  ASSET_ROWS, DEBT_ROWS, ITEM_NUMBER,
  type AssetRowFields, type DebtRowFields,
} from './fl160-fields';
import { FL161_ASSET_ROWS, FL161_DEBT_ROWS } from './fl161-fields';
import { netValue, type AssetRow, type DebtRow, type FormRow } from './mapping';

export interface PlacedAsset {
  row: AssetRow;
  /** The PDF field names for the line this row landed on. */
  fields: AssetRowFields;
  /** Text for column A. On FL-161 it carries the item number, e.g. "7. Tartan Bank Plaid CD x2222". */
  description: string;
}

export interface PlacedDebt {
  row: DebtRow;
  fields: DebtRowFields;
  description: string;
}

export interface AssetSums { grossValue: number; debt: number; netValue: number }
export interface DebtSums { totalOwing: number }

export interface Allocation {
  /** Rows that fit on the main form. */
  fl160: { assets: PlacedAsset[]; debts: PlacedDebt[] };
  /** Rows that spilled onto the continuation sheet, ordered by item number. */
  fl161: { assets: PlacedAsset[]; debts: PlacedDebt[] };
  /** True when an FL-161 must be generated and the "continuation attached" box ticked. */
  needsContinuation: boolean;
  /** FL-160 items 17 and 25: sums of the FL-161 rows. Null when that side has no overflow. */
  continuation: { assets: AssetSums | null; debts: DebtSums | null };
  /** FL-160 items 18 and 26: everything on both forms. */
  totals: { assets: AssetSums; debts: DebtSums };
  /** Rows that didn't fit even on FL-161 (more than 39 extra assets or 47 extra debts). */
  unplaced: FormRow[];
}

export function allocateRows(rows: FormRow[]): Allocation {
  const result: Allocation = {
    fl160: { assets: [], debts: [] },
    fl161: { assets: [], debts: [] },
    needsContinuation: false,
    continuation: { assets: null, debts: null },
    totals: { assets: sumAssets([]), debts: sumDebts([]) },
    unplaced: [],
  };

  // Pass 1: fill FL-160's printed lines in the order the rows arrive.
  const used: Record<string, number> = {}; // lines taken so far, per category
  const overflowAssets: AssetRow[] = [];
  const overflowDebts: DebtRow[] = [];

  for (const row of rows) {
    const line = used[row.category] ?? 0;
    used[row.category] = line + 1;

    if (row.kind === 'asset') {
      const fields = ASSET_ROWS[row.category][line];
      if (fields) result.fl160.assets.push({ row, fields, description: row.description });
      else overflowAssets.push(row);
    } else {
      const fields = DEBT_ROWS[row.category][line];
      if (fields) result.fl160.debts.push({ row, fields, description: row.description });
      else overflowDebts.push(row);
    }
  }

  // Pass 2: overflow goes onto FL-161's blank lines, grouped by item number so the
  // sheet reads in the same order as the main form.
  const byItem = (a: FormRow, b: FormRow) => ITEM_NUMBER[a.category] - ITEM_NUMBER[b.category];
  const numbered = (row: FormRow) => `${ITEM_NUMBER[row.category]}. ${row.description}`;

  overflowAssets.sort(byItem).forEach((row, i) => {
    const fields = FL161_ASSET_ROWS[i];
    if (fields) result.fl161.assets.push({ row, fields, description: numbered(row) });
    else result.unplaced.push(row);
  });
  overflowDebts.sort(byItem).forEach((row, i) => {
    const fields = FL161_DEBT_ROWS[i];
    if (fields) result.fl161.debts.push({ row, fields, description: numbered(row) });
    else result.unplaced.push(row);
  });

  // Sums. Unplaced rows are left out so the totals always match what is printed.
  const contAssets = result.fl161.assets.map((p) => p.row);
  const contDebts = result.fl161.debts.map((p) => p.row);
  result.needsContinuation = contAssets.length > 0 || contDebts.length > 0;
  result.continuation = {
    assets: contAssets.length ? sumAssets(contAssets) : null,
    debts: contDebts.length ? sumDebts(contDebts) : null,
  };
  result.totals = {
    assets: sumAssets([...result.fl160.assets.map((p) => p.row), ...contAssets]),
    debts: sumDebts([...result.fl160.debts.map((p) => p.row), ...contDebts]),
  };

  return result;
}

/**
 * Asset rows whose value is still blank. Their debt counts toward the totals but
 * their value doesn't, so the net total is misleading until these are filled in.
 * Block PDF generation while this list isn't empty.
 */
export function rowsMissingValue(rows: FormRow[]): AssetRow[] {
  return rows.filter((r): r is AssetRow => r.kind === 'asset' && r.grossValue == null);
}

// ---------------------------------------------------------------------------

function sumAssets(rows: AssetRow[]): AssetSums {
  // Work in cents so 0.1 + 0.2 style float drift can't reach the form.
  let gross = 0, debt = 0, net = 0;
  for (const r of rows) {
    gross += cents(r.grossValue);
    debt += cents(r.debt);
    net += cents(netValue(r)); // blank when the row has no value yet
  }
  return { grossValue: gross / 100, debt: debt / 100, netValue: net / 100 };
}

function sumDebts(rows: DebtRow[]): DebtSums {
  let owing = 0;
  for (const r of rows) owing += cents(r.totalOwing);
  return { totalOwing: owing / 100 };
}

function cents(n: number | null): number {
  return n == null ? 0 : Math.round(n * 100);
}