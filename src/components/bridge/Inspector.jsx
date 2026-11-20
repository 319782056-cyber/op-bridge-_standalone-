import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Move, RotateCcw, Trash2 } from "lucide-react";
import { BAR_TYPES, CHINESE_FONTS, DEFAULT_STYLE, NUMBER_FONTS, SUMMARY_MODES } from "@/lib/bridge/constants";
import { clearOffset, deleteRow, parseId, patchRow, setGroup, setLinkedBarWidth, setLinkedBoxHeight, setOffset } from "@/lib/bridge/actions";
import { formatNumber } from "@/lib/bridge/model";
import { ColorField, Field, NumField, SwitchField, TextField } from "./fields";

const Section = ({ title, children }) => (
  <div className="space-y-3 border-b border-border px-4 py-4 last:border-b-0">
    {title && <h3 className="text-sm font-medium text-foreground">{title}</h3>}
    {children}
  </div>
);

const Grid = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>;

// 当前元素独立设置，所有位移与拖拽共享同一份文档状态。
function ElementOptions({ doc, scene, id, commit }) {
  const opts = doc.ov.textStyle?.[id] || {};
  const el = [scene.title, scene.subtitle, ...scene.boxEls, ...scene.barEls.flatMap((b) => [b.num, b.label])].find((e) => e?.id === id);
  const xy = doc.ov.off[id] || [0, 0];
  const patch = (p) => commit((d) => ({ ...d, ov: { ...d.ov, textStyle: { ...d.ov.textStyle, [id]: { ...d.ov.textStyle?.[id], ...p } } } }), `textStyle:${id}`);
  if (!el) return null;
  return <Section title="当前文字 · 独立样式与位置">
    <Grid>
      <NumField label="水平偏移" suffix="px" value={xy[0]} onChange={(v) => commit((d) => setOffset(d, id, [v, (d.ov.off[id] || [0, 0])[1]]), `pos:${id}`)} />
      <NumField label="垂直偏移" suffix="px" value={xy[1]} onChange={(v) => commit((d) => setOffset(d, id, [(d.ov.off[id] || [0, 0])[0], v]), `pos:${id}`)} />
      <NumField label="字号" suffix="pt" min={6} max={48} value={opts.fontsize ?? +(el.lines[0].px / (100 / 72)).toFixed(1)} onChange={(v) => patch({ fontsize: v })} />
      <SwitchField label="加粗" checked={opts.bold ?? el.lines[0].bold} onChange={(v) => patch({ bold: v })} />
    </Grid>
    <ColorField label="文字颜色" value={opts.color || el.lines[0].segs[0].color} onChange={(v) => patch({ color: v })} />
    {[["中文字体", "fontChinese", CHINESE_FONTS], ["数字字体", "fontNumber", NUMBER_FONTS]].map(([label, key, choices]) => <Field key={key} label={label}>
      <Select value={opts[key] || doc.style[key]} onValueChange={(v) => patch({ [key]: v })}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>{choices.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
      </Select>
    </Field>)}
    <Button variant="outline" size="sm" className="w-full" onClick={() => commit((d) => {
      const textStyle = { ...d.ov.textStyle }; delete textStyle[id];
      return { ...d, ov: { ...d.ov, textStyle } };
    })}>恢复继承全局文字样式</Button>
    <p className="text-xs text-muted-foreground">图上拖动时偏移数值同步更新；独立样式只影响当前文字。</p>
  </Section>;
}

/** 选中元素的属性面板 */
export function SelectionPanel({ doc, scene, selected, commit, onSelect }) {
  const setStyle = (patch, key) => commit((d) => ({ ...d, style: { ...d.style, ...patch } }), key);
  const { type, key } = parseId(selected);
  const row = doc.rows.find((r) => r.id === key);
  const be = scene.barEls.find((b) => b.bar.id === key);
  const resetPos = (ids) => (
    <Button variant="outline" size="sm" className="h-8 w-full cursor-pointer" onClick={() => commit((d) => clearOffset(d, ids))}>
      <Move className="mr-1.5 h-3.5 w-3.5" />恢复默认位置
    </Button>
  );

  if (type === "title" || type === "subtitle") {
    const isTitle = type === "title";
    return (
      <div>
        <Section title={isTitle ? "主标题" : "副标题"}>
          <TextField
            label="文字"
            multiline
            value={isTitle ? doc.config.title : doc.config.customSubtitle}
            placeholder={isTitle ? "" : "留空 = 自动汇总文案"}
            hint={isTitle ? undefined : "自动汇总文案由「全局设置 → 汇总文案」控制"}
            onChange={(v) => commit((d) => ({ ...d, config: { ...d.config, [isTitle ? "title" : "customSubtitle"]: v } }), `txt:${type}`)}
          />
          <NumField
            label="字号" suffix="pt" min={6} max={48}
            value={isTitle ? doc.style.titleFontsize : doc.style.subtitleFontsize}
            onChange={(v) => setStyle({ [isTitle ? "titleFontsize" : "subtitleFontsize"]: v }, `fs:${type}`)}
          />
          <NumField
            label="上下位置微调" suffix="pt" min={-100} max={100} hint="正数向下、负数向上；也可直接在图上拖动"
            value={isTitle ? doc.style.titleShiftDownPt : doc.style.subtitleShiftDownPt}
            onChange={(v) => setStyle({ [isTitle ? "titleShiftDownPt" : "subtitleShiftDownPt"]: v }, `shift:${type}`)}
          />
          {!isTitle && <>
            <Field label="自动汇总口径">
              <Select value={doc.config.summaryMode} onValueChange={(v) => commit((d) => ({ ...d, config: { ...d.config, summaryMode: v } }))}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{SUMMARY_MODES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Grid>{[["prefix", "汇总前缀"], ["unit", "单位"], ["increase", "增加文案"], ["decrease", "减少文案"]].map(([key, label]) => <TextField key={key} label={label} value={doc.config[key]} onChange={(v) => commit((d) => ({ ...d, config: { ...d.config, [key]: v } }), `cfg:${key}`)} />)}</Grid>
          </>}
          {isTitle && <SwitchField label="加粗" checked={doc.style.titleBold} onChange={(v) => setStyle({ titleBold: v })} />}
          {resetPos([type])}
        </Section>
        <ElementOptions doc={doc} scene={scene} id={selected} commit={commit} />
      </div>
    );
  }

  if ((type === "bar" || type === "num" || type === "label") && row && be) {
const isNode = row.kind === "节点";
const canBreak = isNode || row.kind === "起始量";
const fill = doc.ov.color[row.id];
    return (
      <div>
        <Section title="节点断轴 · 单柱压缩">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-primary" disabled={!canBreak}
              checked={canBreak && !!doc.ov.nodeBreak?.[row.id]?.enabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                commit((d) => ({ ...d, ov: { ...d.ov, nodeBreak: { ...d.ov.nodeBreak, [row.id]: { ratio: 0.55, ...d.ov.nodeBreak?.[row.id], enabled } } } }));
              }} />
            启用节点断轴
          </label>
          <p className="text-xs text-muted-foreground">{canBreak ? `当前${row.kind}：${row.name}。压缩当前柱，关联增减柱自动贴近，真实数值不变。` : `当前柱类型是「${row.kind}」，仅「起始量」和「节点」可启用断轴。`}</p>
          {canBreak && doc.ov.nodeBreak?.[row.id]?.enabled && <NumField label="保留显示高度" suffix="%" min={10} max={95} value={Math.round((doc.ov.nodeBreak[row.id].ratio ?? 0.55) * 100)}
            hint="拖动当前柱端圆点可调比例；关联柱只平移，不改变变化量高度。"
            onChange={(v) => commit((d) => ({ ...d, ov: { ...d.ov, nodeBreak: { ...d.ov.nodeBreak, [row.id]: { enabled: true, ratio: v / 100 } } } }), `node-break:${row.id}`)} />}
        </Section>
        <Section title={`柱子：${row.name || "未命名"}`}>
          <div className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            累计结果 <span className="tabular-nums font-medium text-foreground">{formatNumber(be.bar.after, doc.config.decimals)}</span>
            {" "}{doc.config.unit}
            {isNode && "（节点数值由前面各项自动汇总）"}
          </div>
          <TextField label="项目名称" value={row.name} onChange={(v) => commit((d) => patchRow(d, row.id, { name: v }), `name:${row.id}`)} />
          <Grid>
            <Field label="柱子类型">
              <Select value={row.kind} onValueChange={(v) => commit((d) => patchRow(d, row.id, { kind: v, value: v === "节点" ? "" : row.value, g: v === "增减项" ? row.g : ["", "", ""] }))}>
                <SelectTrigger className="h-8 cursor-pointer text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{BAR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <NumField
              label="数值" value={isNode ? "" : row.value} nullable disabled={isNode}
              hint={isNode ? "节点自动计算" : "仅此输入框或表格可修改数值；拖拽不会修改数据"}
              onChange={(v) => !isNode && commit((d) => patchRow(d, row.id, { value: v === null ? "" : String(v) }), `val:${row.id}`)}
            />
          </Grid>
          {row.kind === "增减项" && (
            <div className="space-y-2">
              {["一级分组", "二级分组", "三级分组"].map((n, i) => (
                <TextField key={n} label={n} value={row.g[i]} placeholder="留空 = 不分组" onChange={(v) => commit((d) => setGroup(d, row.id, i, v), `g${i}:${row.id}`)} />
              ))}
            </div>
          )}
        </Section>
        <Section title="柱显示高度（数值不变）">
          <p className="text-xs text-muted-foreground">未启用节点断轴时，拖动圆点调整全图比例；启用后仅调整当前节点显示高度。柱值、节点和汇总数值不变。当前柱高度约占绘图区 {Math.round(be.rect.h / scene.ax.h * 100)}%。</p>
          <Grid>
            <NumField label="纵轴显示下限" nullable value={doc.config.yMin} placeholder="自动" onChange={(v) => commit((d) => ({ ...d, config: { ...d.config, yMin: v } }), "display-ymin")} />
            <NumField label="纵轴显示上限" nullable value={doc.config.yMax} placeholder="自动" onChange={(v) => commit((d) => ({ ...d, config: { ...d.config, yMax: v, startRatio: null } }), "display-ymax")} />
          </Grid>
          <Button variant="outline" size="sm" onClick={() => commit((d) => ({ ...d, config: { ...d.config, yMin: null, yMax: null, startRatio: null } }))}>恢复自动高度比例</Button>
        </Section>
        <Section title="当前柱 · 宽度与间隔">
          <Grid>
            <NumField label="柱宽（全图联动）" value={row.width ?? doc.style.barWidth} min={0.1} max={5} onChange={(v) => commit((d) => setLinkedBarWidth(d, v), "linked-width")} />
            <NumField label="与下一柱的间隔" value={row.gap ?? doc.style.barGap ?? 0.4} min={0} max={5} disabled={be.i === scene.barEls.length - 1} onChange={(v) => commit((d) => patchRow(d, row.id, { gap: v }), `gap:${row.id}`)} />
          </Grid>
          <p className="text-xs text-muted-foreground">单位为相对绘图区的布局单位；拖动任意柱左右手柄，会统一调整全部柱宽；后间隔仍按柱独立调整。</p>
          <Button variant="outline" size="sm" onClick={() => commit((d) => patchRow(d, row.id, { width: null, gap: null }))}>恢复全局宽度和间隔</Button>
          <NumField label="柱边框线宽（全图）" suffix="pt" min={0} max={5} value={doc.style.barBorderWidth} onChange={(v) => setStyle({ barBorderWidth: v })} />
          <ColorField label="柱边框颜色（全图）" value={doc.style.colorBorder} onChange={(v) => setStyle({ colorBorder: v })} />
          <NumField label="桥接线宽（全图）" suffix="pt" min={0.1} max={5} value={doc.style.bridgeLineWidth} onChange={(v) => setStyle({ bridgeLineWidth: v })} />
          <NumField label="数字距柱端（全图）" suffix="pt" min={0} max={20} value={doc.style.barNumOffsetPt} onChange={(v) => setStyle({ barNumOffsetPt: v })} />
        </Section>
        <ElementOptions doc={doc} scene={scene} id={type === "bar" ? `num:${row.id}` : selected} commit={commit} />
        {type === "bar" && <ElementOptions doc={doc} scene={scene} id={`label:${row.id}`} commit={commit} />}
        <Section title="外观">
          <ColorField
            label="此柱颜色" value={fill || (be.bar.isTotal ? doc.style.colorTotal : doc.style.colorGray)}
            onChange={(v) => commit((d) => ({ ...d, ov: { ...d.ov, color: { ...d.ov.color, [row.id]: v } } }), `color:${row.id}`)}
            onReset={fill ? () => commit((d) => { const c = { ...d.ov.color }; delete c[row.id]; return { ...d, ov: { ...d.ov, color: c } }; }) : undefined}
          />
          <Field label="数字显示文字" hint="仅改显示，不影响计算；清空恢复自动">
            <input
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={doc.ov.txt[`num:${row.id}`] ?? ""}
              placeholder={formatNumber(be.bar.value, doc.config.decimals)}
              onChange={(e) => commit((d) => {
                const t = { ...d.ov.txt };
                if (e.target.value) t[`num:${row.id}`] = e.target.value; else delete t[`num:${row.id}`];
                return { ...d, ov: { ...d.ov, txt: t } };
              }, `numtxt:${row.id}`)}
            />
          </Field>
          <Grid>
            <Button variant="outline" size="sm" className="h-8 cursor-pointer" onClick={() => commit((d) => clearOffset(d, [`num:${row.id}`, `label:${row.id}`]))}>
              <Move className="mr-1.5 h-3.5 w-3.5" />复位文字
            </Button>
            <Button variant="outline" size="sm" className="h-8 cursor-pointer text-destructive hover:text-destructive"
              onClick={() => { commit((d) => deleteRow(d, row.id)); onSelect(null); }}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />删除此行
            </Button>
          </Grid>
        </Section>
      </div>
    );
  }

  if (type === "head") {
    const he = scene.boxEls.find((b) => b.id === selected);
    if (!he) return null;
    const { level, start, end, amount } = he.box;
    const lv = ["一级", "二级", "三级"][level];
    return (
      <div>
        <Section title={`${lv}分组：${he.box.name}`}>
          <div className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            包含 {end - start + 1} 个项目，合计 <span className="tabular-nums font-medium text-foreground">{formatNumber(amount, doc.config.decimals)}</span> {doc.config.unit}
          </div>
          <TextField
            label="分组名称" value={he.box.name} hint="同步修改框内全部项目的分组字段"
            onChange={(v) => {
              if (!v.trim()) return;
              const ids = new Set(scene.bars.slice(start, end + 1).map((b) => b.id));
              commit((d) => ({ ...d, rows: d.rows.map((r) => (ids.has(r.id) ? { ...r, g: r.g.map((g, i) => (i === level ? v : g)) } : r)) }), `head:${he.id}`);
            }}
          />
          <NumField
            label="框顶高度差" suffix={doc.config.unit} nullable value={doc.config.boxTopGap}
            placeholder={scene.gap ? formatNumber(scene.gap.recommended, doc.config.decimals + 1) : "自动"}
            hint="影响所有分组框的统一高度；选中后也可拖动框顶的胶囊手柄"
            onChange={(v) => commit((d) => ({ ...d, config: { ...d.config, boxTopGap: v } }), "boxtop")}
            onReset={doc.config.boxTopGap != null ? () => commit((d) => ({ ...d, config: { ...d.config, boxTopGap: null } })) : undefined}
          />
          {resetPos([he.id])}
        </Section>
        <Section title="当前框 · 独立几何与线条">
          <p className="text-xs text-muted-foreground">框宽自动匹配所属柱子的宽度、间隔和位置，无需手动调整。上下边按一级、二级、三级分别联动；颜色与线条仍独立。</p>
          <Grid>
            {[["topShift", "框顶偏移", -500], ["bottomInset", "框底内缩", 0], ["textInset", "文字距框顶", 0], ["lineWidth", "框线宽(pt)", 0.1], ["dashLength", "虚线长度", 0.1], ["dashGap", "虚线间隔", 0.1]].map(([field, label, min]) => <NumField key={field} label={label} min={min} max={field === "lineWidth" ? 5 : 500}
              value={he.settings[field] ?? (field === "textInset" ? doc.style.groupTitleInsetPt * 100 / 72 : field === "lineWidth" ? doc.style.boxLineWidth : field.startsWith("dash") ? doc.style.boxLineWidth * 2 * 100 / 72 : 0)}
              onChange={(v) => commit((d) => ["topShift", "bottomInset"].includes(field)
                  ? setLinkedBoxHeight(d, scene, he.box.key, field, v)
                  : { ...d, ov: { ...d.ov, box: { ...d.ov.box, [he.box.key]: { ...d.ov.box?.[he.box.key], [field]: v } } } }, `box:${he.box.key}:${field}`)} />)}
          </Grid>
          <ColorField label="当前框颜色" value={he.settings.color || doc.style.colorBox} onChange={(v) => commit((d) => ({ ...d, ov: { ...d.ov, box: { ...d.ov.box, [he.box.key]: { ...d.ov.box?.[he.box.key], color: v } } } }))} />
          <SwitchField label="显示背景填充" checked={!!he.settings.fill} onChange={(v) => commit((d) => ({ ...d, ov: { ...d.ov, box: { ...d.ov.box, [he.box.key]: { ...d.ov.box?.[he.box.key], fill: v ? doc.style.colorBox : null } } } }))} />
          {he.settings.fill && <>
            <ColorField label="背景颜色" value={he.settings.fill} onChange={(v) => commit((d) => ({ ...d, ov: { ...d.ov, box: { ...d.ov.box, [he.box.key]: { ...d.ov.box?.[he.box.key], fill: v } } } }))} />
            <NumField label="背景不透明度" min={0} max={1} value={he.settings.fillOpacity ?? 0.08} onChange={(v) => commit((d) => ({ ...d, ov: { ...d.ov, box: { ...d.ov.box, [he.box.key]: { ...d.ov.box?.[he.box.key], fillOpacity: v } } } }))} />
          </>}
          <SwitchField label="实线边框" checked={he.settings.solid || false} onChange={(v) => commit((d) => ({ ...d, ov: { ...d.ov, box: { ...d.ov.box, [he.box.key]: { ...d.ov.box?.[he.box.key], solid: v } } } }))} />
          <Button variant="outline" size="sm" onClick={() => commit((d) => {
            const box = { ...d.ov.box }; delete box[he.box.key]; return { ...d, ov: { ...d.ov, box } };
          })}>恢复当前框默认参数</Button>
        </Section>
        <ElementOptions doc={doc} scene={scene} id={selected} commit={commit} />
        <Section title="分组样式（全图通用）">
          <ColorField label="分组框颜色" value={doc.style.colorBox} onChange={(v) => commit((d) => ({ ...d, style: { ...d.style, colorBox: v } }), "colorBox")} />
          <Grid>
            <NumField label="名称字号" suffix="pt" value={doc.style.groupMainFontsize} min={6} max={36} onChange={(v) => commit((d) => ({ ...d, style: { ...d.style, groupMainFontsize: v } }), "gm")} />
            <NumField label="汇总字号" suffix="pt" value={doc.style.groupSubFontsize} min={6} max={36} onChange={(v) => commit((d) => ({ ...d, style: { ...d.style, groupSubFontsize: v } }), "gs")} />
            <NumField label="框线宽" suffix="pt" value={doc.style.boxLineWidth} min={0.1} max={5} onChange={(v) => commit((d) => ({ ...d, style: { ...d.style, boxLineWidth: v } }), "bl")} />
            <NumField label="层间距" suffix="pt" value={doc.style.groupLevelGapPt} min={2} max={30} onChange={(v) => commit((d) => ({ ...d, style: { ...d.style, groupLevelGapPt: v } }), "gl")} />
          </Grid>
        </Section>
      </div>
    );
  }
  return null;
}

/** 全局设置：文案 / 纵轴 / 字号 / 颜色 / 画布 */
export function GlobalPanel({ doc, commit, scene }) {
  const c = doc.config;
  const s = doc.style;
  const setCfg = (patch, key) => commit((d) => ({ ...d, config: { ...d.config, ...patch } }), key);
  const setSt = (patch, key) => commit((d) => ({ ...d, style: { ...d.style, ...patch } }), key);
  const color = (label, k) => (
    <ColorField key={k} label={label} value={s[k]} onChange={(v) => setSt({ [k]: v }, `c:${k}`)} onReset={s[k] !== DEFAULT_STYLE[k] ? () => setSt({ [k]: DEFAULT_STYLE[k] }) : undefined} />
  );
  return (
    <Accordion type="multiple" defaultValue={["height-scales", "canvas", "text"]} className="px-4">
      <AccordionItem value="text">
        <AccordionTrigger className="cursor-pointer py-3 text-sm">标题与汇总文案</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <TextField label="主标题" value={c.title} multiline onChange={(v) => setCfg({ title: v }, "title")} />
          <Field label="副标题口径">
            <Select value={c.summaryMode} onValueChange={(v) => setCfg({ summaryMode: v })}>
              <SelectTrigger className="h-8 cursor-pointer text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{SUMMARY_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <TextField label="自定义副标题" value={c.customSubtitle} placeholder="留空 = 自动汇总" onChange={(v) => setCfg({ customSubtitle: v }, "sub")} />
          <Grid>
            <TextField label="指标单位" value={c.unit} onChange={(v) => setCfg({ unit: v }, "unit")} />
            <NumField label="小数位" value={c.decimals} min={0} max={6} onChange={(v) => setCfg({ decimals: Math.round(v) })} />
            <TextField label="汇总前缀" value={c.prefix} onChange={(v) => setCfg({ prefix: v }, "prefix")} />
            <span />
            <TextField label="增加文案" value={c.increase} onChange={(v) => setCfg({ increase: v }, "inc")} />
            <TextField label="减少文案" value={c.decrease} onChange={(v) => setCfg({ decrease: v }, "dec")} />
          </Grid>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="height-scales">
        <AccordionTrigger className="cursor-pointer py-3 text-sm">节点 / 框内柱高度比例</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <p className="text-xs text-muted-foreground">默认均为 1 倍（1:1）。仅改变柱子显示高度，真实数字、节点计算和汇总不变。起始量与节点共用节点倍率；框外柱不放大。</p>
          <NumField label="节点柱高度倍率（含起始量）" suffix="倍" min={0.1} max={10} value={c.nodeHeightScale ?? 1} onChange={(v) => setCfg({ nodeHeightScale: v }, "node-height-scale")} />
          <NumField label="框内增减柱高度倍率" suffix="倍" min={0.1} max={10} value={c.innerHeightScale ?? 1} onChange={(v) => setCfg({ innerHeightScale: v }, "inner-height-scale")} />
          <Button variant="outline" size="sm" onClick={() => setCfg({ nodeHeightScale: 1, innerHeightScale: 1 })}>恢复 1:1</Button>
          <p className="text-xs text-muted-foreground">示例：节点 0.5、框内 2，可弱化总量柱并突出增减变化。自动纵轴可能重新适配画布，固定纵轴时可直观看到绝对倍数。</p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="axis">
        <AccordionTrigger className="cursor-pointer py-3 text-sm">纵轴与高度</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <NumField label="起始柱高度比例" nullable value={c.startRatio} placeholder="自动" hint="如 0.3 或 30%：起始柱占绘图区高度；与 Y 轴最大值二选一"
            onChange={(v) => setCfg(v != null && (v <= 0 || v >= 1) ? {} : { startRatio: v, ...(v != null ? { yMax: null } : {}) }, "ratio")}
            onReset={c.startRatio != null ? () => setCfg({ startRatio: null }) : undefined} />
          <Grid>
            <NumField label="Y轴最小值" nullable value={c.yMin} placeholder="自动" onChange={(v) => setCfg({ yMin: v }, "ymin")} />
            <NumField label="Y轴最大值" nullable value={c.yMax} placeholder="自动" onChange={(v) => setCfg({ yMax: v, ...(v != null ? { startRatio: null } : {}) }, "ymax")} />
          </Grid>
          <NumField label="框顶高度差" nullable value={c.boxTopGap} suffix={c.unit}
            placeholder={scene?.gap ? formatNumber(scene.gap.recommended, c.decimals + 1) : "自动"}
            onChange={(v) => setCfg({ boxTopGap: v != null && v <= 0 ? null : v }, "boxtop")}
            onReset={c.boxTopGap != null ? () => setCfg({ boxTopGap: null }) : undefined} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="font">
        <AccordionTrigger className="cursor-pointer py-3 text-sm">字体与字号</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <Field label="中文字体" hint="导出图片使用本机已安装字体，未安装时自动回退">
            <Select value={s.fontChinese} onValueChange={(v) => setSt({ fontChinese: v })}>
              <SelectTrigger className="h-8 cursor-pointer text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{CHINESE_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="数字字体">
            <Select value={s.fontNumber} onValueChange={(v) => setSt({ fontNumber: v })}>
              <SelectTrigger className="h-8 cursor-pointer text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{NUMBER_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Grid>
            <NumField label="主标题" suffix="pt" value={s.titleFontsize} min={6} max={48} onChange={(v) => setSt({ titleFontsize: v }, "f1")} />
            <NumField label="副标题" suffix="pt" value={s.subtitleFontsize} min={6} max={48} onChange={(v) => setSt({ subtitleFontsize: v }, "f2")} />
            <NumField label="分组名称" suffix="pt" value={s.groupMainFontsize} min={6} max={36} onChange={(v) => setSt({ groupMainFontsize: v }, "f3")} />
            <NumField label="分组汇总" suffix="pt" value={s.groupSubFontsize} min={6} max={36} onChange={(v) => setSt({ groupSubFontsize: v }, "f4")} />
            <NumField label="项目名称" suffix="pt" value={s.factorFontsize} min={6} max={36} onChange={(v) => setSt({ factorFontsize: v }, "f5")} />
            <NumField label="柱旁数字" suffix="pt" value={s.barNumFontsize} min={6} max={36} onChange={(v) => setSt({ barNumFontsize: v }, "f6")} />
          </Grid>
          <SwitchField label="主标题加粗" checked={s.titleBold} onChange={(v) => setSt({ titleBold: v })} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="color">
        <AccordionTrigger className="cursor-pointer py-3 text-sm">颜色</AccordionTrigger>
        <AccordionContent className="space-y-2.5 pb-4">
          {color("增加数字", "colorRed")}
          {color("减少数字", "colorGreen")}
          {color("浮动柱", "colorGray")}
          {color("起始 / 节点柱", "colorTotal")}
          {color("分组框", "colorBox")}
          {color("文字", "colorText")}
          {color("柱边框", "colorBorder")}
          {color("桥接线", "colorBridge")}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="canvas">
        <AccordionTrigger className="cursor-pointer py-3 text-sm">画布与线条</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <Field label="画布比例" hint="控制导出图片形状，不改变业务数据；固定比例下不会因行数增多而无限拉长。">
            <Select value={s.canvasRatio || "16:9"} onValueChange={(v) => setSt({ canvasRatio: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 · 横版（推荐）</SelectItem>
                <SelectItem value="4:3">4:3 · 标准</SelectItem>
                <SelectItem value="1:1">1:1 · 方形</SelectItem>
                <SelectItem value="custom">自定义宽高</SelectItem>
                <SelectItem value="auto">按项目自动扩宽</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(s.canvasRatio || "16:9") === "custom" && <NumField label="画布宽度" suffix="英寸" min={4} max={60} value={s.figureWidth || 16} onChange={(v) => setSt({ figureWidth: v }, "cw")} />}
          <p className="text-xs text-muted-foreground">固定比例下，调整画布高度会等比改变宽度。柱宽和间隔影响内容密度，不再强制拉伸填满画布。</p>
          <Grid>
            <NumField label="全局柱间隔" value={s.barGap ?? 0.4} min={0} max={5} onChange={(v) => setSt({ barGap: v }, "bg")} />
            <NumField label="分组框线宽" suffix="pt" value={s.boxLineWidth} min={0.1} max={5} onChange={(v) => setSt({ boxLineWidth: v }, "boxlw")} />
            <NumField label="分组层间距" suffix="pt" value={s.groupLevelGapPt} min={2} max={30} onChange={(v) => setSt({ groupLevelGapPt: v }, "levelgap")} />
            <NumField label="柱宽（全图联动）" value={s.barWidth} min={0.1} max={5} onChange={(v) => commit((d) => setLinkedBarWidth(d, v), "bw")} />
            <NumField label="画布高度" suffix="英寸" value={s.figureHeight} min={4} max={30} onChange={(v) => setSt({ figureHeight: v }, "fh")} />
            <NumField label="自动模式最小宽度" disabled={(s.canvasRatio || "16:9") !== "auto"} suffix="英寸" value={s.figureMinWidth} min={4} max={60} onChange={(v) => setSt({ figureMinWidth: v }, "fmw")} />
            <NumField label="自动模式每柱宽度" disabled={(s.canvasRatio || "16:9") !== "auto"} suffix="英寸" value={s.widthPerBar} min={0.3} max={3} onChange={(v) => setSt({ widthPerBar: v }, "wpb")} />
            <NumField label="名称每行字数" value={s.labelWrapChars} min={1} max={30} onChange={(v) => setSt({ labelWrapChars: Math.round(v) }, "lw")} />
            <NumField label="导出分辨率" suffix="DPI" value={s.outputDpi} min={72} max={600} onChange={(v) => setSt({ outputDpi: Math.round(v) }, "dpi")} />
            <NumField label="柱边框线宽" suffix="pt" value={s.barBorderWidth} min={0} max={5} onChange={(v) => setSt({ barBorderWidth: v }, "bbw")} />
            <NumField label="桥接线宽" suffix="pt" value={s.bridgeLineWidth} min={0.1} max={5} onChange={(v) => setSt({ bridgeLineWidth: v }, "brw")} />
            <NumField label="数字距柱端" suffix="pt" value={s.barNumOffsetPt} min={0} max={20} onChange={(v) => setSt({ barNumOffsetPt: v }, "bno")} />
            <NumField label="分组文字距框顶" suffix="pt" value={s.groupTitleInsetPt} min={0} max={20} onChange={(v) => setSt({ groupTitleInsetPt: v }, "gti")} />
          </Grid>
          <Button variant="outline" size="sm" className="h-8 w-full cursor-pointer" onClick={() => commit((d) => ({ ...d, ov: { ...d.ov, off: {} } }))}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />复位所有手动拖动的文字位置
          </Button>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}