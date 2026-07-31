"use client";

import React, { useEffect, useState } from "react";
import { Panel, Badge } from "@planet/ui";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

interface ReviewRow {
  id: string;
  category: string;
  rawText: string;
  status: string;
  createdAt: string;
  user: { email: string };
  balance?: { verdict?: string; reasons?: string[] } | null;
}

export default function ReviewPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ReviewRow[]>("/admin/contributions/review")
      .then(setRows)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <Shell>
      <h1 style={{ fontSize: 20, color: "var(--planet-accent)" }}>مراجعة الإضافات</h1>
      {error && <p style={{ color: "var(--planet-red)" }}>{error}</p>}
      <Panel>
        <table>
          <thead>
            <tr><th>المستخدم</th><th>الفئة</th><th>النص</th><th>التوازن</th><th>الحالة</th><th>التاريخ</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td dir="ltr">{r.user.email}</td>
                <td>{r.category}</td>
                <td style={{ maxWidth: 320 }}>{r.rawText.slice(0, 120)}</td>
                <td>
                  {r.balance?.verdict && (
                    <Badge
                      color={
                        r.balance.verdict === "accept" ? "var(--planet-green)"
                          : r.balance.verdict === "adjust" ? "var(--planet-gold)"
                            : "var(--planet-red)"
                      }
                    >
                      {r.balance.verdict}
                    </Badge>
                  )}
                </td>
                <td><Badge>{r.status}</Badge></td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Shell>
  );
}
