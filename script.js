/**
 * RSVP Matrimonio — Frontend Logic
 * ================================================
 * IMPORTANTE: sostituisci l'URL sotto con il TUO endpoint
 * Apps Script (Deploy > Nuova implementazione > copia URL).
 */
const API_URL = 'INCOLLA_QUI_URL_APPS_SCRIPT';

// ===== STATO =====
let currentNucleo = null; // dati del nucleo trovato
let currentMatch = null;  // persona matchata in fase di conferma

// ===== ELEMENTI =====
const screens = {
  search: document.getElementById('screen-search'),
  confirm: document.getElementById('screen-confirm'),
  already: document.getElementById('screen-already'),
  form: document.getElementById('screen-form'),
  success: document.getElementById('screen-success'),
};

const searchInput = document.getElementById('search-input');
const btnSearch = document.getElementById('btn-search');
const searchMessage = document.getElementById('search-message');
const confirmName = document.getElementById('confirm-name');
const btnConfirmYes = document.getElementById('btn-confirm-yes');
const btnConfirmNo = document.getElementById('btn-confirm-no');
const btnAlreadyBack = document.getElementById('btn-already-back');
const membersContainer = document.getElementById('members-container');
const btnSubmit = document.getElementById('btn-submit');
const submitMessage = document.getElementById('submit-message');

// ===== NAVIGAZIONE SCHERMATE =====
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ===== RICERCA =====
btnSearch.addEventListener('click', doSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') doSearch();
});

