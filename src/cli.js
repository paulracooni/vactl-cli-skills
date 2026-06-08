import { createInterface } from 'readline';
import {
  loadConfig, saveConfig, requireConfig, CONFIG_PATH,
} from './config.js';
import { makeParse, makeWorker } from './api.js';
import {
  c, ok, warn, parseArgs,
} from './util.js';
import { company } from './commands/company.js';
import { rules } from './commands/rules.js';
import { feedback } from './commands/feedback.js';
import { ai } from './commands/ai.js';
import { matches, ann, intake } from './commands/data.js';
import { scheduler, stats } from './commands/ops.js';

const GROUPS = {
  company, rules, feedback, ai, matches, ann, intake, scheduler,
};

function makeCtx() {
  const cfg = requireConfig();
  return { cfg, parse: makeParse(cfg), worker: makeWorker(cfg) };
}

function printHelp() {
  console.log(c.bold('vactl') + ' — ValueAdd 어드민 CLI (원격 서버 조작)\n');
  console.log('사용: ' + c.cyan('vactl <그룹> <명령> [인자]') + '\n');
  console.log(c.bold('설정'));
  console.log('  login                    대화형으로 서버/앱ID/마스터키 설정');
  console.log('  config set --server <url> --app-id <id> --master-key <key>');
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

function printVersion() {
  console.log('vactl 1.0.0');
}

function setConfigFromOpts(cfg, opts) {
  if (opts.server) {
    const s = String(opts.server).replace(/\/+$/, '');
    cfg.parseUrl = s + '/parse';
    cfg.workerUrl = s;
  }
  if (opts['parse-url']) cfg.parseUrl = opts['parse-url'];
  if (opts['worker-url']) cfg.workerUrl = opts['worker-url'];
  if (opts['app-id']) cfg.appId = opts['app-id'];
  if (opts['master-key']) cfg.masterKey = opts['master-key'];
}

function configCmd(argv) {
  const sub = argv[0];
  if (sub === 'path') { console.log(CONFIG_PATH); return; }
  if (sub === 'show') {
    const cfg = loadConfig();
    const masked = { ...cfg };
    if (masked.masterKey) masked.masterKey = masked.masterKey.slice(0, 6) + `…(${masked.masterKey.length}자)`;
    console.log(c.gray('config: ' + CONFIG_PATH));
    console.log(JSON.stringify(masked, null, 2));
    return;
  }
  if (sub === 'set') {
    const { opts } = parseArgs(argv.slice(1));
    const cfg = loadConfig();
    setConfigFromOpts(cfg, opts);
    saveConfig(cfg);
    ok('저장됨: ' + CONFIG_PATH);
    return;
  }
  console.error("config 하위명령: set | show | path");
  process.exit(1);
}

const ask = (rl, q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

async function loginCmd() {
  const cfg = loadConfig();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const curServer = cfg.parseUrl ? cfg.parseUrl.replace(/\/parse\/?$/, '') : '';
  const server = await ask(rl, `서버 URL${curServer ? ` [${curServer}]` : ' (예: https://34-50-38-51.nip.io)'}: `);
  const appId = await ask(rl, `APP_ID${cfg.appId ? ` [${cfg.appId}]` : ''}: `);
  const mk = await ask(rl, 'MASTER_KEY: ');
  rl.close();
  if (server) setConfigFromOpts(cfg, { server });
  if (appId) cfg.appId = appId;
  if (mk) cfg.masterKey = mk;
  saveConfig(cfg);
  ok('저장됨: ' + CONFIG_PATH);
  try {
    const h = await makeWorker(cfg).get('/api/health');
    ok('워커 연결 OK: ' + JSON.stringify(h));
  } catch (e) { warn('워커 확인 실패 (URL/네트워크 확인): ' + e.message); }
}

async function pingCmd() {
  const cfg = requireConfig();
  try {
    const h = await makeWorker(cfg).get('/api/health');
    ok('워커 OK: ' + JSON.stringify(h));
  } catch (e) { warn('워커 실패: ' + e.message); }
  try {
    const rows = await makeParse(cfg).find('Company', { limit: 1 });
    ok(`Parse OK (Company ${rows.length >= 0 ? '접근 가능' : ''})`);
  } catch (e) { warn('Parse 실패: ' + e.message); }
}

export async function main(argv) {
  const [first, ...rest] = argv;
  if (!first || first === 'help' || first === '--help' || first === '-h') return printHelp();
  if (first === 'version' || first === '--version' || first === '-v') return printVersion();
  if (first === 'config') return configCmd(rest);
  if (first === 'login') return loginCmd();
  if (first === 'ping' || first === 'whoami') return pingCmd();
  if (first === 'stats') return stats._bare.run(makeCtx(), rest);

  const group = GROUPS[first];
  if (!group) { console.error(c.red(`알 수 없는 명령: ${first}`)); printHelp(); process.exit(1); }
  const sub = rest[0];
  if (!sub || sub === '--help' || sub === '-h') return printGroupHelp(first, group);
  const cmd = group[sub];
  if (!cmd) { console.error(c.red(`알 수 없는 '${first}' 하위명령: ${sub}`)); printGroupHelp(first, group); process.exit(1); }
  return cmd.run(makeCtx(), rest.slice(1));
}
