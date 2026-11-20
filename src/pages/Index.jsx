import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronDown, ClipboardCopy, Download, Grip, FileSpreadsheet, FilePlus2, Image as ImageIcon, Loader2, Maximize2, MousePointerClick, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Redo2, RotateCcw, SlidersHorizontal, Table2, Undo2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBridgeDoc } from '@/hooks/useBridgeDoc';
import { computeScene } from '@/lib/bridge/layout';
import { applyEdit, clearOffset, editInit, isOffsetable, parseId, resetAllParameters, setOffset } from '@/lib/bridge/actions';
import { createBlankDoc, createInitialDoc } from '@/lib/bridge/constants';
import { downloadTemplateWorkbook, downloadWorkbook } from '@/lib/bridge/excel';
import { copyPng, exportPng, exportSvg, safeFilename } from '@/lib/bridge/export';
import ChartCanvas from '@/components/bridge/ChartCanvas';
import DataTable from '@/components/bridge/DataTable';
import { GlobalPanel, SelectionPanel } from '@/components/bridge/Inspector';
import ImportDialog from '@/components/bridge/ImportDialog';
import ShareDialog from '@/components/bridge/ShareDialog';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const TYPE_NAME = {
  title: '主标题',
  subtitle: '副标题',
  bar: '柱子',
  num: '柱旁数字',
  label: '项目名称',
  head: '分组',
};

