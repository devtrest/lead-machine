"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
};

type ToastCtx = {
  show: (t: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
};

const STYLES: Record<ToastKind, string> = {
  success:
    "border-[var(--success-100)] bg-white text-[var(--ink-strong)] [&_.icon]:text-[var(--success-700)]",
  error:
    "border-[var(--danger-100)] bg-white text-[var(--ink-strong)] [&_.icon]:text-[var(--danger-700)]",
  warning:
    "border-[var(--warning-100)] bg-white text-[var(--ink-strong)] [&_.icon]:text-[var(--warning-700)]",
  info: "border-[var(--brand-100)] bg-white text-[var(--ink-strong)] [&_.icon]:text-[var(--brand-700)]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);
  const seed = useId();

  const show = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = `${seed}-${++idCounter.current}`;
      setToasts((prev) => [...prev, { ...t, id }]);
      // Auto-dismiss after 4.5s
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 4500);
    },
    [seed]
  );

  const value: ToastCtx = {
    show,
    success: (title, description) =>
      show({ kind: "success", title, description }),
    error: (title, description) => show({ kind: "error", title, description }),
    warning: (title, description) =>
      show({ kind: "warning", title, description }),
    info: (title, description) => show({ kind: "info", title, description }),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((x) => x.id !== id))
        }
      />
    </Ctx.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.10)] ${STYLES[t.kind]}`}
          >
            <span className="icon mt-0.5 shrink-0">{ICONS[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight">
                {t.title}
              </div>
              {t.description ? (
                <div className="mt-0.5 text-xs leading-snug text-[var(--ink-muted)]">
                  {t.description}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-[var(--ink-subtle)] transition hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
