// OP 桥图布局引擎：把 matplotlib 的 draw_one / calculate_frame_layout 移植为纯函数，
// 输出一份与渲染无关的“场景描述”，由 SVG 组件绘制，也用于导出 PNG / SVG。
import { PT, INCH, chineseFontStack, numberFontStack } from "./constants";
import { buildBars, buildGroupBoxes, summaryAmount, amountSegments, formatNumber, wrapText } from "./model";

const LINE_H = 1.2; // 行高 = 字号 × 1.2

// ---------- 文本测量（canvas，带缓存） ----------
let _ctx = null;
const _cache = new Map();
export function measureText(text, px, family, bold) {
  if (!_ctx) {
    const c = document.createElement("canvas");
    _ctx = c.getContext("2d");
  }
  const key = `${bold ? "b" : "n"}|${px}|${family}|${text}`;
  const hit = _cache.get(key);
  if (hit !== undefined) return hit;
  _ctx.font = `${bold ? "bold " : ""}${px}px ${family}`;
  const w = _ctx.measureText(text).width;
  if (_cache.size > 5000) _cache.clear();
  _cache.set(key, w);
  return w;
}

const isNumberToken = (t) => /^[-+]?\d+(\.\d+)?$/.test(t);

/** 混色文字按实际宽度换行（数字优先保持完整）。返回 [[{text,color,num}]] */
function wrapSegments(segs, px, fonts, maxWidth) {
  const lines = [];
  let cur = [];
  let curW = 0;
  const widthOf = (t, num) => measureText(t, px, num ? fonts.num : fonts.cn, true);
  for (const seg of segs) {
    if (!seg.text) continue;
    let tokens = seg.num && isNumberToken(seg.text) ? [seg.text] : Array.from(seg.text);
    if (maxWidth != null) {
      tokens = tokens.flatMap((t) => (t.length > 1 && widthOf(t, seg.num) > maxWidth ? Array.from(t) : [t]));
    }
    for (const t of tokens) {
      const w = widthOf(t, seg.num);
      if (maxWidth != null && cur.length && curW + w > maxWidth) {
        lines.push(cur);
        cur = [];
        curW = 0;
      }
      const last = cur[cur.length - 1];
      if (last && last.color === seg.color && last.num === seg.num) last.text += t;
      else cur.push({ text: t, color: seg.color, num: seg.num });
      curW += w;
    }
  }
  if (cur.length) lines.push(cur);
  return lines.length ? lines : [[{ text: "", color: "#000", num: false }]];
}

const lineWidth = (segs, px, fonts, bold = true) =>
  segs.reduce((s, g) => s + measureText(g.text, px, g.num ? fonts.num : fonts.cn, bold), 0);

/** 把若干“块”(每块一组行，同字号) 组装成一个文本元素，坐标相对元素左上角 */
function packBlocks(blocks, fonts, sepPx) {
  const lines = [];
  let y = 0;
  let maxW = 0;
  blocks.forEach((block, bi) => {
    if (bi > 0) y += sepPx;
    block.lines.forEach((segs, li) => {
      if (li > 0) y += block.gap ?? 2 * PT;
      const h = block.px * LINE_H;
      const w = lineWidth(segs, block.px, fonts, block.bold !== false);
      lines.push({ segs, px: block.px, y, h, w, bold: block.bold !== false, stroke: block.stroke || 0 });
      maxW = Math.max(maxW, w);
      y += h;
    });
  });
  return { lines, w: maxW, h: y };
}

