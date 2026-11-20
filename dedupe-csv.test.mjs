// Acceptance criteria from the Seedup PRD (prd:3aa85535-68de-4a51-b702-6ad0a6374fd7), one test per criterion group.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, parseCsv, summary } from './dedupe-csv.mjs';

function run(input, args = [], name = 'in.csv') {
  const dir = mkdtempSync(join(tmpdir(), 'dedupe-'));
  const file = join(dir, name);
  writeFileSync(file, input);
  let stdout = '', stderr = '';
  const code = main([file, ...args], { stdout: { write: (s) => { stdout += s; } }, stderr: { write: (s) => { stderr += s; } } });
  const out = join(dir, name.replace(/\.csv$/, '') + '.deduped.csv');
  return { code, stdout, stderr, dir, file, out, output: existsSync(out) ? readFileSync(out, 'utf8') : null };
}

test('F-01/F-02 G-1: header kept, first of two identical rows kept', () => {
  const r = run('id,name\n1,a\n2,b\n1,a\n');
  assert.equal(r.code, 0);
  assert.equal(r.output, 'id,name\n1,a\n2,b\n');
});

test('F-01: quoted line breaks stay in one row', () => {
  const r = run('name,note\nkim,"line1\nline2"\n');
  assert.equal(r.output, 'name,note\nkim,"line1\nline2"\n');
  assert.equal(r.stdout, 'removed: 0\nkept: 1\n');
});

test('F-01: --no-header treats every line as data', () => {
  const r = run('1,2\n1,2\n', ['--no-header']);
  assert.equal(r.output, '1,2\n');
  assert.equal(r.stdout, 'removed: 1\nkept: 1\n');
});

test('F-01: quoted delimiters, escaped quotes and BOM', () => {
  const parsed = parseCsv('﻿a,b\n"x,1","say ""hi"""\n');
  assert.deepEqual(parsed.header, ['a', 'b']);
  assert.deepEqual(parsed.rows, [['x,1', 'say "hi"']]);
});

test('F-01: semicolon delimiter in and out; comma by default', () => {
  assert.equal(run('a;b\n1;2\n1;2\n', ['--delimiter', ';']).output, 'a;b\n1;2\n');
  assert.equal(run('a,b\n1,2\n').output, 'a,b\n1,2\n');
});

test('F-01: a row with the wrong column count warns and stays in order', () => {
  const r = run('a,b\n1,2\n3\n4,5\n');
  assert.match(r.stderr, /line 3: expected 2 columns, got 1/);
  assert.equal(r.output, 'a,b\n1,2\n3\n4,5\n');
});

test('F-01: repeated rows with the wrong column count are never removed', () => {
  const r = run('a,b\n3\n3\n1,2\n1,2\n');
  assert.equal(r.output, 'a,b\n3\n3\n1,2\n');
  assert.equal(r.stdout, 'removed: 1\nkept: 3\n');
  assert.equal(r.stderr.match(/expected 2 columns/g).length, 2);
});

test('F-01: unclosed quote exits 2 with the line number', () => {
  const r = run('a,b\n1,"open\n');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /line 2: unclosed quote/);
});

test('F-02: --keys by name and number; all columns by default', () => {
  assert.equal(run('a,b,c\n1,2,x\n1,2,y\n', ['--keys', '1,2']).output, 'a,b,c\n1,2,x\n');
  assert.equal(run('a,b,c\n1,2,x\n1,2,y\n', ['--keys', '3']).stdout, 'removed: 0\nkept: 2\n');
  assert.equal(run('a,b,c\n1,2,x\n1,2,y\n', ['--keys', 'a,b']).stdout, 'removed: 1\nkept: 1\n');
  const r = run('a,b\n1,2\n1,2\n1,3\n');
  assert.equal(r.output, 'a,b\n1,2\n1,3\n');
  assert.equal(r.stdout, 'removed: 1\nkept: 2\n');
});

test('F-02: unknown --keys column exits 2 and writes nothing', () => {
  const r = run('a,b\n1,2\n', ['--keys', 'email']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unknown column: email/);
  assert.equal(r.output, null);
});

test('F-02: --trim and --ignore-case change only the comparison', () => {
  assert.equal(run('a\n x\nx\n').stdout, 'removed: 0\nkept: 2\n');
  assert.equal(run('a\n x\nx\n', ['--trim']).output, 'a\n x\n');
  assert.equal(run('a\nKim\nkim\n', ['--ignore-case']).output, 'a\nKim\n');
});

