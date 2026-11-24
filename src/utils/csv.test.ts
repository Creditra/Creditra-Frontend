import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv } from './csv';

describe('escapeCsvCell', () => {
  it('leaves simple values unchanged', () => {
    expect(escapeCsvCell('Completed')).toBe('Completed');
    expect(escapeCsvCell(1250)).toBe('1250');
  });

  it('escapes commas and quotes', () => {
    expect(escapeCsvCell('Fee, monthly')).toBe('"Fee, monthly"');
    expect(escapeCsvCell('He said "hello"')).toBe('"He said ""hello"""');
  });

  it('escapes newlines', () => {
    expect(escapeCsvCell('Line one\nLine two')).toBe('"Line one\nLine two"');
  });

  it('normalizes nullish values to empty strings', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('neutralizes formula-leading cells (=, +, -, @)', () => {
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell('+1+1')).toBe("'+1+1");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@SUM(1+1)')).toBe("'@SUM(1+1)");
    expect(escapeCsvCell('=HYPERLINK("https://example.com", "click")')).toBe(
      `"'=HYPERLINK(""https://example.com"", ""click"")"`,
    );
  });
});

describe('toCsv', () => {
  it('builds a CRLF-delimited CSV document', () => {
    const csv = toCsv(
      ['Date', 'Note'],
      [["2025-02-20", 'Fee, monthly'], ["2025-02-21", 'He said "hello"']],
    );

    expect(csv).toBe(
      'Date,Note\r\n2025-02-20,"Fee, monthly"\r\n2025-02-21,"He said ""hello"""',
    );
  });
});