const Index = () => {
  const { doc, commit, undo, redo, canUndo, canRedo } = useBridgeDoc();
  const [selected, setSelected] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [shareMode, setShareMode] = useState(null);
const [mobileView, setMobileView] = useState('chart');
const [showData, setShowData] = useState(false);
  const [dataSeeThrough, setDataSeeThrough] = useState(false);
const [showProps, setShowProps] = useState(false);
  const [dataPanelSize, setDataPanelSize] = useState({ width: 460, height: null });
  const [resizingData, setResizingData] = useState(false);
  const workspaceRef = useRef(null);
  const dataPanelRef = useRef(null);
  const resizeCleanupRef = useRef(null);
  useEffect(() => () => resizeCleanupRef.current?.(), []);
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setDataPanelSize((size) => ({
        width: Math.min(size.width, el.clientWidth),
        height: size.height == null ? null : Math.min(size.height, el.clientHeight),
      }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const beginPanelResize = (event, direction) => {
    if (event.button !== 0 || !workspaceRef.current || !dataPanelRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();
    const initial = dataPanelRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    setResizingData(true);
    const move = (e) => {
      const bounds = workspaceRef.current;
      if (!bounds) return;
      setDataPanelSize({
        width: Math.min(bounds.clientWidth, Math.max(Math.min(320, bounds.clientWidth), initial.width + (direction.includes('x') ? e.clientX - startX : 0))),
        height: Math.min(bounds.clientHeight, Math.max(Math.min(240, bounds.clientHeight), initial.height + (direction.includes('y') ? e.clientY - startY : 0))),
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      resizeCleanupRef.current = null;
      setResizingData(false);
    };
    resizeCleanupRef.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };
const [zoom, setZoom] = useState('fit'); // "fit" | number
  const [box, setBox] = useState({
    w: 800,
    h: 600,
  });
  const [fontsTick, setFontsTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const svgRef = useRef(null);
  const stageRef = useRef(null); // 字体加载完成后重新测量文字
  const [spacePan, setSpacePan] = useState(false);
  const panRef = useRef(null);
  useEffect(() => {
    const isTypingTarget = (target) => {
      const tag = (target?.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || target?.isContentEditable;
    };
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setSpacePan(true);
      }
    };
    const onKeyUp = (event) => {
      if (event.code === 'Space') {
        setSpacePan(false);
        panRef.current = null;
      }
    };
    const onBlur = () => {
      setSpacePan(false);
      panRef.current = null;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
  useEffect(() => {
    if (document.fonts?.ready) document.fonts.ready.then(() => setFontsTick((n) => n + 1));
  }, []);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() =>
      setBox({
        w: el.clientWidth,
        h: el.clientHeight,
      }),
    );
    ro.observe(el);
    setBox({
      w: el.clientWidth,
      h: el.clientHeight,
    });
    return () => ro.disconnect();
  }, []);
  const scene = useMemo(
    () => computeScene(doc), // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, fontsTick],
  ); // 输入暂时无效时仍保留选中元素的属性面板，避免输入框失焦。
  const lastValidScene = useRef(null);
  if (scene.ok) lastValidScene.current = scene;
  const inspectorScene = scene.ok ? scene : lastValidScene.current; // 选中的元素被删除后自动取消选中
  useEffect(() => {
    if (!selected || !scene.ok) return;
    const { type, key } = parseId(selected);
    const exists = type === 'title' || type === 'subtitle' || (['bar', 'num', 'label'].includes(type) && scene.bars.some((b) => b.id === key)) || (type === 'head' && scene.boxEls.some((b) => b.id === selected));
    if (!exists) setSelected(null);
  }, [scene, selected]);
  const fitScale = scene.ok ? Math.min(1, Math.max(0.01, (box.w - 32) / scene.W), Math.max(0.01, (box.h - 32) / scene.H)) : 1;
  const scale = zoom === 'fit' ? fitScale : zoom;
  const zoomBy = (f) => setZoom(Math.min(2.5, Math.max(0.2, +(scale * f).toFixed(2))));
  const selectedRowId = useMemo(() => {
    if (!selected) return null;
    const { type, key } = parseId(selected);
    return ['bar', 'num', 'label'].includes(type) ? key : null;
  }, [selected]);
  // 表格选中仅同步预览选区，不自动收起数据面板。
const selectFromTable = useCallback((id) => { setSelected(id ? `bar:${id}` : null); }, []);
  // 点击画布元素时自动弹出属性抽屉
  const handleSelect = useCallback((id) => {
    setSelected(id);
    if (id) setShowProps(true);
  }, []);

  const onEditCommit = (id, text) => {
    const r = applyEdit(doc, scene, id, text);
    if (r.error) toast.error(r.error);
    else commit(() => r.doc);
  }; // ---- 快捷键 ----
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        (e.shiftKey ? redo : undo)();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      if (e.key === 'Escape') setSelected(null);
      if (selected && isOffsetable(selected) && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        commit((d) => {
          const cur = d.ov.off[selected] || [0, 0];
          return setOffset(d, selected, [cur[0] + dx, cur[1] + dy]);
        }, `nudge:${selected}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, selected, commit]); // ---- 导出 ----
  const baseName = safeFilename(doc.config.title.split('\n')[0]);
  const withSvg = async (fn) => {
    if (!scene.ok || !svgRef.current) {
      toast.error('数据有误，暂时无法导出，请先修正左侧标红的行');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await fn(svgRef.current);
    } catch (e) {
      toast.error(e.message || '导出失败');
    } finally {
      setBusy(false);
    }
  };
  const doPng = () =>
    withSvg(async (svg) => {
      await exportPng(svg, `${baseName}.png`, doc.style.outputDpi);
      toast.success(`已导出 PNG（${doc.style.outputDpi} DPI）`);
    });
  const doSvg = () =>
    withSvg(async (svg) => {
      exportSvg(svg, `${baseName}.svg`);
      toast.success('已导出 SVG 矢量图');
    });
  const doCopy = () =>
    withSvg(async (svg) => {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('当前浏览器不支持复制图片，请使用下载');
      await copyPng(svg, doc.style.outputDpi);
      toast.success('图片已复制到剪贴板');
    });
  const doExcel = () => {
    try {
      downloadWorkbook(doc, `${baseName}-数据.xlsx`);
      toast.success('已导出 Excel 数据与全局参数（包含柱宽、间隔、框与文字独立参数）');
    } catch (e) {
      toast.error(e.message || 'Excel 导出失败');
    }
  };
  const doTemplate = () => {
    try {
      downloadTemplateWorkbook();
      toast.success('Excel 模板已下载，填写后可重新导入生成桥图');
    } catch (e) {
      toast.error(e.message || '模板下载失败');
    }
  };
  const errors = scene.ok ? [] : scene.errors;
  const selType = selected ? parseId(selected).type : null;
  const hasOffsets = Object.keys(doc.ov.off).length > 0;
  const mobileTab = (id, Icon, label) => (
    <button type='button' onClick={() => setMobileView(id)} className={cn('flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-2.5 text-sm transition-colors', mobileView === id ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground')}>
      <Icon className='h-4 w-4' />
      {label}
    </button>
  );
  return (
    <div className='flex h-[100dvh] min-h-0 flex-col bg-background text-foreground'>
      {/* 顶部栏 */}
      <header className='flex h-14 shrink-0 items-center gap-2 border-b border-border bg-white px-4'>
        <div className='flex items-center gap-2'>
          <BarChart3 className='h-5 w-5 text-primary' />
          <span className='hidden text-base font-semibold sm:inline'>OP 桥图</span>
          <span className='hidden text-sm text-muted-foreground sm:inline'>本地独立版</span>
        </div>
        <div className='mx-2 hidden h-5 w-px bg-border sm:block' />
        <div className='flex items-center gap-0.5'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8 cursor-pointer' disabled={!canUndo} onClick={undo}>
                <Undo2 className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>撤销 Ctrl+Z</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8 cursor-pointer' disabled={!canRedo} onClick={redo}>
                <Redo2 className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重做 Ctrl+Shift+Z</TooltipContent>
          </Tooltip>
        </div>

        <div className='flex shrink-0 items-center gap-1'>
          <Button variant={showData || mobileView === 'data' ? 'secondary' : 'outline'} size='sm' className='h-8 cursor-pointer gap-1' aria-expanded={showData || mobileView === 'data'} onClick={() => {
            const open = !(showData || mobileView === 'data');
            setShowData(open);
            setShowProps(false);
            setMobileView('chart');
          }}><Table2 className='h-4 w-4' />数据</Button>
          <Button variant={showProps || mobileView === 'props' ? 'secondary' : 'outline'} size='sm' className='h-8 cursor-pointer gap-1' aria-expanded={showProps || mobileView === 'props'} onClick={() => {
            const open = !(showProps || mobileView === 'props');
            setShowProps(open);
            setShowData(false);
            setMobileView('chart');
          }}><SlidersHorizontal className='h-4 w-4' />属性</Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-8 cursor-pointer gap-1'>
              <FilePlus2 className='h-4 w-4' />
              <span className='hidden sm:inline'>文件</span>
              <ChevronDown className='h-3.5 w-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-52'>
            <DropdownMenuItem onClick={() => setShareMode('import')}><ClipboardCopy className='mr-2 h-4 w-4' />从本地备份文件恢复</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareMode('export')}><ClipboardCopy className='mr-2 h-4 w-4' />备份当前看板</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className='cursor-pointer' onClick={() => setImportOpen(true)}>
              <Upload className='mr-2 h-4 w-4' />
              导入 Excel / 粘贴数据
            </DropdownMenuItem>
            <DropdownMenuItem className='cursor-pointer' onClick={doTemplate}>
              <FileSpreadsheet className='mr-2 h-4 w-4' />
              下载 Excel 输入模板
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='cursor-pointer'
              onClick={() => {
                commit(createBlankDoc());
                setSelected(null);
                toast.success('已新建空白图表');
              }}
            >
              新建空白图表
            </DropdownMenuItem>
            <DropdownMenuItem
              className='cursor-pointer'
              onClick={() => {
                commit(createInitialDoc());
                setSelected(null);
                toast.success('已载入示例数据');
              }}
            >
              载入示例数据
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className='ml-auto flex items-center gap-2'>
          <Button variant='outline' size='sm' className='hidden h-8 cursor-pointer sm:inline-flex' disabled={busy} onClick={() => setResetOpen(true)}>
            <RotateCcw className='mr-1.5 h-4 w-4' />
            一键还原
          </Button>
          <Button size='sm' className='h-8 cursor-pointer' disabled={busy || !scene.ok} onClick={doPng}>
            {busy ? <Loader2 className='mr-1.5 h-4 w-4 animate-spin motion-reduce:animate-none' /> : <Download className='mr-1.5 h-4 w-4' />}
            {busy ? '导出中' : '导出图片'}
          </Button>
          <Button variant='outline' size='sm' className='hidden h-8 cursor-pointer sm:inline-flex' onClick={() => setImportOpen(true)}>
            <Upload className='mr-1.5 h-4 w-4' />
            导入数据
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm' className='h-8 cursor-pointer gap-1.5' disabled={busy}>
                更多
                <ChevronDown className='h-3.5 w-3.5' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-60'>
              <DropdownMenuItem className='cursor-pointer' onClick={() => setResetOpen(true)}>
                <RotateCcw className='mr-2 h-4 w-4' />
                一键还原全部参数
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>图片</DropdownMenuLabel>
              <DropdownMenuItem className='cursor-pointer' onClick={doPng}>
                <ImageIcon className='mr-2 h-4 w-4' />
                下载 PNG（{doc.style.outputDpi} DPI）
              </DropdownMenuItem>
              <DropdownMenuItem className='cursor-pointer' onClick={doSvg}>
                <ImageIcon className='mr-2 h-4 w-4' />
                下载 SVG 矢量图
              </DropdownMenuItem>
              <DropdownMenuItem className='cursor-pointer' onClick={doCopy}>
                <ClipboardCopy className='mr-2 h-4 w-4' />
                复制图片到剪贴板
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>数据</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShareMode('export')}><ClipboardCopy className='mr-2 h-4 w-4' />保存完整看板备份文件</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareMode('import')}><Upload className='mr-2 h-4 w-4' />从备份文件恢复看板</DropdownMenuItem>
              <DropdownMenuItem className='cursor-pointer' onClick={doTemplate}>
                <FileSpreadsheet className='mr-2 h-4 w-4' />
                下载 Excel 输入模板
              </DropdownMenuItem>
              <DropdownMenuItem className='cursor-pointer' onClick={doExcel}>
                <FileSpreadsheet className='mr-2 h-4 w-4' />
                导出当前数据 Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 移动端分栏切换 */}
      <div className='flex shrink-0 border-b border-border bg-white xl:hidden'>
        {mobileTab('data', Table2, '数据')}
        {mobileTab('chart', BarChart3, '预览')}
        {mobileTab('props', SlidersHorizontal, '属性')}
      </div>

      <main ref={workspaceRef} className='relative flex min-h-0 flex-1 gap-3 overflow-hidden p-0 xl:p-3'
  onPointerDownCapture={(event) => {
    if (!(showData || mobileView === 'data') || resizingData || dataPanelRef.current?.contains(event.target)) return;
    // Radix 菜单通过 portal 挂载在面板外，但仍属于数据编辑操作。
    if (event.target instanceof Element && event.target.closest('[data-radix-popper-content-wrapper], [role="dialog"], [role="listbox"], [role="menu"]')) return;
    // 先提交尚未失焦的表格输入，再收起面板；内部点击及弹出的行菜单不受影响。
    const active = document.activeElement;
    if (active instanceof HTMLElement && dataPanelRef.current?.contains(active)) active.blur();
    setShowData(false);
    if (mobileView === 'data') setMobileView('chart');
  }}
>
        {/* 数据表：半隐藏侧滑抽屉，不影响预览占满 */}
        <section
          ref={dataPanelRef}
          style={{ width: dataPanelSize.width, height: dataPanelSize.height ?? '100%', maxWidth: '100%', maxHeight: '100%' }}
          className={cn(
            'absolute left-0 top-0 z-20 flex min-h-0 flex-col rounded-r-xl border border-border/50 shadow-lg transition-transform duration-200 motion-reduce:transition-none',
            resizingData && 'select-none',
            dataSeeThrough ? 'bg-white/25' : 'bg-white/85',
            (showData || mobileView === 'data') ? 'translate-x-0' : '-translate-x-full pointer-events-none',
          )}
        >
          <div className='flex shrink-0 items-center justify-between border-b border-border bg-white/95 px-4 pb-2 pt-3'>
            <div>
              <h2 className='text-sm font-semibold'>数据</h2>
              <p className='py-1 text-[11px] text-muted-foreground'>拖动右边、底边或右下角调整大小 · 数据本机处理</p>
            </div>
            {errors.length > 0 && (
              <span className='flex items-center gap-1 text-xs text-destructive'>
                <AlertTriangle className='h-3.5 w-3.5' />
                {errors.length} 处待修正
              </span>
            )}
            <Button variant='ghost' size='icon' className='h-7 w-7 shrink-0 cursor-pointer' title='收起数据面板' onClick={() => { setShowData(false); setMobileView('chart'); }}>
              <PanelLeftClose className='h-4 w-4' />
            </Button>
          </div>
          <div className='flex shrink-0 items-center justify-between gap-2 bg-white/95 px-3 py-2'>
            <div className='flex rounded-md bg-muted p-0.5' role='group' aria-label='数据面板显示模式'>
              <Button variant={!dataSeeThrough ? 'secondary' : 'ghost'} size='sm' className='h-7 text-xs' aria-pressed={!dataSeeThrough} onClick={() => setDataSeeThrough(false)}>编辑数据</Button>
              <Button variant={dataSeeThrough ? 'secondary' : 'ghost'} size='sm' className='h-7 text-xs' aria-pressed={dataSeeThrough} onClick={() => setDataSeeThrough(true)}>透视图表</Button>
            </div>
            <span className='text-[11px] text-muted-foreground'>{dataSeeThrough ? '背景透出 · 输入框保持清晰' : '阅读优先 · 可随时透视'}</span>
          </div>
          <DataTable doc={doc} commit={commit} selectedRowId={selectedRowId} onSelectRow={selectFromTable} errors={errors} seeThrough={dataSeeThrough} />
          <div className='flex shrink-0 items-center justify-between bg-white/95 px-3 py-2 text-[11px] text-muted-foreground'>
            <span>{Math.round(dataPanelSize.width)} × {dataPanelSize.height == null ? '自适应' : Math.round(dataPanelSize.height)} px</span>
            <button type='button' className='cursor-pointer hover:text-foreground' onClick={() => setDataPanelSize({ width: Math.min(460, workspaceRef.current?.clientWidth || 460), height: null })}>恢复大小</button>
          </div>
          <div role='separator' aria-label='调整数据面板宽度' aria-orientation='vertical' tabIndex={0}
            className='absolute bottom-5 right-0 top-0 z-30 w-3 cursor-ew-resize touch-none hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            onPointerDown={(e) => beginPanelResize(e, 'x')} onKeyDown={(e) => {
              if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                setDataPanelSize((size) => ({ ...size, width: Math.min(workspaceRef.current?.clientWidth || size.width, Math.max(320, size.width + (e.key === 'ArrowRight' ? 20 : -20))) }));
              }
            }} />
          <div role='separator' aria-label='调整数据面板高度' aria-orientation='horizontal' tabIndex={0}
            className='absolute bottom-0 left-0 right-5 z-30 h-3 cursor-ns-resize touch-none hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            onPointerDown={(e) => beginPanelResize(e, 'y')} onKeyDown={(e) => {
              if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                setDataPanelSize((size) => ({ ...size, height: Math.min(workspaceRef.current?.clientHeight || 600, Math.max(240, (size.height ?? dataPanelRef.current?.clientHeight ?? 600) + (e.key === 'ArrowDown' ? 20 : -20))) }));
              }
            }} />
          <button type='button' aria-label='拖动调整数据面板宽高' title='拖动调整宽高，双击恢复大小'
            className='absolute bottom-0 right-0 z-40 flex h-6 w-6 cursor-nwse-resize touch-none items-center justify-center rounded-br-xl bg-primary/10 text-primary hover:bg-primary/20'
            onPointerDown={(e) => beginPanelResize(e, 'xy')}
            onDoubleClick={() => setDataPanelSize({ width: Math.min(460, workspaceRef.current?.clientWidth || 460), height: null })}>
            <Grip className='h-4 w-4' />
          </button>
        </section>

        {/* 预览 */}
        <section className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <div className='flex shrink-0 items-center gap-2 bg-white px-3 py-2 xl:rounded-t-xl'>
            <MousePointerClick className='hidden h-4 w-4 shrink-0 text-muted-foreground md:block' />
            <p className='min-w-0 flex-1 truncate text-xs text-muted-foreground'>单击选中 · 双击编辑 · 空格+拖动画布 · Ctrl/⌘+滚轮缩放 · 圆点调高度比例（不改数值）</p>
            {selected && (
              <Button variant='outline' size='sm' className='h-7 shrink-0 cursor-pointer text-xs xl:hidden' onClick={() => setMobileView('props')}>
                编辑属性
              </Button>
            )}
            {hasOffsets && (
              <Button variant='ghost' size='sm' className='h-7 cursor-pointer text-xs' onClick={() => commit((d) => clearOffset(d, Object.keys(d.ov.off)))}>
                复位位置
              </Button>
            )}
            <div className='flex items-center gap-0.5'>
              <Button variant='ghost' size='icon' className='h-7 w-7 cursor-pointer' onClick={() => zoomBy(1 / 1.2)} title='缩小'>
                <ZoomOut className='h-4 w-4' />
              </Button>
              <button type='button' onClick={() => setZoom(1)} className='w-12 cursor-pointer text-center text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground' title='恢复 100%'>
                {Math.round(scale * 100)}%
              </button>
              <Button variant='ghost' size='icon' className='h-7 w-7 cursor-pointer' onClick={() => zoomBy(1.2)} title='放大'>
                <ZoomIn className='h-4 w-4' />
              </Button>
              <Button variant={zoom === 'fit' ? 'secondary' : 'ghost'} size='icon' className='h-7 w-7 cursor-pointer' onClick={() => setZoom('fit')} title='适应窗口'>
                <Maximize2 className='h-4 w-4' />
              </Button>
            </div>
          </div>
          <div
            ref={stageRef}
            className={cn('relative min-h-0 flex-1 overflow-auto bg-muted/70 p-4 xl:rounded-b-xl', spacePan ? (panRef.current ? 'cursor-grabbing' : 'cursor-grab') : '')}
            onWheel={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              const factor = Math.exp(-e.deltaY * 0.002);
              setZoom(Math.min(2.5, Math.max(0.2, +(scale * factor).toFixed(2))));
            }}
            onPointerDownCapture={(e) => {
              if (!spacePan || e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              panRef.current = {
                pointerId: e.pointerId,
                x: e.clientX,
                y: e.clientY,
                left: e.currentTarget.scrollLeft,
                top: e.currentTarget.scrollTop,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!panRef.current || panRef.current.pointerId !== e.pointerId) return;
              e.currentTarget.scrollLeft = panRef.current.left - (e.clientX - panRef.current.x);
              e.currentTarget.scrollTop = panRef.current.top - (e.clientY - panRef.current.y);
            }}
            onPointerUp={(e) => {
              if (panRef.current?.pointerId === e.pointerId) panRef.current = null;
            }}
            onPointerCancel={() => { panRef.current = null; }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            {scene.ok ? (
              <div
                className='mx-auto w-fit'
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) setSelected(null);
                }}
              >
                <ChartCanvas scene={scene} selected={selected} onSelect={handleSelect} commit={commit} scale={scale} svgRef={svgRef} editInit={(id) => editInit(doc, scene, id)} onEditCommit={onEditCommit} />
              </div>
            ) : (
              <div className='mx-auto mt-10 max-w-md rounded-xl bg-white p-6'>
                <div className='mb-3 flex items-center gap-2 text-sm font-medium'>
                  <AlertTriangle className='h-4 w-4 text-destructive' />
                  还不能生成图表
                </div>
                <ul className='space-y-1.5 text-sm text-muted-foreground'>
                  {scene.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      <button
                        type='button'
                        className='cursor-pointer text-left transition-colors hover:text-foreground'
                        onClick={() => {
                          if (e.rowId) {
                            setShowData(true);
                            setShowProps(false);
                            selectFromTable(e.rowId);
                          }
                        }}
                      >
                        {e.msg}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scene.ok && scene.warnings.length > 0 && (
              <div className='pointer-events-none sticky bottom-0 left-0 mt-3 flex justify-center'>
                <div className='pointer-events-auto max-w-xl rounded-lg bg-foreground/90 px-3 py-2 text-xs leading-relaxed text-background'>
                  {scene.warnings.map((w, i) => (
                    <div key={i} className='flex items-start gap-1.5'>
                      <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0' />
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 属性面板：半隐藏侧滑抽屉 */}
        <aside
          className={cn(
            'absolute bottom-0 right-0 top-0 z-20 flex w-full flex-col bg-white shadow-xl transition-transform duration-200 xl:w-[320px] 2xl:w-[360px] xl:rounded-l-xl',
            (showProps || mobileView === 'props') ? 'translate-x-0' : 'translate-x-full pointer-events-none',
          )}
        >
          <div className='flex h-12 shrink-0 items-center justify-between border-b border-border px-4'>
            <h2 className='text-sm font-semibold'>{selected && inspectorScene ? `属性 · ${TYPE_NAME[selType] || ''}` : '全局设置'}</h2>
            {selected && (
              <Button variant='ghost' size='sm' className='h-7 cursor-pointer gap-1 text-xs' onClick={() => setSelected(null)}>
                <X className='h-3.5 w-3.5' />
                返回全局
              </Button>
            )}
            <Button variant='ghost' size='icon' className='h-7 w-7 shrink-0 cursor-pointer' title='收起属性面板' onClick={() => { setShowProps(false); setMobileView('chart'); }}>
              <PanelRightClose className='h-4 w-4' />
            </Button>
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto'>{selected && inspectorScene ? <SelectionPanel doc={doc} scene={inspectorScene} selected={selected} commit={commit} onSelect={handleSelect} /> : <GlobalPanel doc={doc} commit={commit} scene={scene.ok ? scene : null} />}</div>
        </aside>
      </main>

      <ShareDialog open={shareMode !== null} mode={shareMode} doc={doc} onOpenChange={(open) => { if (!open) setShareMode(null); }}
        onImport={(imported) => {
          commit(imported);
          setSelected(null);
          setShowData(false);
          setShowProps(false);
          setMobileView('chart');
          setZoom('fit');
        }} />
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>还原全部参数？</AlertDialogTitle>
            <AlertDialogDescription>将标题、汇总文案、单位、小数位、纵轴、字体、颜色、画布、柱宽、柱间隔，以及所有框和文字的独立参数恢复为系统原始默认值。 表格中的项目名称、数值、类型、分组和行顺序不会改变。还原后可通过“撤销”恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                commit(resetAllParameters);
                setSelected(null);
                setZoom('fit');
                toast.success('全部参数已还原，表格数据已保留');
              }}
            >
              确认还原
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportDoc={(d) => {
          commit({
            config: d.config,
            style: d.style,
            rows: d.rows,
            ov: d.ov,
          });
          setSelected(null);
        }}
        onPasteRows={(rows, mode) =>
          commit((d) => ({
            ...d,
            rows: mode === 'replace' ? rows : [...d.rows, ...rows],
          }))
        }
      />
    </div>
  );
};
export default Index;