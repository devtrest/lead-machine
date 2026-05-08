import * as React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  padded?: boolean;
};

export function Card({
  elevated,
  padded = true,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <div
      className={`${elevated ? "surface-card-elev" : "surface-card"} ${padded ? "p-6" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-[var(--ink-strong)]">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
