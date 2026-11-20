// Turns a student's raw answers into clean tags for batching and matching.
// Pure functions only (no database, no network), so they are easy to test and tweak.

// Canonical tag for every chip on the form, plus common ways students type the same thing.
const ALIASES = {
  javascript: ['javascript', 'js', 'java script', 'ecmascript', 'es6'],
  typescript: ['typescript', 'ts'],
  react: ['react', 'reactjs', 'react.js', 'react js'],
  nextjs: ['next.js', 'nextjs', 'next js', 'next'],
  vue: ['vue', 'vuejs', 'vue.js'],
  'html-css': ['html/css', 'html', 'css', 'html5', 'css3', 'html css', 'html & css'],
  tailwind: ['tailwind css', 'tailwind', 'tailwindcss'],
  bootstrap: ['bootstrap'],
  nodejs: ['node.js', 'nodejs', 'node', 'node js'],
  express: ['express', 'expressjs', 'express.js'],
  python: ['python', 'py', 'python3'],
  django: ['django'],
  flask: ['flask'],
  fastapi: ['fastapi', 'fast api'],
  java: ['java'],
  'spring-boot': ['spring boot', 'springboot', 'spring'],
  dotnet: ['c#/.net', 'c#', 'csharp', '.net', 'dotnet', 'asp.net', 'asp.net core'],
  php: ['php'],
  laravel: ['laravel'],
  go: ['go', 'golang'],
  cpp: ['c++', 'cpp'],
  c: ['c'],
  sql: ['sql'],
  postgresql: ['postgresql', 'postgres', 'postgre', 'psql'],
  mysql: ['mysql'],
  mongodb: ['mongodb', 'mongo', 'mongo db'],
  firebase: ['firebase'],
  flutter: ['flutter', 'dart'],
  'react-native': ['react native', 'react-native'],
  kotlin: ['kotlin'],
  swift: ['swift'],
  android: ['android', 'android studio'],
  'machine-learning': ['machine learning', 'ml'],
  'deep-learning': ['deep learning', 'dl', 'tensorflow', 'pytorch', 'keras', 'neural network', 'neural networks'],
  'computer-vision': ['computer vision', 'opencv', 'image processing'],
  nlp: ['nlp', 'natural language processing'],
  'data-analysis': ['data analysis', 'data analytics', 'analytics', 'data science'],
  'pandas-numpy': ['pandas/numpy', 'pandas', 'numpy', 'scikit-learn', 'sklearn'],
  'bi-tools': ['power bi/tableau', 'power bi', 'powerbi', 'tableau', 'looker'],
  excel: ['excel', 'ms excel', 'microsoft excel', 'spreadsheets'],
  ai: ['ai', 'artificial intelligence'],
  docker: ['docker', 'containers'],
  aws: ['aws', 'amazon web services', 'ec2', 's3'],
  linux: ['linux', 'ubuntu', 'bash'],
  git: ['git/github', 'git', 'github', 'gitlab'],
  networking: ['networking', 'computer networks', 'cisco', 'tcp/ip'],
  cybersecurity: ['cybersecurity', 'cyber security', 'security', 'ethical hacking', 'penetration testing', 'authentication'],
  cicd: ['ci/cd', 'cicd', 'devops', 'github actions', 'jenkins'],
  'rest-api': ['rest apis', 'rest api', 'rest', 'restful api', 'restful apis', 'api', 'apis', 'graphql'],
  iot: ['embedded/iot', 'embedded', 'iot', 'arduino', 'raspberry pi', 'esp32', 'microcontroller'],
  'ui-ux': ['ui/ux design', 'ui/ux', 'ui', 'ux', 'ui ux', 'user interface', 'user experience'],
  figma: ['figma'],
  'graphic-design': ['graphic design', 'photoshop', 'illustrator', 'canva'],
  wordpress: ['wordpress'],
};

