'use client';

import * as React from 'react';
import { Card, EmptyState, Spinner } from '@e3lani/ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  loading,
  emptyTitle = 'لا توجد بيانات',
}: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyTitle?: string;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!rows.length) return <EmptyState title={emptyTitle} />;

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-right text-sm">
        <thead className="border-b border-line bg-surface">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2.5 font-bold text-ink-muted">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id} className="align-middle hover:bg-surface/60">
              {columns.map((column) => (
                <td key={column.key} className={`px-3 py-2.5 ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
