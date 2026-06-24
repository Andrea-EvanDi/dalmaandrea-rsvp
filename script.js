/**
 * RSVP Matrimonio — Frontend Logic
 * ================================================
 * IMPORTANTE: sostituisci l'URL sotto con il TUO endpoint
 * Apps Script (Deploy > Nuova implementazione > copia URL).
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbw52BpmZfdtqcOzmnt7vHS66uW8K6hHnwsJye023wPpM89gwXJpX8H5cadVpH8CmS7EkA/exec';

// ===== STATO =====
let currentNucleo = null;
let currentMatch = null;
let currentCandidates = [];

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

// ===== AUTOCOMPLETE =====
let invitatiList = [];   // [{nome, cognome, nucleoId}] — caricato una volta sola
let listLoaded = false;

const dropdown = document.getElementById('autocomplete-dropdown');

// Carica la lista al focus sul campo (lazy: non al page load, evita chiamata inutile
// se l'utente non usa il form) — ma solo una volta
searchInput.addEventListener('focus', loadListIfNeeded);
searchInput.addEventListener('input', onSearchInput);
searchInput.addEventListener('keydown', onSearchKeydown);

// Chiudi dropdown cliccando fuori
document.addEventListener('click', (e) => {
  if (!e.target.closest('#screen-search')) closeDropdown();
});

async function loadListIfNeeded() {
  if (listLoaded) return;
  dropdown.innerHTML = '<div class="search-loading">Caricamento...</div>';
  dropdown.classList.add('open');
  try {
    const res = await fetch(`${API_URL}?action=list`);
    const data = await res.json();
    if (data.ok) {
      invitatiList = data.invitati;
      listLoaded = true;
    }
  } catch (err) {
    showMessage(searchMessage, 'Errore di connessione. Riprova.', 'error');
  }
  closeDropdown();
}

function normalizeForSearch(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // rimuove accenti
    .replace(/['\s]+/g, ' ')                             // apostrofi e spazi multipli → spazio
    .trim();
}

function onSearchInput() {
  hideMessage(searchMessage);
  const query = normalizeForSearch(searchInput.value);

  if (query.length < 3) {
    closeDropdown();
    return;
  }

  // Filtra in-memory: sottostringa su Nome, Cognome, o Nome+Cognome
  const results = invitatiList.filter(inv => {
    const nome    = normalizeForSearch(inv.nome);
    const cognome = normalizeForSearch(inv.cognome);
    const full    = nome + ' ' + cognome;
    const reverse = cognome + ' ' + nome;
    return nome.includes(query) ||
           cognome.includes(query) ||
           full.includes(query) ||
           reverse.includes(query);
  });

  renderDropdown(results, searchInput.value.trim());
}

function renderDropdown(results, rawQuery) {
  dropdown.innerHTML = '';

  if (results.length === 0) {
    dropdown.innerHTML = '<div class="autocomplete-empty">Nessun risultato. Riprova o contattaci.</div>';
    dropdown.classList.add('open');
    return;
  }

  results.forEach((inv, idx) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.dataset.idx = idx;
    // Evidenzia la parte che corrisponde alla query
    const fullName = `${inv.nome} ${inv.cognome}`;
    item.innerHTML = highlightMatch(fullName, rawQuery);
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // evita blur sull'input prima del click
      selectInvitato(inv);
    });
    dropdown.appendChild(item);
  });

  dropdown.classList.add('open');
  // Salva risultati correnti per navigazione da tastiera
  dropdown._results = results;
  dropdown._focused = -1;
}

function highlightMatch(fullName, query) {
  if (!query) return fullName;
  const idx = fullName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .indexOf(normalizeForSearch(query));
  if (idx === -1) return fullName;
  return fullName.slice(0, idx) +
    `<mark>${fullName.slice(idx, idx + query.length)}</mark>` +
    fullName.slice(idx + query.length);
}

// Navigazione da tastiera nel dropdown
function onSearchKeydown(e) {
  if (!dropdown.classList.contains('open')) return;
  const items = dropdown.querySelectorAll('.autocomplete-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    dropdown._focused = Math.min((dropdown._focused ?? -1) + 1, items.length - 1);
    updateFocus(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    dropdown._focused = Math.max((dropdown._focused ?? 0) - 1, 0);
    updateFocus(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const f = dropdown._focused ?? -1;
    if (f >= 0 && dropdown._results?.[f]) {
      selectInvitato(dropdown._results[f]);
    }
  } else if (e.key === 'Escape') {
    closeDropdown();
  }
}

function updateFocus(items) {
  items.forEach((item, i) => {
    item.classList.toggle('focused', i === dropdown._focused);
  });
  if (dropdown._focused >= 0) {
    items[dropdown._focused].scrollIntoView({ block: 'nearest' });
  }
}

function closeDropdown() {
  dropdown.classList.remove('open');
  dropdown.innerHTML = '';
}

function selectInvitato(inv) {
  // Aggiorna il campo con il nome selezionato e chiudi dropdown
  searchInput.value = `${inv.nome} ${inv.cognome}`;
  closeDropdown();
  hideMessage(searchMessage);

  // Passa direttamente alla conferma identità (no ricerca backend necessaria)
  currentMatch = inv;
  currentCandidates = [inv];
  confirmName.textContent = `${inv.nome} ${inv.cognome}`;
  showScreen('confirm');
}

// ===== CONFERMA MATCH =====
btnConfirmNo.addEventListener('click', () => {
  currentMatch = null;
  currentCandidates = [];
  showScreen('search');
});

btnConfirmYes.addEventListener('click', async () => {
  if (!currentMatch) return;
  setLoading(btnConfirmYes, true, 'Sì, sono io');

  try {
    const url = `${API_URL}?action=expand&nucleoId=${encodeURIComponent(currentMatch.nucleoId)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.found) {
      showMessage(searchMessage, data.message || 'Errore nel recupero del nucleo.', 'error');
      showScreen('search');
      return;
    }

    if (data.giaRisposto) {
      showScreen('already');
      return;
    }

    currentNucleo = data;
    renderMembersForm(currentNucleo.membri);
    showScreen('form');

  } catch (err) {
    showMessage(searchMessage, 'Errore di connessione. Riprova.', 'error');
    showScreen('search');
  }

  setLoading(btnConfirmYes, false, 'Sì, sono io');
});

btnAlreadyBack.addEventListener('click', () => {
  currentMatch = null;
  currentCandidates = [];
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

      <div class="field-label">Presenza<span class="required-mark">*</span></div>
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
        <label class="field-label">Necessità di trasporto / informazioni su come arrivare<span class="required-mark">*</span></label>
        <div class="radio-group" data-field="trasporto">
          <div class="radio-option" data-value="Sì">Sì</div>
          <div class="radio-option" data-value="No">No</div>
        </div>
      </div>
    `;

    membersContainer.appendChild(card);
  });

  updateSubmitButtonState();

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

      // Rimuove lo stato di errore non appena l'utente risponde
      group.classList.remove('has-error');

      // Se è il campo "presenza", mostra/nascondi i campi dipendenti
      if (group.dataset.field === 'presenza') {
        const card = group.closest('.member-card');
        const dependentFields = card.querySelectorAll('.presenza-dependent');
        dependentFields.forEach(f => {
          f.classList.toggle('conditional-hidden', value !== 'Sì');
        });
      }

      updateSubmitButtonState();
    });
  });
}

// ===== VALIDAZIONE LIVE (abilita/disabilita bottone Invia) =====
function isCardValid(card) {
  const presenzaGroup = card.querySelector('[data-field="presenza"]');
  const presenza = presenzaGroup.dataset.selected || '';
  if (!presenza) return false;

  if (presenza === 'Sì') {
    const trasportoGroup = card.querySelector('[data-field="trasporto"]');
    const trasporto = trasportoGroup ? (trasportoGroup.dataset.selected || '') : '';
    if (!trasporto) return false;
  }

  return true;
}

function updateSubmitButtonState() {
  const cards = membersContainer.querySelectorAll('.member-card');
  const allValid = Array.from(cards).every(isCardValid);
  btnSubmit.disabled = !allValid;
}

// ===== SUBMIT =====
btnSubmit.addEventListener('click', doSubmit);

async function doSubmit() {
  hideMessage(submitMessage);

  const cards = membersContainer.querySelectorAll('.member-card');
  const risposte = [];
  let hasError = false;
  let firstErrorEl = null;

  cards.forEach(card => {
    const presenzaGroup = card.querySelector('[data-field="presenza"]');
    const presenza = presenzaGroup.dataset.selected || '';

    if (!presenza) {
      hasError = true;
      markFieldError(card, 'presenza');
      if (!firstErrorEl) firstErrorEl = presenzaGroup;
      return; // senza presenza non ha senso validare il resto della card
    }
    clearFieldError(card, 'presenza');

    const intolleranzeInput = card.querySelector('[data-field="intolleranze"]');
    const pernottamentoGroup = card.querySelector('[data-field="pernottamento"]');
    const trasportoGroup = card.querySelector('[data-field="trasporto"]');

    // Trasporto è obbligatorio solo per chi conferma la presenza
    let trasportoValue = '';
    if (presenza === 'Sì') {
      trasportoValue = trasportoGroup ? (trasportoGroup.dataset.selected || '') : '';
      if (!trasportoValue) {
        hasError = true;
        markFieldError(card, 'trasporto');
        if (!firstErrorEl) firstErrorEl = trasportoGroup;
      } else {
        clearFieldError(card, 'trasporto');
      }
    }

    risposte.push({
      nome: card.dataset.nome,
      cognome: card.dataset.cognome,
      presenza: presenza,
      intolleranze: presenza === 'Sì' && intolleranzeInput ? intolleranzeInput.value.trim() : '',
      pernottamento: presenza === 'Sì' && pernottamentoGroup ? (pernottamentoGroup.dataset.selected || '') : '',
      trasporto: trasportoValue
    });
  });

  if (hasError) {
    showMessage(submitMessage, 'Completa i campi obbligatori evidenziati per procedere.', 'error');
    if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
function markFieldError(card, fieldName) {
  const group = card.querySelector(`[data-field="${fieldName}"]`);
  if (group) group.classList.add('has-error');
}

function clearFieldError(card, fieldName) {
  const group = card.querySelector(`[data-field="${fieldName}"]`);
  if (group) group.classList.remove('has-error');
}

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
