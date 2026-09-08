/*
 * Piccola utility DOM condivisa.
 *
 * scrollIntoView({block:'nearest'}) (la forma "moderna" con opzioni) non e'
 * affidabile sul motore WebKit di alcune TV Tizen piu' datate: scorre in una
 * sola direzione o non scorre affatto. Questa funzione replica manualmente lo
 * stesso comportamento ("nearest": scorre solo il minimo indispensabile per
 * rendere l'elemento visibile, sia verso l'alto che verso il basso) usando
 * solo scrollTop/offsetTop, universalmente supportati.
 */
var DomUtil = {
  /**
   * @param {HTMLElement} container elemento con overflow-y: auto/scroll
   * @param {HTMLElement} el elemento figlio da rendere visibile
   */
  scrollIntoViewNearest: function (container, el) {
    if (!container || !el) return;
    var elTop = el.offsetTop;
    var elBottom = elTop + el.offsetHeight;
    var viewTop = container.scrollTop;
    var viewBottom = viewTop + container.clientHeight;

    if (elTop < viewTop) {
      container.scrollTop = elTop;
    } else if (elBottom > viewBottom) {
      container.scrollTop = elBottom - container.clientHeight;
    }
  }
};
