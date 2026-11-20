// Excel 导入 / 导出：与 OP桥图.py 使用的模板结构保持一致（图表配置 / 参数配置 / OP数据）
import * as XLSX from "xlsx";
import { parseValue } from "./model";
import {
  BAR_TYPES, CONFIG_HEADERS, DATA_HEADERS, DEFAULT_CONFIG, DEFAULT_STYLE, PARAMETER_HEADERS, PARAM_SPECS,
  SUMMARY_MODES, makeRow,
} from "./constants";

const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

const toBool = (v) => ["是", "true", "1", "yes"].includes(str(v).toLowerCase());

const parseNum = (v) => {
  const t = str(v).replace(/,/g, "");
  if (t === "") return null;
  if (t.endsWith("%")) {
    const n = Number(t.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const sheetRows = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: false });

function findHeaderRow(rows, mustHave) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map(str);
    if (mustHave.every((h) => cells.includes(h))) return i;
  }
  return -1;
}

export function parseWorkbookArrayBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "array" });
  const notes = [];

  // ---- 数据 ----
  let dataSheetName = null;
  let dataRows = null;
  let headerIdx = -1;

  // 优先使用「图表配置」中第一张启用图表指定的数据 Sheet
  let cfgRecord = null;
  const cfgWs = wb.Sheets["图表配置"];
  if (cfgWs) {
    const rows = sheetRows(cfgWs);
    const hi = findHeaderRow(rows, ["主标题", "数据Sheet"]);
    if (hi >= 0) {
      const heads = rows[hi].map(str);
      for (let r = hi + 1; r < rows.length; r++) {
        const rec = {};
        heads.forEach((h, c) => { if (h) rec[h] = rows[r][c]; });
        if (!str(rec["主标题"]) && !str(rec["数据Sheet"])) continue;
        if (["否", "0", "false"].includes(str(rec["启用"]).toLowerCase())) continue;
        cfgRecord = rec;
        break;
      }
    }
  }
  if (cfgRecord && wb.Sheets[str(cfgRecord["数据Sheet"])]) dataSheetName = str(cfgRecord["数据Sheet"]);
  const candidates = dataSheetName ? [dataSheetName, ...wb.SheetNames] : wb.SheetNames;
  for (const name of candidates) {
    const rows = sheetRows(wb.Sheets[name]);
    const hi = findHeaderRow(rows, ["项目名称", "柱子类型"]);
    if (hi >= 0) { dataSheetName = name; dataRows = rows; headerIdx = hi; break; }
  }
  if (!dataRows) throw new Error("没有找到数据表：需要包含「项目名称」和「柱子类型」两列表头（可参考 OP数据 Sheet）。");

  const heads = dataRows[headerIdx].map(str);
  const col = (n) => heads.indexOf(n);
  const rows = [];
  for (let r = headerIdx + 1; r < dataRows.length; r++) {
    const line = dataRows[r];
    const name = str(line[col("项目名称")]);
    const kind = str(line[col("柱子类型")]);
    const value = col("数值") >= 0 ? str(line[col("数值")]) : "";
    if (!name && !kind && !value) continue;
    const g = ["一级分组", "二级分组", "三级分组"].map((n) => (col(n) >= 0 ? str(line[col(n)]) : ""));
    const row = makeRow(name, BAR_TYPES.includes(kind) ? kind : "增减项", value, g);
    const width = col("柱宽") >= 0 ? parseNum(line[col("柱宽")]) : null;
    const gap = col("后间隔") >= 0 ? parseNum(line[col("后间隔")]) : null;
    row.width = width == null ? null : Math.max(0.1, Math.min(5, width));
    row.gap = gap == null ? null : Math.max(0, Math.min(5, gap));
    rows.push(row);
    if (kind && !BAR_TYPES.includes(kind)) notes.push(`「${name}」的柱子类型「${kind}」无效，已按增减项处理。`);
  }

  // ---- 图表配置 ----
  const config = { ...DEFAULT_CONFIG };
  if (cfgRecord) {
    if (str(cfgRecord["主标题"])) config.title = str(cfgRecord["主标题"]);
    if (str(cfgRecord["指标单位"])) config.unit = str(cfgRecord["指标单位"]);
    const dec = parseNum(cfgRecord["小数位"]);
    if (dec !== null) config.decimals = Math.max(0, Math.min(6, Math.round(dec)));
    config.prefix = str(cfgRecord["汇总前缀"]);
    if (str(cfgRecord["增加文案"])) config.increase = str(cfgRecord["增加文案"]);
    if (str(cfgRecord["减少文案"])) config.decrease = str(cfgRecord["减少文案"]);
    const mode = str(cfgRecord["副标题口径"]) || str(cfgRecord["计算副标题口径"]);
    if (SUMMARY_MODES.includes(mode)) config.summaryMode = mode;
    config.customSubtitle = str(cfgRecord["自定义副标题"]);
    config.yMin = parseNum(cfgRecord["Y轴最小值"]);
    config.yMax = parseNum(cfgRecord["Y轴最大值"]);
    config.boxTopGap = parseNum(cfgRecord["框顶高度差"]);
    config.startRatio = parseNum(cfgRecord["起始柱高度比例"]);
  }

  // ---- 外观参数 ----
  const style = { ...DEFAULT_STYLE };
  let paramName = cfgRecord ? str(cfgRecord["参数配置Sheet"]) : "";
  if (!paramName || !wb.Sheets[paramName]) paramName = wb.Sheets["参数配置"] ? "参数配置" : "";
  if (paramName) {
    const prow = sheetRows(wb.Sheets[paramName]);
    const phi = findHeaderRow(prow, ["参数名称", "参数值"]);
    if (phi >= 0) {
      const ph = prow[phi].map(str);
      const ni = ph.indexOf("参数名称");
      const vi = ph.indexOf("参数值");
      const byName = new Map(PARAM_SPECS.map((s) => [s[1], s]));
      for (let r = phi + 1; r < prow.length; r++) {
        const spec = byName.get(str(prow[r][ni]));
        const raw = prow[r][vi];
        if (!spec || str(raw) === "") continue;
        const [, , key, kind] = spec;
        if (kind === "boolean") style[key] = toBool(raw);
        else if (kind === "font" || kind === "color") {
          if (kind === "color" && !/^#?[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$/.test(str(raw))) continue;
          const v = str(raw);
          style[key] = kind === "color" && /^[0-9a-fA-F]{6}$/.test(v) ? `#${v}` : v;
        } else {
          const n = parseNum(raw);
          if (n === null) continue;
          if (kind === "chart") config[key] = n;
          else style[key] = kind === "integer" ? Math.round(n) : n;
        }
      }
    }
  } else if (cfgRecord && parseNum(cfgRecord["主标题字号"]) !== null) {
    style.titleFontsize = parseNum(cfgRecord["主标题字号"]);
  }

  // 外部 Excel 参数不可信，限制画布及字号范围以避免无限尺寸或负宽度。
  const limits = {
    figureHeight: [4, 30], figureMinWidth: [4, 60], widthPerBar: [0.3, 3],
    barWidth: [0.1, 5], labelWrapChars: [1, 30], outputDpi: [72, 600],
    titleFontsize: [6, 48], subtitleFontsize: [6, 48], groupMainFontsize: [6, 36],
    groupSubFontsize: [6, 36], factorFontsize: [6, 36], barNumFontsize: [6, 36],
    barBorderWidth: [0, 5], bridgeLineWidth: [0.1, 5], boxLineWidth: [0.1, 5],
    groupLevelGapPt: [2, 30], groupTitleInsetPt: [0, 20], barNumOffsetPt: [0, 20],
    titleShiftDownPt: [-100, 100], subtitleShiftDownPt: [-100, 100],
  };
  Object.entries(limits).forEach(([key, [min, max]]) => {
    if (style[key] < min || style[key] > max) {
      notes.push(`参数「${PARAM_SPECS.find((p) => p[2] === key)?.[1] || key}」超出范围，已限制在 ${min}～${max}。`);
      style[key] = Math.min(max, Math.max(min, style[key]));
    }
  });
  let ov = { off: {}, txt: {}, color: {} };
  const editorSheet = wb.Sheets["在线编辑参数"];
  if (editorSheet) {
    try {
      const data = sheetRows(editorSheet);
      const saved = JSON.parse(String(data[1]?.[1] || "{}"));
      // 通过顺序恢复稳定 ID，保证框与文字的独立参数不会丢失。
      if (Array.isArray(saved.ids) && saved.ids.length === rows.length) {
        rows.forEach((r, i) => { r.id = String(saved.ids[i]); });
        if (saved.ov && typeof saved.ov === "object") ov = { ...ov, ...saved.ov };
        if (Number.isFinite(saved.barGap)) style.barGap = Math.max(0, Math.min(5, saved.barGap));
if (["16:9", "4:3", "1:1", "custom", "auto"].includes(saved.canvasRatio)) style.canvasRatio = saved.canvasRatio;
for (const key of ["nodeHeightScale", "innerHeightScale"]) if (Number.isFinite(saved[key])) config[key] = Math.max(0.1, Math.min(10, saved[key]));
if (Number.isFinite(saved.figureWidth)) style.figureWidth = Math.max(4, Math.min(60, saved.figureWidth));
      }
    } catch { notes.push("在线编辑参数无法解析，已仅导入基础数据。"); }
  }
  return { config, style, rows, ov, notes, dataSheetName };
}