export function computeScene(doc) {
  const { config: cfg, style: st, rows, ov } = doc;
  const warnings = [];
  const { bars, errors } = buildBars(rows);
  if (errors.length) return { ok: false, errors };

  const fonts = { cn: chineseFontStack(st.fontChinese), num: numberFontStack(st.fontNumber) };
  const count = bars.length;
  const boxes = buildGroupBoxes(bars);

  // ---- 画布尺寸 ----
  let widthIn = Math.max(st.figureMinWidth, count * st.widthPerBar);
  const numPx = st.barNumFontsize * PT;
  const widestNumber = Math.max(...bars.map((b) => measureText(formatNumber(b.value, cfg.decimals), numPx, fonts.num, true)));
  widthIn = Math.max(widthIn, (count * (widestNumber + 12)) / INCH + 0.7);
  const ratioMode = st.canvasRatio || "16:9";
  const aspectRatio = ratioMode === "16:9" ? 16 / 9 : ratioMode === "4:3" ? 4 / 3 : ratioMode === "1:1" ? 1 : null;
  const H = Math.round(st.figureHeight * INCH);
  // 固定比例不随行数扩展。只有用户明确选择“按项目自动扩宽”时才使用旧逻辑。
  const W = Math.round((aspectRatio ? st.figureHeight * aspectRatio : ratioMode === "custom" ? (st.figureWidth || 16) : widthIn) * INCH);

  // ---- 标题 / 副标题 ----
  const titleText = cfg.title || "";
  const titlePx = st.titleFontsize * PT;
  const titleLines = String(titleText).split("\n");
  const title = packBlocks(
    [{ px: titlePx, lines: titleLines.map((t) => [{ text: t, color: st.colorText, num: false }]), bold: st.titleBold, stroke: st.titleBold ? 0.35 * PT : 0, gap: 0 }],
    fonts, 0,
  );
  let subtitle = null;
  if (cfg.customSubtitle || cfg.summaryMode !== "不显示") {
    const segs = cfg.customSubtitle
      ? [{ text: cfg.customSubtitle, color: st.colorText, num: false }]
      : amountSegments(summaryAmount(cfg.summaryMode, bars), cfg, st);
    const lines = cfg.customSubtitle ? String(cfg.customSubtitle).split("\n").map((t) => [{ text: t, color: st.colorText, num: false }]) : [segs];
    subtitle = packBlocks([{ px: st.subtitleFontsize * PT, lines, gap: 0 }], fonts, 0);
  }
  const padTop = 16;
  const titleGap = 6;
  const titleTop = padTop;
  const subtitleTop = titleTop + title.h + titleGap;
  // 标题下移参数会占用额外高度，绘图区随之让位，避免与分组文字重叠
  const titleBottom = titleTop + Math.max(0, st.titleShiftDownPt) * PT + title.h;
  const subtitleBottom = subtitle ? subtitleTop + Math.max(0, st.subtitleShiftDownPt) * PT + subtitle.h : 0;
  const mt = Math.max(titleBottom, subtitleBottom) + 22;

  // ---- X 轴标签 ----
  const labelPx = st.factorFontsize * PT;
  const labelLines = bars.map((b) => wrapText(b.name, st.labelWrapChars));
  const maxLabelLines = Math.max(...labelLines.map((l) => l.length));
  const labelsH = maxLabelLines * labelPx * LINE_H;
  const mb = 10 + labelsH + 14;
  const ml = 24;
  const mr = 24;
  const ax = { l: ml, r: W - mr, t: mt, b: H - mb };
  ax.w = ax.r - ax.l;
  ax.h = ax.b - ax.t;
  if (ax.h < 120) warnings.push("绘图区高度不足，请增大「画布高度」或减小标题/标签字号。");
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const widths = bars.map((b) => rowById.get(b.id).width ?? st.barWidth);
  const gaps = bars.map((b) => rowById.get(b.id).gap ?? st.barGap ?? 0.4);
  const units = widths.reduce((a, b) => a + b, 0) + gaps.slice(0, -1).reduce((a, b) => a + b, 0) + 0.4;
  // 小幅宽度/间隔调整不再被“撑满画布”归一化抵消，过宽时才统一压缩以防溢出。
  const slot = ax.w / Math.max(count, units);
  const centers = [];
  let cursor = 0.2 + (ax.w / slot - units) / 2;
  widths.forEach((w, i) => { centers.push(cursor + w / 2); cursor += w + gaps[i]; });
  if (slot * (st.barWidth + (st.barGap ?? 0.4)) < widestNumber + 8) {
    warnings.push("当前画布项目较密集，可增大画布尺寸、减小柱旁字号或选择自动扩宽；预览缩放不影响导出尺寸。");
  }
  const xc = (i) => ax.l + centers[i] * slot;
  const xu = (u) => ax.l + u * slot; // 数据 x（-0.5..count-0.5）→ 像素

  // ---- 纵轴 ----
  const nodeScale = Math.max(0.1, Math.min(10, cfg.nodeHeightScale ?? 1));
  const innerScale = Math.max(0.1, Math.min(10, cfg.innerHeightScale ?? 1));
  let displayRunning = 0;
  const displayBars = bars.map((b) => {
    if (b.isTotal) {
      displayRunning = b.value * nodeScale;
      return { base: 0, value: displayRunning, after: displayRunning };
    }
    const value = b.value * (b.kind === "增减项" && b.groups[0] ? innerScale : 1);
    const base = displayRunning;
    displayRunning += value;
    return { base, value, after: displayRunning };
  });
  const pts = [0];
  displayBars.forEach((b) => { pts.push(b.base, b.base + b.value); });
  const dataMin = Math.min(...pts);
  const highest = Math.max(...pts);
  let span = highest - dataMin;
  if (span < 1e-9) span = Math.max(Math.abs(highest) * 0.1, 0.01);
  const yMin = cfg.yMin != null ? cfg.yMin : dataMin < 0 ? dataMin - span * 0.15 : 0;

// ---- 三层分组标题 ----
// 共用相邻柱边缘之间的连接中点作为框边界，各级框使用同一规则。
// 因此相邻分组在同一个中点闭合，允许边线重叠，无需额外内缩或外扩。
const boundaryBetween = (i) => ((centers[i] + widths[i] / 2) + (centers[i + 1] - widths[i + 1] / 2)) / 2;
const headings = boxes.map((box) => {
const left = box.start > 0 ? boundaryBetween(box.start - 1) : centers[box.start] - widths[box.start] / 2 - 0.2;
const right = box.end < count - 1 ? boundaryBetween(box.end) : centers[box.end] + widths[box.end] / 2 + 0.2;
    const maxW = Math.max(12, (right - left) * slot - 8);
    const mainName = ov.txt[`head:${box.key}`] ?? box.name;
    const main = wrapSegments([{ text: mainName, color: st.colorText, num: false }], st.groupMainFontsize * PT, fonts, maxW);
    const sub = wrapSegments(amountSegments(box.amount, cfg, st, true), st.groupSubFontsize * PT, fonts, maxW);
    const el = packBlocks(
      [{ px: st.groupMainFontsize * PT, lines: main }, { px: st.groupSubFontsize * PT, lines: sub }],
      fonts, 3 * PT,
    );
    return { box, left, right, el };
  });

  const levelCount = headings.reduce((m, h) => Math.max(m, h.box.level + 1), 0);
  const heights = new Array(levelCount).fill(0);
  headings.forEach((h) => { heights[h.box.level] = Math.max(heights[h.box.level], h.el.h); });
  const offsets = [0];
  for (let l = 1; l < levelCount; l++) offsets.push(offsets[l - 1] + heights[l - 1] + st.groupLevelGapPt * PT);
  const titleInset = st.groupTitleInsetPt * PT;
  const clearance = (st.barNumFontsize + st.barNumOffsetPt) * PT + 6;
  const occupied = headings.reduce((m, h) => Math.max(m, offsets[h.box.level] + titleInset + h.el.h + clearance), 0);
  if (headings.length && occupied / ax.h >= 0.9) warnings.push("三层分组文字过长，请缩短分组名称、减小字号或增大画布高度。");

  let yMax;
  let ratio = cfg.startRatio;
  if (ratio != null && cfg.yMax != null) {
    warnings.push("起始柱高度比例与 Y 轴最大值同时填写，已优先使用起始柱高度比例。");
  }
  if (ratio != null && (ratio <= 0 || ratio >= 1)) { warnings.push("起始柱高度比例须在 0~1 之间，已忽略。"); ratio = null; }
  if (ratio != null && Math.abs(bars[0].value) === 0) { warnings.push("起始量为 0，无法按比例缩放，已忽略起始柱高度比例。"); ratio = null; }
  if (ratio != null) {
    yMax = yMin + Math.abs(displayBars[0].value) / ratio;
  } else if (cfg.yMax != null && cfg.yMax > yMin) {
    yMax = cfg.yMax;
  } else {
    const usable = Math.max(0.2, Math.min(0.85, 1 - occupied / Math.max(1, ax.h) - 0.06));
    yMax = yMin + Math.max(highest - yMin, span) / usable;
  }
  if (!(yMax > yMin)) { yMax = yMin + span * 1.5; warnings.push("纵轴范围无效，已恢复自动。"); }
  const yRange = yMax - yMin;
  const dpp = yRange / Math.max(1, ax.h); // 每像素对应的数据量
  const y = (v) => ax.b - ((v - yMin) / yRange) * ax.h;
  if (highest + (clearance * yRange) / ax.h >= yMax) warnings.push("最高柱及数字已贴近绘图区上沿，建议减小起始柱高度比例或增大 Y 轴最大值。");

  // ---- 框顶 ----
  let gap = null;
  let gapRange = null;
  let levelTops = [];
  if (headings.length) {
    let minimumGap = 0;
    headings.forEach(({ box, el }) => {
      const localHighest = Math.max(...displayBars.slice(box.start, box.end + 1).map((b) => Math.max(b.base, b.base + b.value)));
      minimumGap = Math.max(
        minimumGap,
        localHighest - highest + (offsets[box.level] + titleInset + el.h + clearance) * dpp,
        yMin - highest + (offsets[box.level] + titleInset + el.h + 6) * dpp,
      );
    });
    const maximumGap = yMax - highest - 4 * PT * dpp;
    const recommended = maximumGap > minimumGap
      ? Math.min(Math.max(span * 0.12, minimumGap + span * 0.03), (minimumGap + maximumGap) / 2)
      : minimumGap + span * 0.03;
    gap = cfg.boxTopGap != null && cfg.boxTopGap > 0 ? cfg.boxTopGap : recommended;
    if (gap < minimumGap) { warnings.push(`框顶高度差太小，已自动抬高到 ${minimumGap.toPrecision(3)}，否则分组文字会重叠。`); gap = minimumGap; }
    if (maximumGap > minimumGap && gap >= maximumGap) { warnings.push("框顶高度差超出绘图区，已自动收回。"); gap = maximumGap - span * 0.01; }
    if (maximumGap <= minimumGap) warnings.push("当前纵轴上限无法容纳三层文字，请减小起始柱高度比例或增大 Y 轴最大值。");
    gapRange = [minimumGap, maximumGap];
    const top = highest + gap;
    levelTops = offsets.map((o) => top - o * dpp);
    gap = { value: gap, recommended, min: minimumGap, max: maximumGap };
  }

  // ---- 元素位置 ----
  const off = (id) => ov.off[id] || [0, 0];
  const titleEl = {
    id: "title", kind: "title", cx: W / 2, top: titleTop + st.titleShiftDownPt * PT, ...title, color: st.colorText, dxy: off("title"),
  };
  const subtitleEl = subtitle && {
    id: "subtitle", kind: "subtitle", cx: W / 2, top: subtitleTop + st.subtitleShiftDownPt * PT, ...subtitle, dxy: off("subtitle"),
  };

  // 截断只压缩总量柱；浮动柱平移，变化量高度不变；两端同时截断时渐进衔接。
  const totalShift = (b) => {
    if (!b?.isTotal || !ov.nodeBreak?.[b.id]?.enabled) return 0;
    const ratio = Math.max(0.1, Math.min(0.95, ov.nodeBreak[b.id].ratio ?? 0.55));
    const displayed = displayBars[b.index];
    return (y(0) - y(displayed.after)) * (1 - ratio);
  };
  const floatShifts = bars.map((b, i) => {
    if (b.isTotal) return 0;
    let previous = null;
    let following = null;
    let previousIndex = -1;
    let followingIndex = count;
    for (let j = i - 1; j >= 0; j--) if (bars[j].isTotal) { previous = bars[j]; previousIndex = j; break; }
    for (let j = i + 1; j < count; j++) if (bars[j].isTotal) { following = bars[j]; followingIndex = j; break; }
    const previousEnabled = !!previous && !!ov.nodeBreak?.[previous.id]?.enabled;
    const followingEnabled = !!following && (!!ov.nodeBreak?.[following.id]?.enabled || nodeScale !== innerScale);
    const followingShift = following ? totalShift(following) +
      (nodeScale !== innerScale ? y(displayBars[followingIndex].after) - y(displayBars[followingIndex - 1].after) : 0) : 0;
    if (previousEnabled && followingEnabled) {
      // 两端均启用时同时读取两端比例，按横向位置渐进过渡，不再覆盖左端。
      const first = previousIndex + 1;
      const last = followingIndex - 1;
      const distance = xc(last) - xc(first);
      const weight = distance > 1e-9 ? (xc(i) - xc(first)) / distance : 0.5;
      return totalShift(previous) * (1 - weight) + followingShift * weight;
    }
    return followingEnabled ? followingShift : totalShift(previous);
  });
  const barEls = bars.map((b, i) => {
    const visualShift = floatShifts[i];
    const display = displayBars[i];
    const top = y(Math.max(display.base, display.base + display.value)) + visualShift;
    const bottom = y(Math.min(display.base, display.base + display.value)) + visualShift;
    const colorKey = ov.color[b.id];
    const fill = colorKey || (b.isTotal ? st.colorTotal : st.colorGray);
    const x = xc(i);
    // 柱旁数字
    const neg = b.isTotal ? b.after < 0 : b.value < 0;
    const offPx = st.barNumOffsetPt * PT;
    const shift = b.isTotal ? (b.after >= 0 ? offPx : -offPx) : b.value < 0 ? -offPx : offPx;
    const numColor = b.isTotal ? st.colorText : b.value < 0 ? st.colorGreen : b.value > 0 ? st.colorRed : st.colorText;
    const numStr = ov.txt[`num:${b.id}`] ?? formatNumber(b.value, cfg.decimals);
    const nw = measureText(numStr, numPx, fonts.num, true);
    const nh = numPx * LINE_H;
    const nodeBreak = b.isTotal && ov.nodeBreak?.[b.id]?.enabled ? ov.nodeBreak[b.id] : null;
    const displayRatio = nodeBreak ? Math.max(0.1, Math.min(0.95, nodeBreak.ratio ?? 0.55)) : 1;
    const fullHeight = Math.max(0, bottom - top);
    const displayHeight = fullHeight * displayRatio;
    const displayTop = nodeBreak && b.value >= 0 ? bottom - displayHeight : top;
    const anchorY = nodeBreak ? (b.value >= 0 ? displayTop : displayTop + displayHeight) : y(display.after) + visualShift;
    const numTop = neg ? anchorY - shift : anchorY - shift - nh;
    const lbl = labelLines[i];
    const lblLines = lbl.map((t, k) => ({
      segs: [{ text: t, color: st.colorText, num: false }], px: labelPx, y: k * labelPx * LINE_H, h: labelPx * LINE_H,
      w: measureText(t, labelPx, fonts.cn, false), bold: false, stroke: 0,
    }));
    const label = {
      id: `label:${b.id}`, kind: "label", barId: b.id, cx: x, top: ax.b + 10, lines: lblLines,
      w: Math.max(...lblLines.map((l) => l.w)), h: lbl.length * labelPx * LINE_H, dxy: off(`label:${b.id}`),
    };
    const num = {
      id: `num:${b.id}`, kind: "num", barId: b.id, cx: x, top: numTop, w: nw, h: nh, dxy: off(`num:${b.id}`),
      lines: [{ segs: [{ text: numStr, color: numColor, num: true }], px: numPx, y: 0, h: nh, w: nw, bold: true, stroke: 0 }],
    };
    return {
      bar: b, i, x, fill, width: widths[i], gap: gaps[i], visualShift, nodeBreak, displayRatio, anchorY, fullHeight, rect: { x: x - (widths[i] * slot) / 2, y: displayTop, w: widths[i] * slot, h: displayHeight },
      num,
      label,
    };
  });

  const bridges = [];
  for (let i = 0; i < count - 1; i++) {
    const cur = bars[i];
    const nxt = bars[i + 1];
    if (nxt.isTotal && cur.after !== nxt.after) continue;
    bridges.push({ x1: xc(i) + (widths[i] * slot) / 2, x2: xc(i + 1) - (widths[i + 1] * slot) / 2,
      y: barEls[i].anchorY,
      y2: nxt.isTotal ? barEls[i + 1].anchorY : y(displayBars[i].after) + barEls[i + 1].visualShift });
  }

  const boxEls = headings.map(({ box, left, right, el }) => {
    const settings = ov.box?.[box.key] || {};
    const top = y(levelTops[box.level]) + (settings.topShift ?? 0);
    // 框横向边界完全由所属项目的柱位置、柱宽及间隔计算，忽略历史手动外扩。
    const leftPx = xu(left);
    const rightPx = xu(right);
    const cx = (leftPx + rightPx) / 2;
    return {
      id: `head:${box.key}`, kind: "head", box,
      settings, rect: { x: leftPx, y: top, w: Math.max(10, rightPx - leftPx), h: Math.max(10, ax.b - top - (settings.bottomInset ?? 0)) },
      cx, top: top + (settings.textInset ?? titleInset), ...el, dxy: off(`head:${box.key}`),
    };
  });

  const textElements = [titleEl, subtitleEl, ...boxEls, ...barEls.flatMap((b) => [b.num, b.label])];
  textElements.filter(Boolean).forEach((el) => {
    const opts = ov.textStyle?.[el.id] || {};
    el.fonts = { cn: opts.fontChinese ? chineseFontStack(opts.fontChinese) : fonts.cn, num: opts.fontNumber ? numberFontStack(opts.fontNumber) : fonts.num };
    if (!Object.keys(opts).length) return;
    let offset = 0;
    el.lines = el.lines.map((ln) => {
      const px = opts.fontsize != null ? opts.fontsize * PT : ln.px;
      const bold = opts.bold ?? ln.bold;
      const segs = ln.segs.map((sg) => ({ ...sg, color: opts.color || sg.color }));
      const line = { ...ln, px, bold, segs, y: offset, h: px * LINE_H, w: lineWidth(segs, px, el.fonts, bold) };
      offset += line.h + 2;
      return line;
    });
    el.h = offset - 2;
    el.w = Math.max(...el.lines.map((ln) => ln.w));
  });
  return {
    ok: true, W, H, ax, slot, fonts, bars, count, warnings,
    y, yMin, yMax, highest, span, gap, gapRange, startValue: bars[0].value,
    title: titleEl, subtitle: subtitleEl, barEls, bridges, boxEls,
    style: st, cfg,
  };
}