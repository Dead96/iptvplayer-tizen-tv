/* Persistenza semplice basata su localStorage (disponibile nella webview Tizen). */
var Storage = {
  KEY_SOURCE_URL: 'iptv.sourceUrl',
  KEY_LEGACY_PLAYLIST_URL: 'iptv.playlistUrl', // versioni precedenti: URL playlist singola
  KEY_ACTIVE_PLAYLIST_INDEX: 'iptv.activePlaylistIndex',
  KEY_LAST_CHANNEL: 'iptv.lastChannelIndex',

  /** URL sorgente configurato: playlist M3U singola oppure indice JSON di piu' liste. */
  getSourceUrl: function () {
    try {
      var v = window.localStorage.getItem(Storage.KEY_SOURCE_URL);
      if (v) return v;
      // Migrazione da versioni precedenti (URL playlist singola).
      return window.localStorage.getItem(Storage.KEY_LEGACY_PLAYLIST_URL) || '';
    } catch (e) {
      return '';
    }
  },

  setSourceUrl: function (url) {
    try {
      window.localStorage.setItem(Storage.KEY_SOURCE_URL, url);
    } catch (e) { /* storage non disponibile, ignora */ }
  },

  getActivePlaylistIndex: function () {
    try {
      var v = window.localStorage.getItem(Storage.KEY_ACTIVE_PLAYLIST_INDEX);
      return v === null ? 0 : parseInt(v, 10);
    } catch (e) {
      return 0;
    }
  },

  setActivePlaylistIndex: function (index) {
    try {
      window.localStorage.setItem(Storage.KEY_ACTIVE_PLAYLIST_INDEX, String(index));
    } catch (e) { /* ignora */ }
  },

  getLastChannelIndex: function () {
    try {
      var v = window.localStorage.getItem(Storage.KEY_LAST_CHANNEL);
      return v === null ? 0 : parseInt(v, 10);
    } catch (e) {
      return 0;
    }
  },

  setLastChannelIndex: function (index) {
    try {
      window.localStorage.setItem(Storage.KEY_LAST_CHANNEL, String(index));
    } catch (e) { /* ignora */ }
  }
};
