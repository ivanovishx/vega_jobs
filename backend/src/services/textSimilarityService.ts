// Lexical text similarity (TF-IDF + cosine).
//
// This is the "content" signal of the matcher: it compares the full text of a
// candidate (resume + skills + target roles) against the full text of a job
// (title + skills + requirements + description). Because it uses every word —
// weighted by how distinctive it is across the whole job corpus — it still
// produces a meaningful match for jobs where the skill dictionary found nothing.

// Common words that carry no matching signal. Kept deliberately broad; rare,
// distinctive words are exactly what we want to survive.
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were',
  'have', 'has', 'had', 'will', 'would', 'should', 'can', 'could', 'you', 'your',
  'our', 'their', 'they', 'them', 'her', 'his', 'its', 'not', 'but', 'all', 'any',
  'who', 'what', 'when', 'where', 'why', 'how', 'which', 'into', 'out', 'over',
  'about', 'more', 'most', 'some', 'such', 'than', 'too', 'very', 'just', 'now',
  'also', 'been', 'being', 'get', 'got', 'may', 'might', 'must', 'shall',
  'work', 'working', 'team', 'teams', 'role', 'job', 'jobs', 'position', 'company',
  'experience', 'years', 'year', 'including', 'across', 'within', 'using', 'able',
  'strong', 'good', 'great', 'help', 'looking', 'join', 'well', 'new', 'other',
]);

// Split text into meaningful lowercase tokens. Keeps `+` and `#` (c++, c#).
// Pure-number tokens ("2026", dates, counts) are dropped — they add noise to
// the similarity (a job and a resume "matching" on the year 2026 means nothing).
export function tokenize(text: string): string[] {
  const matches = (text || '').toLowerCase().match(/[a-z0-9+#]+/g);
  if (!matches) return [];
  return matches.filter(t => t.length >= 2 && !/^[0-9]+$/.test(t) && !STOP_WORDS.has(t));
}

// Inverse document frequency over a corpus of tokenized documents. Rare terms
// get a high weight; terms present in every document approach zero.
export function buildIdf(docs: string[][]): Map<string, number> {
  const n = docs.length;
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    // Smoothed idf so nothing is exactly zero and unseen terms have a bound.
    idf.set(term, Math.log((n + 1) / (freq + 1)) + 1);
  }
  return idf;
}

// Default idf for a query term the corpus never saw — treat it as maximally rare.
function defaultIdf(corpusSize: number): number {
  return Math.log(corpusSize + 1) + 1;
}

// Build a sparse tf-idf vector (term -> weight) from tokens.
function tfIdfVector(tokens: string[], idf: Map<string, number>, corpusSize: number): Map<string, number> {
  const vec = new Map<string, number>();
  if (tokens.length === 0) return vec;
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [term, count] of counts) {
    const tf = count / tokens.length;
    vec.set(term, tf * (idf.get(term) ?? defaultIdf(corpusSize)));
  }
  return vec;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [, w] of a) normA += w * w;
  for (const [, w] of b) normB += w * w;
  if (normA === 0 || normB === 0) return 0;
  // Iterate the smaller vector for the dot product.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, w] of small) {
    const w2 = large.get(term);
    if (w2) dot += w * w2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const textSimilarityService = {
  buildIdf,
  tokenize,

  // Precompute the query (candidate) vector once, then score many documents
  // against it cheaply.
  makeScorer(queryTokens: string[], idf: Map<string, number>, corpusSize: number) {
    const queryVec = tfIdfVector(queryTokens, idf, corpusSize);
    return (docTokens: string[]): number => {
      if (queryVec.size === 0 || docTokens.length === 0) return 0;
      const docVec = tfIdfVector(docTokens, idf, corpusSize);
      return cosine(queryVec, docVec);
    };
  },
};
