// Turns a batch (role family + skills + project domains) into web searches that look for COMPANIES,
// not job listings. Job-related words attract job boards, so most queries describe what a company does.
import { roleFamilyFrom } from '../tags.mjs';

const TECH_LABEL = {
  nodejs: 'Node.js', nextjs: 'Next.js', postgresql: 'PostgreSQL', mongodb: 'MongoDB', mysql: 'MySQL',
  'html-css': 'HTML CSS', 'react-native': 'React Native', 'machine-learning': 'machine learning',
  'deep-learning': 'deep learning', 'data-analysis': 'data analysis', 'pandas-numpy': 'Python data',
  'bi-tools': 'Power BI', 'rest-api': 'REST API', 'ui-ux': 'UI UX', dotnet: '.NET', cicd: 'CI/CD',
  iot: 'IoT', aws: 'AWS', sql: 'SQL', php: 'PHP', 'spring-boot': 'Spring Boot', fastapi: 'FastAPI',
  'computer-vision': 'computer vision', 'graphic-design': 'graphic design', 'embedded-iot': 'embedded',
};
export const humanTag = (tag) => TECH_LABEL[tag] ?? tag.replace(/-/g, ' ');

// What a company that needs this kind of graduate typically builds
const BUILDS = {
  frontend: 'web applications and websites', backend: 'backend systems and APIs', fullstack: 'web and mobile products',
  'data-ai': 'data and AI products', mobile: 'mobile apps', design: 'digital products with an in-house design team',
  devops: 'cloud infrastructure and software', 'security-networking': 'cybersecurity and network services',
  'embedded-iot': 'hardware and IoT products', product: 'software products', qa: 'software products', other: 'software products',
};

const DOMAIN_WORD = {
  fintech: 'fintech', health: 'healthtech', education: 'edtech', agriculture: 'agritech', ecommerce: 'e-commerce',
  logistics: 'logistics', security: 'cybersecurity', iot: 'IoT', 'ai-ml': 'AI', civic: 'civic tech',
  'real-estate': 'proptech', media: 'media', 'hr-jobs': 'HR tech',
};

/**
 * Returns [{ kind: 'local'|'international', mode: 'company'|'web', q }]
 * mode 'company' uses Exa's company search; 'web' is an ordinary web search.
 */
export function buildQueries(batch, domainTags = [], { max = 6 } = {}) {
  const family = roleFamilyFrom(batch.role_family);
  const builds = BUILDS[family] ?? BUILDS.other;
  const [t1, t2] = (batch.defining_tags ?? []).slice(0, 2).map(humanTag);
  const skills = [t1, t2].filter(Boolean).join(' ');
  const d = domainTags[0] ? DOMAIN_WORD[domainTags[0]] ?? domainTags[0] : null;

  const queries = [
    { kind: 'local', mode: 'company', q: `software company in Lagos Nigeria building ${builds}` },
    { kind: 'international', mode: 'company', q: `remote-first software company with an engineering team in Africa using ${skills || 'modern web technology'}`.trim() },
    d
      ? { kind: 'local', mode: 'company', q: `${d} startup in Nigeria with an in-house engineering team` }
      : { kind: 'local', mode: 'company', q: `technology startup in Abuja Nigeria with an in-house engineering team${t1 ? ` using ${t1}` : ''}` },
    d
      ? { kind: 'international', mode: 'company', q: `${d} company with a distributed engineering team using ${t1 ?? 'modern software tools'}` }
      : { kind: 'international', mode: 'company', q: `software product company with a distributed engineering team using ${t1 ?? 'modern software tools'}` },
    { kind: 'local', mode: 'web', q: `software companies in Lagos Nigeria ${skills} about us engineering team`.trim() },
    { kind: 'international', mode: 'web', q: `software startup hiring developers in Africa ${skills} about us`.trim() },
  ];
  return queries.slice(0, Math.max(1, max));
}
