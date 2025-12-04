/**
 * Importe les fichiers de lore (wiki/lore) dans la table lore_entries de l'app test-LORE.
 * - Parse le frontmatter YAML + corps markdown (via gray-matter)
 * - Construit tags à partir du type, id, liens (territoire, region, ville, factions, mots_cles)
 * - Crée/actualise lore_entries (remplace si même titre)
 *
 * Exécution : node scripts/import-wiki.js
 */

const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');
const Database = require('better-sqlite3');

const WIKI_ROOT = path.join(__dirname, '..', '..', 'wiki', 'lore');
const DB_PATH = path.join(__dirname, '..', 'data', 'lore.db');

const db = new Database(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS lore_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  tags TEXT DEFAULT '',
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const insertLore = db.prepare(`
  INSERT INTO lore_entries (title, tags, summary, body)
  VALUES (@title, @tags, @summary, @body)
`);
const deleteLoreByTitle = db.prepare('DELETE FROM lore_entries WHERE title = ?');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('_')) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function normalizeValue(value) {
  if (typeof value === 'string') return value.trim();
  return value;
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function toTags(meta) {
  const tags = new Set();
  const add = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item && typeof item === 'object') {
          Object.values(item).forEach(add);
        } else {
          add(item);
        }
      });
      return;
    }
    if (v && typeof v === 'object') {
      Object.values(v).forEach(add);
      return;
    }
    tags.add(String(v).trim());
  };

  add(meta.type);
  add(meta.id);
  add(meta.portee);
  add(meta.territoire || meta.territory);
  add(meta.region);
  add(meta.ville);
  add(meta.royaume);
  add(meta.autorite_locale);
  add(meta.siege_pouvoir);
  add(meta.type_region || meta.type_ville || meta.type_batiment);
  add(meta.role_principal);
  add(meta.factions_presentes);
  add(meta.factions_actives);
  add(meta.factions);
  add(meta.mots_cles || meta.motscles || meta.motscles || meta.mots_cles);
  add(meta.lieux_remarquables);
  add(meta.villes_principales);
  add(meta.batiments_importants);
  add(meta.axes_fondamentaux);

  return Array.from(tags).filter(Boolean).join(',');
}

function buildSummary(meta, content) {
  const fromMeta =
    meta.summary ||
    meta.resume ||
    meta['description courte'] ||
    meta['description_courte'] ||
    meta['description_courte'];
  if (fromMeta && String(fromMeta).trim()) return String(fromMeta).trim().slice(0, 280);

  const paragraph = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .find((p) => p.length > 0);
  return (paragraph || 'Résumé manquant.').slice(0, 280);
}

function buildBody(title, meta, content) {
  const lines = [];
  lines.push(`Titre: ${title}`);
  if (meta.type) lines.push(`Type: ${meta.type}`);
  const metaKeys = Object.keys(meta).filter((k) => !['nom', 'title', 'id'].includes(k));
  if (metaKeys.length) {
    lines.push('Meta:');
    metaKeys.forEach((k) => {
      const v = meta[k];
      if (Array.isArray(v)) {
        lines.push(`- ${k}: ${v.join(', ')}`);
      } else if (v && typeof v === 'object') {
        lines.push(`- ${k}: ${JSON.stringify(v)}`);
      } else if (v !== undefined) {
        lines.push(`- ${k}: ${v}`);
      }
    });
  }
  if (content.trim()) {
    lines.push('');
    lines.push(content.trim());
  }
  return lines.join('\n');
}

function parseLoreFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const meta = {};
  Object.entries(parsed.data || {}).forEach(([k, v]) => {
    const key = k
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    meta[key] = normalizeValue(v);
  });
  const content = parsed.content || '';
  const slug = slugify(meta.id || path.parse(filePath).name);
  const title = meta.nom || meta.title || slug;
  const tags = toTags(meta);
  const summary = buildSummary(meta, content);
  const body = buildBody(title, meta, content);

  return { title, tags, summary, body };
}

function main() {
  const files = walk(WIKI_ROOT);
  let inserted = 0;
  files.forEach((file) => {
    const rel = path.relative(WIKI_ROOT, file).replace(/\\/g, '/');
    const lore = parseLoreFile(file);
    deleteLoreByTitle.run(lore.title);
    insertLore.run(lore);
    inserted += 1;
    console.log(`Import: ${rel} -> ${lore.title}`);
  });
  console.log(`Termine. ${inserted} entree(s) inserees dans lore_entries.`);
}

main();
