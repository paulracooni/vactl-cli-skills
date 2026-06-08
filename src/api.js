// Parse REST + worker HTTP 클라이언트 (마스터키 인증).

export function makeParse(cfg) {
  const base = String(cfg.parseUrl).replace(/\/+$/, '');
  const headers = {
    'X-Parse-Application-Id': cfg.appId,
    'X-Parse-Master-Key': cfg.masterKey,
    'Content-Type': 'application/json',
  };

  async function req(method, path, { query, body } = {}) {
    let url = base + path;
    if (query) {
      const u = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v != null) u.set(k, v);
      url += '?' + u.toString();
    }
    let res;
    try {
      res = await fetch(url, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error(`서버 연결 실패 (${base}): ${e.message}`);
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
    if (!res.ok) {
      const msg = data && data.error ? data.error : (typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200));
      throw new Error(`Parse ${method} ${path} → ${res.status}: ${msg}`);
    }
    return data;
  }

  return {
    base,
    get: (klass, id, keys) => req('GET', `/classes/${klass}/${encodeURIComponent(id)}`, keys ? { query: { keys } } : {}),
    async find(klass, opts = {}) {
      const q = { limit: String(opts.limit ?? 100) };
      if (opts.where) q.where = JSON.stringify(opts.where);
      if (opts.order) q.order = opts.order;
      if (opts.skip) q.skip = String(opts.skip);
      if (opts.keys) q.keys = opts.keys;
      if (opts.include) q.include = opts.include;
      const r = await req('GET', `/classes/${klass}`, { query: q });
      return r.results || [];
    },
    create: (klass, data) => req('POST', `/classes/${klass}`, { body: data }),
    update: (klass, id, patch) => req('PUT', `/classes/${klass}/${encodeURIComponent(id)}`, { body: patch }),
    del: (klass, id) => req('DELETE', `/classes/${klass}/${encodeURIComponent(id)}`),
  };
}

export function makeWorker(cfg) {
  const base = String(cfg.workerUrl || cfg.parseUrl.replace(/\/parse\/?$/, '')).replace(/\/+$/, '');
  const headers = {
    'X-Parse-Master-Key': cfg.masterKey,
    'Content-Type': 'application/json',
  };
  async function req(method, path, body) {
    let res;
    try {
      res = await fetch(base + path, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error(`워커 연결 실패 (${base}): ${e.message}`);
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
    if (!res.ok) {
      const msg = typeof data === 'string' ? data.slice(0, 200) : (data.detail || JSON.stringify(data).slice(0, 200));
      throw new Error(`worker ${method} ${path} → ${res.status}: ${msg}`);
    }
    return data;
  }
  return { base, get: (p) => req('GET', p), post: (p, b) => req('POST', p, b) };
}

export const ptr = (klass, objectId) => ({ __type: 'Pointer', className: klass, objectId });
export const companyPtr = (id) => ptr('Company', id);
export const parseDate = (iso) => ({ __type: 'Date', iso });
export const opDelete = { __op: 'Delete' };
