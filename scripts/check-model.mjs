import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = new URL('../model.html', import.meta.url);
assert.ok(fs.existsSync(path), 'model.html must exist');
const html = fs.readFileSync(path, 'utf8');
for (const marker of [
  'vendor/three.min.js',
  'vendor/OrbitControls.min.js',
  'data/app-data.js',
  'id="scene"',
  'createSite',
  'createBuildings',
  'createVegetation',
  'createWaterPlay',
  'makeLabel',
  'HOME_POS',
  'OrbitControls',
]) {
  assert.ok(html.includes(marker), `model.html must include ${marker}`);
}
console.log('model.html structure validation passed.');
