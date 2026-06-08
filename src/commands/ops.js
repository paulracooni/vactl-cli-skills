import { parseArgs, c, ok, table } from '../util.js';

export const scheduler = {
  jobs: {
    summary: '백그라운드 잡 + 최근 실행',
    usage: 'scheduler jobs',
    async run({ worker }) {
      const d = await worker.get('/admin/scheduler.json');
      table(['잡', 'cron', '상태', '다음 실행'], (d.jobs || []).map((j) => [
        j.id, j.cron, j.paused ? 'paused' : 'active', j.next_run || '-',
      ]));
      console.log(c.cyan('\n--- 최근 실행 ---'));
      for (const r of (d.recent_runs || []).slice(0, 5)) {
        console.log(`  ${r.started_at} | ${(r.job_id || '').padEnd(20)} | ${(r.status || '').padEnd(8)} | ${r.duration_ms || 0}ms`);
      }
    },
  },

  run: {
    summary: '잡 즉시 트리거 (비동기)',
    usage: 'scheduler run <job_id>   (daily.collect/match/learn/ai_refresh/lifecycle ...)',
    async run({ worker }, argv) {
      const { pos } = parseArgs(argv);
      const jobId = pos[0];
      if (!jobId) { console.error('job_id 가 필요합니다.'); process.exit(1); }
      const r = await worker.post(`/admin/scheduler/trigger?job_id=${encodeURIComponent(jobId)}`);
      ok(`트리거: ${jobId}`);
      console.log(JSON.stringify(r));
    },
  },
};

export const stats = {
  _bare: {
    summary: 'KPI 요약',
    usage: 'stats',
    async run({ worker }) {
      const d = await worker.get('/admin/stats.json');
      console.log(c.bold('=== KPI ==='));
      for (const [k, v] of Object.entries(d.kpi || {})) {
        console.log(`  ${k.padEnd(24)} = ${typeof v === 'number' ? v.toLocaleString() : v}`);
      }
      if (d.per_class_counts) {
        console.log(c.bold('\n=== per_class_counts ==='));
        for (const [k, v] of Object.entries(d.per_class_counts)) {
          console.log(`  ${k.padEnd(24)} = ${typeof v === 'number' ? v.toLocaleString() : v}`);
        }
      }
    },
  },
};
