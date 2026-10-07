"use client";

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export function AppShell({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`crm-app-shell ${className}`.trim()} {...props}>{children}</div>;
}

export function Sidebar({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return <aside className={`crm-sidebar ${className}`.trim()} {...props}>{children}</aside>;
}

export function Topbar({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={`crm-topbar ${className}`.trim()} {...props}>{children}</header>;
}

export function ContentContainer({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`crm-content-container ${className}`.trim()} {...props}>{children}</div>;
}

export function Section({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`crm-section ${className}`.trim()} {...props}>{children}</section>;
}

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`crm-card ${className}`.trim()} {...props}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`crm-page-header ${className}`.trim()}>
      <div className="crm-page-header-copy">
        {eyebrow ? <div className="crm-eyebrow">{eyebrow}</div> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="crm-page-header-actions">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  trend,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`crm-metric-card ${className}`.trim()}>
      <span className="crm-metric-label">{label}</span>
      <strong>{value}</strong>
      {detail || trend ? <div className="crm-metric-footer">{detail ? <span>{detail}</span> : null}{trend ? <span className="crm-metric-trend">{trend}</span> : null}</div> : null}
    </Card>
  );
}

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`crm-button ${className}`.trim()} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`crm-input ${className}`.trim()} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`crm-select ${className}`.trim()} {...props}>{children}</select>;
}

export function Tabs({
  items,
  activeId,
  onChange,
  className = "",
}: {
  items: Array<{ id: string; label: ReactNode; count?: ReactNode }>;
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`crm-tabs ${className}`.trim()} role="tablist">
      {items.map((item) => (
        <button
          aria-selected={activeId === item.id}
          className={activeId === item.id ? "is-active" : ""}
          key={item.id}
          onClick={() => onChange(item.id)}
          role="tab"
          type="button"
        >
          {item.label}{item.count !== undefined ? <span>{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`crm-filter-bar ${className}`.trim()} {...props}>{children}</div>;
}

export function StatusBadge({
  status,
  children,
  className = "",
}: {
  status: "connected" | "success" | "syncing" | "warning" | "error" | "neutral" | "info";
  children: ReactNode;
  className?: string;
}) {
  return <span className={`crm-status-badge crm-status-${status} ${className}`.trim()}>{children}</span>;
}

export function DataTable({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`crm-table-shell ${className}`.trim()} {...props}><table className="crm-data-table">{children}</table></div>;
}

export function EmptyState({ title, description, action, className = "" }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={`crm-empty-state ${className}`.trim()}><div className="crm-empty-state-icon" aria-hidden="true">+</div><h3>{title}</h3>{description ? <p>{description}</p> : null}{action ? <div>{action}</div> : null}</div>;
}

export function LoadingState({ label = "Loading…", className = "" }: { label?: ReactNode; className?: string }) {
  return <div aria-live="polite" className={`crm-loading-state ${className}`.trim()}><span className="crm-spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorState({ title = "Something went wrong", description, action, className = "" }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return <div aria-live="assertive" className={`crm-error-state ${className}`.trim()}><h3>{title}</h3>{description ? <p>{description}</p> : null}{action ? <div>{action}</div> : null}</div>;
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="crm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside aria-label={typeof title === "string" ? title : "Details"} aria-modal="true" className={`crm-drawer ${className}`.trim()} role="dialog">
        <div className="crm-drawer-header"><h2>{title}</h2><button aria-label="Close" className="crm-icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button></div>
        <div className="crm-drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Dialog({ open, title, onClose, children, className = "" }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; className?: string }) {
  return <Drawer className={`crm-dialog ${className}`.trim()} open={open} onClose={onClose} title={title}>{children}</Drawer>;
}

export function Stepper({ steps, activeIndex, className = "" }: { steps: Array<{ label: ReactNode; description?: ReactNode }>; activeIndex: number; className?: string }) {
  return <ol className={`crm-stepper ${className}`.trim()}>{steps.map((step, index) => <li className={index === activeIndex ? "is-active" : index < activeIndex ? "is-complete" : ""} key={index}><span>{index < activeIndex ? "✓" : index + 1}</span><div><strong>{step.label}</strong>{step.description ? <small>{step.description}</small> : null}</div></li>)}</ol>;
}

export function ActivityTimeline({ items, className = "" }: { items: Array<{ id: string; title: ReactNode; detail?: ReactNode; time?: ReactNode }>; className?: string }) {
  return <ol aria-label="Activity timeline" className={`crm-activity-timeline ${className}`.trim()}>{items.map((item) => <li key={item.id}><span className="crm-activity-dot" aria-hidden="true" /><div><strong>{item.title}</strong>{item.detail ? <p>{item.detail}</p> : null}{item.time ? <time>{item.time}</time> : null}</div></li>)}</ol>;
}