const LOOKUP = new Map();
for (const [tag, variants] of Object.entries(ALIASES)) for (const v of variants) LOOKUP.set(v, tag);

const clean = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** "React, reactjs, Node.js, UI/UX Design" -> ['react', 'nodejs', 'ui-ux'] (unique, in order). */
export function normalizeSkills(input) {
  const parts = Array.isArray(input) ? input : String(input ?? '').split(/[,;\n|]+/);
  const out = [];
  for (const raw of parts) {
    const word = clean(raw);
    if (word.length < 1 || word.length > 40) continue;
    const tag = LOOKUP.get(word) ?? (word.length >= 2 ? word.replace(/[^a-z0-9+#.]+/g, '-').replace(/^-+|-+$/g, '') : null);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

// First matching rule wins, so order matters.
const ROLE_RULES = [
  ['fullstack', /full[\s-]?stack/],
  ['mobile', /mobile|android|ios|flutter|react native/],
  ['data-ai', /data|machine learning|\bml\b|\bai\b|artificial|analyst|analytics|deep learning|nlp|vision/],
  ['security-networking', /security|cyber|network|penetration|infosec/],
  ['devops', /devops|cloud|infrastructure|sysadmin|site reliability|\bsre\b/],
  ['design', /design|ui\/?ux|\bux\b|\bui\b|figma/],
  ['frontend', /front[\s-]?end|react|web developer|web dev|html|css/],
  ['backend', /back[\s-]?end|server|api|database|\bdba\b/],
  ['embedded-iot', /embedded|iot|hardware|arduino/],
  ['product', /project manager|product|\bpm\b|business analyst|scrum/],
  ['qa', /\bqa\b|tester|testing|quality/],
];

export function roleFamilyFrom(roleText) {
  const r = clean(roleText);
  for (const [family, re] of ROLE_RULES) if (re.test(r)) return family;
  return 'other';
}

const DOMAIN_RULES = [
  ['fintech', /payment|bank|loan|wallet|financ|fintech|invest|insurance|accounting|invoice|budget|savings/],
  ['health', /health|hospital|patient|medical|clinic|pharmac|disease|diagnos|telemedicine|skin/],
  ['education', /school|student|learning|exam|education|e-learning|classroom|course|tutor|lecture|attendance/],
  ['agriculture', /farm|crop|agric|livestock|soil|harvest/],
  ['ecommerce', /e-?commerce|shop|store|marketplace|retail|inventory|\bsales\b|order/],
  ['logistics', /logistic|delivery|dispatch|transport|tracking|fleet|ride|parking|traffic/],
  ['security', /authenticat|security|encrypt|intrusion|fraud|biometric|access control|firewall/],
  ['iot', /\biot\b|sensor|arduino|smart home|embedded|raspberry/],
  ['ai-ml', /machine learning|\bai\b|artificial|predict|chatbot|nlp|recogni|detection|classif/],
  ['civic', /election|voting|governance|government|civic|census|tax|public service/],
  ['real-estate', /rent|housing|property|real estate|landlord|tenant/],
  ['media', /music|video|stream|news|blog|podcast|social media|chat app|messaging/],
  ['hr-jobs', /recruit|\bjob\b|\bjobs\b|career|hiring|payroll|employee/],
];

export function domainTagsFrom(projectTitle) {
  const t = clean(projectTitle);
  return DOMAIN_RULES.filter(([, re]) => re.test(t)).map(([tag]) => tag);
}

/** Everything the pipeline needs about one student, from their raw form answers. */
export function buildStudentTags({ roleInProject, skills, projectTitle }) {
  return {
    roleFamily: roleFamilyFrom(roleInProject),
    techTags: normalizeSkills(skills),
    domainTags: domainTagsFrom(projectTitle),
    projectSummary: projectTitle ? String(projectTitle).slice(0, 200) : null,
  };
}

export const KNOWN_TAGS = Object.keys(ALIASES);

export const TAG_ALIASES = ALIASES;
