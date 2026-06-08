// 설정 — 환경 프로파일(prod/local) + 글로벌(~/.vactl) + 프로젝트(.vactl.json) + 환경변수.
//
// 우선순위(낮음→높음): 내장 환경 기본값 → 글로벌 envs override → 프로젝트 파일 → 환경변수.
// URL·APP_ID는 환경마다 고정(내장). 사용자는 마스터키만 환경별로 넣으면 됨.
import { homedir } from 'os';
import {
  join, dirname,
} from 'path';
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync,
} from 'fs';

export const CONFIG_DIR = join(homedir(), '.vactl');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
export const PROJECT_FILE = '.vactl.json';

// 내장 환경 프로파일 — 서버 URL·APP_ID는 환경마다 고정.
export const ENVIRONMENTS = {
  prod: {
    parseUrl: 'https://34-50-38-51.nip.io/parse',
    workerUrl: 'https://34-50-38-51.nip.io',
    appId: 'valueadd-prod',
  },
  local: {
    parseUrl: 'http://localhost:1337/parse',
    workerUrl: 'http://localhost:8000',
    appId: 'valueadd-poc',
  },
};
export const DEFAULT_ENV = 'prod';

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) || {}; } catch { return null; }
}

// 글로벌 config 로드 (+ 레거시 평면 형식 in-memory 마이그레이션)
export function loadGlobal() {
  const g = (existsSync(CONFIG_PATH) ? readJson(CONFIG_PATH) : {}) || {};
  if (g.masterKey && !g.masterKeys) {
    const env = g.appId === 'valueadd-poc' ? 'local' : 'prod';
    g.masterKeys = { [env]: g.masterKey };
    if (!g.env) g.env = env;
  }
  return g;
}

export function saveGlobal(cfg) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
  try { chmodSync(CONFIG_PATH, 0o600); } catch { /* windows */ }
}

// cwd → 상위로 올라가며 .vactl.json 탐색 (프로젝트별 환경 선택)
export function findProject(startDir = process.cwd()) {
  let dir = startDir;
  for (;;) {
    const p = join(dir, PROJECT_FILE);
    if (existsSync(p)) { const data = readJson(p); if (data) return { path: p, data }; }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function deriveServer(server) {
  const s = String(server).replace(/\/+$/, '');
  return { parseUrl: s + '/parse', workerUrl: s };
}

export function activeEnvName(envOverride) {
  const global = loadGlobal();
  const project = findProject();
  return envOverride
    || process.env.VACTL_ENV
    || project?.data?.env
    || global.env
    || DEFAULT_ENV;
}

export function resolveConfig(envOverride) {
  const global = loadGlobal();
  const project = findProject();
  const env = activeEnvName(envOverride);

  const cfg = { ...(ENVIRONMENTS[env] || {}) };
  // 글로벌 환경별 override(사용자 커스텀)
  if (global.envs && global.envs[env]) Object.assign(cfg, global.envs[env]);
  // 프로젝트 override
  if (project && project.data) {
    if (project.data.server) Object.assign(cfg, deriveServer(project.data.server));
    for (const k of ['parseUrl', 'workerUrl', 'appId']) if (project.data[k]) cfg[k] = project.data[k];
  }
  // 마스터키: 환경별 > 프로젝트(권장X)
  cfg.masterKey = (global.masterKeys && global.masterKeys[env])
    || (project && project.data && project.data.masterKey) || undefined;
  // 환경변수 최우선
  const e = process.env;
  if (e.VACTL_SERVER) Object.assign(cfg, deriveServer(e.VACTL_SERVER));
  if (e.VACTL_PARSE_URL) cfg.parseUrl = e.VACTL_PARSE_URL;
  if (e.VACTL_WORKER_URL) cfg.workerUrl = e.VACTL_WORKER_URL;
  if (e.VACTL_APP_ID) cfg.appId = e.VACTL_APP_ID;
  if (e.VACTL_MASTER_KEY) cfg.masterKey = e.VACTL_MASTER_KEY;
  if (cfg.parseUrl && !cfg.workerUrl) cfg.workerUrl = cfg.parseUrl.replace(/\/parse\/?$/, '');

  cfg.env = env;
  cfg._projectPath = project ? project.path : null;
  cfg._hasKeyFor = { ...((global.masterKeys) || {}) };
  return cfg;
}

export function requireConfig(envOverride) {
  const cfg = resolveConfig(envOverride);
  const missing = ['parseUrl', 'appId', 'masterKey'].filter((k) => !cfg[k]);
  if (missing.length) {
    console.error(`\x1b[31m[env=${cfg.env}] 설정 부족: ${missing.join(', ')}\x1b[0m`);
    if (missing.includes('masterKey')) {
      console.error(`  마스터키 설정: vactl login --env ${cfg.env}   (또는 vactl config set --env ${cfg.env} --master-key <키>)`);
    }
    process.exit(1);
  }
  return cfg;
}

// ── 설정 변경 헬퍼 ──
export function setMasterKey(env, key) {
  const g = loadGlobal();
  g.masterKeys = g.masterKeys || {};
  g.masterKeys[env] = key;
  saveGlobal(g);
}
export function setDefaultEnv(env) {
  const g = loadGlobal();
  g.env = env;
  saveGlobal(g);
}
export function setEnvOverride(env, patch) {
  const g = loadGlobal();
  g.envs = g.envs || {};
  g.envs[env] = { ...(g.envs[env] || {}), ...patch };
  saveGlobal(g);
}
export function writeProjectEnv(env, dir = process.cwd()) {
  const p = join(dir, PROJECT_FILE);
  writeFileSync(p, JSON.stringify({ env }, null, 2) + '\n');
  return p;
}
