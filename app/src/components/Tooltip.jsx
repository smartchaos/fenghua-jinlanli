import React from 'react';

export default function Tooltip({ hover }){
  const style = hover ? { left: hover.x, top: hover.y, opacity: 1 } : { opacity: 0 };
  const p = hover ? (hover.b.rate*100).toFixed(1) : '';
  return (
    <div className="tip" style={style}>
      {hover && (
        <>
          <b>{hover.b.name}</b>
          <span>{hover.b.joined}/{hover.b.total} 户已入群 · <em>{p}%</em></span>
        </>
      )}
    </div>
  );
}
