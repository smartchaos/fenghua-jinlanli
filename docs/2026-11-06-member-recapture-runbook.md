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

校验：相邻 `ov` 全 >0；拼出的成员数应等于群标题人数（`captured == groupSize`，门禁会卡）。
唯一昵称数会小于人数——同名成员（同户多人共用「纯房号」备注）是真实的，不要折叠。
然后 `rm data/raw/dense_*.txt && for f in data/raw/new_dense_*.txt; do mv "$f" "${f#new_}"; done`。

## 重算与口径

1. 改 `scripts/parse.py` 顶部 `SNAPSHOT_DATE`；群人数直接读快照标题，不用手改常量。
2. 快照里房号无法解析的新成员，映射加 `data/raw/member-overrides.json` 的 `userConfirmed`；
   名字+房号被空格拆开但其实是两人时，把名字加 `noMerge`。
3. `python3 scripts/parse.py`。
4. `cd app && npm run build` 重建 `model.html`（3D 页把数据内联进构建产物，不重建就还是旧名单）。
5. `python3 scripts/check-data.py` 跑数据门禁，报 FAIL 就不要发布。

`report.html` 的所有数字由 `data/app-data.js` 驱动，缓存版本号由门禁自动对齐，不用手改。

## 数据门禁（`scripts/check-data.py`）

一次跑完，把"要人肉排查"的事自动化。分三档：`[FAIL]` 必须修、`[WARN]` 建议看、`[INFO]` 备案。

- **口径自洽**：快照标题群人数 = 产物群人数 = `captured`（抓到人数 ≠ 群人数即说明漏屏/多算）；
  户内人数合计 = 已识别成员；已识别 + 未识别 = 群人数；房号清单 = 478 户且无重复。
- **归属正确**：昵称里写了房号就必须与归属房号一致（抓错并户）；单户入群人数 >6 直接报错。
- **发布同步**：`model.html` 必须内联当前群人数/户数/口径日期，否则报错提醒重建；
  `report.html` 必须保留数据占位符（防止有人又把数字写死）。
- **可疑项**：三人及以上户、未识别成员逐条列出；同户同名只报总数（`--list` 展开）；
  与上一版对比户数/人数突变超阈值会告警。
- `--strict` 把 WARN 也当失败（用于发布前卡口）。

**别折叠"同户同名"**：群里很多人把全家备注都设成同一个房号，同一户出现 2~3 个相同昵称
是真实的（2026-11-11 用户在群里确认「3-801 确实是 3 个」）。多次独立重采结果完全一致也印证
这一点。真正的多算来自**含空格的昵称被拆成两个 token**（如 `12-2-401 Lydia谣🧸` 被拆成
`12-2-401` + `Lydia谣🧸`），`parse.py` 现在按"纯房号 + 同房号后半段"合并成一人。

## 增量重采（群人数小幅变动，2026-11-09 验证）

不必全量重抓：新成员排在成员列表尾部。滚到底后向上逐屏抓，直到某屏包含旧最后一屏
（dense_NN.txt）的结尾 token；把该屏头部裁剪到与旧 seq 尾部最长公共重叠处，只保留
「重叠 + 新增」，写成 dense_(NN+1).txt 接在旧屏后面（stitch 靠后缀-前缀重叠拼接，
头部不裁剪会把旧名字重复拼进去）。校验：重叠 >0、新增条数 ≈ 群人数增量。

写文件时只替换 StaticText 行的 token _run_，保留「列表 聊天成员」表头行，否则
extract_pages 的正则匹配不到该屏（本次踩过：整行替换吃掉表头，屏被静默跳过）。

窗口置前不必人工：AX 点菜单栏「窗口」→ 菜单项「微信, ID: makeKeyAndOrderFront」用
`performSecondaryAction(item, "Pick")`（click 会因菜单关闭校验失败）。注意区分主窗口
「微信」与阅读窗「微信 (窗口)」；会话列表条目带 `ID: session_item_<群名>` 可直接 AX 点击开群。

## 教训（本次踩过）

- 键盘/坐标事件只送达前台可见窗口；AX 读取与 `setValue` 可后台生效，但 `typeText`/`pressKey`/
  坐标点击在窗口不可见时会落空或落到别的控件。2026-11-09 曾在窗口未置前时 `pressKey Return`，
  把聊天输入框里的草稿误发进当前群，超 2 分钟撤回时限不可逆。按键前置三查：
  ① 截图确认窗口红绿灯为彩色（已置前）；② 读 AX 确认聊天输入框 Value 为空、或内容即本次意图；
  ③ 聊天软件内不用 Return/Enter 触发搜索等 UI，改用按钮或 AX 动作。
  搜索框 `setValue` 只改值不触发搜索面板，真实键入必须先置前窗口。
- 0.25 页 ≈ 移动 12 人；1 页整滚相邻重叠为 0，无法验证连续性，会漏抓。
- 采集到的人若曾在 `manual-members.csv` 手工补录过，`parse.py` 的 `dedup_manual` 会按
  昵称自动剔除并在 stdout 打印；同户第二人只提示不删。台账退役后映射进 overrides。
