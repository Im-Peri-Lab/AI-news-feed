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

  return `다음은 ${date} AI 뉴스 기사 제목 목록입니다:\n\n${list}\n\n위 기사 제목만을 근거로 한국어 AI 뉴스 브리핑을 작성하세요. 아래 형식을 정확히 따르세요.\n\n## 핵심 요약\n[오늘 AI 뉴스 전반을 2~3문장으로 요약해 작성]\n\n## 주요 흐름\n### 글로벌 빅테크\n- OpenAI, Google, MS, Meta, Anthropic, NVIDIA 등 글로벌 기업 관련 흐름 (1-2개, 각 1-2문장)\n\n### 국내 AX\n- 통신 3사(KT, SKT, LGU+), 삼성, 네이버, 카카오, SK 등 국내 기업 관련 흐름 (1-2개, 각 1-2문장)\n\n### 정책·사회\n- 정부 발표, 규제, 사회 논의 관련 흐름 (1-2개, 각 1-2문장)\n\n## 지켜볼 단서\n- 오늘 기사 제목에 명시적으로 언급된 일정·발표 예고만 작성\n\n## 놓치지 말 기사\n1. **기사 제목** — 출처\n2. **기사 제목** — 출처\n3. **기사 제목** — 출처\n\n매우 중요한 규칙(반드시 준수):\n1. 기사 제목에 없는 사실은 절대 추론·추가하지 마세요\n2. 회사명·제품명·날짜는 기사 제목에 명시된 것만 사용\n3. "지켜볼 단서"는 기사 제목에 명시적으로 언급된 일정·예고만 포함하고, 없으면 "오늘 기사에 명시된 일정 없음" 한 줄만 작성\n4. 각 카테고리에 해당 기사가 없으면 "해당 기사 없음" 한 줄만 작성\n5. 위 마크다운 헤더(##, ###) 형식을 반드시 유지하세요\n6. 위 형식의 대괄호([]) 안 안내문이나 괄호 안 작성 지침은 출력에 포함하지 말고, 실제 내용만 작성하세요`;
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
