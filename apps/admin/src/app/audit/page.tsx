"use client";

import { AdminShell } from "@/components/AdminShell";
import { type AuditLog, formatDate } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";

export default function AuditPage() {
  const audit = useAdminResource<AuditLog[]>("/admin/audit-logs");

  return (
    <AdminShell>
      <main>
        <div className="page-header">
          <div>
            <p className="eyebrow">Governance</p>
            <h2>Audit logs</h2>
            <p>Reads `/admin/audit-logs` when the API and database have audit records available.</p>
          </div>
          <button className="ghost" type="button" onClick={audit.reload}>
            Refresh
          </button>
        </div>
        {audit.error ? <div className="error">{audit.error}</div> : null}
        <section className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data ?? []).map((log, index) => (
                <tr key={log.id ?? index}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>{log.action ?? "-"}</td>
                  <td>{log.actorId ?? "-"}</td>
                  <td>
                    {log.entityType ?? "-"} {log.entityId ? `/${log.entityId}` : ""}
                  </td>
                  <td>
                    <pre>{JSON.stringify(log.metadata ?? log, null, 2)}</pre>
                  </td>
                </tr>
              ))}
              {!audit.loading && (audit.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <span className="pill inactive">Inactive until audit data exists</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </main>
    </AdminShell>
  );
}
