# 微信群成员快照重采手册（Computer Use）

适用场景：群成员变动后重采 `data/raw/dense_*.txt` 并重算。前置：微信桌面端已登录、
群聊可打开；`data/raw/` 已备份（该目录被 gitignore）。

## 前置检查

- `cp -R data/raw .backup-raw/raw-$(date +%Y%m%d-%H%M%S)`（无版本兜底，先备份）。
- `git fetch origin && git rev-parse HEAD^{tree} origin/main^{tree}`：两 tree 相同则代码已最新。
  若历史被重写（无共同祖先）勿 merge/reset，内容一致即可。

## 采集（唯一需要人工的一步）

微信窗口必须**在前台可见**（滚轮事件依赖可见窗口，AX 读取可后台）。
面板收起态只有 ~16 项：需点「查看更多 ⌄」展开（该按钮不在无障碍树，坐标/元素都点不到）。
「收起」字样 = 已展开；面板被滚到底部时 AX 只剩 3~13 项，滚回顶部即可恢复 54+。

## 执行

在 Qoder node_repl（已加载 computer-use 技能）里逐段执行：

```js
var cua = await (await import("@qoder-space/computer-use")).ComputerUse.createAppClient();
var wechat = await cua.getApp("WeChat");
var FS = await import('node:fs');
var RAWDIR = '<repo>/data/raw';
var cap = async () => {
  var st = await wechat.getAXState({emit:false, disableDiffing:true});
  var m = st.match(/(\d+) 列表 聊天成员[^\n]*\n\s*(\d+) StaticText ([^\n]+)/);
  return {st, listId: m ? +m[1] : null, tokens: m ? m[3].trim().split(/\s+/) : []};
};
var ov = (p,c)=>{ if(!p) return -1; for(var k=Math.min(p.length,c.length);k>0;k--){ if(p.slice(-k).join(' ')===c.slice(0,k).join(' ')) return k; } return 0; };
// 滚到顶、逐屏 0.25 页抓取：相邻屏重叠须 >0（经验值 38~48），为 0 即漏抓需重采
for (var i=0;i<20;i++){ var x=await cap(); if(!x.listId) break; await wechat.scroll(x.listId,'up',5); }
var HIST=[], rep=[];
for (var s=0;s<32;s++){
  var a=await cap(); if(!a.listId){rep.push({err:s});break;}
  FS.writeFileSync(RAWDIR+'/new_dense_'+String(s).padStart(2,'0')+'.txt', a.st);
  rep.push({f:s,n:a.tokens.length,ov:ov(HIST[HIST.length-1],a.tokens)}); HIST.push(a.tokens);
  await wechat.scroll(a.listId,'down',0.25);
  var b=await cap(); if(b.tokens.join(' ')===a.tokens.join(' ')){rep.push({STOP:s});break;}
}
rep;
```

校验：相邻 `ov` 全 >0；拼接唯一数 ≈ 群人数 − 重名数（2026-11-06：269 唯一 / 303 人）。
然后 `rm data/raw/dense_*.txt && for f in data/raw/new_dense_*.txt; do mv "$f" "${f#new_}"; done`。

## 重算与口径

1. 改 `scripts/parse.py` 顶部 `SNAPSHOT_DATE` / `SNAPSHOT_GROUP_SIZE`（= 群标题人数）。
2. 快照里房号无法解析的新成员，映射加 `data/raw/member-overrides.json` 的 `userConfirmed`；
   名字+房号被空格拆开但其实是两人时，把名字加 `noMerge`。
3. `python3 scripts/parse.py`，关注「补录去重/待确认」与 `unresolvedMembers`。
4. 更新 `report.html` 硬编码数字（hero/KPI 兜底/bar-note/mini-note/口径/页脚日期，JS 会覆盖
   带 id 的 KPI，但静态文案要手改），`data/app-data.js` 引用版本号 +1。
5. `cd app && npm run build` 重建 `model.html`。

## 教训（本次踩过）

- 0.25 页 ≈ 移动 12 人；1 页整滚相邻重叠为 0，无法验证连续性，会漏抓。
- 采集到的人若曾在 `manual-members.csv` 手工补录过，`parse.py` 的 `dedup_manual` 会按
  昵称自动剔除并在 stdout 打印；同户第二人只提示不删。台账退役后映射进 overrides。
