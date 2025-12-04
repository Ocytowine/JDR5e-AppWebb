const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const WIKI_ROOT = path.join(__dirname, '..', '..', 'wiki');
const DB_PATH = path.join(__dirname, '..', 'data', 'lore.db');

const db = new Database(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS wiki_entries (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  body TEXT DEFAULT '',
  meta TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const insert = db.prepare(`
INSERT OR REPLACE INTO wiki_entries (id, path, title, category, summary, body, meta)
VALUES (@id, @path, @title, @category, @summary, @body, @meta)
`);

const files = walk(WIKI_ROOT);
files.forEach((file) => {
  const parsed = parseFile(file);
  const relativePath = path.relative(WIKI_ROOT, file).replace(/\\/g, '/');
  const id = parsed.meta.id || path.parse(file).name;
  const title = parsed.meta.nom || parsed.meta.title || id;
  const summary = parsed.meta['description courte'] || parsed.meta.summary || '';
  const body = parsed.meta['description longue'] || parsed.meta.description || parsed.body;

  const cleanedMeta = { ...parsed.meta };
  delete cleanedMeta.id;
  delete cleanedMeta.nom;
  delete cleanedMeta.title;
  delete cleanedMeta['description courte'];
  delete cleanedMeta.summary;
  delete cleanedMeta['description longue'];
  delete cleanedMeta.description;

  insert.run({
    id,
    path: relativePath,
    title,
    category: path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath),
    summary,
    body,
    meta: JSON.stringify(cleanedMeta)
  });

  console.log(`Importe ${relativePath} -> ${id}`);
});

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function parseFile(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const meta = {};
  const body = [];

  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > -1) {
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      meta[key] = value;
    } else if (line.trim()) {
      body.push(line.trim());
    }
  }

  return { meta, body: body.join('\n') };
}
