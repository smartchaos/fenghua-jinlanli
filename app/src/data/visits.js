// 访问统计：公共计数器（无 Cookie、无第三方脚本，仅两个自增计数）。
// 访问次数 pv 每次加载 +1；访客数 uv 每个浏览器 +1（localStorage 标记）。
const BASE = 'https://abacus.jasoncameron.dev';
const NS = 'spax-fenghua';
const TIMEOUT = 10000;

async function req(kind, key, signal) {
  const r = await fetch(`${BASE}/${kind}/${NS}/${key}`, { signal, cache: 'no-store' });
  if (!r.ok) throw new Error(`counter ${r.status}`);
  const j = await r.json();
  if (typeof j.value !== 'number') throw new Error('counter payload');
  return j.value;
}

export function readVisits() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  let seen = false;
  try { seen = !!localStorage.getItem('spax-visitor'); } catch (_) { /* 隐私模式 */ }

  const uv = seen
    ? Promise.resolve(0).then(() => req('get', 'visitors', ctrl.signal))
    : req('hit', 'visitors', ctrl.signal).then((n) => {
        try { localStorage.setItem('spax-visitor', '1'); } catch (_) { /* 忽略 */ }
        return n;
      });

  return Promise.all([req('hit', 'pageviews', ctrl.signal), uv])
    .then(([pv, visitors]) => ({ pv, uv: visitors }))
    .finally(() => clearTimeout(timer));
}
