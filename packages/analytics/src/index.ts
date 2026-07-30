/**
 * Minimal analytics for كوكب يولد أمامك.
 * Default implementation is a no-op with optional console debug.
 */

export type AnalyticsEventName =
  | 'page_view'
  | 'login'
  | 'logout'
  | 'register'
  | 'planet_view'
  | 'planet_create'
  | 'contribution_submit'
  | 'contribution_approve'
  | 'contribution_reject'
  | 'contribution_inject'
  | 'timeline_view'
  | 'forecast_request'
  | 'event_view'
  | 'sim_tick'
  | 'sim_pause'
  | 'sim_resume'
  | 'snapshot_rollback'
  | 'role_change'
  | 'moderation_action'
  | 'ai_request'
  | 'search'
  | 'error';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsClient {
  track(event: AnalyticsEventName, props?: AnalyticsProps): void;
  identify?(userId: string, traits?: AnalyticsProps): void;
  page?(name: string, props?: AnalyticsProps): void;
}

let debug = typeof process !== 'undefined' && process.env?.ANALYTICS_DEBUG === '1';

export function setAnalyticsDebug(enabled: boolean): void {
  debug = enabled;
}

/** Default no-op / console tracker */
export function track(event: AnalyticsEventName, props?: AnalyticsProps): void {
  if (debug || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, props ?? {});
  }
}

export function identify(userId: string, traits?: AnalyticsProps): void {
  if (debug) {
    // eslint-disable-next-line no-console
    console.debug('[analytics:identify]', userId, traits ?? {});
  }
}

export function page(name: string, props?: AnalyticsProps): void {
  track('page_view', { page: name, ...props });
}

export const analytics: AnalyticsClient = {
  track,
  identify,
  page,
};

export default analytics;
