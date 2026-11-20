// OP 桥图：常量、默认配置、与 Python 脚本 / Excel 模板对应的参数表

export const BAR_TYPES = ["起始量", "增减项", "节点", "框外项"];
export const SUMMARY_MODES = ["最后节点", "全部增减", "框内项目", "不显示"];

// matplotlib 中画布按 100dpi、字号按 pt；这里统一换算为 SVG 像素。
export const PT = 100 / 72;
export const INCH = 100;

export const DEFAULT_CONFIG = {
  title: "OP桥图—示例",
  unit: "元",
  decimals: 3,
  prefix: "单均",
  increase: "增加",
  decrease: "减少",
  summaryMode: "最后节点",
  customSubtitle: "",
  yMin: null,
  yMax: null,
  boxTopGap: null,
  startRatio: null,
  nodeHeightScale: 1,
  innerHeightScale: 1,
};

export const DEFAULT_STYLE = {
  titleFontsize: 14,
  subtitleFontsize: 12,
  groupMainFontsize: 12,
  groupSubFontsize: 11,
  factorFontsize: 10,
  barNumFontsize: 10,
  titleBold: true,
  titleShiftDownPt: 3,
  subtitleShiftDownPt: 3,
  barWidth: 0.6,
  barGap: 0.4,
  figureHeight: 9.35,
  canvasRatio: "16:9",
  figureWidth: 16,
  figureMinWidth: 12,
  widthPerBar: 0.8,
  labelWrapChars: 5,
  fontChinese: "KaiTi",
  fontNumber: "Calibri",
  colorGreen: "#00A651",
  colorRed: "#ED2024",
  colorGray: "#E0E0E0",
  colorTotal: "#6699CC",
  colorBox: "#2468A8",
  colorText: "#000000",
  colorBorder: "#000000",
  colorBridge: "#888888",
  outputDpi: 300,
  barBorderWidth: 0.5,
  bridgeLineWidth: 0.8,
  boxLineWidth: 1,
  groupLevelGapPt: 7.2,
  groupTitleInsetPt: 3,
  barNumOffsetPt: 4,
};

export const CHINESE_FONTS = [
  { value: "KaiTi", label: "楷体 KaiTi" },
  { value: "Microsoft YaHei", label: "微软雅黑" },
  { value: "SimHei", label: "黑体 SimHei" },
  { value: "SimSun", label: "宋体 SimSun" },
  { value: "PingFang SC", label: "苹方 PingFang SC" },
  { value: "Noto Sans SC", label: "思源黑体" },
];

