/*
 * Parser per playlist M3U / M3U8 estese (formato IPTV comune):
 *
 * #EXTM3U
 * #EXTINF:-1 tvg-id="rai1" tvg-logo="http://.../rai1.png" group-title="RAI",Rai 1
 * http://server/stream1.m3u8
 * #EXTINF:-1,Canale senza attributi
 * http://server/stream2.ts
 */
var M3uParser = {
  /**
   * @param {string} text contenuto grezzo del file M3U
   * @returns {Array<{id:string,name:string,logo:string,group:string,url:string}>}
   */
  parse: function (text) {
    var channels = [];
    if (!text) return channels;

    var lines = text.split(/\r?\n/);
    var pending = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '#EXTM3U') continue;

      if (line.indexOf('#EXTINF:') === 0) {
        pending = M3uParser._parseExtinf(line);
        continue;
      }

      if (line.indexOf('#') === 0) {
        // altra direttiva M3U (#EXTGRP, #EXTVLCOPT, ecc.) non gestita: ignora
        continue;
      }

      // riga senza cancelletto iniziale: e' l'URL dello stream
      if (pending) {
        pending.url = line;
        pending.id = pending.id || ('ch' + channels.length);
        channels.push(pending);
        pending = null;
      } else {
        // URL senza EXTINF precedente: crea voce minimale
        channels.push({
          id: 'ch' + channels.length,
          name: 'Canale ' + (channels.length + 1),
          logo: '',
          group: '',
          url: line
        });
      }
    }

    return channels;
  },

  _parseExtinf: function (line) {
    var body = line.substring('#EXTINF:'.length);
    var commaIndex = body.indexOf(',');
    var attrsAndDuration = commaIndex >= 0 ? body.substring(0, commaIndex) : body;
    var name = commaIndex >= 0 ? body.substring(commaIndex + 1).trim() : 'Canale';

    var tvgId = M3uParser._extractAttr(attrsAndDuration, 'tvg-id');
    var tvgLogo = M3uParser._extractAttr(attrsAndDuration, 'tvg-logo');
    var groupTitle = M3uParser._extractAttr(attrsAndDuration, 'group-title');

    return {
      id: tvgId || '',
      name: name || 'Canale',
      logo: tvgLogo || '',
      group: groupTitle || '',
      url: ''
    };
  },

  _extractAttr: function (str, attrName) {
    var re = new RegExp(attrName + '="([^"]*)"');
    var m = re.exec(str);
    return m ? m[1] : '';
  },

  /**
   * Se il testo e' una "master playlist" HLS (#EXT-X-STREAM-INF con piu' varianti
   * a bitrate diverso), restituisce l'elenco delle varianti (URL assoluto + bitrate),
   * ordinate dal bitrate piu' basso al piu' alto. Se non e' una master playlist
   * (nessuna variante trovata), restituisce un array vuoto: il chiamante deve in
   * quel caso usare l'URL originale della playlist cosi' com'e'.
   *
   * @param {string} text contenuto della playlist
   * @param {string} baseUrl URL della playlist stessa, per risolvere URI relativi
   * @returns {Array<{bandwidth:number, resolution:string, url:string}>} "resolution"
   *   e' una stringa "LARGHEZZAxALTEZZA" se presente nella playlist, altrimenti ''.
   */
  parseVariants: function (text, baseUrl) {
    if (!text) return [];
    var lines = text.split(/\r?\n/);
    var variants = [];
    var pending = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
        var bwMatch = /BANDWIDTH=(\d+)/.exec(line);
        var resMatch = /RESOLUTION=(\d+x\d+)/.exec(line);
        pending = {
          bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : Number.MAX_SAFE_INTEGER,
          resolution: resMatch ? resMatch[1] : ''
        };
        continue;
      }

      if (line.indexOf('#') === 0) continue;

      if (pending !== null) {
        var resolvedUrl;
        try {
          resolvedUrl = new URL(line, baseUrl).href;
        } catch (e) {
          resolvedUrl = line;
        }
        variants.push({ bandwidth: pending.bandwidth, resolution: pending.resolution, url: resolvedUrl });
        pending = null;
      }
    }

    variants.sort(function (a, b) { return a.bandwidth - b.bandwidth; });
    return variants;
  }
};
