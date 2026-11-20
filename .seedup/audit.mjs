#!/usr/bin/env node
// Seedup local check, generated from Seedup's rules. Reads a diff on stdin: blockers exit 1, warnings only print.
// --json prints every finding, --count prints the blocker count. Never sends anything anywhere.
// seedup-allow: LIE_EMPTY_IMPL 검사 규칙 정규식이라 빈 구현이 아님
const A = {"paths":{"test":"(^|\\/)(tests?|__tests__|e2e)\\/|\\.(test|spec)\\.[cm]?[jt]sx?$","fixture":"(^|\\/)(fixtures?|__fixtures__|__mocks__|mocks?)\\/","doc":"\\.(md|mdx|txt|rst)$|(^|\\/)docs\\/","generated":"(^|\\/)(\\.next|dist|build|out|coverage|node_modules)\\/|(\\.lock|-lock\\.json|-lock\\.yaml|\\.min\\.[cm]?js|\\.snap|\\.map)$|(^|\\/)(schema-manifest\\.json|cloudflare-env\\.d\\.ts|next-env\\.d\\.ts)$"},"secrets":[["Anthropic key","sk-ant-[A-Za-z0-9_-]{20,}"],["OpenAI/OpenRouter key","sk-(?!ant-)(?:proj-|or-v1-)?[A-Za-z0-9_-]{32,}"],["GitHub token","(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,}"],["AWS access key","\\bAKIA[0-9A-Z]{16}\\b"],["Slack token","xox[abprs]-[A-Za-z0-9-]{10,}"],["Google API key","\\bAIza[0-9A-Za-z_-]{35}\\b"],["Stripe live key","\\b(?:sk|rk)_live_[A-Za-z0-9]{20,}"],["Seedup MCP token","\\bsdp_[a-f0-9]{48}\\b"],["JWT","\\beyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}"],["Private key","-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----"]],"secretAssign":"\\b[\\w.-]*(?:secret|token|api[_-]?key|password|passwd|private[_-]?key)[\\w.-]*[\"']?\\s*[:=]\\s*[\"'`]([^\"'`\\s]{20,})[\"'`]","envRef":"^(?:process\\.env|import\\.meta\\.env|env\\([A-Za-z_][A-Za-z0-9_]*\\)$)","rules":[{"code":"SEC_CLIENT_SECRET","severity":"blocker","scope":"code","pattern":"\\bNEXT_PUBLIC_[A-Z0-9_]*(SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|_TOKEN)\\b|\\bNEXT_PUBLIC_[A-Z0-9_]*(OPENAI|ANTHROPIC|OPENROUTER|GROQ|MISTRAL|COHERE|RESEND|SENDGRID|TWILIO|STRIPE_SECRET|AWS)[A-Z0-9_]*\\b","message":"브라우저로 내려가는 NEXT_PUBLIC_ 변수에 비밀값 이름이 붙었습니다.","fixHint":"서버 전용 이름(NEXT_PUBLIC_ 없이)으로 바꾸고 서버에서만 읽으세요."},{"code":"LIE_SKIPPED_TEST","severity":"blocker","scope":"test","pattern":"\\b(?:it|test|describe)\\.(?:skip|todo)\\s*\\(|\\bx(?:it|describe)\\s*\\(|\\{\\s*skip:\\s*true\\s*\\}","message":"새로 건너뛴 테스트가 있습니다.","fixHint":"테스트를 고치거나, 건너뛰는 이유를 seedup-allow로 남기세요."},{"code":"LIE_EMPTY_IMPL","severity":"blocker","scope":"code","pattern":"throw new Error\\(\\s*[\"'\\`][^\"'\\`]*not implemented|NotImplementedError|todo!\\(\\)|unimplemented!\\(\\)","flags":"i","message":"구현 대신 \"not implemented\" 예외가 들어갔습니다.","fixHint":"기능을 구현하거나 완료 보고에서 빼세요."},{"code":"LIE_TODO","severity":"warning","scope":"code","pattern":"(?:\\/\\/|\\/\\*|#|<!--|\\{\\/\\*)\\s*(TODO|FIXME|XXX|HACK)\\b","message":"TODO 주석이 남았습니다.","fixHint":"끝내거나, 남은 일로 기능 상태에 적으세요."},{"code":"LIE_MOCK","severity":"warning","scope":"code","pattern":"\\b(?:[Mm]ock|MOCK|[Dd]ummy|[Ff]ake|[Pp]laceholder|[Ll]orem ipsum|[Hh]ard-?coded)\\b|\\b(?:mock|dummy|fake|placeholder)[A-Z]\\w*","strip":"\\bplaceholder\\s*=\\s*[\"{]","message":"가짜 · 임시 값으로 보이는 코드가 있습니다.","fixHint":"실제 구현으로 바꾸거나 Mock이 의도된 것인지 적으세요."},{"code":"LIE_EMPTY_CATCH","severity":"warning","scope":"code","pattern":"\\bcatch\\s*(?:\\([^)]*\\))?\\s*\\{\\s*\\}","message":"오류를 삼키는 빈 catch가 있습니다.","fixHint":"처리하거나, 무시해도 되는 이유를 catch 안 주석으로 남기세요."},{"code":"LIE_EMPTY_IMPL","severity":"warning","scope":"code","pattern":"\\bfunction\\s+\\w+\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\{\\s*\\}","message":"본문이 빈 함수가 있습니다.","fixHint":"구현하거나 빈 이유를 주석으로 남기세요."},{"code":"SEC_XSS","severity":"warning","scope":"code","pattern":"dangerouslySetInnerHTML|\\.(?:inner|outer)HTML\\s*=|\\beval\\s*\\(|new Function\\s*\\(","message":"HTML을 그대로 넣거나 문자열을 코드로 실행합니다.","fixHint":"사용자 입력이 들어가지 않는지 확인하고, 들어가면 이스케이프하세요."},{"code":"SEC_SQLI","severity":"warning","scope":"code","pattern":"\\`[^\\`]*\\b(?:select|insert|update|delete)\\b[^\\`]*\\$\\{|[\"'][^\"']*\\b(?:select|insert into|update|delete from)\\b[^\"']*[\"']\\s*\\+","flags":"i","message":"SQL을 문자열로 이어 붙입니다.","fixHint":"매개변수 쿼리나 쿼리 빌더를 쓰세요."}],"auth":{"call":"getCurrentUser|getUser\\(|getClaims|auth\\(\\)|userForToken|requireAdmin|isAdmin|verifyToken|verifySignature|CRON_SECRET|authorization","write":"export\\s+(?:async\\s+)?function\\s+(POST|PUT|PATCH|DELETE)\\b|export\\s+const\\s+(POST|PUT|PATCH|DELETE)\\b","route":"(^|\\/)app\\/api\\/.*\\/route\\.[cm]?[jt]s$|(^|\\/)pages\\/api\\/"},"allow":"seedup-allow:\\s*([A-Z_]+)\\s+(.+?)\\s*(?:\\*\\/|-->)?$","catchSplit":{"open":"\\bcatch\\s*(?:\\([^)]*\\))?\\s*\\{\\s*$","close":"^\\s*\\}"}}; // seedup-allow: SEC_SECRET_LEAK 검사 규칙 정규식이라 비밀값이 아님
const re = (source, flags = '') => new RegExp(source, flags);
const P = { test: re(A.paths.test), fixture: re(A.paths.fixture), doc: re(A.paths.doc), generated: re(A.paths.generated) };
const isTest = (path) => P.test.test(path);
const isCode = (path) => !isTest(path) && !P.fixture.test(path) && !P.doc.test(path) && !P.generated.test(path);
const inScope = (scope, path) => (scope === 'all' ? !P.generated.test(path) : scope === 'test' ? isTest(path) : isCode(path));
const SECRETS = A.secrets.map(([name, source]) => [name, re(source, 'g')]);
const ASSIGN = re(A.secretAssign, 'gi');
const ENV_REF = re(A.envRef);
const RULES = A.rules.map((rule) => ({ ...rule, regex: re(rule.pattern, rule.flags || ''), stripRegex: rule.strip ? re(rule.strip, 'g') : null }));
const ALLOW = re(A.allow);
const AUTH = re(A.auth.call, 'i');
const WRITE = re(A.auth.write);
const ROUTE = re(A.auth.route);
const OPEN_CATCH = re(A.catchSplit.open);
const CLOSE_ONLY = re(A.catchSplit.close);

