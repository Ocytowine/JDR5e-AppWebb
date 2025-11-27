const loreListEl = document.getElementById('lore-list');
const loreForm = document.getElementById('lore-form');
const refreshLoreBtn = document.getElementById('refresh-lore');
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const resetConvBtn = document.getElementById('reset-conv');

let conversationId = null;

loadLore();

loreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(loreForm).entries());
  try {
    const res = await fetch('/api/lore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Impossible d\'ajouter cette entrée.');
      return;
    }
    loreForm.reset();
    loadLore();
  } catch (err) {
    console.error(err);
    alert('Erreur réseau lors de l\'ajout.');
  }
});

refreshLoreBtn.addEventListener('click', loadLore);

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = chatInput.value.trim();
  if (!content) return;
  appendBubble('user', content);
  chatInput.value = '';
  try {
    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, conversationId })
    });
    const payload = await res.json();
    if (!res.ok) {
      alert(payload.error || 'Erreur côté serveur.');
      return;
    }
    conversationId = payload.conversationId;
    appendBubble('narrator', payload.response);
  } catch (err) {
    console.error(err);
    appendBubble('narrator', 'Erreur réseau: je suis momentanément muet.');
  }
});

resetConvBtn.addEventListener('click', () => {
  conversationId = null;
  chatLog.innerHTML = '';
});

async function loadLore() {
  loreListEl.innerHTML = '<li class="meta">Chargement...</li>';
  try {
    const res = await fetch('/api/lore');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('format inattendu');
    if (data.length === 0) {
      loreListEl.innerHTML = '<li class="meta">Aucune entrée (les seeds se créent au premier lancement).</li>';
      return;
    }
    loreListEl.innerHTML = data.map(item => `
      <li>
        <p class="title">${item.title}</p>
        <p class="meta">Tags: ${item.tags || '—'} · ${new Date(item.created_at).toLocaleString('fr-FR')}</p>
        <p>${item.summary}</p>
      </li>
    `).join('');
  } catch (err) {
    console.error(err);
    loreListEl.innerHTML = '<li class="meta" style="color: var(--danger);">Impossible de charger la base.</li>';
  }
}

function appendBubble(role, text) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}
