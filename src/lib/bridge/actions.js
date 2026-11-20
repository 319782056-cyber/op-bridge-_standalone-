// 编辑动作：把“画布上的元素 id”映射为数据修改（双击改字、拖拽位移、行操作）
import { DEFAULT_CONFIG, DEFAULT_STYLE, makeRow } from "./constants";
import { parseValue } from "./model";

export const OFFSETABLE = /^(title|subtitle|num:|label:|head:)/;
export const isOffsetable = (id) => !!id && OFFSETABLE.test(id);

export const parseId = (id) => {
  if (!id) return { type: null };
  if (id === "title" || id === "subtitle") return { type: id };
  const i = id.indexOf(":");
  return { type: id.slice(0, i), key: id.slice(i + 1) };
};

export const setOffset = (doc, id, xy) => ({
  ...doc,
  ov: { ...doc.ov, off: { ...doc.ov.off, [id]: [Math.round(xy[0] * 10) / 10, Math.round(xy[1] * 10) / 10] } },
});

export const clearOffset = (doc, ids) => {
  const off = { ...doc.ov.off };
  [].concat(ids).forEach((id) => delete off[id]);
  return { ...doc, ov: { ...doc.ov, off } };
};

// 框宽联动：同侧边界采用相同增量，保留各框原来的项目覆盖范围。
export function setLinkedBoxWidth(doc, scene, boxKey, field, value) {
  if (!["leftPad", "rightPad"].includes(field)) return doc;
  const box = { ...doc.ov.box };
  const current = box[boxKey]?.[field] ?? 0;
  let delta = value - current;
  const keys = scene.boxEls.map((el) => el.box.key);
  const values = keys.map((key) => box[key]?.[field] ?? 0);
  delta = Math.max(-Math.min(...values), Math.min(500 - Math.max(...values), delta));
  keys.forEach((key) => {
    box[key] = { ...box[key], [field]: Math.round(((box[key]?.[field] ?? 0) + delta) * 10) / 10 };
  });
  return { ...doc, ov: { ...doc.ov, box } };
}

// 高度只联动同一级别，保留其他级别及每个框的独立样式。
export function setLinkedBoxHeight(doc, scene, boxKey, field, value) {
  if (!["topShift", "bottomInset"].includes(field)) return doc;
  const source = scene.boxEls.find((el) => el.box.key === boxKey);
  if (!source) return doc;
  const box = { ...doc.ov.box };
  const keys = scene.boxEls.filter((el) => el.box.level === source.box.level).map((el) => el.box.key);
  const values = keys.map((key) => box[key]?.[field] ?? 0);
  const min = field === "topShift" ? -500 : 0;
  let delta = value - (box[boxKey]?.[field] ?? 0);
  delta = Math.max(min - Math.min(...values), Math.min(500 - Math.max(...values), delta));
  keys.forEach((key) => {
    box[key] = { ...box[key], [field]: Math.round(((box[key]?.[field] ?? 0) + delta) * 10) / 10 };
  });
  return { ...doc, ov: { ...doc.ov, box } };
}

// 仅还原参数，保留用户的数据、分组、行顺序及稳定 ID。
export function resetAllParameters(doc) {
  return {
    ...doc,
    config: { ...DEFAULT_CONFIG },
    style: { ...DEFAULT_STYLE },
    rows: doc.rows.map((row) => ({ ...row, width: null, gap: null })),
    ov: { off: {}, txt: {}, color: {}, box: {}, textStyle: {}, nodeBreak: {} },
  };
}

// 仅缩放纵轴范围，让所有柱按同一比例显示；任何业务数值均不修改。
export function scaleBarDisplay(doc, scene, factor) {
  const scale = Math.max(0.2, Math.min(5, factor));
  return {
    ...doc,
    config: { ...doc.config, yMin: scene.yMin / scale, yMax: scene.yMax / scale, startRatio: null },
  };
}

// 柱宽统一为同一全局值，同时清除旧的单柱覆盖。
export function setLinkedBarWidth(doc, value) {
  const width = Math.round(Math.max(0.1, Math.min(5, value)) * 1000) / 1000;
  return { ...doc, style: { ...doc.style, barWidth: width }, rows: doc.rows.map((row) => ({ ...row, width: null })) };
}

const lineText = (el) => el.lines.map((l) => l.segs.map((s) => s.text).join("")).join("\n");

/** 返回双击编辑的初始内容；null 表示该元素不可文字编辑 */
export function editInit(doc, scene, id) {
  const { type, key } = parseId(id);
  if (type === "title") return { text: doc.config.title, multiline: true, hint: "图表主标题" };
  if (type === "subtitle") {
    return { text: doc.config.customSubtitle || (scene.subtitle ? lineText(scene.subtitle) : ""), multiline: true, hint: "副标题（清空恢复自动汇总）" };
  }
  const row = doc.rows.find((r) => r.id === key);
  if (type === "label" && row) return { text: row.name, multiline: false, hint: "项目名称" };
  if ((type === "num" || type === "bar") && row) {
    if (row.kind === "节点") {
      const be = scene.barEls.find((b) => b.bar.id === key);
      return { text: doc.ov.txt[`num:${key}`] ?? (be ? be.num.lines[0].segs[0].text : ""), multiline: false, hint: "节点数值由系统汇总，此处仅修改显示文字" };
    }
    return { text: row.value, multiline: false, hint: "数值（可带符号）" };
  }
  if (type === "head") {
    const be = scene.boxEls.find((b) => b.id === id);
    if (be) return { text: be.box.name, multiline: false, hint: "分组名称（同步修改框内所有项目）" };
  }
  return null;
}

