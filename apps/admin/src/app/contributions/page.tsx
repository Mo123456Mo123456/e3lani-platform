"use client";

import { AdminShell } from "@/components/AdminShell";
import { type ModerationResult, formatDate } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";

export default function ContributionsPage() {
  const moderation = useAdminResource<ModerationResult[]>("/admin/moderation-results");

  return (
    <AdminShell>
      <main>
        <div className="page-header">
          <div>
            <p className="eyebrow">Review</p>
            <h2>Contributions</h2>
            <p>The API currently exposes moderation results for contribution review; approval queues can be added here when available.</p>
          </div>
          <button className="ghost" type="button" onClick={moderation.reload}>
            Refresh
          </button>
        </div>
        {moderation.error ? <div className="error">{moderation.error}</div> : null}
        <section className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Status</th>
                <th>Category</th>
                <th>Contribution</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {(moderation.data ?? []).map((item, index) => (
                <tr key={item.id ?? `${item.contributionId ?? "moderation"}-${index}`}>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <span className={item.allowed ? "pill success" : "pill inactive"}>{item.allowed ? "Allowed" : "Needs review"}</span>
                  </td>
                  <td>{item.category ?? "-"}</td>
                  <td>{item.contributionId ?? item.userId ?? "-"}</td>
                  <td>{item.reason ?? item.text ?? "-"}</td>
                </tr>
              ))}
              {!moderation.loading && (moderation.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5}>No moderation results returned.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </main>
    </AdminShell>
  );
}
