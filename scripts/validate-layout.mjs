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
assert.equal(b[4].z, 37, '4# must be behind 1#/2#');
assert.equal(b[5].z, 37, '5# must be behind 1#/2#');
assert.equal(b[6].z, -6, '6# must be behind 4#/5#');
assert.equal(b[7].z, -6, '7# must be behind 4#/5#');
assert.equal(b[9].z, -49, '9# must be behind 6#/7#');
assert.equal(b[10].z, -49, '10# must be behind 6#/7#');
assert.equal(b[11].z, -88, '11# must be at the back');
assert.equal(b[12].z, -88, '12# must be at the back');
// 南北向楼间距: 4#-6# 与 9#-11# 的净距（中心距减双方基座半深）
const clear = (a, b2) => (b[a].z - b[b2].z) - (b[a].type === '洋房' ? 9.6 : 8.6) - (b[b2].type === '洋房' ? 9.6 : 8.6);
assert.ok(clear(4, 6) >= 25, `4#-6# clear spacing must be >= 25, got ${clear(4, 6)}`);
assert.ok(clear(9, 11) >= 19, `9#-11# clear spacing must be >= 19, got ${clear(9, 11)}`);

/* ---------- 楼间距门禁（2026-11-14 按公开资料校对） ----------
 * 开发商官网 https://canhigh.com/cn_businessxq_cates_72.html 「约78米楼间距」；
 * 焦点 https://www.focus.cn/a/1096633420_100203501 「整体楼间距在35米左右，8号楼南向楼间距约78米」；
 * 规划公示转述 https://cdn.keyland.com.cn/news/85243.html ：用地34165㎡、容积率1.9、密度22%、12幢。
 * 口径 = 建筑主体外墙净距（高层深 14m / 洋房深 16m），不是中心距。
 * 3#、8# 同在中列，中心距 92 - 14 = 78m，即宣传的「最大楼间距」；
 * 其余相邻排中心距 39~48m（净距 24~34m）与「35 米左右」同量级。
 * 地块南北约 171m，5 排楼不可能全取 35m 净距，因此只对可核查的 78m 中庭
 * 做硬约束，其余排距用区间门禁锁住，防止后续误调压路/压河。 */
const bodyGap = (a, c) => (b[a].z - b[c].z)
  - (b[a].type === '洋房' ? 8 : 7) - (b[c].type === '洋房' ? 8 : 7);
assert.ok(Math.abs(bodyGap(3, 8) - 78) <= 1,
  `8# 南向中央中庭净距应约 78m, got ${bodyGap(3, 8)}`);
for (const [front, back] of [[1, 4], [4, 6], [6, 9], [9, 11]]) {
  const centerGap = b[front].z - b[back].z;
  assert.ok(centerGap >= 35 && centerGap <= 50,
    `${front}#-${back}# 排中心距应在 35~50m, got ${centerGap}`);
}

for (const building of data.buildings) {
  const halfW = building.type === '洋房' ? 22 : 19;
  const halfD = building.type === '洋房' ? 8 : 7;
  assert.ok(Math.abs(building.x) + halfW < 100, `${building.name} overlaps 顾扬路`);
  assert.ok(building.z + halfD < 100, `${building.name} overlaps 朱家坝路`);
  assert.ok(building.z - halfD > -100, `${building.name} overlaps the river`);
}
/* 楼排总进深不得超出示意场地（约 190m，对应 34165㎡ 地块南北 ~171m 加示意放大） */
const halfDepth = x => x.type === '洋房' ? 8 : 7;
const southEdge = Math.max(...data.buildings.map(x => x.z + halfDepth(x)));
const northEdge = Math.min(...data.buildings.map(x => x.z - halfDepth(x)));
assert.ok(southEdge - northEdge <= 195,
  `楼排总进深 ${southEdge - northEdge}m 超出地块可用南北长度`);

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
