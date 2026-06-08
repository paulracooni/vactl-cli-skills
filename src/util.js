// 공용 헬퍼 — 색상, 인자 파싱, 포맷, 지역추론, 회사 resolve.

// ── ANSI 색상 (no-dep) ──
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = {
  bold: wrap('1'), dim: wrap('2'), red: wrap('31'), green: wrap('32'),
  yellow: wrap('33'), cyan: wrap('36'), gray: wrap('90'), navy: wrap('34'),
};
export const ok = (s) => console.log(c.green('✓ ') + s);
export const warn = (s) => console.error(c.yellow('⚠ ') + s);
export const fail = (s) => { console.error(c.red('✗ ') + s); process.exit(1); };

// ── 인자 파싱 ──
// booleans: 값 없이 true 가 되는 플래그 이름들 (앞의 -- 제외)
export function parseArgs(argv, { booleans = [], aliases = {} } = {}) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    if (a.startsWith('--')) {
      let key = a.slice(2); let val;
      const eq = key.indexOf('=');
      if (eq >= 0) { val = key.slice(eq + 1); key = key.slice(0, eq); opts[key] = val; continue; }
      if (booleans.includes(key)) { opts[key] = true; continue; }
      val = argv[i + 1]; i += 1; opts[key] = val;
    } else if (a.length >= 2 && a[0] === '-' && a !== '-') {
      const key = aliases[a] || a;
      if (booleans.includes(key)) { opts[key] = true; }
      else { opts[key] = argv[i + 1]; i += 1; }
    } else {
      pos.push(a);
    }
  }
  return { pos, opts };
}

// ── CSV / 키워드 ──
export const csv = (text) => String(text || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

export function kwParse(text) {
  return csv(text).map((raw) => {
    const m = raw.match(/^(.+?)\s*[×x]\s*(\d+)\s*$/);
    return m ? { kw: m[1].trim(), w: parseInt(m[2], 10) } : raw;
  });
}

export function kwDisplay(list) {
  if (!list || !list.length) return '(없음)';
  return list.map((k) => (k && typeof k === 'object'
    ? (k.w != null ? `${k.kw}×${k.w}` : k.kw) : String(k))).join(', ');
}

// ── 회사 resolve (objectId 10자 또는 정확한 name) ──
export async function resolveCompany(parse, ref) {
  if (!ref) fail('회사를 지정하세요 (objectId 또는 회사명).');
  if (/^[A-Za-z0-9]{10}$/.test(ref)) {
    try { return await parse.get('Company', ref); } catch { /* fall through */ }
  }
  const rows = await parse.find('Company', { where: { name: ref }, limit: 2 });
  if (!rows.length) fail(`회사를 찾을 수 없음: ${ref}`);
  if (rows.length > 1) fail(`이름이 중복됨 — objectId로 지정하세요: ${rows.map((r) => r.objectId).join(', ')}`);
  return rows[0];
}

// ── 날짜 ──
export const isoOf = (v) => (v && typeof v === 'object' ? (v.iso || '') : (v || ''));
export const shortDate = (v) => isoOf(v).slice(0, 16).replace('T', ' ');

export function isExpired(closeVal, today = new Date()) {
  let s = isoOf(closeVal);
  s = String(s).slice(0, 10).replace(/[./]/g, '-');
  const m = s.match(/^(20\d\d)-(\d\d?)-(\d\d?)/);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d < t0;
}

// ── 표 출력 ──
export function table(headers, rows) {
  const all = [headers, ...rows];
  const widths = headers.map((_, i) => Math.max(...all.map((r) => dispWidth(String(r[i] ?? '')))));
  const line = (r) => r.map((cell, i) => pad(String(cell ?? ''), widths[i])).join('  ');
  console.log(c.gray(line(headers)));
  console.log(c.gray('─'.repeat(widths.reduce((a, b) => a + b + 2, -2))));
  rows.forEach((r) => console.log(line(r)));
}
// 한글(2칸) 고려한 폭 계산
function dispWidth(s) {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0x1100 ? 2 : 1;
  return w;
}
function pad(s, width) {
  const diff = width - dispWidth(s);
  return s + (diff > 0 ? ' '.repeat(diff) : '');
}

// ── 지역 추론 (worker/matching/region.py 포팅) ──
const SIDO = {
  서울: ['서울특별시', '서울시', '서울'], 부산: ['부산광역시', '부산시', '부산'],
  대구: ['대구광역시', '대구시', '대구'], 인천: ['인천광역시', '인천시', '인천'],
  광주: ['광주광역시', '광주시', '광주'], 대전: ['대전광역시', '대전시', '대전'],
  울산: ['울산광역시', '울산시', '울산'], 세종: ['세종특별자치시', '세종시', '세종'],
  경기: ['경기도', '경기'], 강원: ['강원특별자치도', '강원도', '강원'],
  충북: ['충청북도', '충북'], 충남: ['충청남도', '충남'],
  전북: ['전북특별자치도', '전라북도', '전북'], 전남: ['전라남도', '전남'],
  경북: ['경상북도', '경북'], 경남: ['경상남도', '경남'], 제주: ['제주특별자치도', '제주도', '제주'],
};
const SURFACE = Object.entries(SIDO)
  .flatMap(([code, forms]) => forms.map((f) => [f, code]))
  .sort((a, b) => b[0].length - a[0].length);
const isHangul = (ch) => ch >= '가' && ch <= '힣';

export function codesInText(text) {
  if (!text) return [];
  const t = String(text);
  const found = new Set();
  for (const [surf, code] of SURFACE) {
    if (found.has(code)) continue;
    let start = 0;
    for (;;) {
      const i = t.indexOf(surf, start);
      if (i < 0) break;
      const prev = i > 0 ? t[i - 1] : '';
      if (!(prev && isHangul(prev))) { found.add(code); break; }
      start = i + 1;
    }
  }
  return [...found];
}

export const EV_LABEL = {
  up: '👍관심', star: '👍관심', down: '👎제외', think: '🤔보류',
};