test('F-02: --keys, --trim and --ignore-case combined', () => {
  const input = 'email,name\n Kim@x.com ,a\nkim@x.com,b\nlee@x.com,c\n';
  assert.equal(run(input, ['--keys', 'email', '--trim']).stdout, 'removed: 0\nkept: 3\n');
  assert.equal(run(input, ['--keys', 'email', '--ignore-case']).stdout, 'removed: 0\nkept: 3\n');
  const both = run(input, ['--keys', 'email', '--trim', '--ignore-case']);
  assert.equal(both.output, 'email,name\n Kim@x.com ,a\nlee@x.com,c\n');
  assert.equal(both.stdout, 'removed: 1\nkept: 2\n');
  assert.equal(run('a,b\n X,1\nx,2\n', ['--keys', '1', '--trim', '--ignore-case']).stdout, 'removed: 1\nkept: 1\n');
});

test('F-01: warnings name the line in the source file even after empty lines', () => {
  const r = run('a,b\n\n1,2\n\n3\n');
  assert.match(r.stderr, /^line 5: expected 2 columns, got 1$/m);
});

test('F-04: without duplicates the output equals the input (CRLF and no final newline kept)', () => {
  assert.equal(run('a,b\r\n1,2\r\n3,4\r\n').output, 'a,b\r\n1,2\r\n3,4\r\n');
  assert.equal(run('a,b\n1,2').output, 'a,b\n1,2');
  assert.equal(run('a,b\r\n1,2\r\n1,2\r\n').output, 'a,b\r\n1,2\r\n');
});

test('F-02: all-empty lines are ignored', () => {
  assert.equal(run('a,b\n1,2\n\n,\n1,2\n').stdout, 'removed: 1\nkept: 1\n');
});

test('F-03 G-3: default output next to the input, input untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dedupe-'));
  const file = join(dir, 'data.csv');
  writeFileSync(file, 'a\n1\n1\n');
  const before = statSync(file).mtimeMs;
  assert.equal(main([file], { stdout: { write() {} }, stderr: { write() {} } }), 0);
  assert.equal(readFileSync(file, 'utf8'), 'a\n1\n1\n');
  assert.equal(statSync(file).mtimeMs, before);
  assert.equal(readFileSync(join(dir, 'data.deduped.csv'), 'utf8'), 'a\n1\n');
});

test('F-03: --out equal to the input exits 2 and writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dedupe-'));
  const file = join(dir, 'data.csv');
  writeFileSync(file, 'a\n1\n1\n');
  let stderr = '';
  assert.equal(main([file, '--out', file], { stdout: { write() {} }, stderr: { write: (s) => { stderr += s; } } }), 2);
  assert.match(stderr, /must differ/);
  assert.equal(readFileSync(file, 'utf8'), 'a\n1\n1\n');
});

test('F-03: --out creates a missing directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dedupe-'));
  const file = join(dir, 'data.csv');
  writeFileSync(file, 'a\n1\n');
  const out = join(dir, 'new', 'deep', 'out.csv');
  assert.equal(main([file, '--out', out], { stdout: { write() {} }, stderr: { write() {} } }), 0);
  assert.equal(readFileSync(out, 'utf8'), 'a\n1\n');
});

test('F-04 G-2: removed and kept lines', () => {
  assert.equal(summary([1, 2, 3], [1, 2, 3, 4, 5]), 'removed: 3\nkept: 5\n');
  assert.equal(summary([], []), 'removed: 0\nkept: 0\n');
  const rows = ['a', ...Array.from({ length: 88 }, (_, i) => String(i)), ...Array.from({ length: 12 }, (_, i) => String(i))].join('\n');
  const r = run(rows + '\n');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, 'removed: 12\nkept: 88\n');
});

test('F-04: bad arguments exit 2 with nothing on stdout', () => {
  assert.throws(() => summary(undefined, []), /needs the removed and kept/);
  let stdout = '', stderr = '';
  assert.equal(main(['--bogus'], { stdout: { write: (s) => { stdout += s; } }, stderr: { write: (s) => { stderr += s; } } }), 2);
  assert.equal(stdout, '');
  assert.notEqual(stderr, '');
});
