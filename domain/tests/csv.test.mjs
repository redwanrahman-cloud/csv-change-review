import assert from 'node:assert/strict';
import test from 'node:test';
import { compareCsv, CsvError, parseCsv } from '../csv.mjs';
import { comparisonCases, parserCases } from '../../fixtures/engine-cases.mjs';

for (const fixture of parserCases) {
  test(`parseCsv: ${fixture.name}`, () => {
    if (fixture.errorCode) {
      assert.throws(() => parseCsv(fixture.text), (error) => error?.code === fixture.errorCode && error.message.length > 0);
    } else assert.deepEqual(parseCsv(fixture.text), fixture.expected);
  });
}
for (const fixture of comparisonCases) {
  test(`compareCsv: ${fixture.name}`, () => {
    if (fixture.errorCode) {
      assert.throws(() => compareCsv(fixture.before, fixture.after, fixture.key), (error) => error?.code === fixture.errorCode && error.message.length > 0);
      return;
    }
    const result = compareCsv(fixture.before, fixture.after, fixture.key);
    if (fixture.expected) assert.deepEqual(result, fixture.expected);
    if (fixture.expectedCounts) assert.deepEqual(result.counts, fixture.expectedCounts);
    if (fixture.expectedColumns) assert.deepEqual(result.columns, fixture.expectedColumns);
    if (fixture.expectedKey) assert.equal(result.changed[0].key, fixture.expectedKey);
    if (fixture.expectedCell) {
      assert.deepEqual(
        { column: result.changed[0].cells[0].column, before: result.changed[0].cells[0].before, after: result.changed[0].cells[0].after },
        fixture.expectedCell,
      );
    }
    if (fixture.expectedEvidenceIds) {
      assert.deepEqual(result.changed.flatMap((row) => row.cells.map((cell) => cell.evidenceId)), fixture.expectedEvidenceIds);
      assert.equal(new Set(fixture.expectedEvidenceIds).size, fixture.expectedEvidenceIds.length);
    }
  });
}

test('parseCsv: ill-formed Unicode reports stable actionable CsvError details', () => {
  for (const [codeUnit, kind] of [[0xd800, 'high'], [0xdc00, 'low']]) {
    assert.throws(
      () => parseCsv(`id\n${String.fromCharCode(codeUnit)}`),
      (error) => error instanceof CsvError
        && error.code === 'CSV_ILL_FORMED_UNICODE'
        && error.message === `CSV input contains an isolated ${kind} surrogate at UTF-16 code-unit index 3; replace or remove the invalid code unit.`,
    );
  }
});

test('parseCsv: rejects more than 10,000 data rows', () => {
  const text = ['id', ...Array.from({ length: 10_001 }, (_, index) => String(index))].join('\n');
  assert.throws(() => parseCsv(text), (error) => error?.code === 'CSV_TOO_MANY_ROWS');
});
test('parseCsv: accepts exactly 10,000 data rows', () => {
  const text = ['id', ...Array.from({ length: 10_000 }, (_, index) => String(index))].join('\n');
  assert.equal(parseCsv(text).rows.length, 10_000);
});
test('parseCsv: enforces the 5 MiB limit using UTF-8 bytes', () => {
  const text = `id\n${'é'.repeat(2_621_440)}`;
  assert.throws(() => parseCsv(text), (error) => error?.code === 'CSV_INPUT_TOO_LARGE');
});
test('compareCsv: result objects safely retain an untrusted __proto__ header', () => {
  const result = compareCsv('id,__proto__\n1,safe', 'id,__proto__\n2,value', 'id');
  assert.equal(Object.getPrototypeOf(result.added[0].values), Object.prototype);
  assert.equal(Object.hasOwn(result.added[0].values, '__proto__'), true);
  assert.equal(result.added[0].values.__proto__, 'value');
});
test('compareCsv: exact repeated comparisons are deterministic', () => {
  const before = 'id,note\nβ,old\nα,left';
  const after = 'id,note\nα,right\nβ,new';
  assert.deepEqual(compareCsv(before, after, 'id'), compareCsv(before, after, 'id'));
});