function parse(diff) {
  const files = [];
  let current = null;
  let line = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) { current = { path: raw.split(' b/').pop() || '', isNew: false, added: [] }; files.push(current); }
    else if (!current) continue;
    else if (raw.startsWith('new file mode')) current.isNew = true;
    else if (raw.startsWith('+++ ')) { const path = raw.slice(4).replace(/^b\//, ''); if (path !== '/dev/null') current.path = path; }
    else if (raw.startsWith('@@')) line = Number((/\+(\d+)/.exec(raw) || [])[1] || 1);
    else if (raw.startsWith('+')) { current.added.push({ file: current.path, line, text: raw.slice(1) }); line++; }
    else if (!raw.startsWith('-') && !raw.startsWith('\\')) line++;
  }
  return files;
}

function entropy(value) {
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) || 0) + 1);
  return [...counts.values()].reduce((sum, count) => sum - (count / value.length) * Math.log2(count / value.length), 0);
}

function allowance(file, index, code) {
  for (const line of [file.added[index], file.added[index - 1]]) {
    const match = line && ALLOW.exec(line.text);
    if (match && match[1] === code && line.line >= file.added[index].line - 1) return match[2];
  }
  return undefined;
}

function audit(diff) {
  const findings = [];
  const add = (file, index, code, severity, message) => {
    const at = file.added[index];
    const allowed = allowance(file, index, code);
    findings.push({ code, severity, file: at.file, line: at.line, message, ...(allowed ? { allowed } : {}) });
  };
  for (const file of parse(diff)) {
    file.added.forEach((line, index) => {
      if (!P.generated.test(file.path)) {
        for (const [name, pattern] of SECRETS) for (const _ of line.text.matchAll(pattern)) add(file, index, 'SEC_SECRET_LEAK', 'blocker', name + '로 보이는 값이 코드에 들어갔습니다.');
        if (isCode(file.path)) {
          for (const match of line.text.matchAll(ASSIGN)) {
            if (entropy(match[1]) >= 3.5 && !ENV_REF.test(match[1]) && !SECRETS.some(([, pattern]) => re(pattern.source).test(match[1]))) {
              add(file, index, 'SEC_SECRET_LEAK', 'blocker', '비밀값 이름에 무작위 문자열이 들어갔습니다.');
            }
          }
        }
      }
      for (const rule of RULES) {
        if (!inScope(rule.scope, file.path)) continue;
        if (rule.regex.exec(rule.stripRegex ? line.text.replace(rule.stripRegex, '') : line.text)) add(file, index, rule.code, rule.severity, rule.message);
      }
    });
    if (isCode(file.path)) {
      file.added.forEach((line, index) => {
        const next = file.added[index + 1];
        if (OPEN_CATCH.test(line.text) && next && next.line === line.line + 1 && CLOSE_ONLY.test(next.text)) add(file, index, 'LIE_EMPTY_CATCH', 'warning', '오류를 삼키는 빈 catch가 있습니다.');
      });
    }
    if (file.isNew && ROUTE.test(file.path)) {
      const handler = file.added.findIndex((line) => WRITE.test(line.text));
      if (handler >= 0 && !AUTH.test(file.added.map((line) => line.text).join('\n'))) add(file, handler, 'SEC_NO_AUTH', 'warning', '쓰기 API에 인증 확인이 보이지 않습니다.');
    }
  }
  return findings;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const findings = audit(input);
  const counted = findings.filter((row) => !row.allowed);
  const blockers = counted.filter((row) => row.severity === 'blocker');
  const mode = process.argv[2];
  if (mode === '--json') { process.stdout.write(JSON.stringify(findings)); return; }
  if (mode === '--count') { process.stdout.write(String(blockers.length)); return; }
  for (const row of counted) console.log((row.severity === 'blocker' ? '차단 ' : '경고 ') + row.code + ' ' + row.file + ':' + row.line + ' ' + row.message);
  if (blockers.length) {
    console.log('Seedup: 차단 ' + blockers.length + '개 때문에 커밋을 멈췄습니다. 고치거나, 의도한 것이면 그 줄에 "// seedup-allow: <코드> <이유>"를 적으세요.');
    process.exitCode = 1;
  }
});
