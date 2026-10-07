import type { ReactNode } from "react";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
};

type MetricCardProps = {
  label: string;
  value: string;
};

type StatusPillProps = {
  children: ReactNode;
};

type SimpleDataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

type SimpleDataTableProps<T> = {
  columns: Array<SimpleDataTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  emptyLabel?: string;
  className?: string;
};

export function SurfaceCard({ children, className = "" }: SurfaceCardProps) {
  return <section className={`app-panel board-card${className ? ` ${className}` : ""}`}>{children}</section>;
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="app-panel app-metric-card metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function StatusPill({ children }: StatusPillProps) {
  return <span className="status-pill">{children}</span>;
}

export function SimpleDataTable<T>({ columns, rows, getRowKey, emptyLabel = "No records yet.", className = "" }: SimpleDataTableProps<T>) {
  return (
    <div className={`simple-table-shell${className ? ` ${className}` : ""}`}>
      <div className="simple-table-scroll">
        <table className="simple-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th className={column.className} key={column.key} scope="col">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <td className={column.className} data-label={column.header} key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="simple-table-empty" colSpan={columns.length}>
                  {emptyLabel}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
