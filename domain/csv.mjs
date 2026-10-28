const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_DATA_ROWS = 10_000;
const encoder = new TextEncoder();

export class CsvError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CsvError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new CsvError(code, message);
}

function assertWellFormedUnicode(value, label) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        index += 1;
        continue;
      }
      fail(
        'CSV_ILL_FORMED_UNICODE',
        `${label} contains an isolated high surrogate at UTF-16 code-unit index ${index}; replace or remove the invalid code unit.`,
      );
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail(
        'CSV_ILL_FORMED_UNICODE',
        `${label} contains an isolated low surrogate at UTF-16 code-unit index ${index}; replace or remove the invalid code unit.`,
      );
    }
  }
}

function validateInput(text) {
  if (typeof text !== 'string') fail('CSV_INVALID_TYPE', 'CSV input must be a string.');
  assertWellFormedUnicode(text, 'CSV input');
  if (encoder.encode(text).byteLength > MAX_INPUT_BYTES) {
    fail('CSV_INPUT_TOO_LARGE', 'CSV input exceeds the 5 MiB UTF-8 limit.');
  }
}

function parseRecords(text) {
  const records = [];
  let record = [];
  let cell = '';
  let inQuotes = false;
  let closedQuote = false;
  let fieldStarted = false;

  const pushCell = () => {
    record.push(cell);
    cell = '';
    closedQuote = false;
    fieldStarted = false;
  };
  const pushRecord = () => {
    pushCell();
    records.push(record);
    record = [];
    if (records.length - 1 > MAX_DATA_ROWS) {
      fail('CSV_TOO_MANY_ROWS', 'CSV input exceeds the 10,000 data-row limit.');
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (closedQuote) {
      if (char === ',') pushCell();
      else if (char === '\n') pushRecord();
      else if (char === '\r') {
        if (text[index + 1] === '\n') index += 1;
        pushRecord();
      } else fail('CSV_INVALID_QUOTE', 'Only a delimiter or line ending may follow a closing quote.');
      continue;
    }
    if (char === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (char === '"') fail('CSV_INVALID_QUOTE', 'A quote may only begin an empty field.');
    else if (char === ',') pushCell();
    else if (char === '\n') pushRecord();
    else if (char === '\r') {
      if (text[index + 1] === '\n') index += 1;
      pushRecord();
    } else {
      cell += char;
      fieldStarted = true;
    }
  }
  if (inQuotes) fail('CSV_UNCLOSED_QUOTE', 'Quoted field is not closed.');
  if (cell !== '' || fieldStarted || closedQuote || record.length > 0) pushRecord();
  return records;
}

export function parseCsv(text) {
  validateInput(text);
  const normalized = text.startsWith('\uFEFF') ? text.slice(1) : text;
  if (normalized === '') return { headers: [], rows: [] };
  const records = parseRecords(normalized);
  if (records.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = records;
  const seenHeaders = new Set();
  for (const header of headers) {
    if (header.trim() === '') fail('CSV_BLANK_HEADER', 'CSV headers must not be blank.');
    if (seenHeaders.has(header)) {
      fail('CSV_DUPLICATE_HEADER', `Duplicate CSV header: ${JSON.stringify(header)}.`);
    }
    seenHeaders.add(header);
  }
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].length !== headers.length) {
      fail('CSV_RECORD_WIDTH', `Data row ${index + 1} has ${rows[index].length} cells; expected ${headers.length}.`);
    }
  }
  return { headers, rows };
}

function assertUsableDocument(document, label) {
  if (document.headers.length === 0) fail('CSV_EMPTY_DOCUMENT', `${label} CSV must contain a header row.`);
}
function assertKeyColumn(document, keyColumn, label) {
  if (!document.headers.includes(keyColumn)) {
    fail('CSV_KEY_NOT_FOUND', `Key column ${JSON.stringify(keyColumn)} is missing from ${label} CSV.`);
  }
}
function assertSameSchema(beforeHeaders, afterHeaders) {
  if (beforeHeaders.length !== afterHeaders.length || beforeHeaders.some((header) => !afterHeaders.includes(header))) {
    fail('CSV_SCHEMA_MISMATCH', 'Before and after CSVs must have identical column-name sets.');
  }
}
function rowValues(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}
function indexRows(document, keyColumn, label, canonicalHeaders) {
  const keyIndex = document.headers.indexOf(keyColumn);
  const rows = new Map();
  for (let index = 0; index < document.rows.length; index += 1) {
    const row = document.rows[index];
    const key = row[keyIndex];
    if (key === '') fail('CSV_BLANK_KEY', `${label} CSV data row ${index + 1} has a blank key.`);
    if (rows.has(key)) fail('CSV_DUPLICATE_KEY', `${label} CSV has duplicate key ${JSON.stringify(key)}.`);
    const nativeValues = rowValues(document.headers, row);
    rows.set(key, Object.fromEntries(canonicalHeaders.map((header) => [header, nativeValues[header]])));
  }
  return rows;
}
function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function hexUtf8(value) {
  return Array.from(encoder.encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function evidenceId(key, column) {
  return `cell-k-${hexUtf8(key)}-c-${hexUtf8(column)}`;
}

export function compareCsv(beforeText, afterText, keyColumn) {
  if (typeof keyColumn !== 'string' || keyColumn === '') {
    fail('CSV_INVALID_KEY_COLUMN', 'Key column must be a nonempty string.');
  }
  assertWellFormedUnicode(keyColumn, 'Key column');
  const before = parseCsv(beforeText);
  const after = parseCsv(afterText);
  assertUsableDocument(before, 'Before');
  assertUsableDocument(after, 'After');
  assertKeyColumn(before, keyColumn, 'before');
  assertKeyColumn(after, keyColumn, 'after');
  assertSameSchema(before.headers, after.headers);
  const columns = [...before.headers];
  const beforeRows = indexRows(before, keyColumn, 'Before', columns);
  const afterRows = indexRows(after, keyColumn, 'After', columns);
  const beforeKeys = [...beforeRows.keys()].sort(compareStrings);
  const afterKeys = [...afterRows.keys()].sort(compareStrings);
  const added = afterKeys.filter((key) => !beforeRows.has(key)).map((key) => ({ key, values: afterRows.get(key) }));
  const removed = beforeKeys.filter((key) => !afterRows.has(key)).map((key) => ({ key, values: beforeRows.get(key) }));
  const changed = [];
  for (const key of beforeKeys) {
    if (!afterRows.has(key)) continue;
    const beforeValues = beforeRows.get(key);
    const afterValues = afterRows.get(key);
    const cells = [];
    for (const column of columns) {
      if (column === keyColumn || beforeValues[column] === afterValues[column]) continue;
      cells.push({ column, before: beforeValues[column], after: afterValues[column], evidenceId: evidenceId(key, column) });
    }
    if (cells.length > 0) changed.push({ key, cells });
  }
  const cellCount = changed.reduce((total, row) => total + row.cells.length, 0);
  return {
    keyColumn,
    columns,
    added,
    removed,
    changed,
    counts: { added: added.length, removed: removed.length, changed: changed.length, cells: cellCount },
  };
}
