/* 小区平面纹理配色（日夜双套） */
export const SITE_PAL = {
  night: {
    base:'#0a1210', vig:'rgba(30,48,42,.5)', plot:'#122019',
    river:['#0a1c28','#0d2836','#0b1f2b'], wave:'rgba(120,180,200,.10)',
    bank:'rgba(9,14,13,.9)', bankEdge:'rgba(120,160,130,.10)',
    road:'#101317', roadDash:'rgba(228,235,242,.6)',
    path:'#1b2629', pathDash:'rgba(210,200,180,.10)',
    belt:'rgba(22,44,34,.55)',
    treeLo:22, treeSpan:22, treeFill:s=>`rgba(${s},${s+22},${s+12},.55)`, treeHi:'rgba(120,170,130,.07)',
    flower:{soil:'#0d1811', edge:'rgba(64,76,64,.45)', green:'#15261a', greenHi:'#1c3323',
      red:'#571f28', orange:'#59311c', yellow:'#57491c', pink:'#572e3e', white:'#3e3e3c'},
    lblRiver:'rgba(130,165,180,.45)', lblRoad:'rgba(150,160,175,.38)'
  },
  day: {
    base:'#79a85f', vig:'rgba(215,230,185,.5)', plot:'#8fb96f',
    river:['#69a0c3','#86b5d4','#75aacb'], wave:'rgba(255,255,255,.30)',
    bank:'rgba(96,116,94,.9)', bankEdge:'rgba(255,255,255,.28)',
    road:'#3d4248', roadDash:'rgba(255,255,255,.95)',
    path:'#e3ded1', pathDash:'rgba(130,120,105,.28)',
    belt:'rgba(76,116,62,.5)',
    treeLo:64, treeSpan:30, treeFill:s=>`rgba(${s},${s+34},${s+18},.5)`, treeHi:'rgba(235,245,220,.15)',
    flower:{soil:'#41622f', edge:'rgba(214,218,192,.85)', green:'#4e7a37', greenHi:'#689a4b',
      red:'#cf4453', orange:'#dd7a3a', yellow:'#dcb63c', pink:'#d87f9e', white:'#edede7'},
    lblRiver:'rgba(45,70,88,.55)', lblRoad:'rgba(70,82,95,.5)'
  }
};
