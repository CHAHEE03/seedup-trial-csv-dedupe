#!/usr/bin/env node
// Remove duplicate CSV rows, keep the first one, and report how many were removed. Node standard library only.
// usage: node dedupe-csv.mjs <input> [--out <path>] [--keys <name|number,...>] [--delimiter <char>] [--no-header] [--trim] [--ignore-case]
// exit codes: 0 ok, 1 cannot read or write a file, 2 bad arguments or malformed CSV.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export class UsageError extends Error {}

// F-01: one pass over the whole text, so quoted delimiters and line breaks stay inside their value.
export function parseCsv(text, delimiter = ',', hasHeader = true) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  // The output keeps the input's line ending and final newline, so a file without duplicates comes back unchanged.
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const finalNewline = text === '' || /\r?\n$/.test(text);
  const rows = [], lines = [];
  let row = [], value = '', quoted = false, line = 1, rowLine = 1, quoteLine = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') quoted = false;
      else { if (ch === '\n') line++; value += ch; }
    } else if (ch === '"' && value === '') { quoted = true; quoteLine = line; }
    else if (ch === delimiter) { row.push(value); value = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(value); rows.push(row); lines.push(rowLine); row = []; value = ''; line++; rowLine = line;
    } else value += ch;
  }
  if (quoted) throw new UsageError(`line ${quoteLine}: unclosed quote`);
  if (value !== '' || row.length) { row.push(value); rows.push(row); lines.push(rowLine); }
  // All-empty lines are ignored (decision for F-02); every kept row remembers its line in the source file.
  const data = rows.map((r, i) => ({ r, line: lines[i] })).filter(({ r }) => r.some((v) => v !== ''));
  const body = hasHeader ? data.slice(1) : data;
  return { header: hasHeader ? data[0]?.r ?? null : null, rows: body.map((d) => d.r), lines: body.map((d) => d.line), delimiter, eol, finalNewline };
}

// F-02: the first row of each key stays; the key uses only the chosen columns, normalised only for comparison.
export function dedupe({ header, rows, lines }, { keys, trim = false, ignoreCase = false } = {}) {
  const width = header?.length ?? Math.max(0, ...rows.map((r) => r.length));
  const columns = keys?.length ? keys.map((key) => {
    const index = /^\d+$/.test(key) ? Number(key) - 1 : header ? header.indexOf(key) : -1;
    if (index < 0 || index >= width) throw new UsageError(`unknown column: ${key}`);
    return index;
  }) : null;
  const warnings = [];
  const seen = new Set(), kept = [], removed = [];
  rows.forEach((row, i) => {
    // A row with the wrong column count is warned about and always kept in place, never judged a duplicate.
    if (header && row.length !== header.length) {
      warnings.push(`line ${lines?.[i] ?? i + 2}: expected ${header.length} columns, got ${row.length}`);
      kept.push(row);
      return;
    }
    const values = (columns ?? row.map((_, c) => c)).map((c) => {
      let v = row[c] ?? '';
      if (trim) v = v.trim();
      if (ignoreCase) v = v.toLowerCase();
      return v;
    });
    const key = JSON.stringify(values);
    if (seen.has(key)) removed.push(row);
    else { seen.add(key); kept.push(row); }
  });
  return { keptRows: kept, removedRows: removed, removedCount: removed.length, keptCount: kept.length, warnings };
}

const quote = (value, delimiter) => (/["\r\n]/.test(value) || value.includes(delimiter) ? `"${value.replace(/"/g, '""')}"` : value);
export const toCsv = (header, rows, delimiter = ',', eol = '\n', finalNewline = true) => {
  const all = [...(header ? [header] : []), ...rows];
  return all.map((r) => r.map((v) => quote(v, delimiter)).join(delimiter)).join(eol) + (finalNewline && all.length ? eol : '');
};

// F-03: never write over the input; the default output sits next to it.
export function outputPath(input, out) {
  const target = resolve(out ?? join(dirname(input), `${basename(input, extname(input))}.deduped.csv`));
  if (target === resolve(input)) throw new UsageError('output path must differ from the input path');
  return target;
}

// F-04: the two count lines.
export function summary(removedRows, keptRows) {
  if (!Array.isArray(removedRows) || !Array.isArray(keptRows)) throw new UsageError('summary needs the removed and kept row lists');
  return `removed: ${removedRows.length}\nkept: ${keptRows.length}\n`;
}

export function parseArgs(argv) {
  const options = { hasHeader: true, trim: false, ignoreCase: false, delimiter: ',' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => { if (i + 1 >= argv.length) throw new UsageError(`${arg} needs a value`); return argv[++i]; };
    if (arg === '--out') options.out = value();
    else if (arg === '--keys') options.keys = value().split(',').map((k) => k.trim()).filter(Boolean);
    else if (arg === '--delimiter') { options.delimiter = value(); if (options.delimiter.length !== 1) throw new UsageError('--delimiter must be one character'); }
    else if (arg === '--no-header') options.hasHeader = false;
    else if (arg === '--trim') options.trim = true;
    else if (arg === '--ignore-case') options.ignoreCase = true;
    else if (arg.startsWith('--')) throw new UsageError(`unknown option: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length !== 1) throw new UsageError('usage: dedupe-csv <input> [--out <path>] [--keys a,b] [--delimiter c] [--no-header] [--trim] [--ignore-case]');
  return { input: positional[0], ...options };
}

export function main(argv, io = process) {
  let options, text;
  try {
    options = parseArgs(argv);
    options.target = outputPath(options.input, options.out);
  } catch (error) { io.stderr.write(`${error.message}\n`); return 2; }
  try { text = readFileSync(options.input, 'utf8'); } catch (error) { io.stderr.write(`cannot read ${options.input}: ${error.code ?? error.message}\n`); return 1; }
  let parsed, result;
  try {
    parsed = parseCsv(text, options.delimiter, options.hasHeader);
    result = dedupe(parsed, options);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    io.stderr.write(`${error.message}\n`);
    return 2;
  }
  for (const warning of result.warnings) io.stderr.write(`${warning}\n`);
  try {
    mkdirSync(dirname(options.target), { recursive: true });
    writeFileSync(options.target, toCsv(parsed.header, result.keptRows, options.delimiter, parsed.eol, parsed.finalNewline));
  } catch (error) { io.stderr.write(`cannot write ${options.target}: ${error.code ?? error.message}\n`); return 1; }
  io.stdout.write(summary(result.removedRows, result.keptRows));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
