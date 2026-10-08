// Open /tests/browser/plugin-spotlight.html with the Vite dev server running.
// Mounts the real PluginSpotlight (market 首屏精选轮播) over a synthetic market
// whose covers cover the whole 素材链 and the whole real-world aspect spread:
//   1. cover         编辑封面 → object-cover 铺满
//   2. shot-wide     3600×740 截图 → 原比例装帧（不裁切成一条线）
//   3. shot-tall     357×425 截图 → 原比例装帧（不裁掉大半）
//   4. icon-only     只有 icon → 图标瓦片
//   5. no-art        什么都没有 → 品牌色首字块
//   6. broken        image 与 screenshot 都取不到 → 降级落到 icon
// Images are inline SVG data URLs, so the page never touches the network.
//
// The readout checks what jsdom cannot: that the progress bar really is the
// autoplay timer (getAnimations playState), that hovering freezes it, that the
// shipped `motion-reduce:animate-none` declaration stops it, and that no cover
// is ever stretched. PASS/FAIL lands on <body data-status> and in the title.
// It measures animation effects in this browser — not CPU/GPU cost, and not
// the native WKWebView.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/lib/i18n";
import type { FeaturedPlugin, MarketPlugin } from "../../src/lib/ipc";
import { PluginSpotlight } from "../../src/features/plugins/hub/PluginSpotlight";
import { useMarketplaceStore } from "../../src/features/plugins/marketplace/store";
import { usePluginsStore } from "../../src/features/plugins/manager/usePlugins";

localStorage.setItem("ccgui-next.language", "zh");

