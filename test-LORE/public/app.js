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
      alert(err.error || "Impossible d'ajouter cette entree.");
      return;
    }
    loreForm.reset();
    loadLore();
  } catch (err) {
    console.error(err);
    alert("Erreur reseau lors de l'ajout.");
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
      alert(payload.error || 'Erreur cote serveur.');
      return;
    }
    conversationId = payload.conversationId;
    appendBubble('narrator', payload.response);
    updateTokenUsage(payload.tokenUsage);
  } catch (err) {
    console.error(err);
    appendBubble('narrator', 'Erreur reseau: je suis momentanement muet.');
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
      loreListEl.innerHTML = '<li class="meta">Aucune entree (les seeds se creent au premier lancement).</li>';
      return;
    }
    loreListEl.innerHTML = data
      .map((item) => {
        const date = new Date(item.created_at).toLocaleString('fr-FR');
        return `
        <li class="lore-card" data-id="${item.id}">
          <button class="lore-toggle" type="button">
            <div class="lore-head">
              <p class="title">${item.title}</p>
              <p class="meta">Tags: ${item.tags || '-'} · ${date}</p>
            </div>
            <span class="chevron">▼</span>
          </button>
          <div class="lore-content" hidden>
            <p>${item.summary || ''}</p>
          </div>
        </li>`;
      })
      .join('');
    bindLoreToggles();
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

function bindLoreToggles() {
  const toggles = loreListEl.querySelectorAll('.lore-toggle');
  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.lore-card');
      const content = card?.querySelector('.lore-content');
      const chevron = btn.querySelector('.chevron');
      if (!content) return;
      const isOpen = !content.hidden;
      content.hidden = isOpen;
      card?.classList.toggle('open', !isOpen);
      if (chevron) chevron.textContent = isOpen ? '▼' : '▲';
    });
  });
}

function updateTokenUsage(tokenUsage) {
  const lastEl = document.getElementById('token-last');
  const totalEl = document.getElementById('token-total');
  if (!lastEl || !totalEl || !tokenUsage) return;
  const last = tokenUsage.last;
  const total = tokenUsage.total;
  lastEl.textContent = last
    ? `in ${last.prompt || 0} · out ${last.completion || 0} · total ${last.total || 0}`
    : '-';
  totalEl.textContent = total
    ? `in ${total.prompt || 0} · out ${total.completion || 0} · total ${total.total || 0}`
    : '-';
}
