import { useEffect, useRef, useState } from "react";
import { PT } from "@/lib/bridge/constants";
import { formatNumber } from "@/lib/bridge/model";
import { isOffsetable, scaleBarDisplay, setLinkedBarWidth, setLinkedBoxHeight, setOffset } from "@/lib/bridge/actions";

const SEL = "#2468A8";

function TextEl({ el, fonts, selected, hovered, handlers }) {
  const x = el.cx + el.dxy[0];
  const y = el.top + el.dxy[1];
  const movable = isOffsetable(el.id);
  fonts = el.fonts || fonts;
  return (
    <g
      data-el={el.id}
      transform={`translate(${x},${y})`}
      style={{ cursor: movable ? "move" : "pointer" }}
      onPointerDown={(e) => handlers.down(e, el.id, movable ? "move" : "select")}
      onDoubleClick={(e) => { e.stopPropagation(); handlers.edit(el.id); }}
      onPointerEnter={() => handlers.hover(el.id)}
      onPointerLeave={() => handlers.hover(null)}
    >
      <rect data-ui x={-el.w / 2 - 6} y={-3} width={el.w + 12} height={el.h + 6} fill="transparent" />
      {el.lines.map((ln, i) => (
        <text
          key={i}
          x={0}
          y={ln.y + ln.px * 0.98}
          textAnchor="middle"
          fontSize={ln.px}
          fontWeight={ln.bold ? 700 : 400}
          stroke={ln.stroke ? ln.segs[0].color : undefined}
          strokeWidth={ln.stroke || undefined}
          style={{ userSelect: "none" }}
        >
          {ln.segs.map((s, j) => (
            <tspan key={j} fill={s.color} fontFamily={s.num ? fonts.num : fonts.cn}>{s.text}</tspan>
          ))}
        </text>
      ))}
      {(selected || hovered) && (
        <rect
          data-ui
          x={-el.w / 2 - 6}
          y={-3}
          width={el.w + 12}
          height={el.h + 6}
          fill={selected ? "rgba(36,104,168,0.07)" : "none"}
          stroke={SEL}
          strokeWidth={selected ? 1.5 : 1}
          strokeOpacity={selected ? 1 : 0.45}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
    </g>
  );
}

export default function ChartCanvas({ scene, selected, onSelect, commit, scale, svgRef, editInit, onEditCommit }) {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null); // { text, x, y }
  const [editing, setEditing] = useState(null);
  const wrapRef = useRef(null);
  const dragCleanup = useRef(null);
  useEffect(() => () => dragCleanup.current?.(), []);

  const st = scene.style;
  const fonts = scene.fonts;

  const startDrag = (e, id, mode, extra = {}) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(id);
    if (mode === "select") return;
    dragCleanup.current?.();
    const svg = svgRef.current;
    if (!svg) return;
    const k = sceneRef.current.W / svg.getBoundingClientRect().width;
    const sx = e.clientX;
    const sy = e.clientY;
    const s0 = sceneRef.current;
    const dpp0 = (s0.yMax - s0.yMin) / s0.ax.h;
    const elements = [s0.title, s0.subtitle, ...s0.boxEls, ...s0.barEls.flatMap((b) => [b.num, b.label])];
    const startOff = elements.find((el) => el?.id === id)?.dxy || [0, 0];
    let moved = false;
    const gestureKey = `gesture:${id}:${Date.now()}`;

    const move = (ev) => {
      const cdx = ev.clientX - sx;
      const cdy = ev.clientY - sy;
      if (!moved && Math.hypot(cdx, cdy) < 3) return;
      moved = true;
      let dx = cdx * k;
      let dy = cdy * k;
      if (mode === "move") {
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        commit((d) => setOffset(d, id, [startOff[0] + dx, startOff[1] + dy]), gestureKey);
      } else if (mode === "nodeBreakScale") {
        const direction = extra.v0 >= 0 ? -1 : 1;
        const ratio = Math.max(0.1, Math.min(0.95, extra.ratio + direction * dy / Math.max(1, extra.fullHeight)));
        commit((d) => ({ ...d, ov: { ...d.ov, nodeBreak: { ...d.ov.nodeBreak, [extra.barId]: { enabled: true, ratio: +ratio.toFixed(3) } } } }), gestureKey);
        setDrag({ text: `节点显示 ${Math.round(ratio * 100)}%（数值不变）`, x: extra.hx, y: extra.hy });
      } else if (mode === "displayScale") {
        const direction = extra.v0 >= 0 ? -1 : 1;
        const factor = Math.max(0.2, Math.min(5, 1 + direction * dy / extra.height));
        setDrag({ text: `显示高度 ${Math.round(factor * 100)}%（数值不变）`, x: extra.hx, y: extra.hy });
        commit((d) => scaleBarDisplay(d, s0, factor), gestureKey);
      } else if (mode === "width" || mode === "gap") {
        const next = Math.max(mode === "width" ? 0.1 : 0, Math.min(5, extra.v0 + dx / s0.slot * (mode === "width" ? extra.side * 2 : 1)));
        commit((d) => mode === "width" ? setLinkedBarWidth(d, next)
          : { ...d, rows: d.rows.map((r) => r.id === extra.barId ? { ...r, gap: +next.toFixed(3) } : r) }, gestureKey);
      } else if (mode.startsWith("box:")) {
        const field = mode.slice(4);
        const delta = field === "leftPad" ? -dx : field === "rightPad" ? dx : field === "bottomInset" ? -dy : dy;
        const next = Math.max(field === "topShift" ? -500 : 0, Math.min(500, extra.v0 + delta));
        commit((d) => setLinkedBoxHeight(d, s0, extra.boxKey, field, +next.toFixed(1)), gestureKey);
      } else if (mode === "boxtop") {
        const next = Math.max(extra.min, extra.g0 - dy * dpp0);
        setDrag({ text: `框顶高度差 ${formatNumber(next, extra.decimals + 1)}`, x: extra.hx, y: extra.hy });
        commit((d) => ({ ...d, config: { ...d.config, boxTopGap: Number(next.toPrecision(6)) } }), "boxtop");
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      dragCleanup.current = null;
      setDrag(null);
    };
    dragCleanup.current = up;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const handlers = {
    down: (e, id, mode) => startDrag(e, id, mode),
    hover: setHover,
    edit: (id) => {
      const init = editInit(id);
      const node = svgRef.current?.querySelector(`[data-el="${CSS.escape(id)}"]`);
      const wrap = wrapRef.current;
      if (!init || !node || !wrap) return;
      const r = node.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      setEditing({ id, ...init, left: r.left - w.left + r.width / 2, top: r.top - w.top + r.height / 2, width: r.width });
    },
  };

  const selType = selected ? selected.split(":")[0] : null;
  const selBarId = selected && (selType === "bar" || selType === "num" || selType === "label") ? selected.split(":")[1] : null;
  const selBox = selType === "head" ? scene.boxEls.find((b) => b.id === selected) : null;

  const editRef = useRef(null);
  const doneRef = useRef(false);
  useEffect(() => {
    if (editing && editRef.current) { doneRef.current = false; editRef.current.focus(); editRef.current.select(); }
  }, [editing]);
  const finishEdit = (commitIt) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const cur = editing;
    setEditing(null);
    if (commitIt && cur) onEditCommit(cur.id, editRef.current ? editRef.current.value : cur.text);
  };

  const lw = (v) => v * PT;
  const handleOf = (be) => ({
    x: be.x,
    y: be.anchorY,
  });

  return (
    <div ref={wrapRef} className="relative" style={{ width: scene.W * scale, height: scene.H * scale }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${scene.W} ${scene.H}`}
        width={scene.W * scale}
        height={scene.H * scale}
        className="block bg-white"
        style={{ touchAction: "none" }}
      >
        <rect width={scene.W} height={scene.H} fill="#ffffff" onPointerDown={() => onSelect(null)} />

        {/* 桥接线 */}
        {scene.bridges.map((b, i) => (
          <line key={i} x1={b.x1} x2={b.x2} y1={b.y} y2={b.y2 ?? b.y} stroke={st.colorBridge} strokeWidth={lw(st.bridgeLineWidth)}
            strokeDasharray={`${2 * lw(st.bridgeLineWidth)} ${lw(st.bridgeLineWidth)}`} />
        ))}

        {/* 分组框 */}
        {scene.boxEls.map((b) => {
          const opts = b.settings;
          const lineWidth = opts.lineWidth ?? st.boxLineWidth;
          const dash = opts.dashLength ?? 2 * lw(lineWidth);
          const dashGap = opts.dashGap ?? dash;
          return (
            <g key={b.id}>
              <rect x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} fill={opts.fill || "none"} fillOpacity={opts.fill ? (opts.fillOpacity ?? 0.08) : 1} stroke={opts.color || st.colorBox}
                strokeWidth={lw(lineWidth)} strokeDasharray={opts.solid ? undefined : `${dash} ${dashGap}`} strokeLinecap="round" strokeLinejoin="round" />
              <rect data-ui x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} fill="none" stroke="transparent" strokeWidth={10}
                pointerEvents="stroke" style={{ cursor: "pointer" }} onPointerDown={(e) => startDrag(e, b.id, "select")}
                onDoubleClick={(e) => { e.stopPropagation(); handlers.edit(b.id); }} />
              {selected === b.id && (
                <rect data-ui x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} fill="none" stroke={SEL} strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke" pointerEvents="none" />
              )}
            </g>
          );
        })}

        {/* 柱 */}
        {scene.barEls.map((be) => {
          const isSel = selBarId === be.bar.id;
          const { rect } = be;
          return (
            <g key={be.bar.id} data-el={`bar:${be.bar.id}`} style={{ cursor: "pointer" }}
              onPointerDown={(e) => startDrag(e, `bar:${be.bar.id}`, "select")}
              onDoubleClick={(e) => { e.stopPropagation(); handlers.edit(`bar:${be.bar.id}`); }}
              onPointerEnter={() => setHover(`bar:${be.bar.id}`)} onPointerLeave={() => setHover(null)}>
              <title data-ui>{`${be.bar.name}：${formatNumber(be.bar.value, scene.cfg.decimals)}（累计 ${formatNumber(be.bar.after, scene.cfg.decimals)}）`}</title>
              <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={be.fill} stroke={st.colorBorder} strokeWidth={lw(st.barBorderWidth)} />
              {be.nodeBreak && rect.h > 10 && (() => {
                const middle = rect.y + rect.h * 0.78;
                const rise = Math.min(8, rect.h * 0.08);
                const gap = Math.min(7, rect.h * 0.08);
                return <g data-node-break="true" pointerEvents="none">
                  <path d={`M ${rect.x - 1} ${middle + rise / 2} L ${rect.x + rect.w + 1} ${middle - rise / 2} L ${rect.x + rect.w + 1} ${middle - rise / 2 + gap} L ${rect.x - 1} ${middle + rise / 2 + gap} Z`} fill="#fff" />
                  <path d={`M ${rect.x - 2} ${middle + rise / 2} L ${rect.x + rect.w + 2} ${middle - rise / 2} M ${rect.x - 2} ${middle + rise / 2 + gap} L ${rect.x + rect.w + 2} ${middle - rise / 2 + gap}`} fill="none" stroke={st.colorBorder} strokeWidth={Math.max(0.8, lw(st.barBorderWidth))} />
                </g>;
              })()}
              <rect data-ui x={rect.x} y={rect.y - Math.max(0, (10 - rect.h) / 2)} width={rect.w} height={Math.max(rect.h, 10)} fill="transparent" />
              {(isSel || hover === `bar:${be.bar.id}`) && (
                <rect data-ui x={rect.x - 3} y={rect.y - 3} width={rect.w + 6} height={rect.h + 6} fill="none" stroke={SEL}
                  strokeWidth={isSel ? 1.5 : 1} strokeOpacity={isSel ? 1 : 0.45} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              )}
            </g>
          );
        })}

        {/* 底部 X 轴：属于图表内容，PNG / SVG 导出时保留 */}
        <g data-axis="bottom" pointerEvents="none" stroke={st.colorBorder} strokeWidth={PT * 0.8}>
          <line x1={scene.ax.l} x2={scene.ax.r} y1={scene.ax.b} y2={scene.ax.b} />
          {scene.barEls.map((be) => (
            <line key={be.bar.id} x1={be.x} x2={be.x} y1={scene.ax.b} y2={scene.ax.b + 5} />
          ))}
        </g>

        {/* 文本 */}
        {scene.boxEls.map((b) => (
          <TextEl key={b.id} el={b} fonts={fonts} selected={selected === b.id} hovered={hover === b.id} handlers={handlers} />
        ))}
        {scene.barEls.map((be) => (
          <g key={be.bar.id}>
            <TextEl el={be.num} fonts={fonts} selected={selected === be.num.id} hovered={hover === be.num.id} handlers={handlers} />
            <TextEl el={be.label} fonts={fonts} selected={selected === be.label.id} hovered={hover === be.label.id} handlers={handlers} />
          </g>
        ))}
        <TextEl el={scene.title} fonts={fonts} selected={selected === "title"} hovered={hover === "title"} handlers={handlers} />
        {scene.subtitle && (
          <TextEl el={scene.subtitle} fonts={fonts} selected={selected === "subtitle"} hovered={hover === "subtitle"} handlers={handlers} />
        )}

        {/* 高度比例手柄：统一缩放纵轴，永不修改业务数据 */}
        {selBarId && (() => {
          const be = scene.barEls.find((b) => b.bar.id === selBarId);
          if (!be || Math.abs(be.bar.value) < 1e-12) return null;
          const h = handleOf(be);
          return (
            <g data-ui style={{ cursor: "ns-resize" }}
              onPointerDown={(e) => startDrag(e, `bar:${be.bar.id}`, be.nodeBreak ? "nodeBreakScale" : "displayScale", {
                v0: be.bar.value, height: Math.max(1, be.rect.h), hx: h.x, hy: h.y,
                barId: be.bar.id, ratio: be.displayRatio, fullHeight: be.fullHeight,
              })}>
              <circle cx={h.x} cy={h.y} r={Math.max(12, 22 / scale)} fill="transparent" />
              <circle cx={h.x} cy={h.y} r={5.5} fill="#fff" stroke={SEL} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })()}

        {/* 单柱宽度及后间隔手柄：拖拽直接回写该行参数 */}
        {selBarId && (() => {
          const be = scene.barEls.find((b) => b.bar.id === selBarId);
          if (!be) return null;
          const mid = be.rect.y + Math.max(12, be.rect.h / 2);
          return <g data-ui>
            {[-1, 1].map((side) => {
              const x = be.x + side * be.rect.w / 2;
              return <g key={side} style={{ cursor: "ew-resize" }} onPointerDown={(e) => startDrag(e, `bar:${be.bar.id}`, "width", { barId: be.bar.id, v0: be.width, side })}>
                <rect x={x - 10 / scale} y={mid - 12 / scale} width={20 / scale} height={24 / scale} fill="transparent" />
                <rect x={x - 3 / scale} y={mid - 6 / scale} width={6 / scale} height={12 / scale} fill="#fff" stroke={SEL} vectorEffect="non-scaling-stroke" />
              </g>;
            })}
            {be.i < scene.barEls.length - 1 && <g style={{ cursor: "ew-resize" }} onPointerDown={(e) => startDrag(e, `bar:${be.bar.id}`, "gap", { barId: be.bar.id, v0: be.gap })}>
              <rect x={be.x + be.rect.w / 2} y={scene.ax.b + 2} width={Math.max(10, be.gap * scene.slot)} height={14 / scale} fill={SEL} fillOpacity={0.12} />
              <line x1={be.x + be.rect.w / 2 + 2} x2={be.x + be.rect.w / 2 + Math.max(4, be.gap * scene.slot - 2)} y1={scene.ax.b + 7 / scale} y2={scene.ax.b + 7 / scale} stroke={SEL} vectorEffect="non-scaling-stroke" />
            </g>}
          </g>;
        })()}

        {/* 当前框独立尺寸手柄 */}
        {selBox && <g data-ui>
          {[
            ["topShift", selBox.rect.x + selBox.rect.w / 2, selBox.rect.y, "ns-resize"],
            ["bottomInset", selBox.rect.x + selBox.rect.w / 2, selBox.rect.y + selBox.rect.h, "ns-resize"],
          ].map(([field, x, y, cursor]) => <g key={field} style={{ cursor }} onPointerDown={(e) => startDrag(e, selBox.id, `box:${field}`, { boxKey: selBox.box.key, v0: selBox.settings[field] ?? 0 })}>
            <rect x={x - 10 / scale} y={y - 10 / scale} width={20 / scale} height={20 / scale} fill="transparent" />
            <rect x={x - 3 / scale} y={y - 3 / scale} width={6 / scale} height={6 / scale} fill="#fff" stroke={SEL} vectorEffect="non-scaling-stroke" />
          </g>)}
        </g>}

        {drag && (
          <g data-ui pointerEvents="none">
            <rect x={drag.x + 14} y={drag.y - 14} width={Math.max(54, drag.text.length * 8 + 16)} height={26} rx={4} fill="#1f2937" />
            <text x={drag.x + 22} y={drag.y + 4} fontSize={13} fill="#fff" fontFamily={fonts.num}>{drag.text}</text>
          </g>
        )}
      </svg>

      {editing && (
        <div
          className="absolute z-10"
          style={{ left: editing.left, top: editing.top, transform: "translate(-50%, -50%)", width: Math.max(editing.width + 40, 180) }}
        >
          <textarea
            ref={editRef}
            defaultValue={editing.text}
            rows={editing.multiline ? 2 : 1}
            className="block w-full resize-none rounded-md border border-primary bg-white px-2 py-1.5 text-center text-sm text-foreground outline-none ring-2 ring-primary/20"
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); finishEdit(false); }
              else if (e.key === "Enter" && (!editing.multiline || !e.shiftKey)) { e.preventDefault(); finishEdit(true); }
            }}
            onBlur={() => finishEdit(true)}
          />
          <div className="mt-1 text-center text-xs text-muted-foreground">
            {editing.hint} · Enter 确认{editing.multiline ? " / Shift+Enter 换行" : ""} · Esc 取消
          </div>
        </div>
      )}
    </div>
  );
}