async function doSearch() {
  const query = searchInput.value.trim();
  hideMessage(searchMessage);

  if (query.length < 2) {
    showMessage(searchMessage, 'Inserisci almeno nome e cognome.', 'error');
    return;
  }

  setLoading(btnSearch, true, 'Cerca');

  try {
    const url = `${API_URL}?action=search&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.found) {
      showMessage(searchMessage, data.message || 'Nome non trovato.', 'error');
      setLoading(btnSearch, false, 'Cerca');
      return;
    }

    currentMatch = data;
    confirmName.textContent = `${data.matchedPerson.nome} ${data.matchedPerson.cognome}`;
    showScreen('confirm');

  } catch (err) {
    showMessage(searchMessage, 'Errore di connessione. Riprova.', 'error');
  }

  setLoading(btnSearch, false, 'Cerca');
}

// ===== CONFERMA MATCH =====
btnConfirmNo.addEventListener('click', () => {
  currentMatch = null;
  searchInput.value = '';
  showScreen('search');
});

btnConfirmYes.addEventListener('click', () => {
  if (!currentMatch) return;

  if (currentMatch.giaRisposto) {
    showScreen('already');
    return;
  }

  currentNucleo = currentMatch;
  renderMembersForm(currentNucleo.membri);
  showScreen('form');
});

btnAlreadyBack.addEventListener('click', () => {
  currentMatch = null;
  searchInput.value = '';
  showScreen('search');
});

// ===== RENDER FORM NUCLEO =====
function renderMembersForm(membri) {
  membersContainer.innerHTML = '';

  membri.forEach((m, idx) => {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.dataset.nome = m.nome;
    card.dataset.cognome = m.cognome;

    const badge = m.etaTipo === 'Bambino' ? '<span class="member-badge">Bambino</span>' : '';

    card.innerHTML = `
      <div class="member-name">${m.nome} ${m.cognome}${badge}</div>

      <div class="radio-group" data-field="presenza">
        <div class="radio-option" data-value="Sì">Presente</div>
        <div class="radio-option" data-value="No">Assente</div>
      </div>

      <div class="sub-field presenza-dependent conditional-hidden">
        <label>Intolleranze / allergie alimentari</label>
        <input type="text" class="text-input" data-field="intolleranze" placeholder="Nessuna, se non specificato">
      </div>

      ${m.necessitaHotel ? `
      <div class="sub-field presenza-dependent conditional-hidden">
        <label>Necessità di pernottamento</label>
        <div class="radio-group" data-field="pernottamento">
          <div class="radio-option" data-value="Sì">Sì</div>
          <div class="radio-option" data-value="No">No</div>
        </div>
      </div>
      ` : ''}

      <div class="sub-field presenza-dependent conditional-hidden">
        <label>Necessità di trasporto / informazioni su come arrivare</label>
        <div class="radio-group" data-field="trasporto">
          <div class="radio-option" data-value="Sì">Sì</div>
          <div class="radio-option" data-value="No">No</div>
        </div>
      </div>
    `;

    membersContainer.appendChild(card);
  });

  // Listener per i radio-group (presenza, pernottamento, trasporto)
  membersContainer.querySelectorAll('.radio-group').forEach(group => {
    group.addEventListener('click', (e) => {
      const option = e.target.closest('.radio-option');
      if (!option) return;

      // Deseleziona fratelli, seleziona questo
      group.querySelectorAll('.radio-option').forEach(o => {
        o.classList.remove('selected-yes', 'selected-no');
      });
      const value = option.dataset.value;
      option.classList.add(value === 'Sì' ? 'selected-yes' : 'selected-no');
      group.dataset.selected = value;

      // Se è il campo "presenza", mostra/nascondi i campi dipendenti
      if (group.dataset.field === 'presenza') {
        const card = group.closest('.member-card');
        const dependentFields = card.querySelectorAll('.presenza-dependent');
        dependentFields.forEach(f => {
          f.classList.toggle('conditional-hidden', value !== 'Sì');
        });
      }
    });
  });
}

// ===== SUBMIT =====
btnSubmit.addEventListener('click', doSubmit);

async function doSubmit() {
  hideMessage(submitMessage);

  const cards = membersContainer.querySelectorAll('.member-card');
  const risposte = [];
  let hasError = false;

  cards.forEach(card => {
    const presenzaGroup = card.querySelector('[data-field="presenza"]');
    const presenza = presenzaGroup.dataset.selected || '';

    if (!presenza) {
      hasError = true;
      presenzaGroup.style.outline = '2px solid var(--color-error)';
      return;
    }
    presenzaGroup.style.outline = 'none';

    const intolleranzeInput = card.querySelector('[data-field="intolleranze"]');
    const pernottamentoGroup = card.querySelector('[data-field="pernottamento"]');
    const trasportoGroup = card.querySelector('[data-field="trasporto"]');

    risposte.push({
      nome: card.dataset.nome,
      cognome: card.dataset.cognome,
      presenza: presenza,
      intolleranze: presenza === 'Sì' && intolleranzeInput ? intolleranzeInput.value.trim() : '',
      pernottamento: presenza === 'Sì' && pernottamentoGroup ? (pernottamentoGroup.dataset.selected || '') : '',
      trasporto: presenza === 'Sì' && trasportoGroup ? (trasportoGroup.dataset.selected || '') : ''
    });
  });

  if (hasError) {
    showMessage(submitMessage, 'Per favore indica la presenza per tutti i membri.', 'error');
    return;
  }

  setLoading(btnSubmit, true, 'Invia risposta');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // evita preflight CORS con Apps Script
      body: JSON.stringify({
        action: 'submit',
        nucleoId: currentNucleo.nucleoId,
        risposte: risposte
      })
    });
    const data = await res.json();

    if (data.success) {
      showScreen('success');
    } else {
      showMessage(submitMessage, data.message || 'Errore durante il salvataggio.', 'error');
    }
  } catch (err) {
    showMessage(submitMessage, 'Errore di connessione. Riprova.', 'error');
  }

  setLoading(btnSubmit, false, 'Invia risposta');
}

// ===== HELPERS =====
function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `message ${type}`;
}
function hideMessage(el) {
  el.textContent = '';
  el.className = 'message';
}
function setLoading(btn, loading, originalText) {
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="loader"></span>Attendere...` : originalText;
}

// ===== AUTO-RESIZE IFRAME (per embed in Canva) =====
function notifyHeight() {
  const height = document.body.scrollHeight;
  window.parent.postMessage({ type: 'rsvp-resize', height: height }, '*');
}
window.addEventListener('load', notifyHeight);
new MutationObserver(notifyHeight).observe(document.body, { childList: true, subtree: true, attributes: true });
