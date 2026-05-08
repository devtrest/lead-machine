import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, iconLeft, className = "", id, ...rest },
  ref
) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[var(--ink-muted)]"
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        {iconLeft ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-subtle)]">
            {iconLeft}
          </span>
        ) : null}
        <input
          id={inputId}
          ref={ref}
          className={`w-full rounded-xl border ${
            error ? "border-[var(--danger-500)]" : "border-[var(--border)]"
          } bg-[var(--surface-elev)] ${
            iconLeft ? "pl-9" : "pl-3.5"
          } pr-3.5 py-2.5 text-sm text-[var(--ink-strong)] placeholder:text-[var(--ink-subtle)] outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20 ${className}`}
          {...rest}
        />
      </div>
      {error ? (
        <p className="text-xs text-[var(--danger-700)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--ink-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, error, className = "", id, ...rest }, ref) {
    const generatedId = React.useId();
  const inputId = id ?? generatedId;
    return (
      <div className="space-y-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[var(--ink-muted)]"
          >
            {label}
          </label>
        ) : null}
        <textarea
          id={inputId}
          ref={ref}
          className={`w-full rounded-xl border ${
            error ? "border-[var(--danger-500)]" : "border-[var(--border)]"
          } bg-[var(--surface-elev)] px-3.5 py-2.5 text-sm text-[var(--ink-strong)] placeholder:text-[var(--ink-subtle)] outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20 ${className}`}
          {...rest}
        />
        {error ? (
          <p className="text-xs text-[var(--danger-700)]">{error}</p>
        ) : hint ? (
          <p className="text-xs text-[var(--ink-subtle)]">{hint}</p>
        ) : null}
      </div>
    );
  }
);
