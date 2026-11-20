// Pure batching logic: no database, no network. Easy to test and to tune.
// Input: [{ id, roleFamily, techTags: [] }]  ->  Output: [{ name, roleFamily, definingTags, studentIds }]

export const FAMILY_LABEL = {
  frontend: 'Frontend', backend: 'Backend', fullstack: 'Full-stack', 'data-ai': 'Data & AI',
  mobile: 'Mobile', design: 'Design', devops: 'DevOps', 'security-networking': 'Security & Networking',
  'embedded-iot': 'Embedded & IoT', product: 'Product', qa: 'QA', other: 'Other', mixed: 'Mixed roles',
};

export function tagCounts(students) {
  const counts = new Map();
  for (const s of students) for (const t of new Set(s.techTags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function topTags(students, n = 5) {
  return tagCounts(students).slice(0, n).map(([tag]) => tag);
}

/** Tags shared by at least 30% of the batch (at least the top 3), most common first. */
export function definingTagsOf(students) {
  const counts = tagCounts(students);
  const shared = counts.filter(([, c]) => c / students.length >= 0.3).slice(0, 5).map(([t]) => t);
  return shared.length >= 3 ? shared : counts.slice(0, 3).map(([t]) => t);
}

/** Split a group larger than `max` by repeatedly carving out the students who share the most common tag. */
export function splitLarge(students, max) {
  const out = [];
  let rest = [...students].sort((a, b) => a.id - b.id);
  while (rest.length > max) {
    const top = topTags(rest, 5);
    if (top.length === 0) {                       // nobody has tags: plain chunks
      out.push(rest.slice(0, max));
      rest = rest.slice(max);
      continue;
    }
    const overlap = (s) => top.reduce((n, t) => n + (s.techTags.includes(t) ? 1 : 0), 0);
    const carriers = rest.filter((s) => s.techTags.includes(top[0])).sort((a, b) => overlap(b) - overlap(a) || a.id - b.id);
    const group = carriers.slice(0, max);
    const taken = new Set(group.map((s) => s.id));
    out.push(group);
    rest = rest.filter((s) => !taken.has(s.id));
  }
  if (rest.length) out.push(rest);
  return out;
}

/**
 * planBatches(students, { max = 30, min = 3 })
 * - one batch family per role family; big families are split by shared tags
 * - groups smaller than `min` are pooled into "Mixed roles" so nobody is left out
 */
export function planBatches(students, { max = 30, min = 3 } = {}) {
  const byFamily = new Map();
  for (const s of students) {
    const fam = s.roleFamily || 'other';
    if (!byFamily.has(fam)) byFamily.set(fam, []);
    byFamily.get(fam).push(s);
  }

  const batches = [];
  const mixedPool = [];
  const make = (family, group) => ({
    roleFamily: family,
    definingTags: definingTagsOf(group),
    studentIds: group.map((s) => s.id),
  });

  for (const [family, members] of [...byFamily.entries()].sort((a, b) => b[1].length - a[1].length)) {
    for (const group of members.length > max ? splitLarge(members, max) : [members]) {
      if (group.length < min) mixedPool.push(...group);
      else batches.push(make(family, group));
    }
  }
  if (mixedPool.length) {
    for (const group of mixedPool.length > max ? splitLarge(mixedPool, max) : [mixedPool]) {
      batches.push(make('mixed', group));
    }
  }

  // Readable, unique names, e.g. "Backend: nodejs, postgresql, express"
  const seen = new Map();
  for (const b of batches) {
    const base = b.roleFamily === 'mixed'
      ? FAMILY_LABEL.mixed
      : `${FAMILY_LABEL[b.roleFamily] ?? b.roleFamily}${b.definingTags.length ? ': ' + b.definingTags.slice(0, 3).join(', ') : ''}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    b.name = n === 1 ? base : `${base} (${n})`;
  }
  return batches;
}
