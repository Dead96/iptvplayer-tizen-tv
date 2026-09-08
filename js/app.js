/*
 * Controller principale: gestisce le view e il flusso dell'app.
 *
 * L'URL configurato in Impostazioni puo' essere:
 *  - l'URL diretto di una playlist M3U/M3U8 (comportamento originale, un'unica
 *    lista senza nome, l'intestazione mostra semplicemente "Canali"); oppure
 *  - l'URL di un piccolo indice JSON che elenca piu' playlist con nome
 *    (vedi js/playlistsIndex.js) — in questo caso l'intestazione mostra il
 *    nome della lista attiva e compare il pulsante "Liste" per cambiarla.
 */
var App = {
  _channels: [],
  _views: {},
  _playlists: [], // [] in modalita' playlist singola, altrimenti le liste dell'indice
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

    var savedUrl = Storage.getSourceUrl();
    if (savedUrl) {
      App.loadSource(savedUrl, { isInitial: true });
    } else {
      App.showSettings({ allowBack: false });
    }
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

  showSettings: function (opts) {
    App.showView('settings');
    SettingsView.show({
      currentUrl: Storage.getSourceUrl(),
      allowBack: !!(opts && opts.allowBack),
      onSave: function (url) {
        App.loadSource(url, { isInitial: false });
      }
    });
  },

  showChannelList: function (focusIndex) {
    App.showView('channels');
    var activeName = (App._playlists.length > 1 && App._playlists[App._activePlaylistIndex])
      ? App._playlists[App._activePlaylistIndex].name
      : 'Canali';
    document.getElementById('channels-title').textContent = activeName;
    ChannelListView.show(App._channels, focusIndex, App._playlists, App._activePlaylistIndex);
  },

  playChannel: function (index) {
    App.showView('player');
    PlayerView.show(App._channels, index);
  },

  /**
   * Carica l'URL configurato dall'utente: rileva da solo se e' un indice JSON
   * di piu' liste o una playlist M3U singola, e mostra la lista canali.
   */
  loadSource: function (url, opts) {
    opts = opts || {};
    App.showLoading('Caricamento...');

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var index = PlaylistsIndex.parse(text);
        Storage.setSourceUrl(url);

        if (index) {
          App._playlists = index;
          var savedIndex = opts.isInitial ? Storage.getActivePlaylistIndex() : 0;
          App._activePlaylistIndex = (savedIndex >= 0 && savedIndex < index.length) ? savedIndex : 0;
          return App._loadActivePlaylist(opts);
        }

        // Non e' un indice valido: trattalo come playlist M3U singola.
        App._playlists = [];
        App._activePlaylistIndex = 0;
        App._channels = M3uParser.parse(text);
        var startIndex = opts.isInitial ? Storage.getLastChannelIndex() : 0;
        App.showChannelList(startIndex);
      })
      .catch(function (err) {
        App.showSettings({ allowBack: !opts.isInitial || App._channels.length > 0 });
        var errorEl = document.getElementById('settings-error');
        errorEl.textContent = 'Impossibile caricare (' +
          (err && err.message ? err.message : err) + ').';
      });
  },

  /** Scarica e mostra la playlist della lista attualmente selezionata (modalita' indice). */
  _loadActivePlaylist: function (opts) {
    opts = opts || {};
    var playlist = App._playlists[App._activePlaylistIndex];
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

  /** Cambia la lista attiva (modalita' indice multi-lista) e mostra i suoi canali. */
  selectPlaylist: function (index) {
    if (index < 0 || index >= App._playlists.length) return;
    App._activePlaylistIndex = index;
    Storage.setActivePlaylistIndex(index);
    App._loadActivePlaylist({ isInitial: false }).catch(function (err) {
      App.showSettings({ allowBack: true });
      var errorEl = document.getElementById('settings-error');
      errorEl.textContent = 'Impossibile caricare la lista (' +
        (err && err.message ? err.message : err) + ').';
    });
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
