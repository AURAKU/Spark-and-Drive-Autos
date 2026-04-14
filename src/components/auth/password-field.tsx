"use client";

import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  name?: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  /** Extra hint next to label (e.g. register “8+ characters”) */
  labelHint?: ReactNode;
  inputClassName?: string;
};

export function PasswordField({
  id,
  label,
  name = "password",
  autoComplete,
  value,
  onChange,
  disabled,
  required,
  minLength,
  placeholder,
  labelHint,
  inputClassName,
}: Props) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelHint ? (
          <span id={hintId} className="text-[11px] text-muted-foreground dark:text-zinc-500">
            {labelHint}
          </span>
        ) : null}
      </div>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={labelHint ? hintId : undefined}
          className={cn("h-11 min-h-11 pr-11", inputClassName)}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className={cn(
            "absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md",
            "text-muted-foreground transition hover:bg-muted hover:text-foreground",
            "dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          {visible ? <EyeOff className="size-4 shrink-0" aria-hidden /> : <Eye className="size-4 shrink-0" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
