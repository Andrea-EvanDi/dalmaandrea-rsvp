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
  search:   document.getElementById('screen-search'),
  multiple: document.getElementById('screen-multiple'),
  confirm:  document.getElementById('screen-confirm'),
  already:  document.getElementById('screen-already'),
  form:     document.getElementById('screen-form'),
  success:  document.getElementById('screen-success'),
};

const confirmName    = document.getElementById('confirm-name');
const btnConfirmYes  = document.getElementById('btn-confirm-yes');
const btnConfirmNo   = document.getElementById('btn-confirm-no');
const btnAlreadyBack = document.getElementById('btn-already-back');
const membersContainer = document.getElementById('members-container');
const btnSubmit      = document.getElementById('btn-submit');
const submitMessage  = document.getElementById('submit-message');

// ===== NAVIGAZIONE SCHERMATE =====
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ===== ELEMENTI RICERCA =====
const inputNome    = document.getElementById('input-nome');
const inputCognome = document.getElementById('input-cognome');
const btnSearch    = document.getElementById('btn-search');
const searchMessage = document.getElementById('search-message');

// ===== RICERCA =====
btnSearch.addEventListener('click', doSearch);
[inputNome, inputCognome].forEach(input => {
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
});

async function doSearch() {
  hideMessage(searchMessage);
  const nome    = inputNome.value.trim();
  const cognome = inputCognome.value.trim();

  if (nome.length < 2 || cognome.length < 2) {
    showMessage(searchMessage, 'Inserisci sia il nome che il cognome (almeno 2 caratteri ciascuno).', 'error');
    return;
  }

  setLoading(btnSearch, true, 'Cerca');

  try {
    const url = `${API_URL}?action=search&nome=${encodeURIComponent(nome)}&cognome=${encodeURIComponent(cognome)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.found) {
      showMessage(searchMessage, data.message || 'Nome non trovato.', 'error');
      setLoading(btnSearch, false, 'Cerca');
      return;
    }

    if (data.multiple) {
      currentCandidates = data.candidates;
      renderCandidates(data.candidates);
      showScreen('multiple');
    } else {
      currentMatch = data.candidates[0];
      currentCandidates = data.candidates;
      confirmName.textContent = `${currentMatch.nome} ${currentMatch.cognome}`;
      showScreen('confirm');
    }

  } catch (err) {
    showMessage(searchMessage, 'Errore di connessione. Riprova.', 'error');
  }

  setLoading(btnSearch, false, 'Cerca');
}

// ===== SELEZIONE MULTIPLA =====
const candidatesContainer = document.getElementById('candidates-container');
const btnMultipleBack     = document.getElementById('btn-multiple-back');

function renderCandidates(candidates) {
  candidatesContainer.innerHTML = '';
  candidates.forEach(c => {
    const el = document.createElement('div');
    el.className = 'candidate-option';
    el.innerHTML = `<div class="candidate-radio"></div>${c.nome} ${c.cognome}`;
    el.addEventListener('click', () => {
      candidatesContainer.querySelectorAll('.candidate-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      setTimeout(() => {
        currentMatch = c;
        confirmName.textContent = `${c.nome} ${c.cognome}`;
        showScreen('confirm');
      }, 200);
    });
    candidatesContainer.appendChild(el);
  });
}

btnMultipleBack.addEventListener('click', () => {
  currentMatch = null;
  currentCandidates = [];
  showScreen('search');
});

// ===== CONFERMA MATCH =====
btnConfirmNo.addEventListener('click', () => {
  if (currentCandidates.length > 1) {
    showScreen('multiple');
  } else {
    currentMatch = null;
    currentCandidates = [];
    showScreen('search');
  }
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
  inputNome.value = '';
  inputCognome.value = '';
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
