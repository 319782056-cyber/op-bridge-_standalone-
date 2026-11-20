import { DEFAULT_CONFIG, DEFAULT_STYLE, BAR_TYPES } from './constants';

// v2 默认值快照不可随页面默认设置修改，否则旧码可能恢复错误。
const V2_DEFAULTS = {"config":{"title":"OP桥图—示例","unit":"元","decimals":3,"prefix":"单均","increase":"增加","decrease":"减少","summaryMode":"最后节点","customSubtitle":"","yMin":null,"yMax":null,"boxTopGap":null,"startRatio":null,"nodeHeightScale":1,"innerHeightScale":1},"style":{"titleFontsize":14,"subtitleFontsize":12,"groupMainFontsize":12,"groupSubFontsize":11,"factorFontsize":10,"barNumFontsize":10,"titleBold":true,"titleShiftDownPt":3,"subtitleShiftDownPt":3,"barWidth":0.6,"barGap":0.4,"figureHeight":9.35,"canvasRatio":"16:9","figureWidth":16,"figureMinWidth":12,"widthPerBar":0.8,"labelWrapChars":5,"fontChinese":"KaiTi","fontNumber":"Calibri","colorGreen":"#00A651","colorRed":"#ED2024","colorGray":"#E0E0E0","colorTotal":"#6699CC","colorBox":"#2468A8","colorText":"#000000","colorBorder":"#000000","colorBridge":"#888888","outputDpi":300,"barBorderWidth":0.5,"bridgeLineWidth":0.8,"boxLineWidth":1,"groupLevelGapPt":7.2,"groupTitleInsetPt":3,"barNumOffsetPt":4}};

const MAX_BYTES = 2 * 1024 * 1024;
const checksum = (bytes) => {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
};
const encode = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const decode = (text) => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};
async function transform(bytes, stream) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error('分享码内容过大，请减少数据行数');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

const omitDefaults = (value, defaults) => Object.fromEntries(Object.entries(value).filter(([key, v]) => JSON.stringify(v) !== JSON.stringify(defaults[key])));
function packDoc(doc) {
  const rowKeys = ['id', 'name', 'kind', 'value', 'g', 'width', 'gap'];
  return {
    c: omitDefaults(doc.config, V2_DEFAULTS.config),
    s: omitDefaults(doc.style, V2_DEFAULTS.style),
    r: doc.rows.map((row) => {
      const extras = Object.fromEntries(Object.entries(row).filter(([key, value]) => !rowKeys.includes(key) || (['width', 'gap'].includes(key) && value === null)));
      // 不改写 ID，保留所有依赖 ID 的文字、框及断轴映射。
      return [row.id, row.name, BAR_TYPES.indexOf(row.kind), row.value, row.g,
        row.width ?? null, row.gap ?? null, extras];
    }),
    o: doc.ov,
  };
}
function unpackDoc(packed) {
  if (!packed || !Array.isArray(packed.r) || packed.r.length > 3000) throw new Error('分享码数据结构不支持');
  return {
    config: { ...V2_DEFAULTS.config, ...packed.c },
    style: { ...V2_DEFAULTS.style, ...packed.s },
    rows: packed.r.map((row) => {
      if (!Array.isArray(row) || row.length !== 8) throw new Error('分享码数据行结构无效');
      const [id, name, type, value, g, width, gap, extras] = row;
      return { ...extras, id, name, kind: BAR_TYPES[type], value, g,
        ...(width !== null ? { width } : {}), ...(gap !== null ? { gap } : {}) };
    }),
    ov: packed.o,
  };
}

export async function createShareCode(doc) {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 2, doc: packDoc(doc) }));
  if (bytes.length > MAX_BYTES) throw new Error('当前看板数据过大，无法生成分享码');
  const compressed = typeof CompressionStream !== 'undefined';
  const payload = compressed ? await transform(bytes, new CompressionStream('gzip')) : bytes;
  return `OPCDK2.${compressed ? 'G' : 'J'}.${checksum(payload)}.${encode(payload)}`;
}

export async function parseShareCode(input) {
  const code = String(input).replace(/\s/g, '');
  if (code.length > MAX_BYTES * 2) throw new Error('分享码过长');
  const match = /^OPCDK[12]\.(G|J)\.([0-9a-f]{8})\.([A-Za-z0-9_-]+)$/.exec(code);
  if (!match) throw new Error('不是有效的 OP 看板分享码，请完整粘贴 OPCDK 开头的内容');
  let payload;
  try { payload = decode(match[3]); } catch { throw new Error('分享码编码损坏'); }
  if (checksum(payload) !== match[2]) throw new Error('分享码校验失败，可能复制不完整或被修改');
  if (match[1] === 'G') {
    if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持此压缩分享码，请使用新版 Chrome 或 Edge');
    try { payload = await transform(payload, new DecompressionStream('gzip')); }
    catch (e) { throw new Error(e.message === '分享码内容过大，请减少数据行数' ? e.message : '分享码压缩内容损坏'); }
  }
  let envelope;
  try {
    envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload), (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('非法字段');
      return value;
    });
  } catch { throw new Error('分享码数据格式无效'); }
  const version = Number(code.slice(5, 6));
  if (envelope?.version !== version) throw new Error("分享码版本标识不匹配");
  const d = version === 2 ? unpackDoc(envelope.doc) : envelope?.doc;
  if (![1, 2].includes(envelope?.version) || !d || !Array.isArray(d.rows) || d.rows.length > 3000) throw new Error('分享码版本或数据结构不支持');
  const config = { ...DEFAULT_CONFIG, ...d.config };
  const style = { ...DEFAULT_STYLE, ...d.style };
  const validNumber = (v) => typeof v === 'number' && Number.isFinite(v);
  for (const [key, fallback] of Object.entries(DEFAULT_CONFIG)) {
    if (typeof fallback === 'string' && typeof config[key] !== 'string') throw new Error('图表文案格式无效');
    if ((typeof fallback === 'number' || fallback === null) && config[key] !== null && !validNumber(config[key])) throw new Error('图表数值参数格式无效');
  }
  for (const [key, fallback] of Object.entries(DEFAULT_STYLE)) {
    if (typeof style[key] !== typeof fallback || (typeof fallback === 'number' && !validNumber(style[key]))) throw new Error('外观参数格式无效');
  }
  if (style.figureHeight < 4 || style.figureHeight > 30 || style.figureMinWidth < 4 || style.figureMinWidth > 60 || style.figureWidth < 4 || style.figureWidth > 60 || style.widthPerBar < 0.3 || style.widthPerBar > 3 || style.barWidth < 0.1 || style.barWidth > 5 || style.barGap < 0 || style.barGap > 5) throw new Error('画布或柱尺寸参数超出有效范围');
  const ids = new Set();
  for (const row of d.rows) {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.name !== 'string' || !BAR_TYPES.includes(row.kind) || !Array.isArray(row.g) || row.g.length !== 3 || row.g.some((g) => typeof g !== 'string') || !['string', 'number'].includes(typeof row.value)) throw new Error('数据行格式无效');
    for (const key of ['width', 'gap']) if (row[key] != null && (!validNumber(row[key]) || row[key] < (key === 'width' ? 0.1 : 0) || row[key] > 5)) throw new Error('数据行尺寸参数无效');
    ids.add(row.id);
  }
  const ov = { off: {}, txt: {}, color: {}, box: {}, textStyle: {}, nodeBreak: {}, ...d.ov };
  for (const map of Object.values(ov)) if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('独立编辑参数格式无效');
  return { config, style, rows: d.rows, ov };
}