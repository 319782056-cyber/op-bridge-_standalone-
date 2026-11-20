import { useCallback, useEffect, useRef, useState } from 'react';
import { BAR_TYPES, createInitialDoc, DEFAULT_CONFIG, DEFAULT_STYLE } from '@/lib/bridge/constants';

const STORAGE_KEY = 'op-bridge-doc-v1';
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const validateStoredDoc = (value) => {
  if (!isRecord(value) || !isRecord(value.config) || !isRecord(value.style) || !Array.isArray(value.rows) || value.rows.length > 3000) return false;
  const ids = new Set();
  for (const row of value.rows) {
    if (!isRecord(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) return false;
    if (typeof row.name !== 'string' || !BAR_TYPES.includes(row.kind)) return false;
    if (!['string', 'number'].includes(typeof row.value)) return false;
    if (!Array.isArray(row.g) || row.g.length !== 3 || row.g.some((item) => typeof item !== 'string')) return false;
    ids.add(row.id);
  }
  if (value.ov !== undefined && !isRecord(value.ov)) return false;
  for (const key of ['off', 'txt', 'color', 'box', 'textStyle', 'nodeBreak']) {
    const map = value.ov?.[key];
    if (map !== undefined && !isRecord(map)) return false;
  }
  return true;
};

const load = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!validateStoredDoc(stored)) return null;
    return {
      config: { ...DEFAULT_CONFIG, ...stored.config },
      style: { ...DEFAULT_STYLE, ...stored.style },
      rows: stored.rows,
      ov: { off: {}, txt: {}, color: {}, ...stored.ov },
    };
  } catch {
    // 浏览器禁用本地存储或旧数据损坏时，使用示例文档启动。
    return null;
  }
};

/** 文档状态 + 撤销/重做 + 本地自动保存。同一 key 的连续修改（如拖拽、输入）合并为一步。 */
export function useBridgeDoc() {
  const [doc, setDoc] = useState(() => load() || createInitialDoc());
  const past = useRef([]);
  const future = useRef([]);
  const last = useRef({ key: null, time: 0 });
  const docRef = useRef(doc);
  docRef.current = doc;
  const [, bump] = useState(0);

  const commit = useCallback((updater, key = null) => {
    const prev = docRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (next === prev) return;
    const now = Date.now();
    const merge = key && last.current.key === key && now - last.current.time < 900;
    if (!merge) {
      past.current.push(prev);
      if (past.current.length > 100) past.current.shift();
    }
    last.current = { key, time: now };
    future.current = [];
    docRef.current = next;
    setDoc(next);
    bump((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push(docRef.current);
    const prev = past.current.pop();
    last.current = { key: null, time: 0 };
    docRef.current = prev;
    setDoc(prev);
    bump((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push(docRef.current);
    const next = future.current.pop();
    last.current = { key: null, time: 0 };
    docRef.current = next;
    setDoc(next);
    bump((n) => n + 1);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      } catch {
        // 本地存储空间不足时不阻断绘图；用户仍可导出备份文件。
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [doc]);

  return { doc, commit, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
