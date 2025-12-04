// wikiTag.js
// Petit moteur de recherche lore (tokenisation + pondération) isolé du serveur.

function wikiTagSearch(query, rows, limit = 5) {
  const tokens = tokenize(query);
  if (!tokens.length || !Array.isArray(rows) || rows.length === 0) return [];

  const docCount = rows.length;
  const df = {};
  const prepared = rows.map((row) => {
    const tTitle = tokenize(row.title);
    const tTags = tokenize(row.tags || '');
    const tSummary = tokenize(row.summary || '');
    const tBody = tokenize(row.body || '');
    const docTerms = new Set([...tTitle, ...tTags, ...tSummary, ...tBody]);
    docTerms.forEach((term) => {
      df[term] = (df[term] || 0) + 1;
    });
    return { row, tTitle, tTags, tSummary, tBody };
  });

  const scored = prepared.map(({ row, tTitle, tTags, tSummary, tBody }) => {
    let score = 0;
    tokens.forEach((term) => {
      const idf = Math.log((docCount + 1) / ((df[term] || 0) + 1)) + 1;
      score += termFrequency(tTitle, term) * 3 * idf;
      score += termFrequency(tTags, term) * 2 * idf;
      score += termFrequency(tSummary, term) * 1.5 * idf;
      score += termFrequency(tBody, term) * 1 * idf;
    });
    return { score, row };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.row);
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toString()
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t && t.length > 2 && !STOPWORDS.has(t));
}

function termFrequency(list, term) {
  let count = 0;
  for (const t of list) if (t === term) count += 1;
  return count;
}

const STOPWORDS = new Set([
  'le',
  'la',
  'les',
  'de',
  'des',
  'du',
  'un',
  'une',
  'et',
  'ou',
  'aux',
  'pour',
  'dans',
  'avec',
  'sur',
  'par',
  'que',
  'qui',
  'quoi',
  'dont',
  'est',
  'sont',
  'au',
  'en',
  'se',
  'sa',
  'son',
  'ses',
  'leurs',
  'leur',
  'ce',
  'cet',
  'cette',
  'ces',
  'mais',
  'plus',
  'tout',
  'tous',
  'toute',
  'comme'
]);

module.exports = {
  wikiTagSearch,
  tokenize,
  termFrequency,
  STOPWORDS
};
