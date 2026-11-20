// One chat function for any OpenAI-compatible provider (Groq, OpenAI).
// Switching provider is a .env change, not a code change.
import { config } from './config.mjs';
import { reserve } from './usage.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function currentModel(tier = 'fast') {
  return config.llm.providers[config.llm.provider].models[tier];
}

/**
 * Send one request. tier: 'fast' (bulk work) or 'smart' (scoring/drafting).
 * Retries politely on rate limits (429) and server errors.
 * NOTE: never put student names, emails or phone numbers in `user` or `system`.
 */
export async function chat({ system, user, tier = 'fast', maxTokens = 3000, retries = 4 }) {
  const name = config.llm.provider;
  const p = config.llm.providers[name];
  if (!p) throw new Error(`Unknown LLM_PROVIDER "${name}"`);
  if (!p.apiKey) throw new Error(`Missing API key for LLM provider "${name}" (check .env)`);

  const body = {
    model: p.models[tier],
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    // Reasoning models spend part of this budget thinking, so keep it generous.
    max_completion_tokens: maxTokens,
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * 2 ** attempt, 30000);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${name} error ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    await reserve(`${name}_tokens`, data.usage?.total_tokens ?? 0).catch(() => {});
    return { text, model: body.model, usage: data.usage ?? null };
  }
  throw new Error(`${name}: still rate limited after ${retries} retries. Wait a minute or reduce batch size.`);
}

/** Pull a JSON object/array out of a model reply, tolerating code fences and chatter. */
export function extractJson(text) {
  const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.search(/[\[{]/);
  if (start === -1) throw new Error('No JSON found in model reply');
  const close = cleaned[start] === '{' ? '}' : ']';
  const end = cleaned.lastIndexOf(close);
  if (end <= start) throw new Error('Unterminated JSON in model reply');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Like chat(), but returns parsed JSON and retries once if the reply isn't valid JSON. */
export async function chatJSON(args) {
  const first = await chat(args);
  try {
    return { data: extractJson(first.text), model: first.model, usage: first.usage };
  } catch {
    const second = await chat({
      ...args,
      user: `${args.user}\n\nReturn ONLY valid JSON. No commentary, no code fences.`,
    });
    return { data: extractJson(second.text), model: second.model, usage: second.usage };
  }
}
