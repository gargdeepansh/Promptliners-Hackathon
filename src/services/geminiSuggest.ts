import { ItemCluster, AiStructuredSuggestion } from '../types';

/**
 * Intelligent deterministic fallback heuristics for when Gemini API is unavailable.
 * Ensures the app remains 100% functional, helpful, and safe offline.
 */
export function getHeuristicSuggestion(cluster: ItemCluster): AiStructuredSuggestion {
  const label = cluster.label.toLowerCase();
  const pattern = cluster.pattern.toLowerCase();
  const key = cluster.key.toLowerCase();

  // Temporary / lock / cache files -> Remove
  if (
    key.includes('temporary') ||
    key.includes('temp') ||
    pattern.includes('.tmp') ||
    pattern.includes('.swp') ||
    pattern.includes('.part') ||
    pattern.includes('~lock')
  ) {
    return {
      id: cluster.id,
      action: 'remove',
      reason: 'Temporary cache or partial build file',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Obsolete logs / debug output -> Remove
  if (key.includes('logs') || pattern.includes('.log')) {
    return {
      id: cluster.id,
      action: 'remove',
      reason: 'Diagnostic log file not needed for long-term storage',
      confidence: 'medium',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Installers / disk images -> Sort to Installers
  if (
    key.includes('installers') ||
    pattern.includes('.dmg') ||
    pattern.includes('.exe') ||
    pattern.includes('.pkg')
  ) {
    return {
      id: cluster.id,
      action: 'sort',
      destination: 'Installers',
      category: 'Installers',
      reason: 'Software setup package ready for archive or cleanup',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Screenshots -> Sort to Images
  if (key.includes('screenshot') || label.includes('screenshot')) {
    return {
      id: cluster.id,
      action: 'sort',
      destination: 'Images',
      category: 'Images',
      reason: 'Screen capture ready for image library organization',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Documents / PDFs -> Keep or Sort to Documents
  if (key.includes('pdf') || key.includes('doc') || pattern.includes('.pdf')) {
    return {
      id: cluster.id,
      action: 'sort',
      destination: 'Documents',
      category: 'Documents',
      reason: 'Document record suitable for structured filing',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Invoices & Receipts -> Sort to Financial
  if (key.includes('invoice') || key.includes('receipt') || label.includes('invoice')) {
    return {
      id: cluster.id,
      action: 'sort',
      destination: 'Financial',
      category: 'Financial',
      reason: 'Tax or payment record for financial archives',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Expenses: Subscriptions
  if (cluster.recurringInfo?.isRecurring || cluster.recurringInfo?.isSubscription) {
    return {
      id: cluster.id,
      action: 'sort',
      destination: 'Subscriptions',
      category: 'Subscriptions',
      reason: 'Predictable cadence indicates active subscription',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Expenses: Rideshare
  if (label.includes('uber') || label.includes('lyft')) {
    return {
      id: cluster.id,
      action: 'sort',
      destination: 'Transport',
      category: 'Transport',
      reason: 'Urban transportation ride',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Expenses: Groceries & Food
  if (
    label.includes('whole foods') ||
    label.includes('trader joe') ||
    label.includes('starbucks') ||
    label.includes('chipotle') ||
    label.includes('sweetgreen')
  ) {
    return {
      id: cluster.id,
      action: 'sort',
      destination: 'Food',
      category: 'Food',
      reason: 'Food and grocery purchase',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Expenses: Utilities & Bills
  if (label.includes('electric') || label.includes('comcast') || label.includes('pg&e')) {
    return {
      id: cluster.id,
      action: 'sort',
      destination: 'Bills',
      category: 'Bills',
      reason: 'Essential household utility bill',
      confidence: 'high',
      riskLevel: 'low',
      needsHumanReview: false,
      source: 'heuristic',
    };
  }

  // Default: Keep with low confidence / review recommendation
  return {
    id: cluster.id,
    action: 'review',
    reason: 'Standard user item requiring review before sorting',
    confidence: 'low',
    riskLevel: 'high',
    needsHumanReview: true,
    source: 'heuristic',
  };
}

/**
 * Fetches batch suggestions for up to 50 clusters from the Gemini endpoint.
 * Sends descriptions/labels only, with NO monetary amounts and NO private contents.
 * Returns a dictionary mapping cluster id to AiStructuredSuggestion.
 * Gracefully falls back to deterministic heuristics if the API call fails or is unavailable.
 */
export async function getBatchClusterSuggestions(
  clusters: ItemCluster[],
  enabled: boolean
): Promise<{
  suggestions: Record<string, AiStructuredSuggestion>;
  source: 'gemini' | 'heuristic';
  apiError?: string;
}> {
  if (clusters.length === 0) {
    return { suggestions: {}, source: 'heuristic' };
  }

  if (!enabled) {
    // Generate heuristic suggestions for all clusters
    const fallbackResults: Record<string, AiStructuredSuggestion> = {};
    for (const c of clusters) {
      fallbackResults[c.id] = getHeuristicSuggestion(c);
    }
    return { suggestions: fallbackResults, source: 'heuristic' };
  }

  try {
    const batch = clusters.slice(0, 50).map((c) => ({
      id: c.id,
      packType: c.packType,
      label: c.label,
      pattern: c.pattern,
      count: c.count,
      exampleDescriptions: c.exampleItems.map((ex) =>
        ex.replace(/\s*\([^)]*\)$/, '').trim()
      ),
      recurring: Boolean(c.recurringInfo?.isRecurring),
    }));

    const response = await fetch('/api/suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clusters: batch }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const result: Record<string, AiStructuredSuggestion> = {};

    const validIds = new Set(clusters.map(c => c.id));
    if (Array.isArray(data)) {
      for (const item of data) {
        if (!item || typeof item.id !== 'string' || !validIds.has(item.id) || result[item.id]) continue;
        if (!['keep', 'remove', 'sort', 'review'].includes(item.action) || typeof item.reason !== 'string') continue;
        const validRisk = ['low', 'medium', 'high'].includes(item.riskLevel);
        const validConfidence = ['high', 'medium', 'low'].includes(item.confidence);
        const uncertain = !validRisk || !validConfidence || typeof item.needsHumanReview !== 'boolean';
        const action = uncertain ? 'review' : item.action as AiStructuredSuggestion['action'];
        const dest = typeof item.destination === 'string' ? item.destination : undefined;
        result[item.id] = {
          id: item.id, action,
          destination: dest,
          category: typeof item.category === 'string' ? item.category : dest,
          reason: item.reason.slice(0, 240),
          confidence: validConfidence ? item.confidence : 'low',
          riskLevel: validRisk ? item.riskLevel : 'high',
          needsHumanReview: uncertain || item.needsHumanReview || action === 'review' || action === 'remove',
          source: 'gemini',
        };
      }
    }

    // Fill in any clusters missing from response with heuristics
    for (const c of clusters) {
      if (!result[c.id]) {
        result[c.id] = getHeuristicSuggestion(c);
      }
    }

    return { suggestions: result, source: 'gemini' };
  } catch (err: any) {
    // Graceful deterministic fallback
    const fallbackResults: Record<string, AiStructuredSuggestion> = {};
    for (const c of clusters) {
      fallbackResults[c.id] = getHeuristicSuggestion(c);
    }
    return {
      suggestions: fallbackResults,
      source: 'heuristic',
      apiError: err?.message,
    };
  }
}

/**
 * Queries the contextual AI Assistant with questions about the current triage session.
 */
export async function askAiAssistant(
  question: string,
  context: {
    clustersSummary?: Array<{ label: string; count: number; totalMetric: number }>;
    totalClusters?: number;
    totalItems?: number;
    packType?: string;
  }
): Promise<{ reply: string; source: 'gemini' | 'heuristic' }> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.reply) {
        return { reply: data.reply, source: 'gemini' };
      }
    }
  } catch {
    // Ignore and fallback below
  }

  // Contextual offline heuristic answers
  const q = question.toLowerCase();
  const clusters = context.clustersSummary || [];

  if (q.includes('space') || q.includes('largest') || q.includes('most')) {
    if (clusters.length > 0) {
      const largest = [...clusters].sort((a, b) => b.totalMetric - a.totalMetric)[0];
      return {
        reply: `The cluster occupying the largest footprint is "${largest.label}" with ${largest.count} items. You can review or sort it first to organize the bulk of your backlog.`,
        source: 'heuristic',
      };
    }
    return {
      reply: 'No cluster metadata is currently loaded to evaluate storage size.',
      source: 'heuristic',
    };
  }

  if (q.includes('review') || q.includes('manual') || q.includes('uncertain')) {
    return {
      reply: 'Clusters with ambiguous extensions, mixed naming patterns, or tax documents should be manually reviewed. Sortie flags items needing human attention with low confidence and never deletes files automatically.',
      source: 'heuristic',
    };
  }

  if (q.includes('duplicate')) {
    return {
      reply: 'Sortie analyzes file sizes and names to detect possible duplicates. Use Smart Cleanup Mode to review duplicate candidate cards and keep the primary version while moving duplicates to the review folder.',
      source: 'heuristic',
    };
  }

  if (q.includes('rule')) {
    return {
      reply: 'You can create reusable rules by clicking "Always do this" after sorting any card. Rules match by file extension, prefix, or merchant name and automate decisions on future scans.',
      source: 'heuristic',
    };
  }

  return {
    reply: `Sortie has ${context.totalClusters || 0} clusters active across ${context.totalItems || 0} items. You can sort files into organized categories, retain critical documents with Keep, or move temporary clutter to the review folder.`,
    source: 'heuristic',
  };
}
