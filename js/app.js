/*
 * Controller principale: gestisce le view e il flusso dell'app.
 *
 * Le liste (nome + URL) sono gestite localmente (Storage.getPlaylists /
 * setPlaylists) e create/modificate dalla schermata Impostazioni. Quando si
 * aggiunge una lista, l'URL fornito viene controllato automaticamente: se e'
 * un piccolo indice JSON con piu' liste (vedi js/playlistsIndex.js) tutte
 * quelle liste vengono importate in un colpo solo (il nome digitato a mano
 * viene ignorato in quel caso); altrimenti viene aggiunta una singola lista
 * con il nome indicato.
 */
var App = {
  _channels: [],
  _views: {},
  _playlists: [],
  _activePlaylistIndex: 0,

  init: function () {
    App._views = {
      loading: document.getElementById('view-loading'),
      settings: document.getElementById('view-settings'),
      channels: document.getElementById('view-channels'),
      player: document.getElementById('view-player')
    };

    Remote.init();
    SettingsView.init();
    ChannelListView.init();
    PlayerView.init();

    App._playlists = Storage.getPlaylists();

    if (App._playlists.length === 0) {
      var legacyUrl = Storage.getLegacySourceUrl();
      if (legacyUrl) {
        App._resolveEntries('Canali', legacyUrl)
          .then(function (entries) {
            App._playlists = entries;
            Storage.setPlaylists(App._playlists);
            App._startFromActivePlaylist(true);
          })
          .catch(function () {
            App.showSettings();
          });
        return;
      }
      App.showSettings();
      return;
    }

    App._startFromActivePlaylist(true);
  },

  _startFromActivePlaylist: function (isInitial) {
    var saved = Storage.getActivePlaylistIndex();
    App._activePlaylistIndex = (saved >= 0 && saved < App._playlists.length) ? saved : 0;
    App._loadActivePlaylist({ isInitial: isInitial }).catch(function (err) {
      App.showSettings();
      var errorEl = document.getElementById('settings-error');
      errorEl.textContent = 'Impossibile caricare la lista "' + App._playlists[App._activePlaylistIndex].name +
        '" (' + (err && err.message ? err.message : err) + ').';
    });
  },

  showView: function (name) {
    Object.keys(App._views).forEach(function (key) {
      App._views[key].classList.toggle('active', key === name);
    });
  },

  showLoading: function (text) {
    document.getElementById('loading-text').textContent = text || 'Caricamento...';
    App.showView('loading');
  },

  showSettings: function () {
    App.showView('settings');
    SettingsView.show({ playlists: App._playlists });
  },

  /** Chiamato da SettingsView quando si esce da Impostazioni (tasto Indietro). */
  closeSettings: function () {
    if (App._playlists.length === 0) return; // niente da mostrare, resta in impostazioni
    App._startFromActivePlaylist(false);
  },

  showChannelList: function (focusIndex) {
    App.showView('channels');
    var active = App._playlists[App._activePlaylistIndex];
    document.getElementById('channels-title').textContent = active ? active.name : 'Canali';
    ChannelListView.show(App._channels, focusIndex, App._playlists, App._activePlaylistIndex);
  },

  playChannel: function (index) {
    App.showView('player');
    PlayerView.show(App._channels, index);
  },

  /** Scarica e mostra i canali della lista attualmente attiva. */
  _loadActivePlaylist: function (opts) {
    opts = opts || {};
    var playlist = App._playlists[App._activePlaylistIndex];
    if (!playlist) return Promise.reject(new Error('Nessuna lista disponibile'));

    App.showLoading('Caricamento "' + playlist.name + '"...');

    return fetch(playlist.url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        App._channels = M3uParser.parse(text);
        var startIndex = opts.isInitial ? Storage.getLastChannelIndex() : 0;
        App.showChannelList(startIndex);
      });
  },

  /** Cambia la lista attiva e mostra i suoi canali. */
  selectPlaylist: function (index) {
    if (index < 0 || index >= App._playlists.length) return;
    App._activePlaylistIndex = index;
    Storage.setActivePlaylistIndex(index);
    App._loadActivePlaylist({ isInitial: false }).catch(function (err) {
      App.showSettings();
      var errorEl = document.getElementById('settings-error');
      errorEl.textContent = 'Impossibile caricare la lista (' +
        (err && err.message ? err.message : err) + ').';
    });
  },

  /**
   * Scarica `url` e determina se e' un indice JSON di piu' liste o una
   * singola playlist M3U.
   * @returns {Promise<Array<{name:string,url:string}>>}
   */
  _resolveEntries: function (name, url) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var index = PlaylistsIndex.parse(text);
        if (index) return index;
        return [{ name: name || 'Lista', url: url }];
      });
  },

  /**
   * Aggiunge una nuova lista (usato dal form "Aggiungi nuova lista" in
   * Impostazioni). Se l'URL e' un indice JSON, importa tutte le liste che
   * contiene (il nome fornito viene ignorato in quel caso).
   * @returns {Promise<number>} il numero di liste aggiunte
   */
  addPlaylist: function (name, url) {
    return App._resolveEntries(name, url).then(function (entries) {
      App._playlists = App._playlists.concat(entries);
      Storage.setPlaylists(App._playlists);
      return entries.length;
    });
  },

  /** Modifica nome/URL di una lista esistente (nessun controllo di rete). */
  updatePlaylist: function (index, name, url) {
    if (!App._playlists[index]) return;
    App._playlists[index] = { name: name, url: url };
    Storage.setPlaylists(App._playlists);
  },

  /** Elimina una lista esistente. */
  deletePlaylist: function (index) {
    if (!App._playlists[index]) return;
    App._playlists.splice(index, 1);
    if (App._activePlaylistIndex >= App._playlists.length) {
      App._activePlaylistIndex = Math.max(0, App._playlists.length - 1);
    }
    Storage.setPlaylists(App._playlists);
    Storage.setActivePlaylistIndex(App._activePlaylistIndex);
  },

  exitApp: function () {
    if (typeof tizen !== 'undefined' && tizen.application) {
      try {
        tizen.application.getCurrentApplication().exit();
        return;
      } catch (e) { /* ignora, ricadi sul log */ }
    }
    console.log('Uscita app (nessuna API tizen disponibile: anteprima browser).');
  }
};

document.addEventListener('DOMContentLoaded', App.init);
