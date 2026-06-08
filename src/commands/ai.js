import {
  parseArgs, resolveCompany, c, ok, fail,
} from '../util.js';

export const ai = {
  refresh: {
    summary: '피드백·메모 분석 → 가이드·제외규칙 초안 생성 (워커/Gemini)',
    usage: 'ai refresh <ref>',
    async run({ parse, worker }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      const r = await worker.post(`/api/companies/${co.objectId}/ai-refresh`);
      if (!r.ok) fail(`실패/스킵: ${JSON.stringify(r)}`);
      ok(`제안 생성: 키워드 ${r.keywords_count}개, 가이드 ${r.guide_length}자`);
      console.log("  → 'vactl ai show' 로 확인, 'vactl ai apply-guide' 로 적용");
    },
  },

  show: {
    summary: 'AI 제안(가이드 초안·키워드·제안 프로필) 출력',
    usage: 'ai show <ref>',
    async run({ parse }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      console.log(c.bold(`=== ${co.name} — AI 제안 ===`));
      console.log(c.cyan('\n[가이드 초안]'));
      console.log(co.ai_guide_draft || '(없음)');
      const kw = co.ai_keywords_suggested || [];
      console.log(c.cyan(`\n[추천 키워드 ${kw.length}]`));
      console.log('  ' + (kw.join(', ') || '(없음)'));
      const sug = co.ai_profile_suggested || {};
      console.log(c.cyan('\n[제안 keywords_out] ') + ((sug.keywords_out || []).join(', ') || '(없음)'));
      console.log(c.cyan('[제안 categories_avoid] ') + ((sug.categories_avoid || []).join(', ') || '(없음)'));
    },
  },

  'apply-guide': {
    summary: '안전: 가이드 교체 + 제외어·회피분야 추가 병합',
    usage: 'ai apply-guide <ref>',
    async run({ parse }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      const guide = (co.ai_guide_draft || '').trim();
      const sug = co.ai_profile_suggested || {};
      if (!guide && !Object.keys(sug).length) fail("적용할 AI 제안이 없습니다. 먼저 'ai refresh'.");
      const p = { ...(co.profile || {}) };
      for (const key of ['keywords_out', 'categories_avoid']) {
        const add = (sug[key] || []).map((x) => String(x).trim()).filter(Boolean);
        const cur = [...(p[key] || [])];
        p[key] = cur.concat(add.filter((a) => !cur.includes(a)));
      }
      const patch = { profile: p };
      if (guide) patch.matching_guide = guide;
      await parse.update('Company', co.objectId, patch);
      ok(`가이드+제외어 반영: ${co.objectId}`);
    },
  },

  'apply-profile': {
    summary: 'AI 제안 프로필 전체 적용 (덮어쓰기)',
    usage: 'ai apply-profile <ref>',
    async run({ parse }, argv) {
      const { pos } = parseArgs(argv);
      const co = await resolveCompany(parse, pos[0]);
      const prof = co.ai_profile_suggested || {};
      if (!Object.keys(prof).length) fail("적용할 제안 프로필이 없습니다. 먼저 'ai refresh'.");
      const patch = { profile: prof };
      const guide = (co.ai_guide_draft || '').trim();
      if (guide) patch.matching_guide = guide;
      await parse.update('Company', co.objectId, patch);
      ok(`프로필 전체 적용: ${co.objectId}`);
    },
  },
};