/** 提交双击编辑。返回 { doc } 或 { error } */
export function applyEdit(doc, scene, id, text) {
  const { type, key } = parseId(id);
  if (type === "title") return { doc: { ...doc, config: { ...doc.config, title: text } } };
  if (type === "subtitle") {
    // 文字未改动（仍是自动汇总文案）时保持“自动”，不固化为自定义副标题
    const auto = !doc.config.customSubtitle && scene.subtitle && text === lineText(scene.subtitle);
    return { doc: { ...doc, config: { ...doc.config, customSubtitle: auto ? "" : text } } };
  }
  if (type === "label") {
    if (!text.trim()) return { error: "项目名称不能为空" };
    return { doc: { ...doc, rows: doc.rows.map((r) => (r.id === key ? { ...r, name: text.trim() } : r)) } };
  }
  if (type === "num" || type === "bar") {
    const row = doc.rows.find((r) => r.id === key);
    if (!row) return { error: "找不到对应项目" };
    if (row.kind === "节点") {
      const txt = { ...doc.ov.txt };
      if (text.trim()) txt[`num:${key}`] = text.trim();
      else delete txt[`num:${key}`];
      return { doc: { ...doc, ov: { ...doc.ov, txt } } };
    }
    const v = parseValue(text);
    if (v === null || Number.isNaN(v)) return { error: "请输入有效数字，不要带单位" };
    return { doc: { ...doc, rows: doc.rows.map((r) => (r.id === key ? { ...r, value: String(v) } : r)) } };
  }
  if (type === "head") {
    const be = scene.boxEls.find((b) => b.id === id);
    if (!be) return { error: "找不到对应分组" };
    if (!text.trim()) return { error: "分组名称不能为空" };
    const { level, start, end } = be.box;
    const ids = new Set(scene.bars.slice(start, end + 1).map((b) => b.id));
    return {
      doc: { ...doc, rows: doc.rows.map((r) => (ids.has(r.id) ? { ...r, g: r.g.map((g, i) => (i === level ? text.trim() : g)) } : r)) },
    };
  }
  return { error: "该元素不支持文字编辑" };
}

// ---------- 行操作 ----------
export const patchRow = (doc, id, patch) => ({ ...doc, rows: doc.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
export const setGroup = (doc, id, level, value) => ({
  ...doc,
  rows: doc.rows.map((r) => (r.id === id ? { ...r, g: r.g.map((g, i) => (i === level ? value : g)) } : r)),
});

export function insertRow(doc, index, template) {
  const prev = doc.rows[index - 1];
  const base = template || makeRow("新项目", "增减项", "", prev && prev.kind === "增减项" ? prev.g : ["", "", ""]);
  const rows = [...doc.rows];
  rows.splice(index, 0, base);
  return { doc: { ...doc, rows }, id: base.id };
}

export const deleteRow = (doc, id) => ({ ...doc, rows: doc.rows.filter((r) => r.id !== id) });

export function moveRow(doc, id, dir) {
  const i = doc.rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= doc.rows.length) return doc;
  if (doc.rows[0]?.kind === "起始量" && (i === 0 || j === 0)) return doc;
  const rows = [...doc.rows];
  [rows[i], rows[j]] = [rows[j], rows[i]];
  return { ...doc, rows };
}

// boundary 是原数组的插入边界：0=首行前，length=末行后。
export function reorderRow(doc, id, boundary) {
  const from = doc.rows.findIndex((r) => r.id === id);
  const locked = doc.rows[0]?.kind === "起始量";
  if (from < 0 || (locked && from === 0)) return doc;
  const target = Math.max(locked ? 1 : 0, Math.min(doc.rows.length, boundary));
  const destination = target > from ? target - 1 : target;
  if (destination === from) return doc;
  const rows = [...doc.rows];
  const [row] = rows.splice(from, 1);
  rows.splice(destination, 0, row);
  return { ...doc, rows };
}

export function duplicateRow(doc, id) {
  const i = doc.rows.findIndex((r) => r.id === id);
  if (i < 0) return { doc };
  const src = doc.rows[i];
  const copy = makeRow(`${src.name}（副本）`, src.kind === "起始量" ? "增减项" : src.kind, src.value, src.g);
  copy.width = src.width;
  copy.gap = src.gap;
  const rows = [...doc.rows];
  rows.splice(i + 1, 0, copy);
  return { doc: { ...doc, rows }, id: copy.id };
}