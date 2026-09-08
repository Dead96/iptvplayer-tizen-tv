/*
 * View "Player": riproduzione dello stream del canale selezionato.
 *
 * Su TV Tizen usa l'API nativa AVPlay (webapis.avplay - le API TV-specifiche
 * Samsung vivono sotto il namespace "webapis", non "tizen"), che gestisce
 * HLS/MPEG-TS con le prestazioni migliori. Se AVPlay non e' disponibile (es.
 * anteprima in un browser desktop durante lo sviluppo) si ricade su un normale
 * tag <video>, utile solo per verificare rapidamente l'interfaccia grafica.
 *
 * L'URL del canale e' spesso una "master playlist" HLS con piu' varianti a
 * bitrate diverso: lasciare che AVPlay cambi variante da solo a meta'
 * riproduzione (ABR) puo' perdere l'audio se le varianti usano codifiche audio
 * diverse. Percio' si legge la master playlist e si apre sempre una variante
 * fissa (di default quella di qualita' piu' alta), cambiabile manualmente dal
 * menu dell'OSD (Invio per aprirlo, molti telecomandi Samsung non hanno piu'
 * i tasti colorati fisici quindi la navigazione e' tutta su frecce/invio).
 */
var PlayerView = {
  OSD_TIMEOUT_MS: 4000,
  DEBUG: true, // log diagnostici a schermo (namespace API, variante aperta, eventi/errori nativi)

  _channels: [],
  _currentIndex: 0,
  _usingAvplay: false,
  _osdEl: null,
  _titleEl: null,
  _menuToggleBtn: null,
  _menuPanelEl: null,
  _qualityBtn: null,
  _debugBtn: null,
  _errorEl: null,
  _errorTextEl: null,
  _errorBackBtn: null,
  _errorRetryBtn: null,
  _spinnerEl: null,
  _debugEl: null,
  _fallbackVideo: null,
  _osdTimer: null,
  _retryTimer: null,

  _variants: [], // varianti di bitrate della master playlist del canale corrente
  _variantIndex: 0,
  _errorActive: false,
  _errorFocus: 'retry', // 'back' | 'retry'
  _debugVisible: false,
  _menuState: 'closed', // 'closed' | 'icon' | 'panel'
  _panelFocus: 0, // 0 = voce Qualita', 1 = voce Debug

  init: function () {
    PlayerView._osdEl = document.getElementById('player-osd');
    PlayerView._titleEl = document.getElementById('player-channel-name');
    PlayerView._menuToggleBtn = document.getElementById('player-menu-toggle');
    PlayerView._menuPanelEl = document.getElementById('player-menu');
    PlayerView._qualityBtn = document.getElementById('player-btn-quality');
    PlayerView._debugBtn = document.getElementById('player-btn-debug');
    PlayerView._errorEl = document.getElementById('player-error');
    PlayerView._errorTextEl = document.getElementById('player-error-text');
    PlayerView._errorBackBtn = document.getElementById('player-error-back');
    PlayerView._errorRetryBtn = document.getElementById('player-error-retry');
    PlayerView._spinnerEl = document.getElementById('player-spinner');
    PlayerView._debugEl = document.getElementById('player-debug');
    PlayerView._fallbackVideo = document.getElementById('fallback-video');
    PlayerView._usingAvplay = typeof webapis !== 'undefined' && !!webapis.avplay;

    // Con AVPlay il tag <video> non serve: se resta visibile (sfondo nero opaco)
    // copre il piano video nativo, che il platform compone SOTTO il livello HTML.
    if (PlayerView._usingAvplay) {
      PlayerView._fallbackVideo.style.display = 'none';
    }

    PlayerView._errorBackBtn.addEventListener('click', function () {
      PlayerView._onErrorBack();
    });
    PlayerView._errorRetryBtn.addEventListener('click', function () {
      PlayerView._onErrorRetry();
    });
    PlayerView._menuToggleBtn.addEventListener('click', function () {
      if (PlayerView._menuState === 'panel') {
        PlayerView._closeMenu();
      } else {
        PlayerView._openMenuIcon();
        PlayerView._openPanel();
      }
    });
    PlayerView._qualityBtn.addEventListener('click', function () {
      PlayerView._cycleQuality();
    });
    PlayerView._debugBtn.addEventListener('click', function () {
      PlayerView._toggleDebug();
    });

    PlayerView._debug('Namespace player: ' + (PlayerView._usingAvplay ? 'webapis.avplay' : 'HTML5 <video> (fallback)'));
  },

  /**
   * @param {Array} channels lista canali
   * @param {number} startIndex indice del canale da avviare
   */
  show: function (channels, startIndex) {
    PlayerView._channels = channels || [];
    PlayerView._currentIndex = startIndex || 0;
    Remote.setHandler(PlayerView.handleKey);
    PlayerView._playCurrent();
  },

  /** Da chiamare quando si lascia la view player (torna alla lista canali). */
  stop: function () {
    clearTimeout(PlayerView._osdTimer);
    clearTimeout(PlayerView._retryTimer);
    if (PlayerView._usingAvplay) {
      try { webapis.avplay.stop(); } catch (e) { /* ignora */ }
      try { webapis.avplay.close(); } catch (e) { /* ignora */ }
    } else {
      PlayerView._fallbackVideo.pause();
      PlayerView._fallbackVideo.removeAttribute('src');
      PlayerView._fallbackVideo.load();
    }
  },

  handleKey: function (action) {
    if (PlayerView._errorActive) {
      return PlayerView._handleErrorKey(action);
    }

    if (PlayerView._menuState !== 'closed') {
      return PlayerView._handleMenuKey(action);
    }

    if (action === 'back') {
      PlayerView.stop();
      Storage.setLastChannelIndex(PlayerView._currentIndex);
      App.showChannelList(PlayerView._currentIndex);
      return true;
    }
    if (action === 'right' || action === 'down') {
      PlayerView._changeChannel(1);
      return true;
    }
    if (action === 'left' || action === 'up') {
      PlayerView._changeChannel(-1);
      return true;
    }
    // Alcuni telecomandi Samsung hanno ancora i tasti colorati fisici: se
    // presenti restano scorciatoie dirette, ma non sono richiesti (vedi menu OSD).
    if (action === 'quality') {
      PlayerView._cycleQuality();
      return true;
    }
    if (action === 'debug') {
      PlayerView._toggleDebug();
      return true;
    }
    if (action === 'enter') {
      PlayerView._openMenuIcon();
      return true;
    }
    return false;
  },

  /* Livello 1: l'icona del menu (i tre puntini) ha il focus, il pannello e' chiuso. */
  _openMenuIcon: function () {
    PlayerView._menuState = 'icon';
    clearTimeout(PlayerView._osdTimer); // resta visibile finche' l'utente non esce
    PlayerView._osdEl.classList.add('visible');
    PlayerView._menuToggleBtn.classList.add('focused');
  },

  /* Livello 2: pannello aperto, focus sulla prima voce (Qualita'). */
  _openPanel: function () {
    PlayerView._menuState = 'panel';
    PlayerView._panelFocus = 0;
    PlayerView._menuPanelEl.classList.add('visible');
    PlayerView._updatePanelFocusStyles();
  },

  _closeMenu: function () {
    PlayerView._menuState = 'closed';
    PlayerView._menuToggleBtn.classList.remove('focused');
    PlayerView._menuPanelEl.classList.remove('visible');
    PlayerView._qualityBtn.classList.remove('focused');
    PlayerView._debugBtn.classList.remove('focused');
    PlayerView._showOsd(); // riprende il normale nascondimento automatico
  },

  _handleMenuKey: function (action) {
    if (PlayerView._menuState === 'icon') {
      if (action === 'back') {
        PlayerView._closeMenu();
        return true;
      }
      if (action === 'enter') {
        PlayerView._openPanel();
        return true;
      }
      return true; // in questo livello ignora frecce (un solo elemento)
    }

    // PlayerView._menuState === 'panel'
    if (action === 'back') {
      PlayerView._menuPanelEl.classList.remove('visible');
      PlayerView._menuState = 'icon';
      return true;
    }
    if (action === 'up' || action === 'left') {
      PlayerView._panelFocus = PlayerView._panelFocus === 0 ? 1 : 0;
      PlayerView._updatePanelFocusStyles();
      return true;
    }
    if (action === 'down' || action === 'right') {
      PlayerView._panelFocus = PlayerView._panelFocus === 1 ? 0 : 1;
      PlayerView._updatePanelFocusStyles();
      return true;
    }
    if (action === 'enter') {
      if (PlayerView._panelFocus === 0) {
        PlayerView._cycleQuality();
      } else {
        PlayerView._toggleDebug();
      }
      return true;
    }
    return true;
  },

  _updatePanelFocusStyles: function () {
    PlayerView._qualityBtn.classList.toggle('focused', PlayerView._panelFocus === 0);
    PlayerView._debugBtn.classList.toggle('focused', PlayerView._panelFocus === 1);
  },

  _handleErrorKey: function (action) {
    if (action === 'back') {
      PlayerView._onErrorBack();
      return true;
    }
    if (action === 'left' || action === 'right') {
      PlayerView._errorFocus = PlayerView._errorFocus === 'back' ? 'retry' : 'back';
      PlayerView._updateErrorFocusStyles();
      return true;
    }
    if (action === 'enter') {
      if (PlayerView._errorFocus === 'back') {
        PlayerView._onErrorBack();
      } else {
        PlayerView._onErrorRetry();
      }
      return true;
    }
    return true; // in stato di errore ignora le altre azioni (es. cambio canale)
  },

  _onErrorBack: function () {
    PlayerView.stop();
    Storage.setLastChannelIndex(PlayerView._currentIndex);
    App.showChannelList(PlayerView._currentIndex);
  },

  _onErrorRetry: function () {
    PlayerView._playCurrent();
  },

  _changeChannel: function (delta) {
    var count = PlayerView._channels.length;
    if (count === 0) return;
    PlayerView._currentIndex = (PlayerView._currentIndex + delta + count) % count;
    PlayerView._playCurrent();
  },

  _cycleQuality: function () {
    if (!PlayerView._usingAvplay || PlayerView._variants.length < 2) return;
    PlayerView._variantIndex = (PlayerView._variantIndex + 1) % PlayerView._variants.length;
    var variant = PlayerView._variants[PlayerView._variantIndex];
    PlayerView._debug('Cambio qualita\' manuale: ' + PlayerView._describeVariant(variant) +
      ' (' + (PlayerView._variantIndex + 1) + '/' + PlayerView._variants.length + ')');
    PlayerView._updateQualityButtonLabel();
    PlayerView._openAvplay(variant.url);
  },

  _describeVariant: function (variant) {
    if (!variant) return '?';
    var kbps = Math.round(variant.bandwidth / 1000) + ' kbps';
    if (variant.resolution) {
      return variant.resolution + ' (' + kbps + ')';
    }
    return kbps;
  },

  _updateQualityButtonLabel: function () {
    if (PlayerView._variants.length === 0) {
      PlayerView._qualityBtn.textContent = 'Qualita\': unica';
    } else {
      var variant = PlayerView._variants[PlayerView._variantIndex];
      PlayerView._qualityBtn.textContent = 'Qualita\': ' + PlayerView._describeVariant(variant) +
        ' (' + (PlayerView._variantIndex + 1) + '/' + PlayerView._variants.length + ')';
    }
  },

  _playCurrent: function () {
    var channel = PlayerView._channels[PlayerView._currentIndex];
    if (!channel) return;

    clearTimeout(PlayerView._retryTimer);
    PlayerView._hideError();
    PlayerView._closeMenu();
    PlayerView._debugEl.textContent = '';
    PlayerView._titleEl.textContent = channel.name;
    PlayerView._showOsd();
    PlayerView._showSpinner();
    Storage.setLastChannelIndex(PlayerView._currentIndex);

    if (PlayerView._usingAvplay) {
      PlayerView._playWithAvplay(channel);
    } else {
      PlayerView._playWithFallbackVideo(channel);
    }
  },

  _playWithAvplay: function (channel) {
    fetch(channel.url)
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var variants = M3uParser.parseVariants(text, channel.url);
        if (variants.length > 0) {
          PlayerView._variants = variants;
          PlayerView._variantIndex = variants.length - 1; // di default la piu' alta
          var chosen = variants[PlayerView._variantIndex];
          PlayerView._debug('Master playlist: ' + variants.length + ' varianti, apro ' +
            PlayerView._describeVariant(chosen) + ' (la piu\' alta).');
          PlayerView._updateQualityButtonLabel();
          PlayerView._openAvplay(chosen.url);
        } else {
          PlayerView._variants = [];
          PlayerView._variantIndex = 0;
          PlayerView._debug('Nessuna master playlist rilevata, apro l\'URL originale.');
          PlayerView._updateQualityButtonLabel();
          PlayerView._openAvplay(channel.url);
        }
      })
      .catch(function (e) {
        PlayerView._variants = [];
        PlayerView._debug('Lettura master playlist fallita (' + (e && e.message ? e.message : e) + '), apro l\'URL originale.');
        PlayerView._updateQualityButtonLabel();
        PlayerView._openAvplay(channel.url);
      });
  },

  _openAvplay: function (url) {
    try { webapis.avplay.stop(); } catch (e) { /* nessuno stream precedente */ }
    try { webapis.avplay.close(); } catch (e) { /* nessuno stream precedente */ }

    PlayerView._debug('Apro: ' + url);
    PlayerView._showSpinner();
    try {
      webapis.avplay.open(url);
      var screenWidth = window.screen && window.screen.width ? window.screen.width : 1920;
      var screenHeight = window.screen && window.screen.height ? window.screen.height : 1080;
      webapis.avplay.setDisplayRect(0, 0, screenWidth, screenHeight);
      // Senza questo, AVPlay mostra il video alla sua risoluzione nativa (spesso bassa)
      // ancorato in alto a sinistra invece di scalarlo per riempire il rettangolo impostato.
      try { webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN'); } catch (e) { /* ignora se non supportato */ }
      webapis.avplay.setListener({
        onbufferingstart: function () {
          PlayerView._debug('Buffering...');
          PlayerView._showSpinner();
        },
        onbufferingprogress: function () {},
        onbufferingcomplete: function () {
          PlayerView._debug('Buffering completato.');
          PlayerView._hideSpinner();
        },
        onstreamcompleted: function () {
          PlayerView._debug('Stream terminato.');
          PlayerView._showError('Lo stream si e\' interrotto.');
        },
        oncurrentplaytime: function () {
          PlayerView._hideSpinner();
        },
        onerror: function (err) {
          PlayerView._debug('ERRORE: ' + JSON.stringify(err));
          PlayerView._showError('Impossibile riprodurre il canale.');
        },
        onevent: function (eventType, eventData) {
          PlayerView._debug('Evento: ' + eventType + ' - ' + JSON.stringify(eventData));
        },
        ondrmevent: function () {}
      });

      webapis.avplay.prepareAsync(
        function () {
          try {
            var tracks = webapis.avplay.getTotalTrackInfo();
            var summary = tracks.map(function (t) {
              return t.type + ':' + (t.extra_info || '');
            }).join(' | ');
            PlayerView._debug('Tracce: ' + summary);
          } catch (e) { /* getTotalTrackInfo non disponibile su questa versione */ }
          webapis.avplay.play();
        },
        function () {
          PlayerView._debug('prepareAsync fallito.');
          PlayerView._showError('Impossibile aprire lo stream.');
        }
      );
    } catch (e) {
      PlayerView._debug('Eccezione AVPlay: ' + (e && e.message ? e.message : e));
      PlayerView._showError('Errore AVPlay: ' + (e && e.message ? e.message : e));
    }
  },

  _playWithFallbackVideo: function (channel) {
    var video = PlayerView._fallbackVideo;
    video.src = channel.url;
    video.onerror = function () {
      PlayerView._hideSpinner();
      PlayerView._showError('Impossibile riprodurre il canale in anteprima browser.');
    };
    video.onplaying = function () {
      PlayerView._hideSpinner();
    };
    video.onwaiting = function () {
      PlayerView._showSpinner();
    };
    var playPromise = video.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () { /* riproduzione automatica bloccata dal browser */ });
    }
  },

  _showError: function (message) {
    PlayerView._hideSpinner();
    PlayerView._errorActive = true;
    PlayerView._errorFocus = 'retry';
    PlayerView._errorTextEl.textContent = message;
    PlayerView._errorEl.hidden = false;
    PlayerView._updateErrorFocusStyles();
  },

  _hideError: function () {
    PlayerView._errorActive = false;
    PlayerView._errorEl.hidden = true;
  },

  _updateErrorFocusStyles: function () {
    PlayerView._errorBackBtn.classList.toggle('focused', PlayerView._errorFocus === 'back');
    PlayerView._errorRetryBtn.classList.toggle('focused', PlayerView._errorFocus === 'retry');
  },

  _showSpinner: function () {
    PlayerView._spinnerEl.classList.add('visible');
  },

  _hideSpinner: function () {
    PlayerView._spinnerEl.classList.remove('visible');
  },

  /* Messaggio temporaneo nell'OSD (es. dopo un cambio qualita' manuale). */
  _showOsdMessage: function (message) {
    var hint = document.querySelector('.player-osd-hint');
    var previous = hint.textContent;
    hint.textContent = message;
    PlayerView._showOsd();
    clearTimeout(PlayerView._osdMessageTimer);
    PlayerView._osdMessageTimer = setTimeout(function () {
      hint.textContent = previous;
    }, 2500);
  },

  /* Log diagnostico a schermo (tasto Blu per mostrarlo/nasconderlo), utile in
     assenza di accesso ai log della TV. Il testo si accumula anche mentre il
     pannello e' nascosto, cosi' e' gia' pronto quando lo si riapre. */
  _debug: function (message) {
    if (!PlayerView.DEBUG) return;
    var ts = new Date().toISOString().substr(11, 8);
    var line = '[' + ts + '] ' + message;
    PlayerView._debugEl.textContent = (PlayerView._debugEl.textContent ? PlayerView._debugEl.textContent + '\n' : '') + line;
  },

  _toggleDebug: function () {
    PlayerView._debugVisible = !PlayerView._debugVisible;
    PlayerView._debugEl.classList.toggle('visible', PlayerView._debugVisible);
    PlayerView._debugBtn.textContent = 'Debug: ' + (PlayerView._debugVisible ? 'ON' : 'OFF');
  },

  _showOsd: function () {
    PlayerView._osdEl.classList.add('visible');
    clearTimeout(PlayerView._osdTimer);
    PlayerView._osdTimer = setTimeout(function () {
      PlayerView._osdEl.classList.remove('visible');
    }, PlayerView.OSD_TIMEOUT_MS);
  }
};
