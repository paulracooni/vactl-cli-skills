import { createInterface } from 'readline';
import {
  loadGlobal, requireConfig, resolveConfig, activeEnvName,
  setMasterKey, setDefaultEnv, setEnvOverride, writeProjectEnv, deriveServer,
  ENVIRONMENTS, CONFIG_PATH, PROJECT_FILE,
} from './config.js';
import { makeParse, makeWorker } from './api.js';
import { c, ok, warn, parseArgs } from './util.js';
import { checkUpdate, updateBanner, localVersion } from './update.js';
import { company } from './commands/company.js';
import { rules } from './commands/rules.js';
import { feedback } from './commands/feedback.js';
import { ai } from './commands/ai.js';
import { matches, ann, intake } from './commands/data.js';
import { scheduler, stats } from './commands/ops.js';

const GROUPS = {
  company, rules, feedback, ai, matches, ann, intake, scheduler,
};

function makeCtx(envOverride) {
  const cfg = requireConfig(envOverride);
  return { cfg, parse: makeParse(cfg), worker: makeWorker(cfg) };
}

function printHelp() {
  const active = activeEnvName();
  console.log(c.bold('vactl') + ' — ValueAdd 어드민 CLI (원격 서버 조작)\n');
  console.log('사용: ' + c.cyan('vactl [--env prod|local] <그룹> <명령> [인자]') + '\n');
  console.log(c.bold('환경 (현재: ' + active + ')'));
  console.log('  env                      환경 목록 + 활성 환경');
  console.log('  env use <prod|local>     기본 환경 변경 (--project: 이 폴더 .vactl.json 에 고정)');
  console.log('  login [--env <name>]     해당 환경 마스터키 설정 (URL·APP_ID는 내장 고정)');
  console.log('  config show | config path');
  console.log('  ping                     서버 연결 확인\n');
  for (const [g, cmds] of Object.entries(GROUPS)) {
    console.log(c.bold(g));
    for (const [name, def] of Object.entries(cmds)) {
      if (name.startsWith('_')) continue;
      console.log(`  ${(g + ' ' + name).padEnd(22)} ${c.gray(def.summary)}`);
    }
  }
  console.log(c.bold('stats') + '                      KPI 요약');
  console.log('\n각 명령 도움말: ' + c.cyan('vactl <그룹> --help'));
}

function printGroupHelp(group, cmds) {
  console.log(c.bold(group) + ' 명령:\n');
  for (const [name, def] of Object.entries(cmds)) {
    if (name.startsWith('_')) continue;
    console.log(`  ${c.cyan(def.usage)}`);
    console.log(`      ${c.gray(def.summary)}`);
  }
}

function envCmd(argv, envOverride) {
  const sub = argv[0];
  if (!sub || sub === 'show' || sub === 'list') {
    const g = loadGlobal();
    const active = activeEnvName(envOverride);
    console.log(c.bold('환경:'));
    for (const [name, def] of Object.entries(ENVIRONMENTS)) {
      const hasKey = !!(g.masterKeys && g.masterKeys[name]);
      const mark = name === active ? c.cyan('●') : ' ';
      console.log(`  ${mark} ${name.padEnd(6)} ${(def.workerUrl).padEnd(30)} appId=${def.appId.padEnd(14)} 키:${hasKey ? c.green('설정됨') : c.gray('없음')}`);
    }
    const cfg = resolveConfig(envOverride);
    if (cfg._projectPath) console.log(c.gray(`\n프로젝트 설정: ${cfg._projectPath} → env=${active}`));
    console.log(`\n활성 환경: ${c.bold(active)}`);
    return;
  }
  if (sub === 'use') {
    const name = argv[1];
    if (!name) { console.error('환경 이름이 필요합니다 (prod | local)'); process.exit(1); }
    if (!ENVIRONMENTS[name]) warn(`'${name}' 은 내장 환경이 아닙니다. (envs override 또는 프로젝트 파일에서 URL 지정 필요)`);
    const { opts } = parseArgs(argv.slice(2), { booleans: ['project'] });
    if (opts.project) {
      const p = writeProjectEnv(name);
      ok(`이 프로젝트 env=${name} → ${p}`);
    } else {
      setDefaultEnv(name);
      ok(`기본 env=${name} (전역)`);
    }
    return;
  }
  console.error('env 하위명령: show | use <prod|local> [--project]');
  process.exit(1);
}

