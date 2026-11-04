import React, { useRef } from 'react';
import { floorRows } from '../data/index.js';

export default function Panel({ b, onClose }){
  // 关闭动画期间(0.42s 滑出)继续渲染最后一次的楼栋数据, 避免内容瞬间卸载
  const last = useRef(b);
  if(b) last.current = b;
  const shown = b || last.current;
  if(!shown){
    return <aside className="panel" />;
  }
  const open = !!b;
  const p = shown.rate * 100;
  const rows = floorRows(shown);
  return (
    <aside className={`panel${open ? ' open' : ''}`}>
      <div className="p-top">
        <div>
          <div className="p-name">{shown.name}</div>
          <span className="p-type">{shown.type} · {shown.floors}F · {shown.total} 户</span>
        </div>
        <button className="p-close" onClick={onClose}>×</button>
      </div>
      <div className="p-hero">
        <div className="ring" style={{ '--p': p.toFixed(1) }}><span>{Math.round(p)}%</span></div>
        <div>
          <div className="p-num">{shown.joined}<small> / {shown.total} 户</small></div>
          <div className="p-sub">{shown.type === '洋房' ? '洋房 · 两单元四户（1F 两户）' : '小高层 · 两梯三户'}</div>
        </div>
      </div>
      <div className="p-bar"><i style={{ width: p.toFixed(1) + '%' }}></i></div>
      <div className="p-section"><span>楼层 / 房号</span><span>已入群</span></div>
      <div className="p-floors">
        {rows.map(r=> r.void ? (
          <div className="frow void" key={r.f}>
            <div className="fno">{r.f}F</div>
            <div className="fchips">架空层 / 入户大堂</div>
            <div className="fc"></div>
          </div>
        ) : (
          <div className="frow" key={r.f}>
            <div className="fno">{r.f}F</div>
            <div className="fchips">
              {r.chips.map(c=> <span key={c.key} className={c.on ? 'chip on' : 'chip'} title={c.key}>{c.label}</span>)}
            </div>
            <div className={`fc${r.cnt === r.total ? ' full' : ''}`}>{r.cnt}/{r.total}</div>
          </div>
        ))}
      </div>
      <div className="p-note">
        {shown.type === '洋房'
          ? '7 层洋房：1F 2 户，2–7F 每层 4 户；逐户状态按房号归并，不含业主姓名。'
          : '逐户状态按房号归并，不含业主姓名。'}
      </div>
    </aside>
  );
}
