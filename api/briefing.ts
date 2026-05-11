import { GoogleGenAI } from '@google/genai';

interface ArticleInput {
  title: string;
  source: string;
}

export const config = { maxDuration: 30 };

function buildPrompt(articles: ArticleInput[], date: string): string {
  const list = articles
    .slice(0, 50)
    .map((a, i) => `${i + 1}. ${a.title} (${a.source})`)
    .join('\n');

  return `다음은 ${date} AI 뉴스 기사 제목 목록입니다:\n\n${list}\n\n위 기사들을 바탕으로 간결한 AI 뉴스 브리핑을 한국어로 작성해주세요. 정확히 아래 형식으로 작성하세요:\n\n## 핵심 요약\n오늘 AI 뉴스 전체를 한 문장으로 요약.\n\n## 주요 흐름\n1. 첫 번째 주요 흐름 (1-2문장)\n2. 두 번째 주요 흐름 (1-2문장)\n3. 세 번째 주요 흐름 (1-2문장)\n\n## 놓치지 말 기사\n1. **기사 제목** — 출처\n2. **기사 제목** — 출처\n3. **기사 제목** — 출처\n\n형식을 그대로 유지하고 각 항목은 간결하게 작성하세요.`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const { articles, date } = req.body as { articles: ArticleInput[]; date: string };
  if (!articles?.length) {
    return res.status(400).json({ error: 'No articles provided' });
  }

  const prompt = buildPrompt(articles, date);

  try {
    const ai = new GoogleGenAI({ apiKey });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) res.write(text);
    }

    res.end();
  } catch (e: any) {
    console.error('[api/briefing] error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate briefing' });
    } else {
      res.end();
    }
  }
}