function configCmd(argv, envOverride) {
  const sub = argv[0];
  if (sub === 'path') { console.log(CONFIG_PATH); return; }
  if (sub === 'show') {
    const cfg = resolveConfig(envOverride);
    const masked = cfg.masterKey ? cfg.masterKey.slice(0, 6) + `…(${cfg.masterKey.length}자)` : c.red('없음');
    console.log(c.gray('config: ' + CONFIG_PATH));
    console.log(`env       : ${c.bold(cfg.env)}` + (cfg._projectPath ? c.gray(`  (프로젝트: ${cfg._projectPath})`) : ''));
    console.log(`parseUrl  : ${cfg.parseUrl}`);
    console.log(`workerUrl : ${cfg.workerUrl}`);
    console.log(`appId     : ${cfg.appId}`);
    console.log(`masterKey : ${masked}`);
    const keys = Object.keys(cfg._hasKeyFor || {});
    if (keys.length) console.log(c.gray(`마스터키 보유 환경: ${keys.join(', ')}`));
    return;
  }
  if (sub === 'set') {
    const { opts } = parseArgs(argv.slice(1));
    const env = envOverride || opts.env || activeEnvName();
    const override = {};
    if (opts.server) Object.assign(override, deriveServer(opts.server));
    if (opts['parse-url']) override.parseUrl = opts['parse-url'];
    if (opts['worker-url']) override.workerUrl = opts['worker-url'];
    if (opts['app-id']) override.appId = opts['app-id'];
    if (Object.keys(override).length) setEnvOverride(env, override);
    if (opts['master-key']) setMasterKey(env, opts['master-key']);
    ok(`저장됨 (env=${env}${Object.keys(override).length ? ', URL/appId override' : ''}${opts['master-key'] ? ', 마스터키' : ''})`);
    return;
  }
  console.error('config 하위명령: set | show | path');
  process.exit(1);
}

const ask = (rl, q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

async function loginCmd(envOverride) {
  const env = envOverride || activeEnvName();
  const def = ENVIRONMENTS[env] || {};
  console.log(`env=${c.bold(env)}  (server=${def.workerUrl || '?'}, appId=${def.appId || '?'})`);
  if (!def.workerUrl) warn(`'${env}' 은 내장 환경이 아닙니다. URL을 먼저 지정하세요: vactl config set --env ${env} --server <url> --app-id <id>`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const mk = await ask(rl, 'MASTER_KEY: ');
  rl.close();
  if (!mk) { warn('입력 없음 — 취소'); return; }
  setMasterKey(env, mk);
  ok(`저장됨 (env=${env}) → ${CONFIG_PATH}`);
  try {
    const h = await makeWorker(resolveConfig(env)).get('/api/health');
    ok('워커 연결 OK: ' + JSON.stringify(h));
  } catch (e) { warn('워커 확인 실패: ' + e.message); }
}

async function pingCmd(envOverride) {
  const cfg = requireConfig(envOverride);
  console.log(c.gray(`env=${cfg.env} · ${cfg.workerUrl}`));
  try { ok('워커 OK: ' + JSON.stringify(await makeWorker(cfg).get('/api/health'))); } catch (e) { warn('워커 실패: ' + e.message); }
  try { await makeParse(cfg).find('Company', { limit: 1 }); ok('Parse OK (접근 가능)'); } catch (e) { warn('Parse 실패: ' + e.message); }
}

async function dispatch(first, rest, envOverride) {
  if (first === 'env') return envCmd(rest, envOverride);
  if (first === 'config') return configCmd(rest, envOverride);
  if (first === 'login') return loginCmd(envOverride);
  if (first === 'ping' || first === 'whoami') return pingCmd(envOverride);
  if (first === 'stats') return stats._bare.run(makeCtx(envOverride), rest);

  const group = GROUPS[first];
  if (!group) { console.error(c.red(`알 수 없는 명령: ${first}`)); printHelp(); process.exit(1); }
  const sub = rest[0];
  if (!sub || sub === '--help' || sub === '-h') return printGroupHelp(first, group);
  const cmd = group[sub];
  if (!cmd) { console.error(c.red(`알 수 없는 '${first}' 하위명령: ${sub}`)); printGroupHelp(first, group); process.exit(1); }
  return cmd.run(makeCtx(envOverride), rest.slice(1));
}

export async function main(argv) {
  // 업데이트 체크를 백그라운드로 시작 (대부분 캐시 히트라 즉시 끝남)
  const updP = checkUpdate().catch(() => null);

  // 전역 --env 추출
  let envOverride;
  const a = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') { envOverride = argv[i + 1]; i += 1; }
    else if (argv[i].startsWith('--env=')) { envOverride = argv[i].slice(6); }
    else a.push(argv[i]);
  }
  argv = a;

  const [first, ...rest] = argv;
  // 명령 종료 후 업데이트 배너 (캐시면 즉시, stale이면 최대 ~1s만 더 기다림)
  const showBanner = async () => {
    try {
      const info = await Promise.race([updP, new Promise((r) => setTimeout(() => r(null), 1000))]);
      updateBanner(info);
    } catch { /* noop */ }
  };

  if (!first || first === 'help' || first === '--help' || first === '-h') { printHelp(); return showBanner(); }
  if (first === 'version' || first === '--version' || first === '-v') { console.log('vactl ' + localVersion()); return showBanner(); }

  try {
    await dispatch(first, rest, envOverride);
  } finally {
    await showBanner();
  }
}
