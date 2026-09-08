/* Persistenza semplice basata su localStorage (disponibile nella webview Tizen). */
var Storage = {
  KEY_PLAYLISTS: 'iptv.playlists',
  KEY_LEGACY_SOURCE_URL: 'iptv.sourceUrl', // versioni precedenti: un solo URL (playlist o indice)
  KEY_LEGACY_PLAYLIST_URL: 'iptv.playlistUrl', // versioni ancora precedenti: playlist singola
  KEY_ACTIVE_PLAYLIST_INDEX: 'iptv.activePlaylistIndex',
  KEY_LAST_CHANNEL: 'iptv.lastChannelIndex',

  /** @returns {Array<{name:string,url:string}>} le liste configurate dall'utente. */
  getPlaylists: function () {
    try {
      var v = window.localStorage.getItem(Storage.KEY_PLAYLISTS);
      if (!v) return [];
      var parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  setPlaylists: function (playlists) {
    try {
      window.localStorage.setItem(Storage.KEY_PLAYLISTS, JSON.stringify(playlists || []));
    } catch (e) { /* storage non disponibile, ignora */ }
  },

  /** URL configurato da una versione precedente dell'app (prima delle liste con nome), se presente. */
  getLegacySourceUrl: function () {
    try {
      return window.localStorage.getItem(Storage.KEY_LEGACY_SOURCE_URL) ||
        window.localStorage.getItem(Storage.KEY_LEGACY_PLAYLIST_URL) || '';
    } catch (e) {
      return '';
    }
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
