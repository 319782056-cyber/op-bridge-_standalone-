// OP 桥图核心计算：移植自 OP桥图.py 的 build_bars / build_group_boxes / summary_amount
import { BAR_TYPES } from "./constants";

const EPS = 1e9;
export const rnd = (x) => Math.round(x * EPS) / EPS;

export const parseValue = (raw) => {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().replace(/,/g, "");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
};

export const isTotalKind = (kind) => kind === "起始量" || kind === "节点";

/** 返回 { bars, errors }，errors 为 [{rowId, msg}]；有错误时 bars 为空。 */
export function buildBars(rows) {
  const errors = [];
  const active = rows.filter((r) => (r.name || "").trim() !== "" || String(r.value).trim() !== "" || r.kind !== "增减项");
  if (active.length === 0) {
    return { bars: [], errors: [{ rowId: null, msg: "还没有数据，请先添加起始量和增减项。" }] };
  }
  active.forEach((row, index) => {
    const label = `第 ${rows.indexOf(row) + 1} 行「${row.name || "未命名"}」`;
    if (!BAR_TYPES.includes(row.kind)) errors.push({ rowId: row.id, msg: `${label}：柱子类型无效。` });
    if (!(row.name || "").trim()) errors.push({ rowId: row.id, msg: `${label}：缺少项目名称。` });
    if (row.kind === "起始量" && index !== 0) errors.push({ rowId: row.id, msg: `${label}：只允许第一条数据是起始量。` });
    if (index === 0 && row.kind !== "起始量") errors.push({ rowId: row.id, msg: `${label}：第一条数据必须是「起始量」。` });
    if (row.kind !== "节点") {
      const v = parseValue(row.value);
      if (v === null) errors.push({ rowId: row.id, msg: `${label}：请填写数值。` });
      else if (Number.isNaN(v)) errors.push({ rowId: row.id, msg: `${label}：「${row.value}」不是有效数字，不要带单位。` });
    }
    if (row.kind === "增减项") {
      const g = row.g;
      if ((g[1] && !g[0]) || (g[2] && !g[1])) errors.push({ rowId: row.id, msg: `${label}：分组不能跳级，填写下级时也要填写上级。` });
    }
  });
  if (active.length < 2 && errors.length === 0) {
    errors.push({ rowId: active[0].id, msg: "只有起始量，请继续填写至少一个增减项或节点。" });
  }
  if (errors.length) return { bars: [], errors };

  const bars = [];
  let running = 0;
  let nodeRunning = 0;
  let segment = 1;
  active.forEach((row, index) => {
    const groups = row.kind === "增减项" ? [row.g[0] || "", row.g[1] || "", row.g[2] || ""] : ["", "", ""];
    let bar;
    if (row.kind === "起始量") {
      running = nodeRunning = parseValue(row.value);
      bar = { value: running, base: 0, after: running };
    } else if (row.kind === "节点") {
      running = nodeRunning;
      bar = { value: running, base: 0, after: running };
    } else {
      const value = parseValue(row.value);
      const before = running;
      running = rnd(running + value);
      if (row.kind === "增减项" && groups[0]) nodeRunning = rnd(nodeRunning + value);
      bar = { value, base: before, after: running };
    }
    bars.push({
      id: row.id, index, name: row.name.trim(), kind: row.kind, ...bar,
      segment, groups, nodeAfter: nodeRunning, isTotal: isTotalKind(row.kind),
    });
    if (row.kind === "节点") segment += 1;
  });
  return { bars, errors };
}

export function buildGroupBoxes(bars) {
  const result = [];
  for (let level = 0; level < 3; level++) {
    let current = null;
    bars.forEach((bar, index) => {
      if (bar.kind !== "增减项" || !bar.groups[level]) {
        current = null;
        return;
      }
      const path = bar.groups.slice(0, level + 1);
      if (current && current.segment === bar.segment && current.path.join("\u0001") === path.join("\u0001") && current.end + 1 === index) {
        current.end = index;
        current.amount = rnd(current.amount + bar.value);
      } else {
        current = {
          level, segment: bar.segment, path, name: path[path.length - 1],
          start: index, end: index, amount: bar.value, key: `g${level}:${bar.id}`,
        };
        result.push(current);
      }
    });
  }
  return result;
}

export function summaryAmount(mode, bars) {
  if (mode === "最后节点") {
    let last = bars[bars.length - 1];
    for (let i = bars.length - 1; i >= 0; i--) {
      if (bars[i].kind === "节点") { last = bars[i]; break; }
    }
    return rnd(last.nodeAfter - bars[0].nodeAfter);
  }
  if (mode === "框内项目") {
    return rnd(bars.filter((b) => b.kind === "增减项" && b.groups[0]).reduce((s, b) => s + b.value, 0));
  }
  return rnd(bars.filter((b) => !b.isTotal).reduce((s, b) => s + b.value, 0));
}

export function formatNumber(value, decimals) {
  const d = Math.max(0, Math.min(6, Number(decimals) || 0));
  let text = (Math.round((value + Number.EPSILON * Math.sign(value)) * 10 ** d) / 10 ** d).toFixed(d);
  if (Number(text) === 0) text = (0).toFixed(d);
  return text;
}

/** 汇总文案分段：前缀(中文字体) + 数字(数字字体,按正负着色) + 单位 */
export function amountSegments(amount, cfg, style, parentheses = false) {
  let label;
  let color;
  if (amount < 0) { label = cfg.decrease; color = style.colorGreen; }
  else if (amount > 0) { label = cfg.increase; color = style.colorRed; }
  else { label = "持平"; color = style.colorText; }
  return [
    { text: (parentheses ? "(" : "") + cfg.prefix + label, color: style.colorText, num: false },
    { text: formatNumber(Math.abs(amount), cfg.decimals), color, num: true },
    { text: cfg.unit + (parentheses ? ")" : ""), color: style.colorText, num: false },
  ];
}

export const wrapText = (text, max) => {
  const n = Math.max(1, Math.round(max) || 5);
  const lines = [];
  String(text).split("\n").forEach((line) => {
    const chars = Array.from(line);
    if (chars.length === 0) { lines.push(""); return; }
    for (let i = 0; i < chars.length; i += n) lines.push(chars.slice(i, i + n).join(""));
  });
  return lines;
};