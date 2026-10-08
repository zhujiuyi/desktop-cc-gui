/* ===========================================================================
 * 插件市场 · 精选与发现流 —— 设计稿行为（纯静态，无构建）
 * 数据 plugin-market-discovery.data.js · 占位图 *.concept.js · 真图直连 GitHub。
 * 落地契约（见对比抽屉）：featured.json = { spotlight[], collections[] }。
 * ======================================================================== */
(function () {
  "use strict";

  /* -------------------------------------------------- 数据（线上快照，不手写） */
  var MOCK = window.MOCK;
  var PLUGINS = MOCK.plugins;
  var FEATURED = MOCK.featured;
  var COLLECTIONS = MOCK.collections;
  var INSTALLED = MOCK.installed;
  /* 轮播上限：一圈 5×6s = 30s，再长就没人翻到底。第 6 条起只在拼图与表格里出现。 */
  var HERO_MAX = 5;
  PLUGINS.forEach(function (p) { if (MOCK.updates[p.id]) p.update = MOCK.updates[p.id]; });

  var CATS = [{ id: "all", label: "全部" }, { id: "dev", label: "开发工具" }, { id: "productivity", label: "效率工具" }, { id: "integration", label: "集成与渠道" }, { id: "appearance", label: "界面外观" }, { id: "other", label: "其他" }];
  var SORTS = [{ id: "smart", label: "综合排序" }, { id: "official", label: "CCGUI官方插件" }, { id: "thirdParty", label: "社区插件" }, { id: "downloads", label: "下载量" }];
  var NOTES = {
    A: { title: "方案 A · Spotlight 轮播", sub: "编辑精选占据首屏，一次讲一个故事", points: ["<b>结构</b>：轮播（296px）→ 筛选工具栏 → 完整表格。工具栏吸顶，滚到哪儿都能筛。", "<b>数据</b>：只读 <code>spotlight[]</code>，一个有序数组，运营改文案不用改结构。", "<b>动效</b>：6s 自动播放；悬停 / 焦点进入 / 切到后台 / 系统减少动效时暂停，进度条停在原处而不是跳回。", "<b>素材</b>：线上 18 个插件只有 6 个带截图、6 个带 icon —— 轮播必须能吃下「没图」：截图 → icon → 渐变块三级回落，缺图不留空洞，也不出现拉伸。", "<b>代价</b>：一屏只看见 1 个精选；不自播放就有 4 个被埋住；a11y 分支最多。"] },
    B: { title: "方案 B · 编辑精选拼图", sub: "不轮播、不隐藏：一屏把主推讲完", points: ["<b>结构</b>：1 张主卡（大图 + 推荐语）+ 3 张次卡常驻，第 4 个起收进「展开更多精选」。", "<b>展开</b>：grid-template-rows 0fr→1fr 高度过渡，收起期间内容保持挂载——对齐 UI 规范 §2.4。", "<b>优点</b>：没有任何自动播放，静态可截图，读屏与键盘路径最短。", "<b>代价</b>：占 380px；精选超过 8 个要再做一层分页或「全部精选」页。"] },
    C: { title: "方案 C · 合集发现流", sub: "把「一张表」变成「逛 + 找」两条路", points: ["<b>结构</b>：合集 rails（横向滑动、吸附、边缘渐隐）→ 「全部插件」+ 筛选 → 表格。搜索框贴着表格，明确它只筛表格。", "<b>扩展</b>：新增合集只是往 <code>collections[]</code> 里加一组 id，UI 零改动——这是唯一能吃下 100+ 插件的形态。", "<b>交互</b>：rails 带左右箭头（键盘可达）、卡片 hover 抬起、卡片角标常驻安装状态。", "<b>代价</b>：首屏要滚动才看到表格；两套卡片组件；输入搜索时 rails 收起（高度过渡），只留结果。"] },
  };

  /* ------------------------------------------------------------------ 工具 */
  var ICON = {
    search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    left: '<path d="m15 18-6-6 6-6"/>',    right: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  };
  function icon(name, cls) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="' + (cls || "") + '" aria-hidden="true">' + ICON[name] + "</svg>";
  }
  var CONCEPT = window.CONCEPT; // 概念占位图（独立文件）
  /* GitHub 账号规则；官方插件的作者位是品牌账号，表格里换成品脾徽标 */
  var GITHUB_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
  function loginFor(p) {
    if (p.official) return null;
    if (GITHUB_LOGIN.test(p.author)) return p.author;
    var owner = (p.repo || "").split("/")[0];
    return GITHUB_LOGIN.test(owner) ? owner : null;
  }
  function hash(s) { var h = 0, i; for (i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function byId(id) { return PLUGINS.filter(function (p) { return p.id === id; })[0]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function avatar(p, size) {
    var tone = CONCEPT.tone(p.id || p.name);
    return '<span class="avatar" style="width:' + size + "px;height:" + size + "px;font-size:" + Math.round(size * 0.42) + "px;background-image:linear-gradient(160deg," + tone[0] + "," + tone[1] + ')">' + esc(Array.from(p.name)[0]) + "</span>";
  }
  function badges(p) {
    var out = "";
    if (p.official) out += '<span class="badge badge--official">' + icon("shield") + "CCGUI官方插件</span>";
    if (p.tier) out += '<span class="badge">' + esc(p.tier) + "</span>";
    return out;
  }
  /* 素材：真图。优先级 featured.json 的 image（编辑封面）→ 插件截图 → 插件 icon
   * → 概念图的渐变块；任一步失败都不留空洞（degrade 逐级降级）。索引里的截图比例
   * 不可控（本仓 3600×740 ~ 357×425），所以只有轮播大图按真实比例自适应（fitShot），
   * 缩略图一律 cover 裁切。 */
  var RAW_BASE = "https://raw.githubusercontent.com/";
  function rawUrl(repo, path) {
    return RAW_BASE + repo + "/HEAD/" + String(path).split("/").map(encodeURIComponent).join("/");
  }
  function imgTag(url, cls) {
    return '<img class="shot__img ' + (cls || "") + '" alt="" loading="lazy" src="' + esc(url) + '" />';
  }
  function withWash(inner, t) {
    return '<div class="shot" style="--sa:' + t[0] + ";--sb:" + t[1] + '" aria-hidden="true"><div class="shot__wash"></div>' + inner + "</div>";
  }
  /* 满铺：cover 裁切铺满容器 —— 缩略图与「真图·满铺」模式 */
  function fullbleed(p, url) { return withWash(imgTag(url, "shot__img--fill"), CONCEPT.tone(p.id)); }
  /* 框内：截图自成一张卡，宽高由 fitShot 按真实像素算，绝不拉伸 */
  function framed(p, url) { return withWash('<div class="shot__win shot__win--real">' + imgTag(url) + "</div>", CONCEPT.tone(p.id)); }
  function iconCard(p, url) { return withWash('<img class="shot__icon" alt="" src="' + esc(url) + '" />', CONCEPT.tone(p.id)); }
  /* 一张卡片的封面；opts.framed 只给轮播大图（那里空间够放下原比例截图）。 */
  function cover(p, opts) {
    opts = opts || {};
    var a = MOCK.art[p.id];
    if (S.art === "concept" || !a) return CONCEPT.forPlugin(p);
    var shot = S.missing ? null : (a.shots && a.shots[0]); // 模拟截 404：降级到 icon
    if (shot) {
      var url = rawUrl(a.repo, shot);
      return S.art === "cover" || !opts.framed ? fullbleed(p, url) : framed(p, url);
    }
    if (a.icon && !S.missing) return iconCard(p, rawUrl(a.repo, a.icon));
    return CONCEPT.fallback(p);
  }
  /* 轮播大图：按真实像素把截图框缩到图片本身的比例，右对齐、垂直居中 */
  function fitShot(img) {
    if (!img.naturalWidth) return;
    var r = img.naturalWidth / img.naturalHeight;
    var win = img.closest(".shot__win--real");
    // 缩略图：4.86:1 / 0.84:1 这种极端比例不裁切，宁可留边也不放大到糊
    if (!win) { img.classList.toggle("shot__img--contain", r > 2.2 || r < 0.95); return; }
    var box = win.parentElement;
    var availW = box.clientWidth * 0.46 - 22; // 文字栏最多 44%，右图从 54% 起，永不重叠
    var availH = box.clientHeight - 44;
    var h = Math.min(availH, availW / r);
    win.style.width = Math.round(h * r) + "px";
    win.style.height = Math.round(h) + "px";
  }
  /* 图片坏了不留空洞：先换 icon，再换渐变块 */
  function degrade(img) {
    var host = img.closest("[data-cover]");
    if (!host) return;
    var p = byId(host.dataset.cover);
    var a = p && MOCK.art[p.id];
    if (p && a && a.icon && host.dataset.step !== "1") {
      host.dataset.step = "1";
      host.innerHTML = iconCard(p, rawUrl(a.repo, a.icon));
    } else if (p) {
      host.dataset.step = "2";
      host.innerHTML = CONCEPT.fallback(p);
    }
    wireImages();
  }
  function wireImages() {
    $$("img.shot__img, img.shot__icon").forEach(function (img) {
      if (img.dataset.wired === "1") return;
      img.dataset.wired = "1";
      img.addEventListener("load", function () { fitShot(img); });
      img.addEventListener("error", function () { degrade(img); });
      // 缓存命中时 load 不会再触发；complete 但没有宽度就是失败
      if (img.complete) { if (img.naturalWidth) fitShot(img); else degrade(img); }
    });
  }
  function stateAction(p, cls) {
    var c = cls || "btn";
    if (S.installing && S.installing.id === p.id) return '<button type="button" class="' + c + ' btn--secondary btn--blocked" disabled>' + icon("loader", "spin") + "安装中 " + S.installing.pct + "%</button>";
    if (S.installed.has(p.id)) {
      if (p.update) return '<button type="button" class="' + c + ' btn--primary" data-install="' + p.id + '">更新至 v' + esc(p.update) + "</button>";
      return '<button type="button" class="' + c + ' btn--ghost" data-detail="' + p.id + '">' + icon("check") + "已安装</button>";
    }
    return '<button type="button" class="' + c + ' btn--primary" data-install="' + p.id + '">安装</button>';
  }
  function slot(p, cls) { return '<span data-slot="action" data-id="' + p.id + '">' + stateAction(p, cls) + "</span>"; }
  /* ----- 状态 ----- */
  var S = { scheme: "A", art: "real", dark: false, missing: false, offline: false, narrow: false, reduced: false, hero: 0, query: "", cat: "all", sort: "smart", installing: null, installed: new Set(INSTALLED) };
  /* 封面宿生：图片坏了由 degrade() 就地换内容，不用重建整张卡 */
  function host(id, inner) { return '<div class="coverhost" data-cover="' + id + '">' + inner + "</div>"; }

  function featuredList(limit) {
    var list = FEATURED.map(function (f) { var p = byId(f.id); return p ? Object.assign({}, p, { tagline: f.tagline, note: f.note }) : null; }).filter(Boolean);
    return limit ? list.slice(0, limit) : list;
  }
  function heroList() { return featuredList(HERO_MAX); }
  function visiblePlugins() {
    var q = S.query.trim().toLowerCase();
    var list = PLUGINS.filter(function (p) {
      if (S.cat !== "all" && p.cat !== S.cat) return false;
      if (S.sort === "official" && !p.official) return false;
      if (S.sort === "thirdParty" && p.official) return false;
      if (!q) return true;
      return (p.id + " " + p.name + " " + p.desc + " " + p.author).toLowerCase().indexOf(q) >= 0;
    });
    return list.sort(function (a, b) { return a.downloads === b.downloads ? a.name.localeCompare(b.name) : b.downloads - a.downloads; });
  }
  function catCount(id) { return id === "all" ? PLUGINS.length : PLUGINS.filter(function (p) { return p.cat === id; }).length; }

  /* ------------------------------------------------------------------ 渲染 */
  function renderNote() {
    var n = NOTES[S.scheme];
    $("#note").innerHTML = "<h2>" + n.title + '<span>' + n.sub + "</span></h2><ul>" + n.points.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
  }
  function renderPlaceholders() {
    $$("[data-placeholder]").forEach(function (el) {
      el.hidden = !S.offline;
      el.innerHTML = S.offline ? "精选拉取失败（404 / 解析失败）：<b>整个精选区不渲染</b> —— 没有空壳、没有报错横幅，工具栏与表格完全不受影响。" : "";
    });
    $$(".hero").forEach(function (el) { el.style.display = S.offline ? "none" : ""; });
    $("#rails").hidden = S.offline;
    $$(".sechead", $('[data-view="B"]')).forEach(function (el) { el.style.display = S.offline ? "none" : ""; });
    $("#bento-more").style.display = S.offline ? "none" : "";
    $("#bento-toggle").style.display = S.offline ? "none" : "";
  }
  var heroSig = "", barsKey = "";
  function renderHero() {
    var track = $("#hero-track"), bars = $("#hero-bars"), list = heroList();
    if (!list.length) { track.innerHTML = ""; bars.innerHTML = ""; heroSig = ""; return; }
    if (S.hero >= list.length) S.hero = 0;
    // DOM 只在「精选集合变化」时重建：每次翻页重建会把淡入淡出变成硬切
    var sig = list.map(function (p) { return p.id; }).join(",") + "|" + S.missing;
    if (sig === heroSig) { applyHeroActive(); return; }
    heroSig = sig;
    barsKey = "";
    track.innerHTML = list.map(function (p, i) {
      return '<article class="slide' + (i === 0 ? " is-active" : "") + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + " / " + list.length + '">' +
        host(p.id, cover(p, { framed: true })) +
        '<div class="hero__scrim" aria-hidden="true"></div>' +
        '<div class="hero__body"><div style="display:flex;gap:6px">' + badges(p) + '<span class="badge badge--onDark">' + icon("star") + "编辑精选</span></div>" +
        '<h3 class="hero__title">' + esc(p.name) + '</h3><p class="hero__pitch">' + esc(p.tagline) + '</p><p class="hero__note">' + esc(p.note) + "</p>" +
        '<div class="hero__meta">' + (p.official ? "<span>" + esc(p.author) + "</span>" : "<span>" + avatar({ id: loginFor(p) || p.id, name: p.author }, 20).replace('class="avatar"', 'class="avatar avatar--circle"') + "</span>" + esc(p.author)) + '<i class="dot"></i>安装量 <b>' + p.downloads + '</b><i class="dot"></i>v' + esc(p.version.replace(/^v/, "")) + "</div>" +
        '<div class="hero__cta">' + slot(p) + '<button type="button" class="btn btn--onDark" data-detail="' + p.id + '">查看详情' + icon("arrow") + "</button></div></div></article>";
    }).join("");
    bars.innerHTML = list.map(function (p, i) { return '<button type="button" role="tab" aria-label="第 ' + (i + 1) + ' 条精选：' + esc(p.name) + '" data-hero-dot="' + i + '"><i></i></button>'; }).join("");
    applyHeroActive();
  }
  function applyHeroActive() {
    var list = heroList();
    $$("#hero-track .slide").forEach(function (el, i) { el.classList.toggle("is-active", i === S.hero); });
    $$("#hero-bars button").forEach(function (el, i) { el.setAttribute("aria-selected", String(i === S.hero)); });
    $("#hero-count").textContent = S.hero + 1 + " / " + list.length;
  }
  function renderBento() {
    var list = featuredList();
    if (!list.length) { $("#bento").innerHTML = ""; $("#bento-grid").innerHTML = ""; return; }
    var main = list[0], side = list.slice(1, 4), rest = list.slice(4);
    $("[data-featured-count]").textContent = "由 CC GUI 团队与社区维护者手工挑选 · 共 " + list.length + " 个";
    $("#bento").innerHTML =
      '<article class="bento__main"><div class="bento__cover">' + host(main.id, cover(main)) + '<span class="coverchip badge badge--glass">' + icon("star") + "编辑精选</span></div>" +
      '<div class="bento__body"><div class="bento__title">' + esc(main.name) + badges(main) + '</div><p class="bento__pitch">' + esc(main.tagline) + '</p><p class="bento__note">' + esc(main.note) + "</p>" +
      '<div class="bento__foot">' + slot(main) + '<span class="meta">' + esc(main.author) + " · 安装量 " + main.downloads + " · " + esc(main.version) + "</span></div></div></article>" +
      '<div class="bento__side">' + side.map(function (p) {
        return '<article class="bento__row"><div class="bento__thumb">' + host(p.id, cover(p)) + '</div><div class="bento__rowmain"><div class="bento__rowname">' + esc(p.name) + (p.official ? '<span class="badge badge--official">官方</span>' : "") + '</div><p class="bento__rowdesc">' + esc(p.tagline) + '</p></div>' + slot(p, "btn btn--sm") + "</article>";
      }).join("") + "</div>";
    // 一屏之内不该出现「2 张卡占 4 列」的空洞：列数跟随剩余数量
    $("#bento-grid").style.gridTemplateColumns = "repeat(" + Math.min(4, Math.max(2, rest.length)) + ", minmax(0, 1fr))";
    $("#bento-grid").innerHTML = rest.map(function (p) {
      return '<article class="poster"><div class="poster__cover">' + host(p.id, cover(p)) + '<span class="coverchip badge badge--glass">' + icon("star") + "精选</span></div>" +
        '<div class="poster__body"><div class="poster__name">' + esc(p.name) + '</div><p class="poster__desc">' + esc(p.tagline) + '</p>' +
        '<div class="poster__foot"><span class="poster__dev">' + (p.official ? esc(p.version) : "@" + esc(p.author)) + "</span>" + slot(p, "btn btn--sm") + "</div></div></article>";
    }).join("");
    var open = $("#bento-more").classList.contains("is-open");
    $("#bento-toggle").textContent = (open ? "收起" : "展开更多精选（" + rest.length + "）");
    $("#bento-toggle").hidden = rest.length === 0;
  }
  function renderRails() {
    if (S.offline) return;
    $("#rails").innerHTML = COLLECTIONS.map(function (c) {
      var items = c.items.map(byId).filter(Boolean);
      return '<section class="rail" data-rail="' + c.id + '"><div class="rail__head"><h3>' + esc(c.title) + '</h3><span class="rail__sub">' + esc(c.sub || items.length + " 个插件") + "</span>" +
        '<div class="rail__nav"><button type="button" data-rail-nav="-1" aria-label="向左滚动' + esc(c.title) + '" title="向左滚动">' + icon("left") + '</button><button type="button" data-rail-nav="1" aria-label="向右滚动' + esc(c.title) + '" title="向右滚动">' + icon("right") + "</button></div></div>" +
        '<div class="rail__wrap"><div class="rail__track">' + items.map(function (p) {
          return '<article class="pcard"><div class="pcard__cover">' + host(p.id, cover(p)) + stateChip(p) + '<span class="coverchip coverchip--right badge badge--glass">' + icon("download") + p.downloads + "</span>" + "</div>" +
            '<div class="pcard__body"><div class="pcard__name">' + esc(p.name) + (p.official ? '<span class="badge badge--official">官方</span>' : "") + '</div><p class="pcard__desc">' + esc(p.desc) + '</p>' +
            '<div class="poster__foot"><span class="poster__dev">' + (p.official ? esc(p.version) : "@" + esc(p.author)) + "</span>" + slot(p, "btn btn--sm") + "</div></div></article>";
        }).join("") + "</div></div></section>";
    }).join("");
    $$(".rail__track").forEach(updateRailFade);
  }
  function updateRailFade(track) {
    var wrap = track.parentElement;
    var more = track.scrollWidth - track.clientWidth - track.scrollLeft > 4;
    wrap.classList.toggle("has-more", more);
  }
  function renderToolbars() {
    var view = $('[data-view="' + S.scheme + '"]');
    $$("[data-toolbar]", view).forEach(function (el) {
      el.innerHTML = '<div class="chips" role="group" aria-label="按类别筛选">' + CATS.map(function (c) {
        return '<button type="button" class="chip" data-cat="' + c.id + '" aria-pressed="' + (S.cat === c.id) + '">' + c.label + " <span>" + catCount(c.id) + "</span></button>";
      }).join("") + '</div><div class="toolbar__end"><label class="select">' + '<select data-sort aria-label="排序与筛选">' + SORTS.map(function (s) {
        return '<option value="' + s.id + '"' + (S.sort === s.id ? " selected" : "") + ">" + s.label + "</option>";
      }).join("") + '</select></label><label class="search">' + icon("search") + '<input type="search" data-search placeholder="搜索插件…" aria-label="搜索插件" value="' + esc(S.query) + '" /></label><button type="button" class="iconbtn" data-refresh aria-label="刷新市场索引" title="刷新市场索引">' + icon("refresh") + "</button></div>";
    });
    var total = $("[data-total]");
    if (total) total.textContent = PLUGINS.length + " 个";
  }
  function renderTables() {
    var rows = visiblePlugins();
    $$('[data-view]:not([hidden]) [data-table]').forEach(function (host) {
      if (!rows.length) { host.innerHTML = '<p class="empty">没有匹配的插件</p>'; return; }
      host.innerHTML = '<table class="market"><thead><tr><th>名称</th><th style="width:180px">开发者</th><th class="num" style="width:96px">安装量</th><th class="num" style="width:96px">版本</th><th class="num" style="width:150px">操作</th></tr></thead><tbody>' +
        rows.map(function (p) {
          return '<tr data-detail="' + p.id + '">' +
            '<td><div class="cellname">' + avatar(p, 36) + '<div class="cellname__text"><div class="cellname__title"><span>' + esc(p.name) + "</span>" + (p.tier ? '<span class="badge">' + esc(p.tier) + "</span>" : "") + '</div><div class="cellname__desc">' + esc(p.desc) + "</div></div></div></td>" +
            "<td>" + devCell(p) + "</td>" +
            '<td class="num" style="color:var(--text-2);font-variant-numeric:tabular-nums">' + p.downloads + "</td>" +
            '<td class="num" style="color:var(--text-2);font-variant-numeric:tabular-nums">' + esc(p.version) + "</td>" +
            '<td class="num">' + slot(p, "btn btn--sm") + "</td></tr>";
        }).join("") + "</tbody></table>";
    });
  }
  function devCell(p) {
    if (p.official) return '<span class="badge badge--official">' + icon("shield") + "CCGUI官方插件</span>";
    var login = loginFor(p);
    return '<div class="celldev">' + (login ? avatar({ id: login, name: p.author }, 20).replace('class="avatar"', 'class="avatar avatar--circle"') : "") + "<span>" + esc(p.author) + "</span></div>";
  }
  /* 状态芯片（合集卡左上角）：安装完成后原地翻牌，不重建整条 rail */
  function stateChip(p) {
    var on = S.installed.has(p.id);
    return '<span class="coverchip badge ' + (on ? "badge--lime" : "badge--glass") + '" data-slot="state" data-id="' + p.id + '">' + (on ? "已安装" : "未安装") + "</span>";
  }
  function syncActions() {
    $$('[data-slot="action"]').forEach(function (el) {
      var p = byId(el.dataset.id);
      if (p) el.innerHTML = stateAction(p);
    });
    $$('[data-slot="state"]').forEach(function (el) {
      var p = byId(el.dataset.id);
      if (!p) return;
      var on = S.installed.has(p.id);
      el.className = "coverchip badge " + (on ? "badge--lime" : "badge--glass");
      el.textContent = on ? "已安装" : "未安装";
    });
  }
  function render() {
    $$("[data-view]").forEach(function (v) { v.hidden = v.dataset.view !== S.scheme; });
    renderNote();
    renderPlaceholders();
    renderHero();
    renderBento();
    renderRails();
    renderToolbars();
    renderTables();
    $("#bento-more").classList.toggle("is-open", $("#bento-toggle").getAttribute("aria-expanded") === "true");
    wireImages();
  }

  /* 轮播时序 */
  var DURATION = 6000, elapsed = 0, lastTs = 0, heroPaused = false;
  function heroGo(step) {
    var list = heroList();
    if (!list.length) return;
    S.hero = (S.hero + step + list.length) % list.length;
    elapsed = 0;
    applyHeroActive();
    paintBars(true);
  }
  function paintBars(force) {
    var bars = $$("#hero-bars button i");
    if (!bars.length) return;
    var key = S.hero + ":" + Math.round(elapsed / 120);
    if (!force && key === barsKey) return;
    barsKey = key;
    var ratio = Math.min(1, elapsed / DURATION);
    bars.forEach(function (bar, i) {
      bar.style.width = i < S.hero ? "100%" : i === S.hero ? ratio * 100 + "%" : "0%";
    });
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = lastTs ? ts - lastTs : 0;
    lastTs = ts;
    if (S.scheme !== "A" || S.reduced || heroPaused || document.hidden || S.offline) return;
    elapsed += dt;
    if (elapsed >= DURATION) {
      S.hero = (S.hero + 1) % (heroList().length || 1);
      elapsed = 0;
      applyHeroActive();
      paintBars(true);
      return;
    }
    paintBars(false);
  }

  /* ------------------------------------------------------------ 交互 */
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.hidden = true; }, 2400);
  }
  function install(id) {
    var entry = byId(id);
    // 已安装且无更新：按钮走 data-detail，不该到这里；有更新时同一个命令重跑
    if (S.installing || (S.installed.has(id) && !entry.update)) return;
    S.installing = { id: id, pct: 0 };
    syncActions();
    var timer = setInterval(function () {
      S.installing.pct = Math.min(100, S.installing.pct + 9);
      if (S.installing.pct >= 100) {
        clearInterval(timer);
        S.installed.add(id);
        delete entry.update; // 更新完成，按钮回到「已安装」
        toast("已安装 " + entry.name + " · " + entry.version);
        S.installing = null;
      }
      syncActions();
    }, 90);
  }
  function setScheme(next) {
    S.scheme = next;
    applyFlags();
    render();
    $(".app__scroll").scrollTop = 0;
    syncHash();
  }
  /* 深色 / 减少动效 / 窄窗口 / 边界开关都只影响预览，一次性落到 DOM */
  var FLAGS = ["dark", "missing", "offline", "narrow", "reduced"];
  var ART_MODES = ["concept", "real", "cover"];
  function applyFlags() {
    $$("[data-toggle]").forEach(function (b) { b.setAttribute("aria-pressed", String(!!S[b.dataset.toggle])); });
    $$("[data-scheme]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.scheme === S.scheme)); });
    $$("[data-art]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.art === S.art)); });
    document.documentElement.classList.toggle("dark", S.dark);
    document.documentElement.classList.toggle("reduced", S.reduced);
    $("#app").classList.toggle("narrow", S.narrow);
  }
  /* #B,dark,offline —— 方案与开关可分享、可截图 */
  function syncHash() {
    var parts = [S.scheme, S.art, "h" + (S.hero + 1)].concat(FLAGS.filter(function (f) { return S[f]; }));
    if (!$("#drawer").hidden) parts.push("compare");
    try { location.replace("#" + parts.join(",")); } catch (err) { /* file:// 下不可用就忽略 */ }
  }
  function readHash() {
    var raw = location.hash.replace(/^#/, "");
    if (!raw) return;
    raw.split(",").forEach(function (part) {
      if (/^[ABC]$/.test(part)) S.scheme = part;
      else if (/^h[1-9]$/.test(part)) S.hero = Number(part.slice(1)) - 1; // 直达第 n 张精选
      else if (ART_MODES.indexOf(part) >= 0) S.art = part;
      else if (FLAGS.indexOf(part) >= 0) S[part] = true;
    });
    if (raw.indexOf("compare") >= 0) { $("#drawer").hidden = false; $("#scrim").hidden = false; }
  }
  function setToggle(name, on) {
    S[name] = on;
    if (name === "offline") S.hero = 0;
    elapsed = 0;
    applyFlags();
    render();
    syncHash();
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var hit = function (sel) { return t && t.closest ? t.closest(sel) : null; };
    var el;
    if ((el = hit("[data-scheme]"))) return setScheme(el.dataset.scheme);
    if ((el = hit("[data-toggle]"))) return setToggle(el.dataset.toggle, !S[el.dataset.toggle]);
    if ((el = hit("[data-art]"))) {
      S.art = el.dataset.art;
      applyFlags();
      render();
      syncHash();
      return;
    }
    if ((el = hit("[data-action='compare']"))) {
      var open = $("#drawer").hidden;
      $("#drawer").hidden = !open;
      $("#scrim").hidden = !open;
      syncHash();
      return;
    }
    if ((el = hit("[data-hero]"))) return heroGo(el.dataset.hero === "next" ? 1 : -1);
    if ((el = hit("[data-hero-dot]"))) { S.hero = Number(el.dataset.heroDot); elapsed = 0; applyHeroActive(); paintBars(true); return; }
    if ((el = hit("[data-install]"))) { e.stopPropagation(); return install(el.dataset.install); }
    if ((el = hit("[data-rail-nav]"))) {
      var track = $(".rail__track", el.closest(".rail"));
      track.scrollBy({ left: Number(el.dataset.railNav) * (track.clientWidth - 80), behavior: S.reduced ? "auto" : "smooth" });
      return;
    }
    if ((el = hit("[data-cat]"))) {
      S.cat = el.dataset.cat;
      $$("[data-cat]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.cat === S.cat)); });
      renderTables();
      return;
    }
    if ((el = hit("[data-detail]"))) { e.stopPropagation(); var d = byId(el.dataset.detail); return toast("打开插件详情：" + d.name + "（本稿未展开该页面）"); }
    if (hit("#bento-toggle")) {
      var btn = $("#bento-toggle"), open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      $("#bento-more").classList.toggle("is-open", !open);
      renderBento();
      return;
    }
    if (hit("[data-static]")) return toast("本稿只评审精选区，该入口不在范围内");
    if (hit("[data-refresh]")) { toast("刷新市场索引（原型不发起网络请求）"); return; }
  });
  function inElement(node, sel) { return node && node.closest ? !!node.closest(sel) : false; }
  document.addEventListener("input", function (e) {
    if (inElement(e.target, "[data-search]")) { S.query = e.target.value; renderTables(); }
  });
  document.addEventListener("change", function (e) {
    if (inElement(e.target, "[data-sort]")) { S.sort = e.target.value; renderTables(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "1" || e.key === "2" || e.key === "3") { if (!inElement(e.target, "input")) setScheme({ 1: "A", 2: "B", 3: "C" }[e.key]); return; }
    if (e.key === "Escape" && !$("#drawer").hidden) { $("#drawer").hidden = true; $("#scrim").hidden = true; return; }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && inElement(e.target, "#hero")) {
      e.preventDefault();
      heroGo(e.key === "ArrowRight" ? 1 : -1);
    }
  });
  document.addEventListener("scroll", function (e) {
    if (e.target.classList && e.target.classList.contains("rail__track")) updateRailFade(e.target);
  }, true);
  var heroEl = $("#hero");
  heroEl.addEventListener("mouseenter", function () { heroPaused = true; });
  heroEl.addEventListener("mouseleave", function () { heroPaused = false; });
  heroEl.addEventListener("focusin", function () { heroPaused = true; });
  heroEl.addEventListener("focusout", function () { heroPaused = false; });
  document.addEventListener("visibilitychange", function () { lastTs = 0; });

  readHash();
  applyFlags();
  render();
  requestAnimationFrame(frame);
})();
