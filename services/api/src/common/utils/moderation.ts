import { ALLOWED_LINK_HOSTS, BLOCKED_KEYWORDS } from '@e3lani/config';

export interface AutoCheckResult {
  ok: boolean;
  reasons: string[];
}

/**
 * الفحص الآلي أثناء الرفع: الحقول، الروابط، المحتوى الممنوع الواضح.
 * لا توجد مراجعة بشرية قبل النشر — المراجعة البشرية تحدث فقط بعد بلاغ.
 */
export function runAutomatedContentCheck(input: {
  title: string;
  description?: string | null;
  contactValue?: string | null;
}): AutoCheckResult {
  const reasons: string[] = [];
  const haystack = `${input.title} ${input.description ?? ''}`.toLowerCase();

  for (const keyword of BLOCKED_KEYWORDS) {
    if (haystack.includes(keyword.toLowerCase())) {
      reasons.push(`محتوى ممنوع: «${keyword}»`);
      break;
    }
  }

  const urls = `${input.description ?? ''} ${input.contactValue ?? ''}`.match(/https?:\/\/[^\s]+/gi);
  for (const url of urls ?? []) {
    if (!isAllowedLink(url)) {
      reasons.push(`رابط غير معتمد: ${url}`);
      break;
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function isAllowedLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return ALLOWED_LINK_HOSTS.some((allowed) => {
      const normalized = allowed.replace(/^www\./, '');
      return host === normalized || host.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}
