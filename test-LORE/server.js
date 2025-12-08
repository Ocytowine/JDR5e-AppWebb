require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const Database = require('better-sqlite3');
const OpenAI = require('openai');
const { wikiTagSearch } = require('./wikiTag');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'lore.db');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const tokenTotals = { prompt: 0, completion: 0, total: 0 };

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
    title: 'Foret de Lune',
    tags: 'nature,anciennes-runes',
    summary: 'Une foret parsemee de ruines scintillantes, sensible aux voeux formules en silence.',
    body: 'Les arbres de la Foret de Lune contiennent des eclats de rune. Le narrateur peut rappeler que les voeux murmures y prennent forme durant la pleine lune.'
  });
  seed.run({
    title: 'Ordre du Verseau',
    tags: 'ordre,magie,eau',
    summary: 'Une guilde semi-clandestine qui parle en enigmes aquatiques.',
    body: "L'Ordre du Verseau recrute des voyageurs qui ont echappe a la noyade. Ils donnent des indices sous forme de metaphores marines."
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.post('/api/message', async (req, res) => {
  const { content, conversationId } = req.body || {};
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'message manquant.' });
  }

  const convId = Number.isInteger(conversationId)
    ? conversationId
    : db.prepare('INSERT INTO conversations (title) VALUES (?)').run('Partie rapide').lastInsertRowid;

  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(convId, 'user', content);

  const rows = db.prepare('SELECT id, title, tags, summary, body FROM lore_entries ORDER BY created_at DESC').all();
  const matches = wikiTagSearch(content, rows, 5);
  const hints = matches.map((row, idx) => `${idx + 1}. ${row.title}`).join(', ');
  const loreContext = matches
    .map(
      (row, idx) =>
        `#${idx + 1} ${row.title}\nTags: ${row.tags || '-'}\nResume: ${shorten(row.summary, 220)}\nNote: ${shorten(row.body, 280)}`
    )
    .join('\n\n');

  let narratorReply = null;
  let lastUsage = null;
  if (openai) {
    try {
      const history = loadHistory(convId);
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.7,
        max_completion_tokens: 400,
        messages: buildChatMessages(content, loreContext, history)
      });
      narratorReply = completion.choices?.[0]?.message?.content?.trim();
      if (completion.usage) {
        lastUsage = {
          prompt: completion.usage.prompt_tokens || 0,
          completion: completion.usage.completion_tokens || 0,
          total: completion.usage.total_tokens || 0
        };
        tokenTotals.prompt += lastUsage.prompt;
        tokenTotals.completion += lastUsage.completion;
        tokenTotals.total += lastUsage.total;
      }
    } catch (err) {
      console.error('OpenAI error', err);
      narratorReply = null;
    }
  }

  const safeNarration = narratorReply || craftNarration(content, matches);
  const responseText = matches.length
    ? `Le narrateur s'inspire de: ${hints}\n\n${safeNarration}`
    : `Le narrateur improvise faute d'indices:\n${safeNarration}`;

  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(convId, 'narrator', responseText);

  res.json({
    conversationId: convId,
    response: responseText,
    loreUsed: matches,
    tokenUsage: {
      last: lastUsage,
      total: tokenTotals
    }
  });
});

function craftNarration(prompt, lore) {
  const base = prompt.trim().slice(0, 240);
  const hook = lore[0]?.title ? `en gardant a l'esprit ${lore[0].title}` : "en s'appuyant sur son instinct";
  return `Le narrateur repond ${hook}: "${base || '...'}".`;
}

function loadHistory(conversationId) {
  const rows = db
    .prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20')
    .all(conversationId);
  return rows.map((row) => ({
    role: row.role === 'narrator' ? 'assistant' : 'user',
    content: row.content
  }));
}

function buildChatMessages(prompt, loreContext, history) {
  const baseSystem = {
    role: 'system',
    content:
      "Tu es un narrateur de JDR francophone. Reponds en 3 a 6 phrases, ton immersif, dynamique. Ne recopie pas les notes; reformule-les en fil narratif, suggere des pistes d'action et des impressions sensorielles. Pas de listes, pas de citations brutes, pas de copier-coller. Si des details manquent, improvise de maniere coherente."
  };

  const loreBlock = loreContext
    ? {
        role: 'system',
        content: `Lore disponible:\n${loreContext}`
      }
    : null;

  return [
    baseSystem,
    ...(loreBlock ? [loreBlock] : []),
    ...history,
    { role: 'user', content: prompt }
  ];
}

function shorten(text, max = 240) {
  if (!text) return '';
  const t = text.toString().trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}...`;
}

app.listen(PORT, () => {
  console.log(`Serveur lance sur http://localhost:${PORT}`);
});
