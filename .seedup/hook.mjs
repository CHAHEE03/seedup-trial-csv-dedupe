#!/usr/bin/env node
// Seedup local hooks (session-start, pre-compact, stop, pre-commit). Plain Node, no packages, no network, no token.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_KEY = "prd:3aa85535-68de-4a51-b702-6ad0a6374fd7";
const GOAL_REL = ".seedup/goal.md";
const AUDIT_REL = '.seedup/audit.mjs';

function readStdin() {
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePayload(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function gitRun(cwd, args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

function gitTop(dir) {
  if (!dir || !existsSync(dir)) return '';
  const res = gitRun(dir, ['rev-parse', '--show-toplevel']);
  return res.status === 0 ? res.stdout.trim() : '';
}

function walkSeedup(start) {
  if (!start || !existsSync(start)) return '';
  for (let dir = resolve(start); ; ) {
    if (existsSync(join(dir, GOAL_REL)) || existsSync(join(dir, '.seedup', 'hook.mjs'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return '';
    dir = parent;
  }
}

function resolveRoot(payload) {
  const fromPayload = typeof payload.cwd === 'string' && payload.cwd && existsSync(payload.cwd) ? payload.cwd : '';
  if (fromPayload) return gitTop(fromPayload) || walkSeedup(fromPayload) || resolve(fromPayload);
  const fromEnv = process.env.CLAUDE_PROJECT_DIR && existsSync(process.env.CLAUDE_PROJECT_DIR) ? process.env.CLAUDE_PROJECT_DIR : '';
  if (fromEnv) return gitTop(fromEnv) || walkSeedup(fromEnv) || resolve(fromEnv);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  if (basename(scriptDir) === '.seedup') {
    const projectDir = dirname(scriptDir);
    return gitTop(projectDir) || projectDir;
  }
  const cwd = process.cwd();
  return gitTop(cwd) || walkSeedup(cwd) || cwd;
}

function isGitWorkTree(root) {
  const res = gitRun(root, ['rev-parse', '--is-inside-work-tree']);
  return res.status === 0 && res.stdout.trim() === 'true';
}

function hasHead(root) {
  return gitRun(root, ['rev-parse', '--verify', 'HEAD']).status === 0;
}

function hasDirty(root) {
  const res = gitRun(root, ['status', '--porcelain']);
  return res.status === 0 && res.stdout.trim().length > 0;
}

function hasUnpushed(root) {
  if (!hasHead(root)) return false;
  const upstream = gitRun(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream.status === 0 && upstream.stdout.trim()) {
    const ahead = gitRun(root, ['log', '--oneline', '@{u}..HEAD', '-n', '1']);
    return ahead.status === 0 && ahead.stdout.trim().length > 0;
  }
  const localOnly = gitRun(root, ['log', '--oneline', 'HEAD', '--not', '--remotes', '-n', '1']);
  return localOnly.status === 0 && localOnly.stdout.trim().length > 0;
}

function auditBlockerCount(root) {
  const auditPath = join(root, AUDIT_REL);
  if (!existsSync(auditPath)) return 0;
  const diffArgs = hasHead(root) ? ['diff', 'HEAD', '-U0', '--no-color'] : ['diff', '--cached', '-U0', '--no-color'];
  const diff = gitRun(root, diffArgs);
  if (diff.status !== 0 || !diff.stdout) return 0;
  const res = spawnSync(process.execPath, [auditPath, '--count'], { input: diff.stdout, encoding: 'utf8' });
  const count = Number.parseInt((res.stdout || '').trim(), 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function runSessionStart(root, payload) {
  const goalPath = join(root, GOAL_REL);
  const context = existsSync(goalPath)
    ? readFileSync(goalPath, 'utf8')
    : `Seedup 목표 파일(${GOAL_REL})이 없습니다. Seedup에서 훅 묶음을 다시 받으세요.\n`;
  process.stdout.write(context);
  if (payload.source === 'compact' || payload.source === 'resume') {
    const reason = payload.source === 'compact' ? '대화가 압축되었습니다.' : '대화가 재개되었습니다.';
    const newline = context.endsWith('\n') ? '' : '\n';
    process.stdout.write(`${newline}${reason} 작업을 이어가기 전에 Seedup MCP의 resume_project(프로젝트 ${PROJECT_KEY})를 호출해 마지막 인계, 최근 결정, 진행 상태를 확인하세요.\n`);
    try {
      const brief = readFileSync(join(root, 'AGENTS.md'), 'utf8').match(/^<!-- Seedup brief: project=[a-z0-9:-]{1,120} goal=(?:[0-9]+|none) prd=[a-f0-9]{16} -->$/im)?.[0];
      if (brief) process.stdout.write(`버전 확인을 위해 이 인자로 호출하세요. resume_project ${JSON.stringify({ project: PROJECT_KEY, brief })}\n`);
    } catch { /* Older setups may have no AGENTS.md yet. */ }
  }
}

// shortcut: Codex PreCompact only surfaces the warning, add summary instructions when Codex supports them.
function runPreCompact(root, summary) {
  const notes = [];
  if (isGitWorkTree(root)) {
    if (hasDirty(root)) notes.push('커밋하지 않은 변경');
    if (hasUnpushed(root)) notes.push('push하지 않은 커밋');
    const blockers = auditBlockerCount(root);
    if (blockers > 0) notes.push(`정적 검사 차단 항목 ${blockers}개`);
  }
  const prefix = notes.length ? `현재 ${notes.join(', ')}이 남아 있습니다. ` : '';
  if (summary) {
    process.stdout.write(`${prefix}하던 일과 다음 할 일을 압축 요약에 남기세요(프로젝트 ${PROJECT_KEY}).\n`);
    return;
  }
  const message = `${prefix}대화 압축 전에 Seedup MCP의 save_handoff로 하던 일, 다음 할 일, 주의할 점, 검증 안 된 커밋을 남기세요(프로젝트 ${PROJECT_KEY}). 압축 뒤에는 ${GOAL_REL}이 다시 주입됩니다.`;
  process.stdout.write(`${JSON.stringify({ continue: true, systemMessage: message })}\n`);
}

function runStop(root, payload) {
  if (payload.stop_hook_active === true) return;
  if (!isGitWorkTree(root)) return;
  const dirty = hasDirty(root);
  const unpushed = hasUnpushed(root);
  const blockers = auditBlockerCount(root);
  if (!dirty && !unpushed && blockers === 0) return;
  const audit = blockers > 0
    ? `커밋 전 검사에서 차단 항목 ${blockers}개가 나왔습니다(git diff HEAD | node .seedup/audit.mjs로 확인). 먼저 고치세요. `
    : '';
  const reason = `${audit}커밋하지 않았거나 push하지 않은 변경이 있으면 끝내기 전에 Seedup MCP의 save_handoff로 하던 일, 다음 할 일, 주의할 점, 검증 안 된 커밋을 남기세요(프로젝트 ${PROJECT_KEY}). 도구가 없으면 사용자에게 요약해 주세요.`;
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
}

function runPreCommit(root) {
  const auditPath = join(root, AUDIT_REL);
  if (!existsSync(auditPath)) {
    console.log(`Seedup: ${auditPath}가 없어 커밋 전 검사를 건너뜁니다.`);
    return;
  }
  const diff = gitRun(root, ['diff', '--cached', '-U0', '--no-color']);
  if (diff.status !== 0) {
    process.exitCode = diff.status ?? 1;
    return;
  }
  const res = spawnSync(process.execPath, [auditPath], { input: diff.stdout, stdio: ['pipe', 'inherit', 'inherit'] });
  process.exitCode = res.status ?? 0;
}

const command = process.argv[2] || '';
if (command === 'pre-commit') {
  runPreCommit(resolveRoot({}));
} else {
  const payload = parsePayload(readStdin());
  const root = resolveRoot(payload);
  if (command === 'session-start') runSessionStart(root, payload);
  else if (command === 'pre-compact') runPreCompact(root, process.argv[3] === '--summary');
  else if (command === 'stop') runStop(root, payload);
}
