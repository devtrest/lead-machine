// Minimal CSV → lead-rows parser for the "Import leads" flow. Runs in the
// browser (no deps). Handles quoted fields with embedded commas/newlines and
// quote-escaping (""), auto-detects a header row, and maps common column names
// to email / name / company / phone. Rows without a valid email are dropped.

export type ImportedLeadRow = {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Split raw CSV text into an array of string cells per row (RFC-4180-ish).
function csvToRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.some((f) => f.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

function findColumn(header: string[], re: RegExp): number {
  return header.findIndex((h) => re.test(h));
}

export function parseLeadsCsv(text: string): ImportedLeadRow[] {
  const records = csvToRows(text);
  if (records.length === 0) return [];

  const first = records[0].map((c) => c.trim().toLowerCase());
  const headerHasEmail = first.some((h) => /(^|[^a-z])e-?mail/.test(h));

  let emailIdx = 0;
  let nameIdx = -1;
  let companyIdx = -1;
  let phoneIdx = -1;
  let dataRows = records;

  if (headerHasEmail) {
    emailIdx = findColumn(first, /(^|[^a-z])e-?mail/);
    nameIdx = findColumn(first, /name|contact|full.?name|first/);
    companyIdx = findColumn(first, /company|business|organi[sz]ation|\borg\b/);
    phoneIdx = findColumn(first, /phone|tel|mobile|cell|number/);
    dataRows = records.slice(1);
  } else {
    // No header — find the column that looks like an email in the first row.
    const guess = records[0].findIndex((c) => c.includes("@"));
    emailIdx = guess >= 0 ? guess : 0;
  }

  const out: ImportedLeadRow[] = [];
  const seen = new Set<string>();
  for (const r of dataRows) {
    const email = (r[emailIdx] ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    const row: ImportedLeadRow = { email };
    if (nameIdx >= 0 && r[nameIdx]?.trim()) row.name = r[nameIdx].trim();
    if (companyIdx >= 0 && r[companyIdx]?.trim())
      row.company = r[companyIdx].trim();
    if (phoneIdx >= 0 && r[phoneIdx]?.trim()) row.phone = r[phoneIdx].trim();
    out.push(row);
  }
  return out;
}
