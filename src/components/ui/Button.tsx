"use client";

import * as React from "react";
import { motion } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50";

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] focus-visible:ring-[var(--brand-500)] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_14px_rgba(79,70,229,0.25)]",
  secondary:
    "bg-[var(--surface-elev)] text-[var(--ink-strong)] border border-[var(--border)] hover:bg-[var(--surface-sunken)] focus-visible:ring-[var(--brand-500)]",
  ghost:
    "bg-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)] focus-visible:ring-[var(--brand-500)]",
  danger:
    "bg-[var(--danger-500)] text-white hover:bg-[var(--danger-700)] focus-visible:ring-[var(--danger-500)]",
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    iconLeft,
    iconRight,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : iconLeft ? (
        <span className="inline-flex h-4 w-4 items-center justify-center">{iconLeft}</span>
      ) : null}
      {children}
      {iconRight && !loading ? (
        <span className="inline-flex h-4 w-4 items-center justify-center">{iconRight}</span>
      ) : null}
    </motion.button>
  );
});
