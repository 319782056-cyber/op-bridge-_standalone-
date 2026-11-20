import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { createShareCode, parseShareCode } from '@/lib/bridge/share';
import { computeScene } from '@/lib/bridge/layout';

const BACKUP_FORMAT = 'OP-BRIDGE-LOCAL-BACKUP';
const BACKUP_VERSION = 1;

export default function ShareDialog({ open, mode, doc, onOpenChange, onImport }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState(null);
  const textRef = useRef(null);
  const fileRef = useRef(null);
  const exporting = mode === 'export';

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCode('');
    setError('');
    setCandidate(null);
    if (exporting) {
      setBusy(true);
      createShareCode(doc)
        .then((value) => { if (active) setCode(value); })
        .catch((e) => { if (active) setError(e.message); })
        .finally(() => { if (active) setBusy(false); });
    } else {
      setBusy(false);
    }
    return () => { active = false; };
    // 仅在弹窗打开时生成当前文档快照。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const downloadBackup = () => {
    const backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      application: 'OP 桥图绘制看板',
      payload: code,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'OP桥图本地备份.opbridge.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('本地备份文件已生成，请妥善保存');
  };

  const inspectText = async (rawText) => {
    setBusy(true);
    setError('');
    setCandidate(null);
    try {
      let payload = rawText.trim();
      if (payload.startsWith('{')) {
        const backup = JSON.parse(payload);
        if (backup?.format !== BACKUP_FORMAT || backup?.version !== BACKUP_VERSION || typeof backup.payload !== 'string') {
          throw new Error('备份文件格式或版本不受支持');
        }
        payload = backup.payload;
      }
      const imported = await parseShareCode(payload);
      // 数据可能正处于未完成编辑状态；结构校验通过即可恢复，图表错误留给编辑器提示。
      computeScene(imported);
      setCode(payload);
      setCandidate(imported);
    } catch (e) {
      setError(e.message || '文件读取失败，请选择有效的 OP 桥图备份文件');
    } finally {
      setBusy(false);
    }
  };

  const readBackupFile = async (file) => {
    if (!file) return;
    try {
      const rawText = await file.text();
      await inspectText(rawText);
    } catch (e) {
      setError(e.message || '无法读取备份文件');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-xl'>
        <DialogHeader>
          <DialogTitle>{exporting ? '备份当前看板' : '从备份文件恢复看板'}</DialogTitle>
          <DialogDescription>
            {exporting
              ? '将当前看板的全部数据、分组、文案、样式、字体、画布及独立编辑参数保存为本地备份文件。'
              : '选择之前导出的 .opbridge.json 备份文件，也可以粘贴旧版 OPCDK 分享码恢复数据。'}
          </DialogDescription>
        </DialogHeader>
        {exporting ? (
          <>
            <Textarea rows={5} className='resize-none break-all font-mono text-xs' readOnly value={code}
              placeholder={busy ? '正在生成备份…' : '备份内容生成后，可保存为文件'} />
            <p className='text-xs text-muted-foreground'>备份文件只保存在你选择的本机位置，不会上传云端。文件内容未加密，请妥善保管。</p>
            {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => onOpenChange(false)}>关闭</Button>
              <Button disabled={busy || !code} onClick={downloadBackup}>
                {busy ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Download className='mr-2 h-4 w-4' />}
                保存备份文件
              </Button>
            </div>
          </>
        ) : (
          <>
            <input ref={fileRef} type='file' accept='.opbridge.json,.json,.txt,text/plain,application/json' className='hidden'
              onChange={(e) => readBackupFile(e.target.files?.[0])} />
            <div className='flex flex-wrap items-center gap-2'>
              <Button variant='outline' disabled={busy} onClick={() => fileRef.current?.click()}>
                <FileUp className='mr-2 h-4 w-4' />选择本地备份文件
              </Button>
              <span className='text-xs text-muted-foreground'>支持 .opbridge.json / .json / 旧版 .txt</span>
            </div>
            <Textarea ref={textRef} rows={6} className='resize-none break-all font-mono text-xs' value={code}
              placeholder='也可以粘贴完整的 OPCDK 开头旧版备份码'
              onChange={(e) => { setCode(e.target.value); setCandidate(null); setError(''); }} />
            <p className='text-xs text-muted-foreground'>恢复前会校验文件格式和图表数据。确认恢复后将替换当前看板，可使用撤销返回恢复前的内容。</p>
            {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
            {candidate && <div className='rounded-md border border-border bg-muted p-3 text-sm'>
              <p className='font-medium'>已识别：{candidate.config.title || '未命名看板'}</p>
              <p className='mt-1 text-xs text-muted-foreground'>共 {candidate.rows.length} 行。确认后将替换当前看板。</p>
            </div>}
            <div className='flex flex-wrap justify-end gap-2'>
              <Button variant='outline' onClick={() => onOpenChange(false)}>取消</Button>
              {candidate
                ? <Button onClick={() => { onImport(candidate); onOpenChange(false); toast.success('本地备份已恢复'); }}>确认恢复</Button>
                : <Button disabled={busy || !code.trim()} onClick={() => inspectText(code)}>
                    {busy && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}校验备份内容
                  </Button>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
