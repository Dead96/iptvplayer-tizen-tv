/*
 * Indice di piu' playlist: un semplice file JSON, ospitato sulla stessa rete
 * locale, con questa forma:
 *
 * [
 *   { "name": "Lista Principale", "url": "http://192.168.1.10:8080/playlist.m3u8" },
 *   { "name": "Sport", "url": "http://192.168.1.10:8080/sport.m3u8" }
 * ]
 *
 * Serve per evitare di dover digitare piu' URL sulla tastiera della TV: si
 * scrive/aggiorna questo file una volta sola sul PC, e l'app lo rilegge ogni
 * volta mostrando l'elenco delle liste disponibili.
 */
var PlaylistsIndex = {
  /**
   * @param {string} text contenuto scaricato dall'URL sorgente
   * @returns {Array<{name:string,url:string}>|null} l'elenco se il testo e'
   *   un indice JSON valido, altrimenti null (il chiamante deve trattare il
   *   testo come una singola playlist M3U).
   */
  parse: function (text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    var playlists = [];
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (!item || typeof item.url !== 'string' || !item.url) return null;
      playlists.push({
        name: typeof item.name === 'string' && item.name ? item.name : ('Lista ' + (i + 1)),
        url: item.url
      });
    }
    return playlists;
  }
};
