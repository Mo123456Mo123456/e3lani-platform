import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "activity"
  | "arrow"
  | "chevron"
  | "climate"
  | "close"
  | "community"
  | "energy"
  | "globe"
  | "language"
  | "menu"
  | "plus"
  | "quality"
  | "spark"
  | "water";

const paths: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  climate: (
    <>
      <path d="M12 2v20M4.2 6.5l15.6 11M19.8 6.5l-15.6 11" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2" />
      <path d="M3.5 20c.5-4 2.2-6 5.5-6s5 2 5.5 6M15 15c3 0 4.5 1.7 5 4.5" />
    </>
  ),
  energy: <path d="m13.2 2-8 12h6l-.4 8 8-12h-6z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18" />
    </>
  ),
  language: (
    <>
      <path d="M4 5h9M8.5 3v2c0 5-2 8-5 10M6 10c1.5 2 3.2 3.4 5 4" />
      <path d="m14 20 3.5-9 3.5 9M15.2 17h4.6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  quality: (
    <>
      <path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="14" cy="18" r="2" />
    </>
  ),
  spark: (
    <path d="M12 2c.5 5.3 2.7 7.5 8 8-5.3.5-7.5 2.7-8 8-.5-5.3-2.7-7.5-8-8 5.3-.5 7.5-2.7 8-8ZM19 16c.2 2 1 2.8 3 3-2 .2-2.8 1-3 3-.2-2-1-2.8-3-3 2-.2 2.8-1 3-3Z" />
  ),
  water: (
    <path d="M12 2S5.5 9.2 5.5 14.2a6.5 6.5 0 0 0 13 0C18.5 9.2 12 2 12 2Zm-3 13.2c.5 1.7 1.5 2.5 3 2.8" />
  ),
};

export function Icon({
  name,
  size = 20,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
