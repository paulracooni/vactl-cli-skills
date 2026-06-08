// 설정 로딩/저장 — ~/.vactl/config.json + 환경변수 override.
import { homedir } from 'os';
import { join } from 'path';
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync,
} from 'fs';

export const CONFIG_DIR = join(homedir(), '.vactl');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

function deriveFromServer(cfg, server) {
  const s = String(server).replace(/\/+$/, '');
  if (!cfg.parseUrl) cfg.parseUrl = s + '/parse';
  if (!cfg.workerUrl) cfg.workerUrl = s;
}

export function loadConfig() {
  let cfg = {};
  if (existsSync(CONFIG_PATH)) {
    try { cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) || {}; } catch { /* ignore */ }
  }
  const e = process.env;
  if (e.VACTL_SERVER) deriveFromServer(cfg, e.VACTL_SERVER);
  if (e.VACTL_PARSE_URL) cfg.parseUrl = e.VACTL_PARSE_URL;
  if (e.VACTL_WORKER_URL) cfg.workerUrl = e.VACTL_WORKER_URL;
  if (e.VACTL_APP_ID) cfg.appId = e.VACTL_APP_ID;
  if (e.VACTL_MASTER_KEY) cfg.masterKey = e.VACTL_MASTER_KEY;
  // worker URL 기본값: parseUrl 에서 /parse 떼어내기
  if (cfg.parseUrl && !cfg.workerUrl) {
    cfg.workerUrl = cfg.parseUrl.replace(/\/parse\/?$/, '');
  }
  return cfg;
}

export function saveConfig(cfg) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
  try { chmodSync(CONFIG_PATH, 0o600); } catch { /* windows */ }
}

export function applyServer(cfg, server) {
  deriveFromServer(cfg, server);
  return cfg;
}

export function requireConfig() {
  const cfg = loadConfig();
  const missing = ['parseUrl', 'appId', 'masterKey'].filter((k) => !cfg[k]);
  if (missing.length) {
    console.error(
      `\x1b[31m설정이 비어 있습니다 (${missing.join(', ')}).\x1b[0m\n`
      + "먼저 'vactl login' (대화형) 또는 'vactl config set --server <url> --app-id <id> --master-key <key>' 을 실행하세요.",
    );
    process.exit(1);
  }
  return cfg;
}
