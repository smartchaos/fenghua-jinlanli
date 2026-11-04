import React from 'react';

export default function Loader({ done }){
  return (
    <div className={`load${done ? ' done' : ''}`}>
      <div className="l-title">风华锦澜里</div>
      <div className="l-line"><i></i></div>
    </div>
  );
}
