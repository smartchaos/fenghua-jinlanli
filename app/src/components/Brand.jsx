import React from 'react';
import { D } from '../data/index.js';

export default function Brand(){
  return (
    <div className="ui brand">
      <div className="brand-top">
        <div className="mark">锦</div>
        <div>
          <h1>风华锦澜里</h1>
          <div className="scope">BROCADE · 立体住区</div>
        </div>
      </div>
      <div className="sub">以真实楼栋关系重建的住区：亮窗为已入群家庭。<br />点击楼栋查看逐户状态 · 拖拽旋转 · 滚轮缩放</div>
      <div className="stat-row">
        <div className="st accent"><b>{D.meta.households}<i>户</i></b><span>已入群</span></div>
        <div className="st"><b>{D.meta.totalHouseholds}<i>户</i></b><span>全盘户数</span></div>
        <div className="st"><b>{(D.meta.coverage*100).toFixed(1)}<i>%</i></b><span>覆盖率</span></div>
      </div>
    </div>
  );
}
