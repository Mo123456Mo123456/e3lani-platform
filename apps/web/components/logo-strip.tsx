type Banner = {
  id: string;
  owner: { name: string | null };
  logoMedia: {
    thumbnailUrl: string | null;
    variants: Record<string, string> | null;
  };
};

function uniqueConsecutive(items: Banner[]) {
  return items.filter((item, index) => index === 0 || items[index - 1]?.owner.name !== item.owner.name);
}

export function LogoStrip({ banners }: { banners: Banner[] }) {
  const logos = uniqueConsecutive(banners);
  if (!logos.length) return null;
  const sequence = [...logos, ...logos];
  return (
    <div
      className="h-14 overflow-hidden border-b border-black/10 bg-brand"
      aria-label="شعارات الشريط الإعلاني"
    >
      <div className="logo-marquee h-full items-center">
        {sequence.map((banner, index) => (
          <div key={`${banner.id}-${index}`} className="flex h-full items-center">
            <div className="mx-6 flex h-10 w-24 items-center justify-center">
              <img
                src={banner.logoMedia.variants?.medium ?? banner.logoMedia.thumbnailUrl ?? ""}
                alt={banner.owner.name ?? "شعار معلن"}
                className="max-h-9 max-w-24 object-contain"
                draggable={false}
              />
            </div>
            <span className="text-sm font-black text-black/70" aria-hidden="true">
              إعلاني
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
