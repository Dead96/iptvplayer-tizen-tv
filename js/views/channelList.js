/* View "Lista canali": elenco verticale navigabile con il telecomando. */
var ChannelListView = {
  PAGE_JUMP: 10, // canali saltati con sinistra/destra, per scorrere piu' velocemente

  _list: null,
  _emptyEl: null,
  _settingsBtn: null,
  _playlistsBtn: null,
  _panelEl: null,
  _channels: [],
  _playlists: [],
  _activePlaylistIndex: 0,
  _focusIndex: 0, // >=0 = indice canale; -1 = Impostazioni; -2 = Liste (solo se ci sono piu' liste)

  _panelActive: false,
  _panelFocusIndex: 0,

  init: function () {
    ChannelListView._list = document.getElementById('channel-list');
    ChannelListView._emptyEl = document.getElementById('channels-empty');
    ChannelListView._settingsBtn = document.getElementById('btn-open-settings');
    ChannelListView._playlistsBtn = document.getElementById('btn-open-playlists');
    ChannelListView._panelEl = document.getElementById('playlists-panel');

    ChannelListView._settingsBtn.addEventListener('click', function () {
      App.showSettings();
    });
    ChannelListView._playlistsBtn.addEventListener('click', function () {
      ChannelListView._openPanel();
    });
  },

  /**
   * @param {Array} channels lista canali gia' parsati
   * @param {number} [focusIndex] indice iniziale da mettere a fuoco
   * @param {Array<{name:string,url:string}>} [playlists] liste disponibili (modalita' indice)
   * @param {number} [activePlaylistIndex] indice della lista attualmente attiva
   */
  show: function (channels, focusIndex, playlists, activePlaylistIndex) {
    ChannelListView._channels = channels || [];
    ChannelListView._playlists = playlists || [];
    ChannelListView._activePlaylistIndex = activePlaylistIndex || 0;
    ChannelListView._playlistsBtn.hidden = ChannelListView._playlists.length < 2;
    ChannelListView._closePanel();

    ChannelListView._render();
    ChannelListView._focusIndex = (typeof focusIndex === 'number' && focusIndex >= 0 &&
      focusIndex < ChannelListView._channels.length) ? focusIndex : 0;
    ChannelListView._updateFocusStyles();
    Remote.setHandler(ChannelListView.handleKey);
  },

  _render: function () {
    var list = ChannelListView._list;
    list.innerHTML = '';
    var channels = ChannelListView._channels;

    ChannelListView._emptyEl.hidden = channels.length > 0;

    channels.forEach(function (ch, index) {
      var row = document.createElement('div');
      row.className = 'channel-row focusable';
      row.dataset.index = String(index);

      if (ch.logo) {
        var img = document.createElement('img');
        img.className = 'channel-logo';
        img.src = ch.logo;
        img.alt = '';
        img.onerror = function () {
          img.remove();
        };
        row.appendChild(img);
      }

      var name = document.createElement('div');
      name.className = 'channel-name';
      name.textContent = ch.name;
      row.appendChild(name);

      row.addEventListener('click', function () {
        App.playChannel(index);
      });

      list.appendChild(row);
    });
  },

  _topSlots: function () {
    return ChannelListView._playlists.length > 1 ? 2 : 1;
  },

  handleKey: function (action) {
    if (ChannelListView._panelActive) {
      return ChannelListView._handlePanelKey(action);
    }

    var count = ChannelListView._channels.length;
    var topSlots = ChannelListView._topSlots();

    if (action === 'back') {
      App.exitApp();
      return true;
    }

    if (action === 'enter') {
      if (ChannelListView._focusIndex === -2) {
        ChannelListView._openPanel();
      } else if (ChannelListView._focusIndex === -1) {
        App.showSettings();
      } else if (count > 0) {
        App.playChannel(ChannelListView._focusIndex);
      }
      return true;
    }

    if (count === 0 && action !== 'up') {
      return true; // nessun canale su cui navigare
    }

    switch (action) {
      case 'up':
        if (ChannelListView._focusIndex === 0) {
          ChannelListView._focusIndex = -1;
        } else if (ChannelListView._focusIndex === -1 && topSlots === 2) {
          ChannelListView._focusIndex = -2;
        }
        break;
      case 'down':
        if (ChannelListView._focusIndex === -2) {
          ChannelListView._focusIndex = -1;
        } else if (ChannelListView._focusIndex === -1) {
          if (count > 0) ChannelListView._focusIndex = 0;
        } else if (ChannelListView._focusIndex + 1 < count) {
          ChannelListView._focusIndex += 1;
        }
        break;
      case 'left':
        if (ChannelListView._focusIndex < 0) return true;
        ChannelListView._focusIndex = Math.max(0, ChannelListView._focusIndex - ChannelListView.PAGE_JUMP);
        break;
      case 'right':
        if (ChannelListView._focusIndex < 0) return true;
        ChannelListView._focusIndex = Math.min(count - 1, ChannelListView._focusIndex + ChannelListView.PAGE_JUMP);
        break;
      default:
        return false;
    }

    ChannelListView._updateFocusStyles();
    return true;
  },

  _updateFocusStyles: function () {
    ChannelListView._settingsBtn.classList.toggle('focused', ChannelListView._focusIndex === -1);
    ChannelListView._playlistsBtn.classList.toggle('focused', ChannelListView._focusIndex === -2);

    var rows = ChannelListView._list.children;
    for (var i = 0; i < rows.length; i++) {
      var isFocused = i === ChannelListView._focusIndex;
      rows[i].classList.toggle('focused', isFocused);
      if (isFocused) {
        rows[i].scrollIntoView({ block: 'nearest' });
      }
    }
  },

  /* ---------- Pannello "Liste disponibili" ---------- */

  _openPanel: function () {
    if (ChannelListView._playlists.length < 2) return;

    var panel = ChannelListView._panelEl;
    panel.innerHTML = '';
    ChannelListView._playlists.forEach(function (pl, i) {
      var btn = document.createElement('button');
      btn.className = 'focusable side-panel-item';
      if (i === ChannelListView._activePlaylistIndex) {
        btn.classList.add('side-panel-item-active');
      }
      btn.textContent = pl.name + (i === ChannelListView._activePlaylistIndex ? ' (attiva)' : '');
      btn.addEventListener('click', function () {
        App.selectPlaylist(i);
      });
      panel.appendChild(btn);
    });

    ChannelListView._panelActive = true;
    ChannelListView._panelFocusIndex = ChannelListView._activePlaylistIndex;
    panel.classList.add('visible');
    ChannelListView._updatePanelFocusStyles();
  },

  _closePanel: function () {
    ChannelListView._panelActive = false;
    ChannelListView._panelEl.classList.remove('visible');
  },

  _handlePanelKey: function (action) {
    var count = ChannelListView._playlists.length;

    if (action === 'back') {
      ChannelListView._closePanel();
      return true;
    }
    if (action === 'up') {
      ChannelListView._panelFocusIndex = Math.max(0, ChannelListView._panelFocusIndex - 1);
      ChannelListView._updatePanelFocusStyles();
      return true;
    }
    if (action === 'down') {
      ChannelListView._panelFocusIndex = Math.min(count - 1, ChannelListView._panelFocusIndex + 1);
      ChannelListView._updatePanelFocusStyles();
      return true;
    }
    if (action === 'enter') {
      ChannelListView._closePanel();
      App.selectPlaylist(ChannelListView._panelFocusIndex);
      return true;
    }
    return true;
  },

  _updatePanelFocusStyles: function () {
    var items = ChannelListView._panelEl.children;
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('focused', i === ChannelListView._panelFocusIndex);
    }
  }
};
