const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'lore.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS lore_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  tags TEXT DEFAULT '',
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT CHECK(role IN ('user', 'narrator')) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
`);

const seedCount = db.prepare('SELECT COUNT(*) AS count FROM lore_entries').get().count;
if (seedCount === 0) {
  const seed = db.prepare(`
    INSERT INTO lore_entries (title, tags, summary, body)
    VALUES (@title, @tags, @summary, @body)
  `);
  seed.run({
    title: 'Forêt de Lune',
    tags: 'nature,anciennes-runes',
    summary: 'Une forêt hantée par des ruines scintillantes, sensible aux vœux formulés en silence.',
    body: 'Les arbres de la Forêt de Lune contiennent des éclats de rune. Le narrateur peut rappeler que les vœux murmurés y prennent forme durant la pleine lune.'
  });
  seed.run({
    title: 'Ordre du Verseau',
    tags: 'ordre,magie,eau',
    summary: 'Une guilde semi-clandestine qui parle en énigmes aquatiques.',
    body: 'L\'Ordre du Verseau recrute des voyageurs qui ont échappé à la noyade. Ils donnent des indices sous forme de métaphores marines.'
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const selectLore = db.prepare(`
  SELECT id, title, tags, summary, body
  FROM lore_entries
  WHERE title LIKE @q OR tags LIKE @q OR body LIKE @q OR summary LIKE @q
  ORDER BY created_at DESC
  LIMIT 5
`);

app.get('/api/lore', (_req, res) => {
  const rows = db.prepare('SELECT id, title, tags, summary, created_at FROM lore_entries ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows);
});

app.post('/api/lore', (req, res) => {
  const { title, tags = '', summary, body } = req.body || {};
  if (!title || !summary || !body) {
    return res.status(400).json({ error: 'title, summary et body sont requis.' });
  }
  const stmt = db.prepare('INSERT INTO lore_entries (title, tags, summary, body) VALUES (?, ?, ?, ?)');
  const info = stmt.run(title, tags, summary, body);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.post('/api/message', (req, res) => {
  const { content, conversationId } = req.body || {};
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'message manquant.' });
  }

  const convId = Number.isInteger(conversationId)
    ? conversationId
    : db.prepare('INSERT INTO conversations (title) VALUES (?)').run('Partie rapide').lastInsertRowid;

  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(convId, 'user', content);

  const matches = selectLore.all({ q: `%${content}%` });
  const hints = matches.map((row, idx) => `${idx + 1}. ${row.title} (${row.tags || 'sans tags'}) - ${row.summary}`).join('\n');
  const responseText = matches.length
    ? `Le narrateur consulte tes notes:\n${hints}\n\nRéponse roleplay: ${craftNarration(content, matches)}`
    : `Le narrateur improvise faute d'indices:\n${craftNarration(content, [])}`;

  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(convId, 'narrator', responseText);

  res.json({
    conversationId: convId,
    response: responseText,
    loreUsed: matches
  });
});

function craftNarration(prompt, lore) {
  const base = prompt.trim().slice(0, 240);
  const hook = lore[0]?.title ? `en gardant à l'esprit ${lore[0].title}` : 'en s\'appuyant sur son instinct';
  return `Le narrateur répond ${hook}: "${base || '...' }".`;
}

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
