/**
 * AI-powered question generation service.
 *
 * Generates adaptive educational questions based on subtopic, difficulty,
 * and student history. Provider-agnostic — supports Claude, OpenAI, or
 * any LLM with a chat completion API.
 *
 * Set QUESTION_AI_PROVIDER env var to 'claude' | 'openai' | 'mock'.
 * Set ANTHROPIC_API_KEY or OPENAI_API_KEY accordingly.
 */

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'foundational',
  2: 'basic',
  3: 'intermediate',
  4: 'advanced',
  5: 'challenge',
};

interface GenerateQuestionInput {
  subtopicName: string;
  difficultyLevel: number;
  gradeLevel?: string;
  recentHistory?: string;
}

interface GeneratedQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

function buildPrompt(input: GenerateQuestionInput): string {
  const diffLabel = DIFFICULTY_LABELS[input.difficultyLevel] ?? 'intermediate';
  const grade = input.gradeLevel ?? 'middle school';

  return `Generate a ${diffLabel}-level multiple choice question about "${input.subtopicName}" for a ${grade} student.

${input.recentHistory ? `Student's recent performance: ${input.recentHistory}\n` : ''}
Requirements:
- One clear question
- Exactly 4 answer choices (A, B, C, D)
- One correct answer
- A brief explanation of why the correct answer is right

Respond in this exact JSON format:
{
  "question": "...",
  "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correctIndex": 0,
  "explanation": "..."
}

Return only the JSON, no markdown fences or extra text.`;
}

function parseResponse(text: string): GeneratedQuestion {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  return {
    question: String(parsed.question),
    choices: Array.isArray(parsed.choices) ? parsed.choices.map(String) : [],
    correctIndex: Number(parsed.correctIndex),
    explanation: String(parsed.explanation ?? ''),
  };
}

// ── Provider implementations ─────────────────────────────────────────

async function generateWithClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

function generateMock(input: GenerateQuestionInput): GeneratedQuestion {
  return {
    question: `What is an important concept in ${input.subtopicName}?`,
    choices: [
      'A) The correct answer about this topic',
      'B) A plausible but incorrect alternative',
      'C) Another incorrect option',
      'D) Yet another incorrect option',
    ],
    correctIndex: 0,
    explanation: `This is a mock question for ${input.subtopicName} at ${DIFFICULTY_LABELS[input.difficultyLevel]} difficulty.`,
  };
}

// ── Public API ───────────────────────────────────────────────────────

export async function generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestion> {
  const provider = process.env.QUESTION_AI_PROVIDER ?? 'mock';

  if (provider === 'mock') {
    return generateMock(input);
  }

  const prompt = buildPrompt(input);

  let responseText: string;
  if (provider === 'claude') {
    responseText = await generateWithClaude(prompt);
  } else if (provider === 'openai') {
    responseText = await generateWithOpenAI(prompt);
  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  return parseResponse(responseText);
}
