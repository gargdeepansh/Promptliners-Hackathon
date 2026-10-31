import { secureRequest } from './security';
import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, Type } from '@google/genai';

interface ClusterInput {
  id: string;
  packType: 'file' | 'expense';
  label: string;
  pattern: string;
  count: number;
  exampleDescriptions: string[];
  recurring?: boolean;
}

export default async function handler(req: any, res: any) {
  const body = secureRequest(req, res);
  if (!body) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Gemini API key is not configured on the server.',
        fallbackAvailable: true,
      })
    );
    return;
  }

  const rawClusters = Array.isArray(body?.clusters) ? body.clusters : [];
  if (rawClusters.length === 0 || rawClusters.length > 50) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Payload must contain a non-empty "clusters" array.' }));
    return;
  }

  // Enforce batch size limit for rate limiting and safety
  const safeClusters: ClusterInput[] = rawClusters.map((c: any) => ({
    id: String(c.id || ''),
    packType: c.packType === 'expense' ? 'expense' : 'file',
    label: String(c.label || '').slice(0, 100),
    pattern: String(c.pattern || '').slice(0, 100),
    count: Number(c.count) || 1,
    exampleDescriptions: Array.isArray(c.exampleDescriptions)
      ? c.exampleDescriptions.slice(0, 5).map((e: any) => String(e).slice(0, 120))
      : [],
    recurring: Boolean(c.recurring),
  }));

  if (safeClusters.some(c => !c.id || c.id.length > 200 || !Number.isSafeInteger(c.count) || c.count < 1)) {
    res.statusCode = 400; res.end(JSON.stringify({error: 'Invalid cluster data.'})); return;
  }
  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `You are Sortie's senior digital organization and financial triage engine.
Analyze these ${safeClusters.length} item clusters and provide safe, structured, actionable recommendations.

Clusters to evaluate:
${JSON.stringify(safeClusters, null, 2)}

Strict Guidelines:
1. "keep": Important permanent files, active records, contracts, valid certificates, ongoing essential subscriptions.
2. "remove": Disposable temporary files (.tmp, .part, .crdownload, .swp), cache dumps, crash logs, obsolete installation packages (.dmg/.pkg/.msi already installed), spam receipts. Note: "remove" moves files into a reversible review folder (_sortie_removed).
3. "sort": Items with clear organizational categories. For files: "Documents", "Images", "Archives", "Installers", "Code", "Work", "Financial". For expenses: "Food", "Transport", "Bills", "Subscriptions", "Shopping", "Other".
4. "review": If the purpose is ambiguous, or if file names indicate potentially sensitive user data (passwords, legal wills, tax forms) where automated action is risky, recommend "review" with needsHumanReview: true.
5. NEVER invent file contents, financial amounts, or unstated facts.
6. Provide concise reasons (maximum 8 words).
7. Calibrate confidence ("high", "medium", "low") honestly based on how distinct the pattern is.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: 'Unique cluster identifier matching input',
              },
              action: {
                type: Type.STRING,
                description: 'Recommended action: keep, remove, sort, or review',
              },
              category: {
                type: Type.STRING,
                description: 'Category name or destination folder',
              },
              destination: {
                type: Type.STRING,
                description: 'Destination folder or category if sort',
              },
              reason: {
                type: Type.STRING,
                description: 'Brief, clear reasoning under 8 words',
              },
              confidence: {
                type: Type.STRING,
                description: 'Confidence level: high, medium, or low',
              },
              riskLevel: {
                type: Type.STRING,
                description: 'Risk assessment: low, medium, or high',
              },
              needsHumanReview: {
                type: Type.BOOLEAN,
                description: 'Whether human confirmation is advised',
              },
            },
            required: ['id', 'action', 'reason', 'confidence', 'riskLevel', 'needsHumanReview'],
          },
        },
      },
    });

    const text = response.text || '[]';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error('Invalid model response'); }
    const ids = new Set(safeClusters.map(c => c.id));
    if (!Array.isArray(parsed)) throw new Error('Invalid model response');
    const validated = parsed.filter((item: any) =>
      item && ids.has(item.id) && ['keep','remove','sort','review'].includes(item.action) &&
      typeof item.reason === 'string' && ['high','medium','low'].includes(item.confidence) &&
      ['high','medium','low'].includes(item.riskLevel) && typeof item.needsHumanReview === 'boolean'
    ).map((item: any) => ({...item, needsHumanReview: item.needsHumanReview || item.action === 'remove' || item.action === 'review'}));
    res.end(JSON.stringify(validated));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Gemini suggestion processing failed.',
        fallbackAvailable: true,
      })
    );
  }
}