const svg = (w: number, h: number, label: string, bg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="${w}" height="${h}" fill="${bg}"/>` +
      `<rect x="${w * 0.05}" y="${h * 0.1}" width="${w * 0.9}" height="${h * 0.14}" rx="${h * 0.03}" fill="#38bdf8"/>` +
      `<text x="${w * 0.05}" y="${h * 0.72}" fill="#f8fafc" font-family="monospace" font-size="${Math.round(h * 0.14)}">${label} ${w}×${h}</text>` +
      `</svg>`,
  )}`;

const COVER = svg(1600, 900, "cover", "#1e3a8a");
const SHOT_WIDE = svg(3600, 740, "wide", "#064e3b");
const SHOT_TALL = svg(357, 425, "tall", "#7c2d12");
const ICON = svg(256, 256, "icon", "#4c1d95");
/** A data URL that is not an image: <img> fails fast, no DNS wait. */
const BROKEN = "data:text/plain,not-an-image";

const entry = (over: Partial<MarketPlugin>): MarketPlugin => ({
  id: "slide",
  repo: "owner/ccgui-plugin-slide",
  name: "幻灯片",
  description: "索引里的原始描述",
  author: "wszbest68-gif",
  tier: "js",
  version: "1.0.0",
  updatedAt: null,
  minAppVersion: null,
  sdkVersion: null,
  permissions: [],
  downloads: 128,
  screenshots: [],
  icon: null,
  ...over,
});

const ENTRIES: MarketPlugin[] = [
  entry({ id: "cover", name: "编辑封面", screenshots: [SHOT_WIDE], icon: ICON }),
  entry({ id: "shot-wide", name: "超宽截图", screenshots: [SHOT_WIDE] }),
  entry({ id: "shot-tall", name: "竖版截图", screenshots: [SHOT_TALL] }),
  entry({ id: "icon-only", name: "只有图标", icon: ICON }),
  entry({ id: "no-art", name: "没有任何素材", author: "zhukunpenglinyutong" }),
  entry({ id: "broken", name: "素材全挂", screenshots: [BROKEN], icon: ICON }),
];

const FEATURED: FeaturedPlugin[] = [
  { id: "cover", tagline: "编辑封面：铺满整块，不裁切", note: "编辑在 featured.json 里给的封面。", image: COVER },
  { id: "shot-wide", tagline: "3600×740 的截图按原比例装帧", note: null, image: null },
  { id: "shot-tall", tagline: "357×425 的截图按原比例装帧", note: null, image: null },
  { id: "icon-only", tagline: "只有 icon：图标瓦片", note: null, image: null },
  { id: "no-art", tagline: "什么都没有：品牌色首字块", note: null, image: null },
  { id: "broken", tagline: "封面与截图都拉不到：落到 icon", note: null, image: BROKEN },
];

const activeSlide = () =>
  document.querySelector<HTMLElement>('[aria-roledescription="slide"][aria-hidden="false"]');
const progressBar = () =>
  document.querySelector<HTMLElement>(".animate-spotlight-progress")?.parentElement
    ?.firstElementChild as HTMLElement | null;
const progressAnimation = () => progressBar()?.getAnimations()[0] ?? null;
const slideIndex = () => ENTRIES.findIndex((e) => activeSlide()?.textContent?.includes(e.name));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 把 shipped 的 reduced-motion 媒体条件改成 always：没有 fixture 规则能盖住它。 */
function forceReducedMotion(on: boolean) {
  let matched = 0;
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes("(prefers-reduced-motion: reduce)") &&
        rule.cssText.includes("motion-reduce")
      ) {
        rule.media.mediaText = on ? "all" : "not all";
        matched += 1;
      } else if ("cssRules" in rule) {
        visit((rule as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      /* Cross-origin CSS is not inspected. */
    }
  }
  return matched;
}

function Fixture() {
  const [steps, setSteps] = useState<string[]>([]);
  const [status, setStatus] = useState("running");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    usePluginsStore.setState({ installed: [], loaded: true, error: null, installing: null });
    useMarketplaceStore.setState({
      entries: ENTRIES,
      featured: FEATURED,
      loaded: true,
      error: null,
      updates: [],
      installing: null,
    });

    const notes: string[] = [];
    const failures: string[] = [];
    const check = (ok: boolean, message: string) => {
      notes.push(`${ok ? "✅" : "❌"} ${message}`);
      if (!ok) failures.push(message);
      setSteps([...notes]);
    };

    const run = async () => {
      await sleep(400);
      const carousel = document.querySelector<HTMLElement>('[aria-roledescription="carousel"]');
      check(!!carousel, "轮播已渲染");
      check(document.querySelectorAll('[aria-roledescription="slide"]').length === ENTRIES.length,
        `${ENTRIES.length} 张幻灯片都在 DOM 里`);
      check(!!carousel?.textContent?.includes("编辑封面"), "首屏停在第一条（编辑优先序）");

      // 1. 进度条就是计时器
      await sleep(300);
      check(progressAnimation()?.playState === "running", "进度条关键帧在跑（= 自动播放中）");
      const before = slideIndex();
      await sleep(1200);
      const moved = slideIndex() !== before || progressAnimation() !== null;
      check(moved, "进度条没有停在第一帧");
      check(document.querySelector('[aria-label^="第 1 条精选"]') !== null, "圆点带可访问名");

      // 2. 悬停冻结：条停 = 翻页停
      carousel!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      await sleep(200);
      check(progressAnimation()?.playState === "paused", "悬停后进度条暂停");
      const frozen = slideIndex();
      await sleep(900);
      check(slideIndex() === frozen, "悬停期间不翻页");
      carousel!.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      await sleep(200);
      check(progressAnimation()?.playState === "running", "移开后进度条恢复");

      // 3. 自动播放真的会翻页（等它自己走完一圈，最多 9s）
      const from = slideIndex();
      let auto = false;
      for (let i = 0; i < 36 && !auto; i += 1) {
        await sleep(250);
        auto = slideIndex() !== from;
      }
      check(auto, "不碰任何东西也会自动翻页");

      // 4. 不裁切：插件截图必须走 object-contain。
      //    量“盒子比例”是量错了对象——object-contain 会把内容居中放在盒子里，
      //    盒子比例本来就可以不等于像素比例。真正要守的是：不许用 cover
      //    （4.86:1 的条铺满 46% 宽的区域会把两端裁掉、糊成一块）。
      const shots = [...document.querySelectorAll<HTMLImageElement>('img[class*="object-contain"]')];
      check(shots.length >= 2, "超宽与竖版都走了原比例装帧");
      const fitted = shots.filter((img) => getComputedStyle(img).objectFit === "contain");
      check(fitted.length === shots.length, `截图一律 object-contain（${fitted.length}/${shots.length}）`);
      const wide = shots.find((img) => img.naturalWidth === 3600);
      const wideHeight = wide?.getBoundingClientRect().height ?? 0;
      check(!!wide && wideHeight > 0 && wideHeight < 180,
        `3600×740 的条是缩到高度里（${Math.round(wideHeight)}px），不是放大铺满`);
      const tall = shots.find((img) => img.naturalWidth === 357);
      check(!!tall && tall.getBoundingClientRect().height > 100,
        "357×425 的竖版截图拿到了整块高度，没被压成一条");

      // 5. 素材链：坏图逐级降级，不停在破图上
      const dots = document.querySelectorAll<HTMLElement>('[role="tab"]');
      dots[dots.length - 1]!.click();
      await sleep(400);
      const broken = activeSlide()!;
      check(broken.textContent!.includes("素材全挂"), "切到最后一页");
      const images = [...broken.querySelectorAll<HTMLImageElement>("img")];
      check(images.length > 0 && images.every((img) => img.naturalWidth > 0),
        "封面与截图都失败后落在可渲染的 icon 上（没有破图）");

      // 6. reduced-motion：shipped 声明生效 → 关键帧不跑 → 不自动翻页
      const matched = forceReducedMotion(true);
      check(matched > 0, `找到 shipped 的 motion-reduce:animate-none 声明（${matched} 条）`);
      await sleep(200);
      check(!progressAnimation() || progressAnimation()!.playState !== "running",
        "reduced-motion 下进度条不再播放");
      const still = slideIndex();
      await sleep(7000);
      check(slideIndex() === still, "reduced-motion 下 7s 内不自动翻页");
      forceReducedMotion(false);

      setStatus(failures.length ? "FAIL" : "PASS");
      document.body.dataset.status = failures.length ? "FAIL" : "PASS";
      document.title = `${failures.length ? "FAIL" : "PASS"} · PluginSpotlight fixture`;
    };

    void run();
  }, []);

  return (
    <div className="bg-background-primary-default p-6 text-text-primary">
      <div className="mb-4 flex items-center gap-3">
        <strong>PluginSpotlight fixture</strong>
        <span
          className={
            status === "PASS"
              ? "rounded-md bg-status-lime-background px-2 py-0.5 text-status-lime-text"
              : status === "FAIL"
                ? "rounded-md bg-status-rose-background px-2 py-0.5 text-status-rose-text"
                : "rounded-md bg-background-secondary-default px-2 py-0.5 text-text-secondary"
          }
        >
          {status}
        </span>
        <span className="text-body-2-regular text-text-secondary">
          真实组件 + 合成数据（图片为内联 SVG，不联网）
        </span>
      </div>
      <div className="mx-auto w-full max-w-[1080px]">
        <PluginSpotlight onOpenDetail={() => {}} />
        <pre
          id="readout"
          className="mt-4 rounded-xl bg-background-secondary-default p-4 text-body-2-regular whitespace-pre-wrap"
        >
          {steps.join("\n")}
        </pre>
        <p className="mt-2 text-body-2-regular text-text-tertiary">
          标题栏与 data-status 给出 PASS / FAIL。checks：素材链、原比例装帧、进度条即计时器、悬停冻结、
          reduced-motion 降级。约 20s 跑完。
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("fixture")!).render(<Fixture />);
