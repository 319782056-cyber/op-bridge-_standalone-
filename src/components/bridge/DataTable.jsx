import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BAR_TYPES } from '@/lib/bridge/constants';
import { deleteRow, duplicateRow, insertRow, moveRow, patchRow, reorderRow, setGroup, setLinkedBarWidth } from '@/lib/bridge/actions';
import { cn } from '@/lib/utils';

export default function DataTable({ doc, commit, selectedRowId, onSelectRow, errors, seeThrough = false }) {
  const errMap = new Map();
  (errors || []).forEach((e) => {
    if (e.rowId && !errMap.has(e.rowId)) errMap.set(e.rowId, e.msg);
  });
  const rowRefs = useRef({});
  const [draggedId, setDraggedId] = useState(null);
  const [dropBoundary, setDropBoundary] = useState(null);
  const [rowMenuId, setRowMenuId] = useState(null);
  const scrollRef = useRef(null);
  const locked = doc.rows[0]?.kind === '起始量';
  const selectedIndex = doc.rows.findIndex((r) => r.id === selectedRowId);
  const finishDrag = () => {
    setDraggedId(null);
    setDropBoundary(null);
  };
  useEffect(() => {
    if (selectedRowId && rowRefs.current[selectedRowId]) {
      rowRefs.current[selectedRowId].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedRowId]);
  const add = (index) => {
    let created;
    commit((d) => {
      const r = insertRow(d, index);
      created = r.id;
      return r.doc;
    });
    if (created) {
      onSelectRow(created);
      requestAnimationFrame(() => {
        rowRefs.current[created]?.querySelector('input[data-cell$=":name"]')?.focus();
      });
    }
  };
  const onKeyDown = (e, id, idx, col) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = doc.rows[idx + (e.shiftKey ? -1 : 1)];
      if (next) document.querySelector(`[data-cell="${next.id}:${col}"]`)?.focus();
    }
  };
  const cell = cn('h-8 rounded-sm border-transparent px-1.5 text-sm text-foreground shadow-none transition-colors hover:border-input hover:bg-white focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/30 disabled:opacity-70', seeThrough ? 'bg-white/80' : 'bg-transparent');
  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div ref={scrollRef} className='min-h-0 flex-1 overflow-auto'>
        <table className='w-full min-w-[820px] border-collapse text-sm'>
          <thead className='sticky top-0 z-10 border-b border-border bg-slate-50 text-xs text-slate-600'>
            <tr>
              <th className='sticky left-0 z-20 w-[88px] bg-slate-50 px-1 py-2 text-center font-medium'>排序 / 插入</th>
              <th
                className='px-1 py-2 text-left font-medium'
                style={{
                  width: '137px',
                  flex: '0 0 auto',
                  alignSelf: 'auto',
                }}
              >
                项目名称
              </th>
              <th className='w-[92px] px-1 py-2 text-left font-medium'>类型</th>
              <th className='w-[84px] px-1 py-2 text-left font-medium'>数值</th>
              <th className='w-[88px] px-1 py-2 text-left font-medium'>一级分组</th>
              <th className='w-[88px] px-1 py-2 text-left font-medium'>二级分组</th>
              <th className='w-[88px] px-1 py-2 text-left font-medium'>三级分组</th>
              <th className='w-[80px] px-1 py-2 text-left font-medium'>柱宽</th>
              <th className='w-[80px] px-1 py-2 text-left font-medium'>后间隔</th>
              <th className='w-[84px] px-1 py-2' />
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((row, idx) => {
              const sel = selectedRowId === row.id;
              const err = errMap.get(row.id);
              const grouped = row.kind === '增减项';
              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    rowRefs.current[row.id] = el;
                  }}
                  onClick={() => onSelectRow(row.id)}
                  onDragOver={(e) => {
                    if (!draggedId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = e.currentTarget.getBoundingClientRect();
                    const boundary = idx + (e.clientY > rect.top + rect.height / 2 ? 1 : 0);
                    setDropBoundary(Math.max(locked ? 1 : 0, boundary));
                    const scroll = scrollRef.current;
                    if (scroll) {
                      const bounds = scroll.getBoundingClientRect();
                      if (e.clientY < bounds.top + 45) scroll.scrollTop -= 12;
                      if (e.clientY > bounds.bottom - 45) scroll.scrollTop += 12;
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = draggedId || e.dataTransfer.getData('text/op-row');
                    if (id) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const boundary = idx + (e.clientY > rect.top + rect.height / 2 ? 1 : 0);
                      commit((d) => reorderRow(d, id, boundary));
                      onSelectRow(id);
                    }
                    finishDrag();
                  }}
                  style={
                    draggedId && dropBoundary === idx
                      ? {
                          boxShadow: 'inset 0 2px 0 #2468A8',
                        }
                      : draggedId && dropBoundary === idx + 1
                        ? {
                            boxShadow: 'inset 0 -2px 0 #2468A8',
                          }
                        : undefined
                  }
                  className={cn('group border-b border-border/60 transition-colors', sel ? 'bg-sky-100/95' : seeThrough ? 'hover:bg-white/30' : 'bg-white/60 hover:bg-slate-50/95', draggedId === row.id && 'opacity-40', (row.kind === '起始量' || row.kind === '节点') && !sel && 'bg-sky-50/20')}
                >
                  <td className={cn('sticky left-0 z-10 px-1 text-center text-xs tabular-nums', sel ? 'bg-sky-100' : 'bg-white/95')}>
                    <div className='flex items-center gap-0.5'>
                      <Popover open={rowMenuId === row.id} onOpenChange={(open) => setRowMenuId(open ? row.id : null)}>
                        <PopoverTrigger asChild>
                          <button
                            type='button'
                            draggable={!(locked && idx === 0)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectRow(row.id);
                            }}
                            aria-label={`第 ${idx + 1} 行操作，点击菜单或拖动排序`}
                            title='点击显示行操作，拖动调整顺序'
                            className='flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                            onDragStart={(e) => {
                              setRowMenuId(null);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/op-row', row.id);
                              setDraggedId(row.id);
                              onSelectRow(row.id);
                            }}
                            onDragEnd={finishDrag}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                commit((d) => moveRow(d, row.id, e.key === 'ArrowUp' ? -1 : 1));
                              }
                            }}
                          >
                            <GripVertical className='h-4 w-4' />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align='start' className='w-44 p-1' onClick={(e) => e.stopPropagation()} onCloseAutoFocus={(e) => e.preventDefault()}>
                          <p className='px-2 py-1.5 text-xs text-muted-foreground'>第 {idx + 1} 行 · 行操作</p>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='w-full justify-start'
                            disabled={locked && idx === 0}
                            title={locked && idx === 0 ? '起始量必须位于首行' : undefined}
                            onClick={() => {
                              setRowMenuId(null);
                              add(idx);
                            }}
                          >
                            <ArrowUp className='mr-2 h-4 w-4' />
                            上方插入行
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='w-full justify-start'
                            onClick={() => {
                              setRowMenuId(null);
                              add(idx + 1);
                            }}
                          >
                            <ArrowDown className='mr-2 h-4 w-4' />
                            下方插入行
                          </Button>
                          <div className='my-1 border-t border-border' />
                          <Button
                            variant='ghost'
                            size='sm'
                            className='w-full justify-start text-destructive hover:text-destructive'
                            onClick={() => {
                              setRowMenuId(null);
                              commit((d) => deleteRow(d, row.id));
                              onSelectRow(doc.rows[idx + 1]?.id || doc.rows[idx - 1]?.id || null);
                            }}
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            删除行
                          </Button>
                          {locked && idx === 0 && <p className='px-2 py-1 text-[11px] text-muted-foreground'>起始量固定首行，不能向上插入</p>}
                        </PopoverContent>
                      </Popover>
                      <span className='w-4 text-muted-foreground'>{idx + 1}</span>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-7 shrink-0'
                        title='在此行下方插入'
                        aria-label={`在第 ${idx + 1} 行下方插入`}
                        onClick={(e) => {
                          e.stopPropagation();
                          add(idx + 1);
                        }}
                      >
                        <Plus className='h-4 w-4' />
                      </Button>
                    </div>
                  </td>
                  <td className='px-0.5 py-0.5'>
                    <Input
                      data-cell={`${row.id}:name`}
                      value={row.name}
                      onChange={(e) =>
                        commit(
                          (d) =>
                            patchRow(d, row.id, {
                              name: e.target.value,
                            }),
                          `name:${row.id}`,
                        )
                      }
                      onKeyDown={(e) => onKeyDown(e, row.id, idx, 'name')}
                      onFocus={() => onSelectRow(row.id)}
                      className={cn(cell, err && 'border-destructive')}
                      title={err}
                    />
                  </td>
                  <td className='px-0.5 py-0.5'>
                    <Select
                      value={row.kind}
                      onValueChange={(v) =>
                        commit((d) =>
                          patchRow(d, row.id, {
                            kind: v,
                            value: v === '节点' ? '' : row.value,
                            g: v === '增减项' ? row.g : ['', '', ''],
                          }),
                        )
                      }
                    >
                      <SelectTrigger className={cn(cell, 'w-full cursor-pointer')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BAR_TYPES.map((t, __dnd_i) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className='px-0.5 py-0.5'>
                    <Input
                      data-cell={`${row.id}:value`}
                      value={row.kind === '节点' ? '' : row.value}
                      disabled={row.kind === '节点'}
                      placeholder={row.kind === '节点' ? '自动' : '0'}
                      inputMode='decimal'
                      onChange={(e) =>
                        commit(
                          (d) =>
                            patchRow(d, row.id, {
                              value: e.target.value,
                            }),
                          `val:${row.id}`,
                        )
                      }
                      onKeyDown={(e) => onKeyDown(e, row.id, idx, 'value')}
                      onFocus={() => onSelectRow(row.id)}
                      className={cn(cell, 'tabular-nums', err && 'border-destructive')}
                    />
                  </td>
                  {[0, 1, 2].map((lv, __dnd_i) => (
                    <td key={lv} className='px-0.5 py-0.5'>
                      <Input
                        data-cell={`${row.id}:g${lv}`}
                        value={grouped ? row.g[lv] : ''}
                        disabled={!grouped}
                        onChange={(e) => commit((d) => setGroup(d, row.id, lv, e.target.value), `g${lv}:${row.id}`)}
                        onKeyDown={(e) => onKeyDown(e, row.id, idx, `g${lv}`)}
                        onFocus={() => onSelectRow(row.id)}
                        className={cell}
                      />
                    </td>
                  ))}
                  {['width', 'gap'].map((field, __dnd_i) => (
                    <td key={field} className='px-0.5'>
                      <Input
                        type='number'
                        step='0.01'
                        min={field === 'width' ? 0.1 : 0}
                        max={5}
                        value={row[field] ?? (field === 'width' ? doc.style.barWidth : (doc.style.barGap ?? 0.4))}
                        disabled={field === 'gap' && idx === doc.rows.length - 1}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const v = raw === '' ? null : Math.max(field === 'width' ? 0.1 : 0, Math.min(5, Number(raw)));
                          commit(
                            (d) =>
                              field === 'width'
                                ? setLinkedBarWidth(d, v ?? d.style.barWidth)
                                : patchRow(d, row.id, {
                                    gap: v,
                                  }),
                            `${field}:${row.id}`,
                          );
                        }}
                        className={cn(cell, 'tabular-nums')}
                      />
                    </td>
                  ))}
                  <td className='px-0.5'>
                    <div className='flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6 cursor-pointer'
                        disabled={idx === 0 || (locked && idx === 1)}
                        title='上移'
                        onClick={(e) => {
                          e.stopPropagation();
                          commit((d) => moveRow(d, row.id, -1));
                        }}
                      >
                        <ArrowUp className='h-3.5 w-3.5' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6 cursor-pointer'
                        disabled={idx === doc.rows.length - 1 || (locked && idx === 0)}
                        title='下移'
                        onClick={(e) => {
                          e.stopPropagation();
                          commit((d) => moveRow(d, row.id, 1));
                        }}
                      >
                        <ArrowDown className='h-3.5 w-3.5' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6 cursor-pointer'
                        title='复制此行'
                        onClick={(e) => {
                          e.stopPropagation();
                          let nid;
                          commit((d) => {
                            const r = duplicateRow(d, row.id);
                            nid = r.id;
                            return r.doc;
                          });
                          if (nid) onSelectRow(nid);
                        }}
                      >
                        <Copy className='h-3.5 w-3.5' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6 cursor-pointer text-destructive hover:text-destructive'
                        title='删除此行'
                        onClick={(e) => {
                          e.stopPropagation();
                          commit((d) => deleteRow(d, row.id));
                        }}
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {doc.rows.length === 0 && (
              <tr>
                <td colSpan={10} className='py-10 text-center text-sm text-muted-foreground'>
                  暂无数据，点击下方“添加一行”开始
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className='space-y-1.5 border-t border-border px-3 py-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button variant='outline' size='sm' className='h-8 cursor-pointer' disabled={selectedIndex < 0} onClick={() => add(selectedIndex + 1)}>
            <Plus className='mr-1 h-4 w-4' />
            在选中行下插入
          </Button>
          <Button variant='ghost' size='sm' className='h-8 cursor-pointer' onClick={() => add(doc.rows.length)}>
            末尾添加
          </Button>
        </div>
        <p className='text-xs text-muted-foreground'>共 {doc.rows.length} 行 · 点击行首手柄操作，拖动排序，蓝线提示落点</p>
      </div>
    </div>
  );
}