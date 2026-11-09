/* 小区平面纹理配色（日夜双套） */
export const SITE_PAL = {
  night: {
    base:'#0a1210', vig:'rgba(30,48,42,.5)', plot:'#122019',
    river:['#0a1c28','#0d2836','#0b1f2b'], wave:'rgba(120,180,200,.10)',
    bank:'rgba(9,14,13,.9)', bankEdge:'rgba(120,160,130,.10)',
    road:'#101317', roadDash:'rgba(228,235,242,.6)',
    path:'#1b2629', pathDash:'rgba(210,200,180,.10)',
    belt:'rgba(22,44,34,.55)',
    treeLo:22, treeSpan:22,
    flower:{soil:'#0d1811', edge:'rgba(64,76,64,.45)', green:'#15261a', greenHi:'#1c3323',
      red:'#571f28', orange:'#59311c', yellow:'#57491c', pink:'#572e3e', white:'#3e3e3c'},
    lblRiver:'rgba(130,165,180,.45)', lblRoad:'rgba(150,160,175,.38)'
  },
  day: {
    base:'#6d8b5c', vig:'rgba(196,208,168,.32)', plot:'#7f9e68',
    river:['#5d8fa8','#7fa9bd','#6395ad'], wave:'rgba(235,245,250,.22)',
    bank:'rgba(78,88,72,.9)', bankEdge:'rgba(240,244,236,.24)',
    road:'#3a3b3c', roadDash:'rgba(238,236,225,.82)',
    path:'#cfc9b8', pathDash:'rgba(120,112,98,.24)',
    belt:'rgba(70,94,58,.5)',
    treeLo:64, treeSpan:30,
    flower:{soil:'#3f5a31', edge:'rgba(206,208,188,.8)', green:'#507144', greenHi:'#6d8b55',
      red:'#b85457', orange:'#c47a46', yellow:'#c6a952', pink:'#bd8194', white:'#dddcd2'},
    lblRiver:'rgba(40,64,78,.55)', lblRoad:'rgba(64,74,84,.5)'
  }
};
