import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../data/app-data.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const data = context.window.APP_DATA;
assert.ok(data, 'APP_DATA must exist');

const b = Object.fromEntries(data.buildings.map(x => [x.id, x]));
const centroid = ids => ({
  x: ids.reduce((sum, id) => sum + b[id].x, 0) / ids.length,
  z: ids.reduce((sum, id) => sum + b[id].z, 0) / ids.length,
});
const close = (actual, expected, label) => {
  assert.ok(Math.abs(actual.x - expected.x) <= 5, `${label} x: ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.z - expected.z) <= 5, `${label} z: ${actual.z} != ${expected.z}`);
};

assert.equal(data.buildings.length, 12, '12 buildings are required');
assert.equal(data.meta.totalHouseholds, 478, 'total households must be 478');
for (const id of [11, 12]) {
  assert.equal(b[id].floors, 7, `${id}# must have 7 floors`);
  assert.equal(b[id].total, 26, `${id}# must have 26 households`);
  assert.equal(b[id].residentFrom, 1, `${id}# residences start at 1F`);
}

assert.equal(b[1].z, 85, '1# must be on land, not on 朱家坝路');
assert.equal(b[2].z, 85, '2# must be on land, not on 朱家坝路');
assert.ok(b[1].x > b[2].x, '1# is to the right of 2#');
assert.ok(Math.abs(b[1].x - b[2].x) >= 90, 'left-right spacing must be increased by 30%');
assert.equal(b[4].z, 30, '4# must be behind 1#/2#');
assert.equal(b[5].z, 30, '5# must be behind 1#/2#');
assert.equal(b[6].z, -5, '6# must be behind 4#/5#');
assert.equal(b[7].z, -5, '7# must be behind 4#/5#');
assert.equal(b[9].z, -50, '9# must be behind 6#/7#');
assert.equal(b[10].z, -50, '10# must be behind 6#/7#');
assert.equal(b[11].z, -80, '11# must be at the back');
assert.equal(b[12].z, -80, '12# must be at the back');

for (const building of data.buildings) {
  const halfW = building.type === '洋房' ? 22 : 19;
  const halfD = building.type === '洋房' ? 8 : 7;
  assert.ok(Math.abs(building.x) + halfW < 100, `${building.name} overlaps 顾扬路`);
  assert.ok(building.z + halfD < 100, `${building.name} overlaps 朱家坝路`);
  assert.ok(building.z - halfD > -100, `${building.name} overlaps the river`);
}

close(b[3], centroid([1, 2, 4, 5]), '3# must be at the center of 1#/2#/4#/5#');
close(b[8], centroid([6, 7, 9, 10]), '8# must be at the center of 6#/7#/9#/10#');

for (const id of [11, 12]) {
  const rows = data.rooms.filter(r => r.b === id);
  assert.equal(rows.filter(r => r.f === 1).length, 2, `${id}# 1F must have 2 households`);
  for (let f = 2; f <= 7; f++) {
    assert.equal(rows.filter(r => r.f === f).length, 4, `${id}# ${f}F must have 4 households`);
  }
}

console.log('Layout validation passed: front/back order, centers, floors, and totals are correct.');
