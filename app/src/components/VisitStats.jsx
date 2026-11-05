import React, { useEffect, useState } from 'react';
import { readVisits } from '../data/visits.js';

export default function VisitStats() {
  const [v, setV] = useState(null);

  useEffect(() => {
    let alive = true;
    readVisits()
      .then((x) => { if (alive) setV(x); })
      .catch(() => { /* 计数服务不可达时整块隐藏 */ });
    return () => { alive = false; };
  }, []);

  if (!v) return null;
  return (
    <span className="visit" title="页面访问次数 · 独立访客数">
      访问 <b>{v.pv}</b>
      {v.uv != null && <> · 访客 <b>{v.uv}</b></>}
    </span>
  );
}
