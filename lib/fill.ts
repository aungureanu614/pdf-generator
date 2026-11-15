// Writes one declaration's rows into the court PDFs.
//
// Runs in the browser: the templates are fetched from /public, filled in memory,
// and handed back as bytes. No financial data goes to the server.
//
// Scope (the "served with a Declaration of Disclosure" use of the form):
//   assets: description, date acquired, value, debt, net   (columns A–E)
//   debts:  description, date incurred, total owing        (columns A–C)
// The proposed-division columns, the signature and the signature date stay blank.

import { PDFDocument, type PDFForm } from '@cantoo/pdf-lib';
import type { Allocation, PlacedAsset, PlacedDebt } from './allocate';
import { ASSET_SUMMARY, DEBT_SUMMARY, HEADER } from './fl160-fields';
import { FL161_HEADER } from './fl161-fields';
import { netValue, type Character } from './mapping';

export interface CaseDetails {
  petitioner: string;
  respondent: string;
  caseNumber: string;
  /** Whose declaration this is; ticks PETITIONER'S or RESPONDENT'S. Null leaves both blank. */
  filedBy: 'petitioner' | 'respondent' | null;
}

export interface GeneratedFile {
  name: string;
  bytes: Uint8Array;
}

/**
 * @param templates  the decrypted court PDFs as bytes (fl160-template.pdf, fl161-template.pdf)
 * @returns the FL-160, plus an FL-161 when rows overflowed
 */
export async function generateDeclaration(
  character: Character,
  allocation: Allocation,
  details: CaseDetails,
  templates: { fl160: ArrayBuffer | Uint8Array; fl161: ArrayBuffer | Uint8Array },
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  // ---- FL-160 ---------------------------------------------------------------
  const doc = await PDFDocument.load(templates.fl160);
  const form = doc.getForm();

  setText(form, HEADER.petitioner, details.petitioner);
  setText(form, HEADER.respondent, details.respondent);
  setText(form, HEADER.caseNumber, details.caseNumber);
  if (details.filedBy === 'petitioner') form.getCheckBox(HEADER.isPetitioners).check();
  if (details.filedBy === 'respondent') form.getCheckBox(HEADER.isRespondents).check();
  form.getCheckBox(character === 'community' ? HEADER.isCommunity : HEADER.isSeparate).check();

  allocation.fl160.assets.forEach((p) => fillAsset(form, p));
  allocation.fl160.debts.forEach((p) => fillDebt(form, p));

  // Items 17 and 25: sums carried over from the continuation sheet.
  if (allocation.continuation.assets) {
    setText(form, ASSET_SUMMARY.continuation.grossValue, money(allocation.continuation.assets.grossValue));
    setText(form, ASSET_SUMMARY.continuation.debt, money(allocation.continuation.assets.debt));
    setText(form, ASSET_SUMMARY.continuation.netValue, money(allocation.continuation.assets.netValue));
  }
  if (allocation.continuation.debts) {
    setText(form, DEBT_SUMMARY.continuation.totalOwing, money(allocation.continuation.debts.totalOwing));
  }

  // Items 18 and 26: grand totals.
  setText(form, ASSET_SUMMARY.total.grossValue, money(allocation.totals.assets.grossValue));
  setText(form, ASSET_SUMMARY.total.debt, money(allocation.totals.assets.debt));
  setText(form, ASSET_SUMMARY.total.netValue, money(allocation.totals.assets.netValue));
  setText(form, DEBT_SUMMARY.total.totalOwing, money(allocation.totals.debts.totalOwing));

  if (allocation.needsContinuation) form.getCheckBox(HEADER.continuationAttached).check();

  files.push({ name: `FL-160-${character}-property-declaration.pdf`, bytes: await doc.save() });

  // ---- FL-161, only when something overflowed ---------------------------------
  if (allocation.needsContinuation) {
    const cont = await PDFDocument.load(templates.fl161);
    const contForm = cont.getForm();

    setText(contForm, FL161_HEADER.petitioner, details.petitioner);
    setText(contForm, FL161_HEADER.respondent, details.respondent);
    setText(contForm, FL161_HEADER.caseNumber, details.caseNumber);
    if (details.filedBy === 'petitioner') contForm.getCheckBox(FL161_HEADER.isPetitioners).check();
    if (details.filedBy === 'respondent') contForm.getCheckBox(FL161_HEADER.isRespondents).check();
    contForm.getCheckBox(character === 'community' ? FL161_HEADER.isCommunity : FL161_HEADER.isSeparate).check();

    allocation.fl161.assets.forEach((p) => fillAsset(contForm, p));
    allocation.fl161.debts.forEach((p) => fillDebt(contForm, p));

    files.push({ name: `FL-161-${character}-continuation.pdf`, bytes: await cont.save() });
  }

  return files;
}

// ---------------------------------------------------------------------------

function fillAsset(form: PDFForm, { row, fields, description }: PlacedAsset) {
  setDescription(form, fields.description, description);
  setText(form, fields.dateAcquired, usDate(row.dateAcquired));
  setText(form, fields.grossValue, money(row.grossValue));
  setText(form, fields.debt, money(row.debt));
  setText(form, fields.netValue, money(netValue(row)));
}

function fillDebt(form: PDFForm, { row, fields, description }: PlacedDebt) {
  setDescription(form, fields.description, description);
  setText(form, fields.dateIncurred, usDate(row.dateIncurred));
  setText(form, fields.totalOwing, money(row.totalOwing));
}

function setText(form: PDFForm, fieldName: string, text: string) {
  if (text === '') return; // leave the box untouched rather than writing an empty value
  form.getTextField(fieldName).setText(text);
}

/** The description box holds ~34 characters at the form's 9pt; shrink longer text to fit. */
function setDescription(form: PDFForm, fieldName: string, text: string) {
  if (text === '') return;
  const field = form.getTextField(fieldName);
  field.setText(text);
  if (text.length > 34) field.setFontSize(text.length > 44 ? 6 : 7);
}

/** 1234.5 → "1,234.50". The form prints its own "$". Blank for null. */
function money(n: number | null): string {
  if (n == null) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "2002-08-28" → "08/28/2002", the format FL-161 asks for. Blank for null. */
function usDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}
