"use client";

import React from "react";
import { TopBar } from "@/components/panels/TopBar";

export function DataPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <TopBar />
      <main style={{ flex: 1, overflowY: "auto", padding: 20 }} className="panel-scroll">
        <h1 style={{ fontSize: 20, color: "var(--planet-accent)", margin: "0 0 16px" }}>{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--planet-border)", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "start", padding: "10px 12px", color: "var(--planet-accent)",
                  borderBottom: "1px solid var(--planet-border)", fontWeight: 600, whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(56,189,248,0.06)" }}>
              {cells.map((c, j) => (
                <td key={j} style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
