import { secureRequest } from './security';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  const body = secureRequest(req, res);
  if (!body) return;

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

  const { question, context } = body || {};
  if (!question || typeof question !== 'string' || question.length > 1000 || (context !== undefined && JSON.stringify(context).length > 12000)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Question is required.' }));
    return;
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

    const reply = response.text || 'I could not analyze this request.';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ reply }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Assistant query failed.',
      })
    );
  }
}
