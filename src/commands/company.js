import {
  parseArgs, resolveCompany, table, c, ok, fail, kwDisplay, codesInText,
} from '../util.js';

export const company = {
  list: {
    summary: '회사 목록',
    usage: 'company list [--status active|paused|churned] [-n 50] [--json]',
    async run({ parse }, argv) {
      const { opts } = parseArgs(argv, { booleans: ['json'], aliases: { '-n': 'limit' } });
      const where = {};
      if (opts.status) where.status = opts.status;
      const rows = await parse.find('Company', { where, limit: Number(opts.limit || 50), order: 'name' });
      if (opts.json) { console.log(JSON.stringify(rows, null, 2)); return; }
      table(['objectId', 'name', 'status', 'match', 'email'], rows.map((r) => [
        r.objectId, (r.name || '').slice(0, 30), r.status || '',
        r.matching_enabled === false ? 'off' : 'on', r.email || '',
      ]));
      console.log(`총 ${rows.length}건`);
    },
  },

  show: {
    summary: '회사 상세 (가이드·프로필·면허·인증·AI키워드)',
    usage: 'company show <ref> [--json]',
    async run({ parse }, argv) {
      const { pos, opts } = parseArgs(argv, { booleans: ['json'] });
      const co = await resolveCompany(parse, pos[0]);
      if (opts.json) { console.log(JSON.stringify(co, null, 2)); return; }
      const p = co.profile || {};
      console.log(c.bold(`=== ${co.name} (${co.objectId}) ===`));
      console.log(`email           : ${co.email || ''}`);
      console.log(`status          : ${co.status || ''}`);
      console.log(`address         : ${co.address || '(없음)'}`);
      console.log(`match_frequency : ${co.match_frequency || 'daily'}`);
      console.log(`matching_enabled: ${co.matching_enabled}`);
      console.log(`matching_accuracy   : ${co.matching_accuracy ?? ''}`);
      console.log(c.cyan('\n--- matching_guide ---'));
      console.log(co.matching_guide || '(없음)');
      console.log(c.cyan('\n--- profile ---'));
      console.log(`  keywords_in     : ${kwDisplay(p.keywords_in)}`);
      console.log(`  keywords_out    : ${kwDisplay(p.keywords_out)}`);
      console.log(`  region_pref     : ${(p.region_pref || []).join(', ') || '(없음)'}`);
      console.log(`  licenses(면허)  : ${(p.licenses || []).join(', ') || '(없음)'}`);
      console.log(`  certifications  : ${(p.certifications || []).join(', ') || '(없음)'}`);
      console.log(`  bid_divisions   : ${(p.bid_divisions || []).join(', ') || '(없음)'}`);
      console.log(`  categories_must : ${(p.categories_must || []).join(', ') || '(없음)'}`);
      console.log(`  categories_want : ${(p.categories_want || []).join(', ') || '(없음)'}`);
      console.log(`  categories_avoid: ${(p.categories_avoid || []).join(', ') || '(없음)'}`);
      console.log(`  industry_codes  : ${(p.industry_codes || []).join(', ') || '(없음)'}`);
      const ai = co.ai_keywords_suggested || [];
      if (ai.length) console.log(c.cyan(`\n--- AI 추천 키워드 (${ai.length}) ---\n  `) + ai.join(', '));
    },
  },

  create: {
    summary: '회사 신규 생성',
    usage: 'company create --name X [--email Y] [--address "..."] [--match-frequency daily|weekly|manual] [--enabled/--disabled]',
    async run({ parse }, argv) {
      const { opts } = parseArgs(argv, { booleans: ['enabled', 'disabled', 'json'] });
      if (!opts.name) fail('--name 은 필수입니다.');
      const data = {
        name: opts.name, status: opts.status || 'active',
        matching_enabled: opts.disabled ? false : true,
      };
      if (opts.email) data.email = opts.email;
      if (opts['match-frequency']) data.match_frequency = opts['match-frequency'];
      if (opts.address) {
        data.address = opts.address;
        const seeded = codesInText(opts.address);
        if (seeded.length) data.profile = { region_pref: seeded.sort() };
      }
      const res = await parse.create('Company', data);
      if (opts.json) { console.log(JSON.stringify(res)); return; }
      ok(`생성됨: ${res.objectId} — ${opts.name}`);
      if (data.profile) console.log(`  region_pref 자동설정: ${data.profile.region_pref.join(', ')}`);
    },
  },

  edit: {
    summary: '회사 기본 정보 부분 수정',
    usage: 'company edit <ref> [--name|--email|--status|--address|--match-frequency ...] [--enabled/--disabled]',
    async run({ parse }, argv) {
      const { pos, opts } = parseArgs(argv, { booleans: ['enabled', 'disabled'] });
      const co = await resolveCompany(parse, pos[0]);
      const patch = {};
      for (const k of ['name', 'email', 'status', 'address']) if (opts[k] != null) patch[k] = opts[k];
      if (opts['match-frequency'] != null) patch.match_frequency = opts['match-frequency'];
      if (opts.enabled) patch.matching_enabled = true;
      if (opts.disabled) patch.matching_enabled = false;
      if (!Object.keys(patch).length) { console.log('변경 없음'); return; }
      await parse.update('Company', co.objectId, patch);
      ok(`수정됨: ${co.objectId} (${Object.keys(patch).join(', ')})`);
    },
  },

  rematch: {
    summary: '이 회사 즉시 재매칭 (워커 컴퓨트)',
    usage: 'company rematch <ref>',
    async run({ parse, worker }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      const res = await worker.post(`/api/companies/${co.objectId}/rematch`);
      if (res.skipped) { console.log(c.yellow(`⚠ 스킵됨: ${res.skipped}`)); return; }
      ok(`재매칭 완료: ${co.objectId} — grant top ${res.grant?.top ?? 0} / bid top ${res.bid?.top ?? 0}`);
    },
  },

  delete: {
    summary: '[차단됨] 회사 삭제는 어드민 웹에서만',
    usage: 'company delete  (CLI에서 차단)',
    async run() {
      fail('company delete 는 CLI에서 차단되어 있습니다.\n'
        + '  파괴적이라 어드민 웹에서만 가능합니다: /admin/companies/<id> → [🗑 삭제]');
    },
  },
};
