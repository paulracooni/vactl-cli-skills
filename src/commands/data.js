import {
  parseArgs, resolveCompany, c, fail, table, EV_LABEL, isExpired, isoOf, shortDate,
} from '../util.js';
import { companyPtr } from '../api.js';

const GRANT_CLASSES = {
  bizinfo: 'BizinfoAnnouncement', kstartup: 'KstartupAnnouncement', bojo: 'BojoAnnouncement',
};

export const matches = {
  list: {
    summary: '현재 매칭 결과 (점수순, 마감 지난 건 제외)',
    usage: 'matches list <ref> [--kind grant|bid|both] [-n 20]',
    async run({ parse }, argv) {
      const { pos, opts } = parseArgs(argv, { aliases: { '-n': 'limit' } });
      const co = await resolveCompany(parse, pos[0]);
      const limit = Number(opts.limit || 20);
      const kind = opts.kind || 'both';
      const specs = [];
      if (kind === 'grant' || kind === 'both') specs.push(['Match', 'grant_class', 'grant_id']);
      if (kind === 'bid' || kind === 'both') specs.push(['BidMatch', 'bid_class', 'bid_id']);
      for (const [klass, cf, idf] of specs) {
        const rows = await parse.find(klass, { where: { company: companyPtr(co.objectId) }, order: '-score', limit });
        console.log(c.cyan(`\n=== ${klass} (top ${limit}) ===`));
        for (const m of rows) {
          let ann = {};
          try { ann = await parse.get(m[cf], m[idf], 'title,close_at,bid_close_at'); } catch { /* skip */ }
          const close = ann.close_at || ann.bid_close_at || '';
          if (isExpired(close)) continue;
          const cs = isoOf(close).slice(0, 10).replace(/[./]/g, '-') || '?';
          const ev = EV_LABEL[m.evaluation] || '';
          console.log(`  ${String(m.score ?? 0).padStart(3)}점 ${ev.padEnd(4)} ${(ann.title || '').slice(0, 48)} ${c.gray('[마감 ' + cs + ']')}`);
        }
      }
    },
  },

  runs: {
    summary: '추천 스냅샷(MatchRun) 이력 — 날짜/버전별',
    usage: 'matches runs <ref> [-n 10]',
    async run({ parse }, argv) {
      const { pos, opts } = parseArgs(argv, { aliases: { '-n': 'limit' } });
      const co = await resolveCompany(parse, pos[0]);
      const rows = await parse.find('MatchRun', {
        where: { company: companyPtr(co.objectId) }, order: '-run_at', limit: Number(opts.limit || 10),
      });
      console.log(c.bold(`=== ${co.name} — 추천 스냅샷 ${rows.length}건 ===`));
      for (const r of rows) {
        console.log(`  v${String(r.version).padEnd(3)} ${shortDate(r.run_at)}  ${r.count}건  trigger=${r.trigger}`);
      }
    },
  },
};

export const ann = {
  search: {
    summary: 'active 공고·입찰 제목 검색',
    usage: 'ann search [-q "검색어"] [--source bizinfo|kstartup|bojo|g2b] [-n 20]',
    async run({ parse }, argv) {
      const { opts } = parseArgs(argv, { aliases: { '-n': 'limit', '-q': 'query' } });
      const limit = Number(opts.limit || 20);
      let classes;
      if (opts.source === 'g2b') classes = ['G2bBid'];
      else if (GRANT_CLASSES[opts.source]) classes = [GRANT_CLASSES[opts.source]];
      else classes = [...Object.values(GRANT_CLASSES), 'G2bBid'];
      const where = { status: 'active' };
      if (opts.query) where.title = { $regex: opts.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
      let total = 0;
      for (const klass of classes) {
        const rows = await parse.find(klass, { where, limit, order: '-createdAt' });
        if (!rows.length) continue;
        console.log(c.cyan(`\n=== ${klass} (${rows.length}) ===`));
        for (const r of rows) {
          const close = isoOf(r.close_at || r.bid_close_at).slice(0, 10) || '?';
          console.log(`  ${r.objectId}  ${(r.title || '').slice(0, 50)} ${c.gray('[마감 ' + close + ']')}`);
          total += 1;
        }
      }
      console.log(`\n총 ${total}건`);
    },
  },

  show: {
    summary: '공고/입찰 상세 (g2b는 license_limits 포함)',
    usage: 'ann show <클래스> <objectId> [--json]',
    async run({ parse }, argv) {
      const { pos, opts } = parseArgs(argv, { booleans: ['json'] });
      const [klass, id] = pos;
      if (!klass || !id) fail('클래스명과 objectId 가 필요합니다. 예: ann show G2bBid <id>');
      const d = await parse.get(klass, id);
      if (opts.json) { console.log(JSON.stringify(d, null, 2)); return; }
      console.log(c.bold(`=== ${d.title} (${klass}/${id}) ===`));
      for (const k of ['org', 'notice_org', 'demand_org', 'region', 'participation_region',
        'close_at', 'bid_close_at', 'bid_division', 'industry_code', 'license_limits', 'status', 'url']) {
        const v = d[k];
        if (v == null || v === '') continue;
        const disp = (v && typeof v === 'object') ? (v.iso || JSON.stringify(v)) : v;
        console.log(`  ${k.padEnd(18)}: ${disp}`);
      }
    },
  },
};

export const intake = {
  list: {
    summary: '고객 폼 응답 목록 (최신순)',
    usage: 'intake list [-c <ref>] [-n 30]',
    async run({ parse }, argv) {
      const { opts } = parseArgs(argv, { aliases: { '-n': 'limit', '-c': 'company' } });
      const where = {};
      if (opts.company) {
        const co = await resolveCompany(parse, opts.company);
        where.company = companyPtr(co.objectId);
      }
      const rows = await parse.find('CompanyIntake', { where, limit: Number(opts.limit || 30), order: '-createdAt', include: 'company' });
      table(['objectId', '제출일', '업체명', '상태'], rows.map((r) => [
        r.objectId, shortDate(r.submitted_at || r.createdAt), (r.biz_name || '').slice(0, 24), r.status || 'new',
      ]));
      console.log(`총 ${rows.length}건`);
    },
  },

  show: {
    summary: '폼 응답 상세',
    usage: 'intake show <intake-id> [--json]',
    async run({ parse }, argv) {
      const { pos, opts } = parseArgs(argv, { booleans: ['json'] });
      const d = await parse.get('CompanyIntake', pos[0]);
      if (opts.json) { console.log(JSON.stringify(d, null, 2)); return; }
      console.log(c.bold(`=== ${d.biz_name || '(이름 없음)'} (${d.objectId}) ===`));
      console.log(`제출일 : ${shortDate(d.submitted_at)}`);
      console.log(`상태   : ${d.status || 'new'}`);
      for (const [label, key] of [['업종', 'biz_division'], ['규모', 'company_size'], ['지역', 'main_region'], ['나라장터', 'g2b_registered']]) {
        if (d[key]) console.log(`${label.padEnd(8)}: ${d[key]}`);
      }
      if (d.about) console.log(`\n[회사 소개]\n  ${d.about}`);
      if ((d.certifications || []).length) console.log(`\n[인증] ${d.certifications.join(', ')}`);
      if (d.free_notes) console.log(`\n[자유 메모]\n  ${d.free_notes}`);
    },
  },
};
