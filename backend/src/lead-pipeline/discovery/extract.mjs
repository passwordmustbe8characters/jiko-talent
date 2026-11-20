// One model call per company: what it does, where it is, named contacts, and a few sourced facts.
// The model only SUGGESTS; run.mjs checks every quote against the stored page before saving anything.
import { chatJSON } from '../llm.mjs';

const s = (v, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const arr = (v) => (Array.isArray(v) ? v : []);

const TYPES = ['product_company', 'software_agency', 'enterprise', 'job_board', 'recruiter', 'investor', 'training', 'media', 'directory', 'other'];

export function cleanExtraction(data) {
  const d = data && typeof data === 'object' ? data : {};
  return {
    companyName: s(d.company_name, 200),
    companyType: TYPES.includes(String(d.company_type ?? '').toLowerCase().trim()) ? String(d.company_type).toLowerCase().trim() : null,
    summary: s(d.summary, 600),
    industry: s(d.industry, 100),
    city: s(d.city, 80),
    country: s(d.country, 80),
    companySize: s(d.company_size, 40),
    fundingStage: s(d.funding_stage, 40),
    facts: arr(d.facts).slice(0, 6).map((f) => ({
      category: s(f?.category, 20) ?? 'other', claim: s(f?.claim, 400), sourceUrl: s(f?.source_url, 500), quote: s(f?.quote, 600),
    })).filter((f) => f.claim && f.sourceUrl && f.quote),
    contacts: arr(d.contacts).slice(0, 5).map((c) => ({
      fullName: s(c?.full_name, 150), jobTitle: s(c?.job_title, 150), email: s(c?.email, 255)?.toLowerCase() ?? null,
      phone: s(c?.phone, 30), sourceUrl: s(c?.source_url, 500), quote: s(c?.quote, 600),
    })).filter((c) => (c.fullName || c.email || c.phone) && c.sourceUrl && c.quote),
  };
}

export async function extractCompany({ pages, role, tags }) {
  const body = pages.map((p) => `=== PAGE: ${p.url} ===\n${p.content.slice(0, 5000)}`).join('\n\n');
  const system =
    'You extract facts about a company from the text of its own website pages. Use ONLY the text provided. ' +
    'Never invent anything. Every quote must be copied exactly, character for character, from the page text, and be at least 25 characters long. ' +
    'If something is not in the text, use null or leave it out. Reply with JSON only.';
  const user =
    `We are researching companies that might hire junior ${role} graduates skilled in: ${tags.join(', ') || 'general software skills'}.\n\n` +
    `${body}\n\n` +
    'Return JSON in exactly this shape:\n' +
    '{"company_name": string|null, "company_type": "product_company|software_agency|enterprise|job_board|recruiter|investor|training|media|directory|other", "summary": "1-2 sentences on what the company does, in your own words", "industry": string|null, ' +
    '"city": string|null, "country": string|null, "company_size": string|null, "funding_stage": string|null, ' +
    '"facts": [{"category": "overview|funding|culture|hiring|other", "claim": string, "source_url": "one of the PAGE urls above", "quote": "exact text from that page"}], ' +
    '"contacts": [{"full_name": string|null, "job_title": string|null, "email": string|null, "phone": string|null, "source_url": "one of the PAGE urls above", "quote": "exact text from that page where this person or contact appears"}]}\n' +
    'company_type says what kind of organisation owns this website. job_board means it lists jobs or matches candidates with OTHER companies; recruiter means a recruitment or staffing agency; investor means a fund. ' +
    'Give at most 5 facts and 3 contacts. Only list a contact if a real person or email is written in the text.';
  const { data } = await chatJSON({ system, user, tier: 'fast', maxTokens: 2500 });
  return cleanExtraction(data);
}
