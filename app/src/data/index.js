/* 数据层: 楼栋/户室/元信息 + 纯函数工具(React UI 与 three 场景共用) */
import APP_DATA from './app-data.js';

export const D = APP_DATA;
export const B = D.buildings;
export const roomList = D.rooms;

export const roomsByB = {};
roomList.forEach(r => (roomsByB[r.b] = roomsByB[r.b] || []).push(r));

export function heightOf(b){ return b.type === '洋房' ? b.floors*3.2+1.4 : 4.4 + (b.floors-1)*3.05 + 1.4; }

/* 侧板楼层行(纯数据 → React 渲染) */
export function floorRows(b){
  const list = roomsByB[b.id] || [];
  const rows = [];
  for(let f = b.floors; f >= 1; f--){
    if(f < b.residentFrom){
      rows.push({ f, void: true, chips: [], cnt: 0, total: 0 });
      continue;
    }
    const fr = list.filter(r=>r.f === f).sort((a, c)=>c.col-a.col);
    rows.push({
      f,
      void: false,
      chips: fr.map(r=>({
        key: r.key,
        label: b.type === '洋房' ? `${r.u}-${f}${String(r.no).padStart(2, '0')}` : `${f}${String(r.no).padStart(2, '0')}`,
        on: r.joined > 0
      })),
      cnt: fr.filter(r=>r.joined > 0).length,
      total: fr.length
    });
  }
  return rows;
}
