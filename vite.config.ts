import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import 'dotenv/config';

function geminiSuggestPlugin(): Plugin {
  return {
    name: 'gemini-suggest-middleware',
    configureServer(server) {
      // 1. Suggestion Endpoint: POST /api/suggest
      server.middlewares.use('/api/suggest', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
          return;
        }

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

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const rawClusters = Array.isArray(data.clusters)
              ? data.clusters
              : [data];

            if (rawClusters.length === 0 || !rawClusters[0]?.id) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: 'Payload must contain a non-empty clusters array.',
                })
              );
              return;
            }

            // Cap at 50 clusters max to avoid token overload
            const safeClusters = rawClusters.slice(0, 50).map((c: any) => ({
              id: String(c.id || ''),
              packType: c.packType === 'expense' ? 'expense' : 'file',
              label: String(c.label || '').slice(0, 100),
              pattern: String(c.pattern || '').slice(0, 100),
              count: Number(c.count) || 1,
              exampleDescriptions: Array.isArray(c.exampleDescriptions)
                ? c.exampleDescriptions
                    .slice(0, 5)
                    .map((e: any) => String(e).slice(0, 120))
                : [],
              recurring: Boolean(c.recurring),
            }));

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
                        description:
                          'Recommended action: keep, remove, sort, or review',
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
                    required: ['id', 'action', 'reason'],
                  },
                },
              },
            });

            const resultText = response.text || '[]';
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(resultText);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'Suggestion processing failed.',
                details: err?.message,
                fallbackAvailable: true,
              })
            );
          }
        });
      });

      // 2. Chat Endpoint: POST /api/chat
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'Gemini assistant is offline (API key not configured).',
            })
          );
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const { question, context } = data;

            if (!question || typeof question !== 'string') {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Question is required.' }));
              return;
            }

            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                },
              },
            });

            const prompt = `You are Sortie's built-in intelligent digital organization assistant.
A user is asking a question about their current triage session.

Context about current backlog clusters:
${JSON.stringify(context || {}, null, 2)}

User Question: "${question}"

Instructions:
1. Answer concisely, clearly, and constructively in 2 to 4 sentences.
2. Rely only on the provided cluster metadata and facts. Never invent filenames, private file contents, or financial details.
3. If recommending a rule, specify the exact pattern and target category.
4. If asked about uncertainty, explain why human review is helpful.`;

            const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: prompt,
              config: {
                systemInstruction:
                  'You are a thoughtful, security-minded, concise digital productivity assistant for the Sortie triage application.',
              },
            });

            const reply =
              response.text || 'I could not analyze this request.';
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ reply }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'Assistant query failed.',
                details: err?.message,
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiSuggestPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
