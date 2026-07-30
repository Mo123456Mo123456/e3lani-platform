/**
 * Central operating modes — stored in SystemSetting `launch_mode`.
 * Default for current release: FREE_LAUNCH (publish free, no payment UI).
 */
export const LAUNCH_MODES = ['FREE_LAUNCH', 'PAID_ONLY', 'PROFILE_ONLY'] as const;

export type LaunchMode = (typeof LAUNCH_MODES)[number];

export const DEFAULT_LAUNCH_MODE: LaunchMode = 'FREE_LAUNCH';

export function isLaunchMode(value: unknown): value is LaunchMode {
  return typeof value === 'string' && (LAUNCH_MODES as readonly string[]).includes(value);
}

export function paymentsRequired(mode: LaunchMode): boolean {
  return mode === 'PAID_ONLY';
}

export function feedPromotionAllowed(mode: LaunchMode): boolean {
  return mode === 'FREE_LAUNCH' || mode === 'PAID_ONLY';
}
