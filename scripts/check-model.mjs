import fs from 'node:fs';
import assert from 'node:assert/strict';

// model.html 现为 Vite 单文件构建产物(源在 app/), 校验产物完整性与关键标记
const path = new URL('../model.html', import.meta.url);
assert.ok(fs.existsSync(path), 'model.html must exist');
const html = fs.readFileSync(path, 'utf8');
for (const marker of [
  'id:"scene"',
  'id="root"',
  '__MODEL',
  'spax-theme-v2',
  '风华锦澜里',
  '京 杭 大 运 河',
  '顾 扬 路',
  '朱 家 坝 路',
  '自动巡览',
]) {
  assert.ok(html.includes(marker), `model.html must include ${marker}`);
}
const moduleScripts = html.match(/<script type="module"[^>]*>/g) || [];
assert.ok(moduleScripts.length >= 1, 'model.html must inline the module bundle');
console.log('model.html structure validation passed.');
