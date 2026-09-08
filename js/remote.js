/*
 * Gestione input telecomando Samsung.
 * Traduce i keyCode nativi in azioni semantiche e le inoltra
 * a un unico handler attivo (quello della view corrente).
 */
var Remote = {
  KEY: {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK: 10009,
    CH_UP: 427,
    CH_DOWN: 428,
    YELLOW: 405,
    BLUE: 406
  },

  _handler: null,

  init: function () {
    // Registra i tasti extra del telecomando TV (non necessari per frecce/invio).
    if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
      try {
        tizen.tvinputdevice.registerKey('ChannelUp');
        tizen.tvinputdevice.registerKey('ChannelDown');
        tizen.tvinputdevice.registerKey('ColorF2Yellow');
        tizen.tvinputdevice.registerKey('ColorF3Blue');
      } catch (e) {
        // Su alcune versioni Tizen o nel simulatore puo' non essere disponibile: si ignora.
      }
    }

    document.addEventListener('keydown', Remote._onKeyDown);
  },

  /** Imposta l'unico handler attivo: function(action) */
  setHandler: function (fn) {
    Remote._handler = fn;
  },

  // Mappa di riserva su e.key, usata quando keyCode non e' valorizzato
  // (accade con alcuni automatismi di test da browser; sul telecomando
  // Tizen reale e' sempre keyCode a essere popolato correttamente).
  KEY_NAME: {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    Enter: 'enter',
    Escape: 'back',
    y: 'quality',
    b: 'debug'
  },

  _onKeyDown: function (e) {
    var action = null;
    switch (e.keyCode) {
      case Remote.KEY.LEFT: action = 'left'; break;
      case Remote.KEY.RIGHT: action = 'right'; break;
      case Remote.KEY.UP: action = 'up'; break;
      case Remote.KEY.DOWN: action = 'down'; break;
      case Remote.KEY.ENTER: action = 'enter'; break;
      case Remote.KEY.BACK: action = 'back'; break;
      case Remote.KEY.CH_UP: action = 'right'; break;
      case Remote.KEY.CH_DOWN: action = 'left'; break;
      case Remote.KEY.YELLOW: action = 'quality'; break;
      case Remote.KEY.BLUE: action = 'debug'; break;
      default: action = Remote.KEY_NAME[e.key] || null;
    }
    if (!action) return;
    if (Remote._handler) {
      var handled = Remote._handler(action);
      if (handled !== false) e.preventDefault();
    }
  }
};
