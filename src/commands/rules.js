import {
  parseArgs, resolveCompany, c, ok, fail, kwParse, csv,
} from '../util.js';
import { opDelete } from '../api.js';

export const rules = {
  show: {
    summary: '매칭 규칙(profile + guide) 출력',
    usage: 'rules show <ref>',
    async run({ parse }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      console.log(c.bold(`=== ${co.name} — 매칭 규칙 ===`));
      console.log(`matching_enabled: ${co.matching_enabled}`);
      console.log(c.cyan('\nmatching_guide:'));
      console.log('  ' + (co.matching_guide || '(없음)'));
      console.log(c.cyan('\nprofile:'));
      console.log(JSON.stringify(co.profile || {}, null, 2));
    },
  },

  guide: {
    summary: 'matching_guide 설정/교체 ("" 로 제거)',
    usage: 'rules guide <ref> "<텍스트>"',
    async run({ parse }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      const text = pos[1];
      if (text == null) fail('가이드 텍스트를 주세요 (제거는 "" ).');
      if (text === '') {
        await parse.update('Company', co.objectId, { matching_guide: opDelete });
        console.log(c.yellow(`✓ guide 제거: ${co.objectId}`));
      } else {
        await parse.update('Company', co.objectId, { matching_guide: text });
        ok(`guide 설정: ${co.objectId} (${text.length}자)`);
      }
    },
  },

  set: {
    summary: '매칭 규칙(profile) 부분 set',
    usage: 'rules set <ref> [--keywords-in|--keywords-out|--region-pref|--licenses|--certifications|--bid-divisions|--categories-must|--categories-want|--categories-avoid|--industry-codes|--presmpt-min N|--presmpt-max N]',
    async run({ parse }, argv) {
      const { pos, opts } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      const p = { ...(co.profile || {}) };
      if (opts['keywords-in'] != null) p.keywords_in = kwParse(opts['keywords-in']);
      for (const [flag, key] of [
        ['keywords-out', 'keywords_out'], ['region-pref', 'region_pref'],
        ['licenses', 'licenses'], ['certifications', 'certifications'],
        ['bid-divisions', 'bid_divisions'], ['categories-must', 'categories_must'],
        ['categories-want', 'categories_want'], ['categories-avoid', 'categories_avoid'],
        ['industry-codes', 'industry_codes'],
      ]) if (opts[flag] != null) p[key] = csv(opts[flag]);
      if (opts['presmpt-min'] != null) p.presmpt_min = Number(opts['presmpt-min']);
      if (opts['presmpt-max'] != null) p.presmpt_max = Number(opts['presmpt-max']);
      await parse.update('Company', co.objectId, { profile: p });
      ok(`profile 갱신: ${co.objectId}`);
    },
  },

  'kw-add': {
    summary: 'keywords_in/out 에 추가 (중복 skip)',
    usage: 'rules kw-add <ref> in|out <키워드들...>',
    async run({ parse }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      const kind = pos[1];
      if (kind !== 'in' && kind !== 'out') fail("kind 는 'in' 또는 'out'");
      const field = `keywords_${kind}`;
      const p = { ...(co.profile || {}) };
      const cur = [...(p[field] || [])];
      const seen = new Set(cur.map((k) => (k && typeof k === 'object' ? k.kw : String(k))));
      const parsed = kind === 'in' ? kwParse(pos.slice(2).join(',')) : csv(pos.slice(2).join(','));
      const added = [];
      for (const k of parsed) {
        const word = k && typeof k === 'object' ? k.kw : k;
        if (word && !seen.has(word)) { cur.push(k); seen.add(word); added.push(word); }
      }
      p[field] = cur;
      await parse.update('Company', co.objectId, { profile: p });
      ok(`${field}: +${added.length}건, 총 ${cur.length}건` + (added.length ? `  (${added.join(', ')})` : ''));
    },
  },

  'kw-remove': {
    summary: 'keywords_in/out 에서 제거',
    usage: 'rules kw-remove <ref> in|out <키워드들...>',
    async run({ parse }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      const kind = pos[1];
      if (kind !== 'in' && kind !== 'out') fail("kind 는 'in' 또는 'out'");
      const field = `keywords_${kind}`;
      const p = { ...(co.profile || {}) };
      const remove = new Set(pos.slice(2).map((s) => s.trim()));
      const kept = []; const removed = [];
      for (const k of (p[field] || [])) {
        const word = k && typeof k === 'object' ? k.kw : String(k);
        if (remove.has(word)) removed.push(word); else kept.push(k);
      }
      p[field] = kept;
      await parse.update('Company', co.objectId, { profile: p });
      console.log(c.yellow(`✓ ${field}: -${removed.length}건, 총 ${kept.length}건`) + (removed.length ? `  (${removed.join(', ')})` : ''));
    },
  },
};
