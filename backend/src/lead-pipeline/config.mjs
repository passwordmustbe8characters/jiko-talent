// Central settings for the private lead pipeline. Everything comes from .env.
import 'dotenv/config';

const env = (key, fallback) => process.env[key] ?? fallback;

export const config = {
  databaseUrl: env('DATABASE_URL'),

  llm: {
    // 'groq' (free tier) or 'openai'. Switch providers by changing LLM_PROVIDER in .env.
    provider: env('LLM_PROVIDER', 'groq'),
    providers: {
      groq: {
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: env('GROQ_API_KEY'),
        models: {
          fast: env('GROQ_MODEL_FAST', 'openai/gpt-oss-20b'),    // bulk extraction and tagging
          smart: env('GROQ_MODEL_SMART', 'openai/gpt-oss-120b'), // scoring and drafting
        },
      },
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: env('OPENAI_API_KEY'),
        models: {
          fast: env('OPENAI_MODEL_FAST', 'gpt-6-luna'),
          smart: env('OPENAI_MODEL_SMART', 'gpt-6-luna'),
        },
      },
    },
  },

  search: {
    // Providers are tried in this order; cached results are always checked first.
    order: env('SEARCH_ORDER', 'tavily,exa,serper').split(',').map((s) => s.trim()).filter(Boolean),
    providers: {
      // Limits are deliberately a little below the free allowances so you never hit the wall.
      tavily: { apiKey: env('TAVILY_API_KEY'), monthlyLimit: Number(env('TAVILY_MONTHLY_LIMIT', 900)) },
      exa: { apiKey: env('EXA_API_KEY'), monthlyLimit: Number(env('EXA_MONTHLY_LIMIT', 800)) },
      // Serper's free credits are a one-time grant, so it is used sparingly.
      serper: { apiKey: env('SERPER_API_KEY'), monthlyLimit: Number(env('SERPER_MONTHLY_LIMIT', 300)) },
    },
    cacheDays: Number(env('SEARCH_CACHE_DAYS', 14)),
  },

  // Who the outreach emails come from. Set these in .env.
  outreach: {
    senderName: env('OUTREACH_SENDER_NAME', 'Your Name'),
    senderTitle: env('OUTREACH_SENDER_TITLE', 'Founder'),
    orgName: env('OUTREACH_ORG_NAME', 'Jiko Talent'),
    replyEmail: env('OUTREACH_REPLY_EMAIL', 'you@example.com'),
    university: env('OUTREACH_UNIVERSITY', 'a Nigerian university'),
  },

  fetch: {
    // Put your real contact email in .env so site owners can reach you.
    userAgent: env('FETCH_USER_AGENT', 'JikoTalentBot/0.1 (contact: set-your-email@example.com)'),
    timeoutMs: Number(env('FETCH_TIMEOUT_MS', 15000)),
    maxBytes: 1_500_000,
    maxChars: Number(env('FETCH_MAX_CHARS', 25000)),
    cacheDays: Number(env('FETCH_CACHE_DAYS', 30)),
    minGapMs: Number(env('FETCH_MIN_GAP_MS', 1500)), // pause between requests to the same site
  },
};
