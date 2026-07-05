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

  // Card informativa hotel — mostrata solo per nuclei con Necessita_Hotel=Sì,
  // appare prima delle card membri con animazione fade-slide
  const nucleoHasHotel = membri.some(m => m.necessitaHotel);
  if (nucleoHasHotel) {
    const hotelCard = document.createElement('div');
    hotelCard.className = 'hotel-card';
    hotelCard.innerHTML = `
      <span class="hotel-card-icon">🌿</span>
      <div class="hotel-card-title">Abbiamo pensato anche alla vostra sistemazione</div>
      <p class="hotel-card-text">
        Per rendere tutto più semplice e piacevole, siamo felici di offrirvi
        la sistemazione per la notte del matrimonio (10 → 11 ottobre).
        Vi chiediamo solo di confermarla e di segnalarci eventuali necessità
        per notti aggiuntive, così da comunicare il numero definitivo alla struttura.
      </p>
    `;
    membersContainer.appendChild(hotelCard);
  }

  membri.forEach((m) => {
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

  // Setup sezione hotel (nascosta inizialmente)
  setupHotelSection(nucleoHasHotel);
  updateSubmitButtonState();

  // Listener radio-group nelle card membri
  membersContainer.querySelectorAll('.radio-group').forEach(group => {
    group.addEventListener('click', (e) => {
      const option = e.target.closest('.radio-option');
      if (!option) return;

      group.querySelectorAll('.radio-option').forEach(o => {
        o.classList.remove('selected-yes', 'selected-no');
      });
      const value = option.dataset.value;
      option.classList.add(value === 'Sì' ? 'selected-yes' : 'selected-no');
      group.dataset.selected = value;
      group.classList.remove('has-error');

      if (group.dataset.field === 'presenza') {
        const card = group.closest('.member-card');
        card.querySelectorAll('.presenza-dependent').forEach(f => {
          f.classList.toggle('conditional-hidden', value !== 'Sì');
        });
        // Aggiorna visibilità sezione hotel dopo ogni cambio presenza
        updateHotelSectionVisibility(nucleoHasHotel);
      }

      updateSubmitButtonState();
    });
  });
}

// ===== SEZIONE HOTEL =====
function setupHotelSection(nucleoHasHotel) {
  const hotelSection = document.getElementById('hotel-section');
  if (!hotelSection) return;

  // Reset stato
  hotelSection.style.display = 'none';

  // Listener su "stanza-confermata" per mostrare/nascondere notti extra
  const stanzaGroup = hotelSection.querySelector('[data-field="stanza-confermata"]');
  if (stanzaGroup) {
    stanzaGroup.addEventListener('click', (e) => {
      const option = e.target.closest('.radio-option');
      if (!option) return;
      stanzaGroup.querySelectorAll('.radio-option').forEach(o => {
        o.classList.remove('selected-yes', 'selected-no');
      });
      const value = option.dataset.value;
      option.classList.add(value === 'Sì' ? 'selected-yes' : 'selected-no');
      stanzaGroup.dataset.selected = value;
      stanzaGroup.classList.remove('has-error');

      const nottiWrapper = document.getElementById('notti-extra-wrapper');
      if (nottiWrapper) nottiWrapper.style.display = value === 'Sì' ? 'block' : 'none';

      updateSubmitButtonState();
    });
  }

  // Listener checkbox notti extra
  hotelSection.querySelectorAll('.notte-option').forEach(opt => {
    opt.addEventListener('click', () => {
      opt.classList.toggle('selected');
      const checkbox = opt.querySelector('.notte-checkbox');
      if (checkbox) checkbox.textContent = opt.classList.contains('selected') ? '✓' : '';
    });
  });
}

function updateHotelSectionVisibility(nucleoHasHotel) {
  const hotelSection = document.getElementById('hotel-section');
  if (!hotelSection || !nucleoHasHotel) return;

  const cards = membersContainer.querySelectorAll('.member-card');
  const almenoUnPresente = Array.from(cards).some(card => {
    const g = card.querySelector('[data-field="presenza"]');
    return g && g.dataset.selected === 'Sì';
  });

  if (almenoUnPresente && hotelSection.style.display === 'none') {
    hotelSection.style.display = 'block';
    // Ri-triggera l'animazione rimuovendo e riaggungendo la classe
    hotelSection.style.animation = 'none';
    hotelSection.offsetHeight; // force reflow
    hotelSection.style.animation = '';
  } else if (!almenoUnPresente) {
    hotelSection.style.display = 'none';
    // Reset stato interno
    const stanzaGroup = hotelSection.querySelector('[data-field="stanza-confermata"]');
    if (stanzaGroup) {
      stanzaGroup.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected-yes', 'selected-no'));
      delete stanzaGroup.dataset.selected;
    }
    const nottiWrapper = document.getElementById('notti-extra-wrapper');
    if (nottiWrapper) nottiWrapper.style.display = 'none';
  }
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

function isHotelSectionValid() {
  const hotelSection = document.getElementById('hotel-section');
  if (!hotelSection || hotelSection.style.display === 'none') return true; // non visibile = non richiesta

  const stanzaGroup = hotelSection.querySelector('[data-field="stanza-confermata"]');
  if (!stanzaGroup || !stanzaGroup.dataset.selected) return false; // obbligatorio se visibile

  return true;
}

function updateSubmitButtonState() {
  const cards = membersContainer.querySelectorAll('.member-card');
  const allValid = Array.from(cards).every(isCardValid) && isHotelSectionValid();
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
      return;
    }
    clearFieldError(card, 'presenza');

    const intolleranzeInput = card.querySelector('[data-field="intolleranze"]');
    const trasportoGroup    = card.querySelector('[data-field="trasporto"]');

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
      nome:         card.dataset.nome,
      cognome:      card.dataset.cognome,
      presenza:     presenza,
      intolleranze: presenza === 'Sì' && intolleranzeInput ? intolleranzeInput.value.trim() : '',
      trasporto:    trasportoValue
    });
  });

  // Raccolta dati sezione hotel (a livello nucleo, non per-membro)
  const hotelSection = document.getElementById('hotel-section');
  const hotelVisibile = hotelSection && hotelSection.style.display !== 'none';
  let hotelData = { stanzaConfermata: '', nottiExtra: '', notePernottamento: '' };

  if (hotelVisibile) {
    const stanzaGroup = hotelSection.querySelector('[data-field="stanza-confermata"]');
    const stanzaVal   = stanzaGroup ? (stanzaGroup.dataset.selected || '') : '';

    if (!stanzaVal) {
      hasError = true;
      if (stanzaGroup) {
        stanzaGroup.classList.add('has-error');
        if (!firstErrorEl) firstErrorEl = stanzaGroup;
      }
    }

    // Notti extra — raccoglie i selezionati come stringa "Venerdì", "Domenica" o "Venerdì+Domenica"
    const nottiSelezionate = Array.from(hotelSection.querySelectorAll('.notte-option.selected'))
      .map(el => el.dataset.notte)
      .join('+');

    const noteTextarea = document.getElementById('note-pernottamento');

    hotelData = {
      stanzaConfermata:  stanzaVal,
      nottiExtra:        nottiSelezionate || 'Nessuna',
      notePernottamento: noteTextarea ? noteTextarea.value.trim() : ''
    };
  }

  if (hasError) {
    showMessage(submitMessage, 'Completa i campi obbligatori evidenziati per procedere.', 'error');
    if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Propaga i dati hotel su ogni membro presente (il backend li scrive solo se Presenza=Sì)
  if (hotelVisibile) {
    risposte.forEach(r => {
      if (r.presenza === 'Sì') {
        r.stanzaConfermata  = hotelData.stanzaConfermata;
        r.nottiExtra        = hotelData.nottiExtra;
        r.notePernottamento = hotelData.notePernottamento;
      }
    });
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
