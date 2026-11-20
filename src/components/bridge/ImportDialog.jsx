import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { parsePastedTable, parseWorkbookArrayBuffer } from "@/lib/bridge/excel";
import { cn } from "@/lib/utils";

export default function ImportDialog({ open, onOpenChange, onImportDoc, onPasteRows }) {
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState("");
  const fileRef = useRef(null);

  const readFile = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      toast.error("请选择 .xlsx / .xls / .csv 文件");
      return;
    }
    try {
      const doc = parseWorkbookArrayBuffer(await file.arrayBuffer());
      if (!doc.rows.length) throw new Error("文件里没有读到任何数据行");
      onImportDoc(doc);
      toast.success(`已导入 ${doc.rows.length} 行数据（来自「${doc.dataSheetName}」）`);
      doc.notes.slice(0, 3).forEach((n) => toast.warning(n));
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || "文件解析失败，请检查格式");
    }
  };

  const applyPaste = (mode) => {
    const rows = parsePastedTable(text);
    if (!rows.length) {
      toast.error("没有识别到数据，请从 Excel 复制含“项目名称、柱子类型、数值、分组”的区域");
      return;
    }
    onPasteRows(rows, mode);
    toast.success(`已${mode === "replace" ? "替换为" : "追加"} ${rows.length} 行数据`);
    setText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>导入数据</DialogTitle>
          <DialogDescription>直接使用你原来的《OP桥图数据输入模板.xlsx》，或从 Excel 复制粘贴数据行。</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="file">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="cursor-pointer">上传 Excel</TabsTrigger>
            <TabsTrigger value="paste" className="cursor-pointer">粘贴表格</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="mt-4">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                drag ? "border-primary bg-primary/5" : "border-input hover:bg-muted/60",
              )}
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">点击选择或拖入 Excel 文件</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                自动识别「图表配置 / 参数配置 / OP数据」；若只有数据表，则读取含“项目名称、柱子类型”表头的 Sheet。
                <br />导入会替换当前图表的数据、文案和外观参数。
              </p>
              <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" className="hidden"
                onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </TabsContent>
          <TabsContent value="paste" className="mt-4 space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"项目名称\t柱子类型\t数值\t一级分组\t二级分组\t三级分组\n2025实际\t起始量\t0.5\n运费项目一\t增减项\t0.02\t降本项目\t运输优化\t运价优化"}
              className="h-48 resize-none font-mono text-xs"
            />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <FileSpreadsheet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              可带表头，也可不带（默认列顺序：项目名称、柱子类型、数值、一级/二级/三级分组）；支持含“序号”首列。
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="cursor-pointer" disabled={!text.trim()} onClick={() => applyPaste("append")}>追加到末尾</Button>
              <Button className="cursor-pointer" disabled={!text.trim()} onClick={() => applyPaste("replace")}>替换全部数据</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}