export function buildWorkbook(doc) {
  const { config: c, style: s, rows } = doc;
  const wb = XLSX.utils.book_new();

  const banner = "OP 桥图配置｜每行一张图；空白纵轴自动设置。（由 OP 桥图在线编辑器导出，可直接用于 OP桥图.py）";
  const cfgRow = [
    "01", "是", c.title, "OP数据", c.unit, c.decimals, c.prefix, c.increase, c.decrease, c.summaryMode,
    c.customSubtitle || "", c.yMin ?? "", c.yMax ?? "", c.boxTopGap ?? "", c.startRatio ?? "", s.titleFontsize, "参数配置",
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([[banner], CONFIG_HEADERS, cfgRow]);
  ws1["!cols"] = CONFIG_HEADERS.map(() => ({ wch: 14 }));

  const params = PARAM_SPECS.map(([cat, name, key, kind, unit, note]) => {
    let value;
    if (kind === "chart") value = c[key] ?? "";
    else if (kind === "boolean") value = s[key] ? "是" : "否";
    else value = s[key];
    return [cat, name, value, unit, note];
  });
  const ws2 = XLSX.utils.aoa_to_sheet([
    ["外观参数配置｜只修改 C 列参数值。复制本 Sheet 可创建另一套样式。"], PARAMETER_HEADERS, ...params,
  ]);
  ws2["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 60 }];

  const data = rows.map((r, i) => {
    const parsed = parseValue(r.value);
    const value = r.kind === "节点" || parsed === null ? "" : Number.isNaN(parsed) ? String(r.value) : parsed;
    return [i + 1, r.name, r.kind, value, r.g[0] || "", r.g[1] || "", r.g[2] || "", "", r.width ?? "", r.gap ?? ""];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([
    ["按 Excel 行顺序从左向右绘图｜起始量填总量，增减项/框外项填有符号变化量，节点数值留空。"], [...DATA_HEADERS, "柱宽", "后间隔"], ...data,
  ]);
  ws3["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, ws1, "图表配置");
  XLSX.utils.book_append_sheet(wb, ws2, "参数配置");
  XLSX.utils.book_append_sheet(wb, ws3, "OP数据");
  const editorSheet = XLSX.utils.aoa_to_sheet([
    ["参数", "内容（在线编辑器使用，Python 忽略本 Sheet）"],
    ["编辑状态", JSON.stringify({ ids: rows.map((r) => r.id), ov: doc.ov, barGap: s.barGap ?? 0.4, canvasRatio: s.canvasRatio || "16:9", figureWidth: s.figureWidth || 16, nodeHeightScale: c.nodeHeightScale ?? 1, innerHeightScale: c.innerHeightScale ?? 1 })],
  ]);
  XLSX.utils.book_append_sheet(wb, editorSheet, "在线编辑参数");
  return wb;
}

export function downloadWorkbook(doc, filename) {
  XLSX.writeFile(buildWorkbook(doc), filename);
}

// 独立输入模板：不带当前用户数据和手动编辑状态，保留默认参数与示例行结构。
export function buildTemplateWorkbook() {
  const wb = buildWorkbook({
    config: { ...DEFAULT_CONFIG, title: "请填写图表标题" },
    style: { ...DEFAULT_STYLE },
    rows: [
      makeRow("期初", "起始量", ""),
      makeRow("项目一", "增减项", "", ["一级分组示例", "二级分组示例", "三级分组示例"]),
      makeRow("项目二", "增减项", "", ["一级分组示例", "二级分组示例", "三级分组示例"]),
      makeRow("期末节点", "节点", ""),
      makeRow("框外项目", "框外项", ""),
    ],
    ov: { off: {}, txt: {}, color: {} },
  });
  delete wb.Sheets["在线编辑参数"];
  wb.SheetNames = wb.SheetNames.filter((name) => name !== "在线编辑参数");
  const instructions = XLSX.utils.aoa_to_sheet([
    ["OP桥图数据输入模板 · 填写说明"],
    ["步骤", "说明"],
    ["1. 图表配置", "填写主标题、指标单位、小数位及汇总文案；纵轴参数留空时自动计算。"],
    ["2. 参数配置", "默认外观参数已填好，仅需按需修改参数值列。"],
    ["3. OP数据", "示例项目名称、类型及分组可替换，填写数值；不需要的示例行可删除，也可继续插入新行。"],
    ["起始量", "必须是第一行，数值填写期初总量。"],
    ["增减项", "填写带正负符号的变化量；分组按一级、二级、三级顺序填写，不能跳级。"],
    ["节点", "数值留空，由系统自动汇总；节点汇总只累计框内增减项。"],
    ["框外项", "填写带正负符号的变化量，不参与分组框汇总。"],
    ["柱宽与后间隔", "留空使用全局默认参数。"],
    ["4. 导入编辑器", "填写后在页面选择导入数据，上传本文件即可生成预览。"],
    ["模板与数据导出", "本模板不包含当前图表数据；保存当前数据请使用导出当前数据 Excel。"],
  ]);
  instructions["!cols"] = [{ wch: 20 }, { wch: 95 }];
  XLSX.utils.book_append_sheet(wb, instructions, "填写说明");
  return wb;
}

export function downloadTemplateWorkbook() {
  XLSX.writeFile(buildTemplateWorkbook(), "OP桥图数据输入模板.xlsx");
}

/** 解析从 Excel / 表格软件复制的 TSV：支持带表头或不带表头。列顺序：项目名称、柱子类型、数值、一级、二级、三级 */
export function parsePastedTable(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const table = lines.map((l) => (l.includes("\t") ? l.split("\t") : l.split(/[,，]/)).map((x) => x.trim()));
  let start = 0;
  let order = ["name", "kind", "value", "g0", "g1", "g2"];
  const head = table[0];
  if (head.includes("项目名称")) {
    const map = { 项目名称: "name", 柱子类型: "kind", 数值: "value", 一级分组: "g0", 二级分组: "g1", 三级分组: "g2" };
    order = head.map((h) => map[h] || null);
    start = 1;
  } else if (head.length >= 2 && !BAR_TYPES.includes(head[1]) && BAR_TYPES.includes(head[2] || "")) {
    // 带“序号”首列
    order = [null, "name", "kind", "value", "g0", "g1", "g2"];
  }
  const rows = [];
  for (let i = start; i < table.length; i++) {
    const rec = {};
    table[i].forEach((v, c) => { if (order[c]) rec[order[c]] = v; });
    if (!rec.name && !rec.value) continue;
    const kind = BAR_TYPES.includes(rec.kind) ? rec.kind : "增减项";
    rows.push(makeRow(rec.name || "", kind, kind === "节点" ? "" : (rec.value || "").replace(/,/g, ""), [rec.g0 || "", rec.g1 || "", rec.g2 || ""]));
  }
  return rows;
}