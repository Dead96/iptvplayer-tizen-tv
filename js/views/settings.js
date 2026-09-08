/* View "Impostazioni": inserimento/modifica URL playlist M3U. */
var SettingsView = {
  _input: null,
  _button: null,
  _errorEl: null,
  _focus: 'input', // 'input' | 'button'
  _onSave: null,
  _allowBack: false,

  init: function () {
    SettingsView._input = document.getElementById('playlist-url');
    SettingsView._button = document.getElementById('btn-save-settings');
    SettingsView._errorEl = document.getElementById('settings-error');

    SettingsView._button.addEventListener('click', SettingsView._save);
    SettingsView._input.addEventListener('focus', function () {
      SettingsView._focus = 'input';
      SettingsView._updateFocusStyles();
    });
  },

  /**
   * @param {object} opts
   * @param {string} opts.currentUrl valore iniziale del campo
   * @param {boolean} opts.allowBack se true, il tasto "indietro" torna alla lista canali
   * @param {function(string)} opts.onSave callback invocata con l'URL confermato
   */
  show: function (opts) {
    opts = opts || {};
    SettingsView._input.value = opts.currentUrl || '';
    SettingsView._onSave = opts.onSave || null;
    SettingsView._allowBack = !!opts.allowBack;
    SettingsView._errorEl.textContent = '';
    SettingsView._focus = 'input';
    SettingsView._updateFocusStyles();
    SettingsView._input.focus();

    Remote.setHandler(SettingsView.handleKey);
  },

  handleKey: function (action) {
    // Solo su/giu' spostano il focus tra campo e pulsante: sinistra/destra
    // restano liberi per muovere il cursore mentre si modifica l'URL.
    if (action === 'down') {
      if (SettingsView._focus === 'input') {
        SettingsView._focus = 'button';
        SettingsView._input.blur();
        SettingsView._updateFocusStyles();
        return true;
      }
    }
    if (action === 'up') {
      if (SettingsView._focus === 'button') {
        SettingsView._focus = 'input';
        SettingsView._input.focus();
        SettingsView._updateFocusStyles();
        return true;
      }
    }
    if (action === 'enter') {
      if (SettingsView._focus === 'button') {
        SettingsView._save();
        return true;
      }
      // Invio sul campo testo: lascia il comportamento nativo (apre/chiude tastiera).
      return false;
    }
    if (action === 'back') {
      if (SettingsView._allowBack) {
        App.showChannelList();
        return true;
      }
      // Nessuna playlist ancora caricata: non c'e' una view precedente utile.
      return true;
    }
    return false;
  },

  _updateFocusStyles: function () {
    SettingsView._input.classList.toggle('focused', SettingsView._focus === 'input');
    SettingsView._button.classList.toggle('focused', SettingsView._focus === 'button');
  },

  _save: function () {
    var url = SettingsView._input.value.trim();
    if (!url) {
      SettingsView._errorEl.textContent = 'Inserisci un URL valido.';
      return;
    }
    if (SettingsView._onSave) {
      SettingsView._onSave(url);
    }
  }
};
