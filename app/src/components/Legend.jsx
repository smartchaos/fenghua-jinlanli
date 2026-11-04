import React from 'react';

export default function Legend(){
  return (
    <>
      <div className="ui legend">
        <span><i className="on"></i>已入群</span>
        <span><i className="off"></i>未入群</span>
        <span><i className="void"></i>架空层</span>
      </div>
      <div className="ui compass"><div className="n">N</div>北</div>
    </>
  );
}
