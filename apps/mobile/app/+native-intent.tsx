export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path);
    const segments = [url.hostname, ...url.pathname.split('/')].filter(Boolean);
    if (segments[0] === 'ads' && segments[1]) return `/ads/${segments[1]}`;
    if (segments[0] === 'brands' && segments[1]) return `/brands/${segments[1]}`;
  } catch {
    if (path.startsWith('/ads/') || path.startsWith('/brands/')) return path;
  }
  return path;
}
