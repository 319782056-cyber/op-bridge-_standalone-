import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RotateCcw } from "lucide-react";

export function Field({ label, hint, children, action }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {action}
      </div>
      {children}
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** 数字输入：允许空值（null），失焦/回车提交，避免输入过程中被格式化 */
export function NumField({ label, value, onChange, step = 1, min, max, nullable = false, placeholder, suffix, hint, onReset, disabled = false }) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  useEffect(() => { setText(value === null || value === undefined ? "" : String(value)); }, [value]);
  const submit = () => {
    const t = text.trim();
    if (t === "") {
      if (nullable) onChange(null);
      else setText(String(value));
      return;
    }
    let n = Number(t.endsWith("%") ? Number(t.slice(0, -1)) / 100 : t);
    if (!Number.isFinite(n)) { setText(value === null || value === undefined ? "" : String(value)); return; }
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
  };
  return (
    <Field
      label={label}
      hint={hint}
      action={onReset && (
        <button type="button" onClick={onReset} className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
          恢复自动
        </button>
      )}
    >
      <div className="relative">
        <Input
          value={text}
          disabled={disabled}
          inputMode="decimal"
          placeholder={placeholder}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="h-8 pr-9 text-sm tabular-nums"
        />
        {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </Field>
  );
}

export function TextField({ label, value, onChange, placeholder, hint, multiline }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => { setText(value ?? ""); }, [value]);
  const props = {
    value: text,
    placeholder,
    onChange: (e) => { setText(e.target.value); onChange(e.target.value); },
    className: "text-sm",
  };
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea {...props} rows={2} className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      ) : (
        <Input {...props} className="h-8 text-sm" />
      )}
    </Field>
  );
}

export function ColorField({ label, value, onChange, onReset }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
        aria-label={label}
      />
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toUpperCase());
        }}
        onBlur={() => setText(value)}
        className="h-8 w-[92px] text-xs tabular-nums"
      />
      {onReset && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer" onClick={onReset} title="恢复默认">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function SwitchField({ label, checked, onChange, hint }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label className="text-sm">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}