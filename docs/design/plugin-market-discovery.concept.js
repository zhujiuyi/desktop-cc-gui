/* ===========================================================================
 * 插件市场 · 精选与发现流 —— 概念占位图
 *
 * 没有真图时画一张「像截图」的占位：色块 + 假窗口，不引图标库、不请求网络。
 * 它在素材链里的位置：真图 → 插件 icon → 本文件的渐变块（fallback）。
 * 概念图本身也是评审用的第三种素材模式（见主文件的 S.art）。
 * ======================================================================== */
(function () {
  "use strict";

  var TONES = [
    ["#2b7fff", "#1d4ed8"], ["#8b5cf6", "#6d28d9"], ["#10b981", "#047857"], ["#f59e0b", "#b45309"],
    ["#ec4899", "#be185d"], ["#06b6d4", "#0e7490"], ["#6366f1", "#4338ca"], ["#f43f5e", "#be123c"],
  ];
  /* 同一个 id 永远同一个色相：八色循环，着色只用 id 哈希 */
  function hash(s) {
    var h = 0, i;
    for (i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function toneFor(id) { return TONES[hash(id) % TONES.length]; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* 概念「截图」：五套版式，按插件类别挑，同类再按 id 在两种版式间轮换 */
  function sceneHTML(kind, seed) {
    var t = TONES[seed % TONES.length], body;
    var row = '<div class="shot__row"><i></i><i></i><i></i></div>';
    var foot = '<div class="shot__foot"><i></i><i></i></div>';
    if (kind === "providers") body = '<div class="shot__grid">' + row + row + row + row + row + "</div>";
    else if (kind === "naming") body = '<div style="display:flex;flex-direction:column;gap:9px"><span class="shot__chip">✨ 会话标题</span><div class="shot__grid">' + row + row + "</div></div>";
    else if (kind === "chart") body = '<div class="shot__cols"><div class="shot__col"><b style="--h:46%"></b></div><div class="shot__col"><b style="--h:82%"></b></div><div class="shot__col"><b style="--h:64%"></b></div></div><div class="shot__grid">' + row + "</div>";
    else if (kind === "ring") body = '<div style="display:flex;gap:12px;align-items:center"><div class="shot__ring"><b></b></div><div style="flex:1;display:flex;flex-direction:column;gap:8px"><div class="shot__rowline"><span class="r"></span><span class="r"></span></div><div class="shot__rowline"><span class="r"></span><span class="r"></span></div><div class="shot__rowline"><span class="r"></span><span class="r"></span></div></div></div>' + row;
    else body = '<div class="shot__cols"><div class="shot__col"></div><div class="shot__col"></div><div class="shot__col" style="background:var(--sa);opacity:.35"></div></div><div class="shot__grid">' + row + row + "</div>";
    return '<div class="shot" style="--sa:' + t[0] + ";--sb:" + t[1] + '" aria-hidden="true"><div class="shot__wash"></div><div class="shot__win"><div class="shot__bar"><i></i><i></i><i></i></div>' + body + foot + "</div></div>";
  }
  var ALT = { providers: "relay", naming: "providers", chart: "ring", ring: "chart", relay: "naming" };
  function forPlugin(p) {
    var kind = hash(p.id) % 2 === 0 ? p.scene : (ALT[p.scene] || p.scene);
    return sceneHTML(kind, hash(p.id));
  }

  /* 素材链最后一级：没有截图也没有 icon 时的确定性渐变块 + 首字 */
  function fallback(p) {
    var t = toneFor(p.id);
    return '<div class="shot" style="--sa:' + t[0] + ";--sb:" + t[1] + '" aria-hidden="true"><div class="shot__wash" style="filter:saturate(.5)"></div><span class="avatar" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:56px;height:56px;font-size:24px;border:2px solid rgb(255 255 255 / .5);background-image:linear-gradient(160deg,' + t[0] + "," + t[1] + ')">' + esc(Array.from(p.name)[0]) + "</span></div>";
  }

  window.CONCEPT = { hash: hash, tone: toneFor, forPlugin: forPlugin, fallback: fallback };
})();
