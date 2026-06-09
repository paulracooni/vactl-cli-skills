// 업데이트 감지 — GitHub의 package.json 버전과 비교해 새 버전이 있으면 권장 배너 표시.
// 결과는 ~/.vactl/update-check.json 에 24h 캐시 (매 명령마다 네트워크 호출 X).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { c } from './util.js';

const REPO = 'paulracooni/vactl-cli-skills';
const REMOTE_PKG = `https://raw.githubusercontent.com/${REPO}/main/package.json`;
const UPDATE_CMD = `npm install -g github:${REPO}`;
const CHECK_FILE = join(homedir(), '.vactl', 'update-check.json');
const TTL = 24 * 3600 * 1000; // 24시간

function cmpVer(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}

export function localVersion() {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version || '0.0.0';
  } catch { return '0.0.0'; }
}

function readCache() { try { return JSON.parse(readFileSync(CHECK_FILE, 'utf8')); } catch { return null; } }
function writeCache(obj) {
  try { mkdirSync(join(homedir(), '.vactl'), { recursive: true }); writeFileSync(CHECK_FILE, JSON.stringify(obj)); } catch { /* noop */ }
}

async function fetchRemoteVersion() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2000);
  try {
    const r = await fetch(REMOTE_PKG, { signal: ctrl.signal });
    if (!r.ok) return null;
    return (await r.json()).version || null;
  } catch { return null; } finally { clearTimeout(t); }
}

// 새 버전이 있으면 {latest, current}, 없으면 null. 24h 캐시.
export async function checkUpdate({ force = false } = {}) {
  if (process.env.VACTL_NO_UPDATE_CHECK) return null;
  const current = localVersion();
  const cache = readCache();
  const now = Date.now();
  let latest;
  if (!force && cache && now - (cache.ts || 0) < TTL) {
    latest = cache.latest;
  } else {
    latest = await fetchRemoteVersion();
    if (latest) writeCache({ ts: now, latest });
    else if (cache) latest = cache.latest; // 네트워크 실패 시 마지막 값
  }
  return latest && cmpVer(latest, current) > 0 ? { latest, current } : null;
}

export function updateBanner(info) {
  if (!info) return;
  console.error(c.yellow(`\n⬆  새 버전 vactl v${info.latest} 가 있습니다 (현재 v${info.current}).`));
  console.error(c.gray(`   CLI 업데이트:  ${UPDATE_CMD}`));
  console.error(c.gray('   스킬도 갱신하려면 INSTALL.md 의 "업데이트" 단계를 참고하세요.'));
}
