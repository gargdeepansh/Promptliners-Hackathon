/**
 * Site configuration and legal constants.
 * Clearly marked placeholders for operator details.
 */

const getSiteUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_APP_URL) return import.meta.env.VITE_APP_URL;
    if (import.meta.env.APP_URL) return import.meta.env.APP_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return '';
};

export const siteConfig = {
  name: 'Sortie',
  url: getSiteUrl(),
  description:
    'Clear your folders and expenses in 60 second runs. Sortie groups your backlog into cards for rapid triage.',

  // Clearly marked operator placeholders:
  operatorName: 'YOUR NAME',
  contactEmail: 'YOUR EMAIL',
  jurisdiction: 'YOUR COUNTRY',
  hostingProvider: 'Local browser / Static host',

  // Storage keys and versions
  storageKeys: {
    rules: 'sortie_rules',
    plan: 'sortie_current_plan',
    history: 'sortie_history',
    settings: 'sortie_settings',
    directoryHandle: 'sortie_dir_handle',
  },

  // Scoring parameters
  scoring: {
    basePoints: 10,
    quickDecisionWindowMs: 2000,
    maxCombo: 5,
    undoPenaltySeconds: 3,
  },

  // Default run durations (in seconds)
  durations: [30, 60, 90] as const,
  defaultDuration: 60,
};

export function hasSiteConfigPlaceholders(): boolean {
  return (
    siteConfig.operatorName === 'YOUR NAME' ||
    siteConfig.contactEmail === 'YOUR EMAIL' ||
    siteConfig.jurisdiction === 'YOUR COUNTRY' ||
    siteConfig.operatorName.includes('YOUR ') ||
    siteConfig.contactEmail.includes('YOUR ') ||
    siteConfig.jurisdiction.includes('YOUR ')
  );
}
