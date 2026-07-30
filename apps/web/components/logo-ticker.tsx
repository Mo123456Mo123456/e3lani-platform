type Logo = { id: string; logoUrl: string };

export function LogoTicker({ logos, label }: { logos: Logo[]; label: string }) {
  const unique = logos.filter(
    (logo, index, items) => index === 0 || logo.logoUrl !== items[index - 1]?.logoUrl,
  );
  if (unique.length === 0) return null;
  const sequence = unique.flatMap((logo) => [
    <img
      key={`logo-${logo.id}`}
      src={logo.logoUrl}
      alt=""
      draggable={false}
      className="h-8 w-20 shrink-0 object-contain"
    />,
    <span
      key={`separator-${logo.id}`}
      className="shrink-0 rounded-md bg-e3-yellow px-2 py-1 text-[10px] font-black text-e3-black"
      aria-hidden
    >
      إعلاني
    </span>,
  ]);
  return (
    <section
      aria-label={label}
      className="pointer-events-none h-12 overflow-hidden border-b border-black/10 bg-white"
    >
      <div className="ticker-track flex h-full items-center gap-8 px-4">
        {sequence}
        {sequence}
      </div>
    </section>
  );
}
