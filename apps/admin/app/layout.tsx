export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: "Segoe UI, Tahoma, sans-serif",
          background: "#0b1220",
          color: "#e8eef8",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