export const NUMBER_FONTS = [
  { value: "Calibri", label: "Calibri" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
  { value: "Times New Roman", label: "Times New Roman" },
];

export const chineseFontStack = (name) =>
  `"${name}", "KaiTi", "STKaiti", "Kaiti SC", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
export const numberFontStack = (name) =>
  `"${name}", Calibri, Arial, "Helvetica Neue", sans-serif`;

// 与 Python 脚本 PARAMETER_SPECS 一一对应（导入/导出 Excel 的「参数配置」Sheet 用）
export const PARAM_SPECS = [
  ["字号", "主标题字号", "titleFontsize", "number", "pt", "数字越大字越大；留空默认14。"],
  ["字号", "副标题字号", "subtitleFontsize", "number", "pt", "自动或自定义副标题字号。"],
  ["字号", "分组主标题字号", "groupMainFontsize", "number", "pt", "三层框中分组名称的字号。"],
  ["字号", "分组副标题字号", "groupSubFontsize", "number", "pt", "框内增加/减少汇总说明的字号。"],
  ["字号", "项目名称字号", "factorFontsize", "number", "pt", "底部X轴项目名称字号。"],
  ["字号", "柱子数字字号", "barNumFontsize", "number", "pt", "柱旁数值的字号。"],
  ["标题位置", "主标题下移", "titleShiftDownPt", "number", "pt", "只移动主标题；正数向下、负数向上、0不移动。"],
  ["标题位置", "副标题下移", "subtitleShiftDownPt", "number", "pt", "独立移动副标题，不随主标题变化；正数向下。"],
  ["标题位置", "主标题加粗", "titleBold", "boolean", "是/否", "填是开启粗体及轻描边，填否使用常规字重。"],
  ["柱与画布", "柱宽", "barWidth", "number", "X轴间距", "所有柱统一宽度，不改变数值；建议0.6。"],
  ["柱与画布", "画布高度", "figureHeight", "number", "英寸", "图片画布高度；建议9.35。"],
  ["柱与画布", "画布最小宽度", "figureMinWidth", "number", "英寸", "项目少时的最小宽度；建议12。"],
  ["柱与画布", "每柱画布宽度", "widthPerBar", "number", "英寸/柱", "项目多时画布宽度=柱数×此值。"],
  ["柱与画布", "项目名称每行字数", "labelWrapChars", "integer", "字符", "底部名称按此长度换行。"],
  ["柱与画布", "输出分辨率", "outputDpi", "integer", "DPI", "图片清晰度，建议300；不改变数据。"],
  ["高度", "起始柱高度比例", "startRatio", "chart", "比例", "填30%或0.3表示起始柱占绘图区高度30%。留空自动。"],
  ["高度", "框顶高度差", "boxTopGap", "chart", "图表数值单位", "框顶=全图最高柱顶+此值；留空自动。"],
  ["高度", "Y轴最小值", "yMin", "chart", "图表数值单位", "留空自动。"],
  ["高度", "Y轴最大值", "yMax", "chart", "图表数值单位", "留空自动；与起始柱高度比例只能填一个。"],
  ["字体", "中文字体", "fontChinese", "font", "字体名", "例如KaiTi、Microsoft YaHei、SimHei。"],
  ["字体", "数字字体", "fontNumber", "font", "字体名", "例如Calibri、Arial。"],
  ["颜色", "减少数字颜色", "colorGreen", "color", "颜色", "负向影响使用此色。"],
  ["颜色", "增加数字颜色", "colorRed", "color", "颜色", "正向影响使用此色。"],
  ["颜色", "浮动柱颜色", "colorGray", "color", "颜色", "增减项及框外项的柱色。"],
  ["颜色", "起始节点柱颜色", "colorTotal", "color", "颜色", "起始量及节点的落地柱颜色。"],
  ["颜色", "分组框颜色", "colorBox", "color", "颜色", "三层虚线框的颜色。"],
  ["颜色", "文字颜色", "colorText", "color", "颜色", "主标题、项目名及汇总前后文颜色。"],
  ["颜色", "柱边框颜色", "colorBorder", "color", "颜色", "柱边框颜色。"],
  ["颜色", "桥接线颜色", "colorBridge", "color", "颜色", "柱间连接虚线颜色。"],
  ["线条与间距", "柱边框线宽", "barBorderWidth", "number", "pt", "柱边框粗细。"],
  ["线条与间距", "桥接线宽", "bridgeLineWidth", "number", "pt", "连接虚线粗细。"],
  ["线条与间距", "分组框线宽", "boxLineWidth", "number", "pt", "框边界粗细。"],
  ["线条与间距", "分组层间距", "groupLevelGapPt", "number", "pt", "上层文字与下一层框顶之间的留白。"],
  ["线条与间距", "分组文字距框顶", "groupTitleInsetPt", "number", "pt", "框顶到分组名称的内侧距离。"],
  ["线条与间距", "数字距柱端", "barNumOffsetPt", "number", "pt", "柱旁数字到对应柱端的外侧间距。"],
];

export const CONFIG_HEADERS = [
  "图表编号", "启用", "主标题", "数据Sheet", "指标单位", "小数位",
  "汇总前缀", "增加文案", "减少文案", "副标题口径", "自定义副标题",
  "Y轴最小值", "Y轴最大值", "框顶高度差", "起始柱高度比例", "主标题字号", "参数配置Sheet",
];
export const DATA_HEADERS = ["序号", "项目名称", "柱子类型", "数值", "一级分组", "二级分组", "三级分组", "备注"];
export const PARAMETER_HEADERS = ["分类", "参数名称", "参数值", "单位", "填写说明"];

let counter = 0;
export const uid = () => `r${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const makeRow = (name, kind, value, g = ["", "", ""]) => ({
  id: uid(), name, kind, value: value === null || value === undefined ? "" : String(value), g: [...g],
});

export const SAMPLE_ROWS = () => [
  makeRow("2025实际", "起始量", 0.5),
  makeRow("运费项目一", "增减项", 0.02, ["降本项目", "运输优化", "运价优化"]),
  makeRow("运费项目二", "增减项", -0.04, ["降本项目", "运输优化", "运价优化"]),
  makeRow("装载率改善", "增减项", 0.01, ["降本项目", "运输优化", "装载改善"]),
  makeRow("线路合并", "增减项", -0.03, ["降本项目", "运输优化", "装载改善"]),
  makeRow("人效项目一", "增减项", 0.1, ["降本项目", "仓内优化", ""]),
  makeRow("人效项目二", "增减项", -0.035, ["降本项目", "仓内优化", ""]),
  makeRow("仓租项目一", "增减项", -0.025, ["降本项目", "仓内优化", ""]),
  makeRow("仓租项目二", "增减项", 0.01, ["降本项目", "升级", ""]),
  makeRow("节点A", "节点", "", ["", "", ""]),
  makeRow("业务量变化一", "增减项", 0.09, ["经营变化", "", ""]),
  makeRow("业务量变化二", "增减项", 0.06, ["经营变化", "", ""]),
  makeRow("节点B", "节点", "", ["", "", ""]),
  makeRow("结构变化一", "增减项", 0.04, ["经营变化", "规模变化", ""]),
  makeRow("结构变化二", "增减项", -0.02, ["经营变化", "规模变化", ""]),
  makeRow("价格变化一", "增减项", 0.05, ["经营变化", "价格变化", ""]),
  makeRow("价格变化二", "增减项", 0.03, ["经营变化", "价格变化", ""]),
  makeRow("节点C", "节点", "", ["", "", ""]),
  makeRow("框外项目一", "框外项", 0.3),
  makeRow("框外项目二", "框外项", -0.04),
  makeRow("框外项目三", "框外项", 0.18),
];

export const createInitialDoc = () => ({
  config: { ...DEFAULT_CONFIG },
  style: { ...DEFAULT_STYLE },
  rows: SAMPLE_ROWS(),
  // off: 元素手动位移；txt: 文本覆盖；color: 单根柱颜色
  ov: { off: {}, txt: {}, color: {} },
});

export const createBlankDoc = () => ({
  config: { ...DEFAULT_CONFIG, title: "未命名桥图" },
  style: { ...DEFAULT_STYLE },
  rows: [makeRow("期初", "起始量", ""), makeRow("项目一", "增减项", ""), makeRow("期末", "节点", "")],
  ov: { off: {}, txt: {}, color: {} },
});