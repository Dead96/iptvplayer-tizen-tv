/*
 * View "Impostazioni": elenco delle liste configurate, con un form per
 * aggiungerne una nuova o modificare/eliminare quella selezionata.
 *
 * Ha due modalita':
 *  - "list": elenco liste + riga finale "Aggiungi nuova lista"
 *  - "form": nome + URL, con Salva (e, se si sta modificando una lista
 *    esistente, anche Elimina)
 */
var SettingsView = {
  _listModeEl: null,
  _formModeEl: null,
  _playlistsContainer: null,
  _nameInput: null,
  _urlInput: null,
  _deleteBtn: null,
  _saveBtn: null,
  _listErrorEl: null,
  _formErrorEl: null,

  _mode: 'list', // 'list' | 'form'
  _playlists: [],

  _listFocusIndex: 0, // 0..N-1 = liste esistenti; N = riga "Aggiungi nuova lista"
  _editingIndex: -1, // -1 = nuova lista, altrimenti indice della lista in modifica
  _formFocusOrder: [], // ['name','url','save'] oppure ['name','url','delete','save']
  _formFocusIndex: 0,

  init: function () {
    SettingsView._listModeEl = document.getElementById('settings-list-mode');
    SettingsView._formModeEl = document.getElementById('settings-form-mode');
    SettingsView._playlistsContainer = document.getElementById('settings-playlists');
    SettingsView._nameInput = document.getElementById('playlist-name');
    SettingsView._urlInput = document.getElementById('playlist-url');
    SettingsView._deleteBtn = document.getElementById('btn-delete-playlist');
    SettingsView._saveBtn = document.getElementById('btn-save-playlist');
    SettingsView._listErrorEl = document.getElementById('settings-error');
    SettingsView._formErrorEl = document.getElementById('settings-form-error');

    SettingsView._saveBtn.addEventListener('click', function () {
      SettingsView._save();
    });
    SettingsView._deleteBtn.addEventListener('click', function () {
      SettingsView._delete();
    });
    SettingsView._nameInput.addEventListener('focus', function () {
      SettingsView._formFocusIndex = SettingsView._formFocusOrder.indexOf('name');
      SettingsView._updateFormFocusStyles();
    });
    SettingsView._urlInput.addEventListener('focus', function () {
      SettingsView._formFocusIndex = SettingsView._formFocusOrder.indexOf('url');
      SettingsView._updateFormFocusStyles();
    });
  },

  /**
   * @param {object} opts
   * @param {Array<{name:string,url:string}>} opts.playlists liste attualmente configurate
   */
  show: function (opts) {
    opts = opts || {};
    SettingsView._playlists = opts.playlists || [];
    SettingsView._showListMode();
    Remote.setHandler(SettingsView.handleKey);
  },

  /* ---------- modalita' elenco ---------- */

  _showListMode: function () {
    SettingsView._mode = 'list';
    SettingsView._listModeEl.hidden = false;
    SettingsView._formModeEl.hidden = true;
    SettingsView._listErrorEl.textContent = '';
    SettingsView._renderList();
    SettingsView._updateListFocusStyles();
  },

  _renderList: function () {
    var container = SettingsView._playlistsContainer;
    container.innerHTML = '';

    SettingsView._playlists.forEach(function (pl, i) {
      var btn = document.createElement('button');
      btn.className = 'focusable settings-playlist-row';

      var name = document.createElement('div');
      name.className = 'settings-playlist-name';
      name.textContent = pl.name;
      btn.appendChild(name);

      var url = document.createElement('div');
      url.className = 'settings-playlist-url';
      url.textContent = pl.url;
      btn.appendChild(url);

      btn.addEventListener('click', function () {
        SettingsView._openForm(i);
      });
      container.appendChild(btn);
    });

    var addBtn = document.createElement('button');
    addBtn.className = 'focusable settings-playlist-row settings-playlist-add';
    addBtn.textContent = '+ Aggiungi nuova lista';
    addBtn.addEventListener('click', function () {
      SettingsView._openForm(-1);
    });
    container.appendChild(addBtn);
  },

  _updateListFocusStyles: function () {
    var rows = SettingsView._playlistsContainer.children;
    for (var i = 0; i < rows.length; i++) {
      var isFocused = i === SettingsView._listFocusIndex;
      rows[i].classList.toggle('focused', isFocused);
      if (isFocused) DomUtil.scrollIntoViewNearest(SettingsView._playlistsContainer, rows[i]);
    }
  },

  /* ---------- modalita' form (aggiungi/modifica/elimina) ---------- */

  _openForm: function (index) {
    SettingsView._mode = 'form';
    SettingsView._editingIndex = index;
    var editing = index >= 0;
    var playlist = editing ? SettingsView._playlists[index] : null;

    SettingsView._nameInput.value = editing ? playlist.name : '';
    SettingsView._urlInput.value = editing ? playlist.url : '';
    SettingsView._formErrorEl.textContent = '';
    SettingsView._deleteBtn.hidden = !editing;

    SettingsView._formFocusOrder = editing ? ['name', 'url', 'delete', 'save'] : ['name', 'url', 'save'];
    SettingsView._formFocusIndex = 0;

    SettingsView._listModeEl.hidden = true;
    SettingsView._formModeEl.hidden = false;

    SettingsView._nameInput.focus();
    SettingsView._updateFormFocusStyles();
  },

  _closeForm: function () {
    var wasEditing = SettingsView._editingIndex;
    SettingsView._showListMode();
    SettingsView._listFocusIndex = wasEditing >= 0 ? wasEditing : SettingsView._playlists.length;
    SettingsView._updateListFocusStyles();
  },

  _applyFormFocus: function () {
    var current = SettingsView._formFocusOrder[SettingsView._formFocusIndex];
    if (current === 'name') {
      SettingsView._nameInput.focus();
    } else if (current === 'url') {
      SettingsView._urlInput.focus();
    } else {
      SettingsView._nameInput.blur();
      SettingsView._urlInput.blur();
    }
    SettingsView._updateFormFocusStyles();
  },

  _updateFormFocusStyles: function () {
    var current = SettingsView._formFocusOrder[SettingsView._formFocusIndex];
    SettingsView._nameInput.classList.toggle('focused', current === 'name');
    SettingsView._urlInput.classList.toggle('focused', current === 'url');
    SettingsView._deleteBtn.classList.toggle('focused', current === 'delete');
    SettingsView._saveBtn.classList.toggle('focused', current === 'save');
  },

  _save: function () {
    var name = SettingsView._nameInput.value.trim();
    var url = SettingsView._urlInput.value.trim();
    if (!url) {
      SettingsView._formErrorEl.textContent = 'Inserisci un URL valido.';
      return;
    }

    if (SettingsView._editingIndex >= 0) {
      var current = SettingsView._playlists[SettingsView._editingIndex];
      App.updatePlaylist(SettingsView._editingIndex, name || current.name, url);
      SettingsView._playlists = App._playlists;
      SettingsView._closeForm();
      return;
    }

    SettingsView._formErrorEl.textContent = 'Verifica in corso...';
    App.addPlaylist(name, url)
      .then(function () {
        SettingsView._playlists = App._playlists;
        SettingsView._closeForm();
      })
      .catch(function (err) {
        SettingsView._formErrorEl.textContent = 'Impossibile verificare l\'URL (' +
          (err && err.message ? err.message : err) + ').';
      });
  },

  _delete: function () {
    if (SettingsView._editingIndex < 0) return;
    App.deletePlaylist(SettingsView._editingIndex);
    SettingsView._playlists = App._playlists;
    SettingsView._editingIndex = -1;
    SettingsView._showListMode();
  },

  /* ---------- input telecomando ---------- */

  handleKey: function (action) {
    if (SettingsView._mode === 'form') {
      return SettingsView._handleFormKey(action);
    }
    return SettingsView._handleListKey(action);
  },

  _handleListKey: function (action) {
    var totalRows = SettingsView._playlists.length + 1; // + riga "Aggiungi nuova lista"

    if (action === 'back') {
      // No-op se non c'e' ancora nessuna lista configurata (App.closeSettings lo gestisce).
      App.closeSettings();
      return true;
    }
    if (action === 'up') {
      SettingsView._listFocusIndex = Math.max(0, SettingsView._listFocusIndex - 1);
      SettingsView._updateListFocusStyles();
      return true;
    }
    if (action === 'down') {
      SettingsView._listFocusIndex = Math.min(totalRows - 1, SettingsView._listFocusIndex + 1);
      SettingsView._updateListFocusStyles();
      return true;
    }
    if (action === 'enter') {
      var idx = SettingsView._listFocusIndex;
      SettingsView._openForm(idx < SettingsView._playlists.length ? idx : -1);
      return true;
    }
    return false;
  },

  _handleFormKey: function (action) {
    var order = SettingsView._formFocusOrder;
    var current = order[SettingsView._formFocusIndex];
    // Elimina/Salva sono affiancati orizzontalmente: quando il focus e' su uno
    // dei due, destra/sinistra si muovono tra loro come su/giu'. Sui campi di
    // testo (nome/URL) invece sinistra/destra restano liberi per il cursore.
    var onButton = current === 'delete' || current === 'save';

    if (action === 'back') {
      SettingsView._closeForm();
      return true;
    }
    if (action === 'down' || (onButton && action === 'right')) {
      if (SettingsView._formFocusIndex < order.length - 1) {
        SettingsView._formFocusIndex += 1;
        SettingsView._applyFormFocus();
      }
      return true;
    }
    if (action === 'up' || (onButton && action === 'left')) {
      if (SettingsView._formFocusIndex > 0) {
        SettingsView._formFocusIndex -= 1;
        SettingsView._applyFormFocus();
      }
      return true;
    }
    if (action === 'enter') {
      if (current === 'save') {
        SettingsView._save();
        return true;
      }
      if (current === 'delete') {
        SettingsView._delete();
        return true;
      }
      // Invio su un campo testo: lascia il comportamento nativo (apre/chiude tastiera).
      return false;
    }
    return false;
  }
};
