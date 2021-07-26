import * as d3 from 'd3';

const kshf = {
  browsers: [],
  dt: {},
  dt_id: {},

  maxVisibleItems_Default: 100,
  scrollWidth: 19,
  attribPanelWidth: 220,
  catHeight: 18,

  map: {
    // http://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png
    // http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
    // http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png
    // http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png
    // http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png
    // http://tile.stamen.com/watercolor/{z}/{x}/{y}.jpg
    // http://tile.stamen.com/terrain/{z}/{x}/{y}.jpg
    // http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png
    // http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png
    // http://otile{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.png
    tileTemplate: 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    wrapLongitude: 170,
    config: {
      maxBoundsViscosity: 1,
      boxZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
      zoomControl: false,
      worldcopyjump: true,
      /* continuousWorld: true, crs: L.CRS.EPSG3857 */
    },
    tileConfig: {
      attribution: '© <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' +
        ' &amp; <a href="http://cartodb.com/attributions" target="_blank">CartoDB</a>',
      subdomains: 'abcd',
      maxZoom: 19,
      // noWrap: true
    },
    flyConfig: {
      padding: [0, 0],
      pan: { animate: true, duration: 1.2 },
      zoom: { animate: true },
    },
  },

  lang: {
    en: {
      ModifyBrowser: 'Modify browser',
      OpenDataSource: 'Open data source',
      ShowInfoCredits: 'Powered by Payformance<br>Show info',
      ShowFullscreen: 'Fullscreen',
      RemoveFilter: 'Remove filter',
      RemoveAllFilters: 'Remove all filters',
      SaveSelection: 'Save Selection',
      MinimizeSummary: 'Minimize',
      OpenSummary: 'Open',
      MaximizeSummary: 'Maximize',
      RemoveSummary: 'Remove',
      ReverseOrder: 'Reverse order',
      Reorder: 'Reorder',
      ShowMoreInfo: 'Show record info',
      Percentiles: 'Percentiles',
      LockToCompare: 'Lock selection',
      Unlock: 'Unlock',
      ChangeMeasureFunc: 'Change metric',
      Search: 'Search',
      CreatingBrowser: 'Creating Dashboard Browser',
      Rows: 'Rows',
      More: 'More',
      LoadingData: 'Loading data sources',
      ShowAll: 'Show All',
      ScrollToTop: 'Top',
      Percent: 'Percent',
      Absolute: 'Absolute',
      AbsoluteSize: 'Absolute Size',
      PartOfSize: 'Relative Size',
      Width: 'Size',
      DragToFilter: 'Drag',
      And: 'And',
      Or: 'Or',
      Not: 'Not',
      EditTitle: 'Rename',
      ResizeBrowser: 'Resize browser',
      RemoveRecords: 'Remove record panel',
      EditFormula: 'Edit formula',
      NoData: '(No data)',
      ValidData: '(Valid data)',
      ZoomToFit: 'Zoom to fit',
      Close: 'Close',
      Help: 'Help',
    },
    tr: {
      ModifyBrowser: 'Tarayıcıyı düzenle',
      OpenDataSource: 'Veri kaynağını aç',
      ShowInfoCredits: 'Bilgi',
      ShowFullscreen: 'Tam ekran',
      RemoveFilter: 'Filtreyi kaldır',
      RemoveAllFilters: 'Tüm filtreleri kaldır',
      MinimizeSummary: 'Ufalt',
      OpenSummary: 'Aç',
      MaximizeSummary: 'Büyüt',
      RemoveSummary: 'Kaldır',
      ReverseOrder: 'Ters sırala',
      Reorder: 'Yeniden sırala',
      ShowMoreInfo: 'Daha fazla bilgi',
      Percentiles: 'Yüzde',
      LockToCompare: 'Kilitle ve karşılaştır',
      Unlock: 'Kilidi kaldır',
      Search: 'Ara',
      LoadingData: 'Veriler yükleniyor...',
      CreatingBrowser: 'Keşif arayüzü oluşturuluyor...',
      Rows: 'Satır',
      More: 'Daha',
      ShowAll: 'Hepsi',
      ScrollToTop: 'Yukarı',
      Absolute: 'Net',
      Percent: 'Yüzde',
      PartOfSize: 'Görece',
      Width: 'Genişlik',
      DragToFilter: 'Sürükle',
      And: 'Ve',
      Or: 'Veya',
      Not: 'Değil',
      EditTitle: 'Değiştir',
      ResizeBrowser: 'Boyutlandır',
      RemoveRecords: 'Kayıtları kaldır',
      EditFormula: 'Formülü değiştir',
      NoData: '(verisiz)',
      VelidData: '(veri var)',
      ZoomToFit: 'Oto-yakınlaş',
      Close: 'Kapat',
      Help: 'Yardim',
    },
    fr: {
      ModifyBrowser: 'Modifier le navigateur',
      OpenDataSource: 'Ouvrir la source de données',
      ShowInfoCredits: 'Afficher les credits',
      RemoveFilter: 'Supprimer le filtre',
      RemoveAllFilters: 'Supprimer tous les filtres',
      MinimizeSummary: 'Réduire le sommaire',
      OpenSummary: 'Ouvrir le sommaire',
      MaximizeSummary: 'Agrandir le sommaire',
      RemoveSummary: '??',
      ReverseOrder: "Inverser l'ordre",
      Reorder: 'Réorganiser',
      ShowMoreInfo: "Plus d'informations",
      Percentiles: 'Percentiles',
      LockToCompare: 'Bloquer pour comparer',
      Unlock: 'Débloquer',
      Search: 'Rechercher',
      CreatingBrowser: 'Création du navigateur',
      Rows: 'Lignes',
      More: 'Plus',
      LoadingData: 'Chargement des données',
      ShowAll: 'Supprimer les filtres',
      ScrollToTop: 'Début',
      Absolute: 'Absolue',
      Percent: 'Pourcentage',
      PartOfSize: 'Part-Of',
      Width: 'Largeur',
      DragToFilter: '??',
      And: '??',
      Or: '??',
      Not: '??',
      EditFormula: 'Edit Formula',
      NoData: '(No data)',
      ValidData: '(Valid data)',
      ZoomToFit: 'Zoom to fit',
    },
    // translation by github@nelsonmau
    it: {
      ModifyBrowser: 'Modifica il browser',
      OpenDataSource: 'Fonte Open Data',
      ShowInfoCredits: 'Mostra info e crediti',
      ShowFullscreen: 'Schermo intero',
      RemoveFilter: 'Rimuovi il filtro',
      RemoveAllFilters: 'Rimuovi tutti i filtri',
      MinimizeSummary: 'Chiudi il sommario',
      OpenSummary: 'Apri il sommario',
      MaximizeSummary: 'Massimizza il sommario',
      RemoveSummary: 'Rimuovi il sommario',
      ReverseOrder: 'Ordine inverso',
      Reorder: 'Riordina',
      ShowMoreInfo: 'Mostra più informazioni',
      Percentiles: 'Percentuali',
      LockToCompare: 'Blocca per confrontare',
      Unlock: 'Sblocca',
      Search: 'Cerca',
      CreatingBrowser: 'Browser in preparazione - Payformance',
      Rows: 'Righe',
      More: 'Di più',
      LoadingData: 'Carimento delle fonti dati',
      ShowAll: 'Mostra tutto',
      ScrollToTop: 'Torna su',
      Absolute: 'Assoluto',
      Percent: 'Percentuale',
      Relative: 'Relativo',
      Width: 'Larghezza',
      DragToFilter: 'Trascina',
      And: 'E',
      Or: 'O',
      Not: 'No',
      EditTitle: 'Modifica',
      NoData: '(No data)',
      ValidData: '(Valid data)',
      ResizeBrowser: 'Ridimensiona il browser',
      RemoveRecords: 'Rimuovi la visualizzazione dei record',
    },
    cur: null, // Will be set to en if not defined before a browser is loaded
  },

  Util: {
    sortFunc_List_String(a, b) {
      return a.localeCompare(b);
    },
    sortFunc_List_Date(a, b) {
      if (a === null) return -1;
      if (b === null) return 1;
      return b.getTime() - a.getTime(); // recent first
    },
    sortFunc_List_Number(a, b) {
      return b - a;
    },
    /** Given a list of columns which hold multiple IDs, breaks them into an array */
    cellToArray(dt, columns, splitExpr) {
      if (splitExpr === undefined) splitExpr = /\b\s+/;
      let j;
      dt.forEach((p) => {
        p = p.data;
        columns.forEach((column) => {
          let list = p[column];
          if (list === null) return;
          if (typeof list === 'number') {
            p[column] = `${list}`;
            return;
          }
          const list2 = list.split(splitExpr);
          list = [];
          // remove empty "" records
          for (j = 0; j < list2.length; j++) {
            list2[j] = list2[j].trim();
            if (list2[j] !== '') list.push(list2[j]);
          }
          p[column] = list;
        });
      });
    },
    baseMeasureFormat: d3.format('.2s'),
    /** You should only display at most 3 digits + k/m/etc */
    formatForItemCount(n) {
      if (n < 1000) return n;
      return kshf.Util.baseMeasureFormat(n);
    },
    clearArray(arr) {
      while (arr.length > 0) arr.pop();
    },
    ignoreScrollEvents: false,
    scrollToPos_do(scrollDom, targetPos) {
      scrollDom = scrollDom.node();
      kshf.Util.ignoreScrollEvents = true;
      // scroll to top
      let startTime = null;
      const scrollInit = scrollDom.scrollTop;
      const easeFunc = d3.easeCubicOut;
      const scrollTime = 500;
      var animateToTop = function (timestamp) {
        let progress;
        if (startTime === null) startTime = timestamp;
        // complete animation in 500 ms
        progress = (timestamp - startTime) / scrollTime;
        const m = easeFunc(progress);
        scrollDom.scrollTop = (1 - m) * scrollInit + m * targetPos;
        if (scrollDom.scrollTop !== targetPos) {
          window.requestAnimationFrame(animateToTop);
        } else {
          kshf.Util.ignoreScrollEvents = false;
        }
      };
      window.requestAnimationFrame(animateToTop);
    },
    toProperCase(str) {
      return str.toLowerCase().replace(/\b[a-z]/g, f => f.toUpperCase());
    },
    setTransform(dom, transform) {
      dom.style.webkitTransform = transform;
      dom.style.MozTransform = transform;
      dom.style.msTransform = transform;
      dom.style.OTransform = transform;
      dom.style.transform = transform;
    },
    // http://stackoverflow.com/questions/13627308/add-st-nd-rd-and-th-ordinal-suffix-to-a-number
    ordinal_suffix_of(i) {
      let j = i % 10,
        k = i % 100;
      if (j == 1 && k != 11) return `${i}st`;
      if (j == 2 && k != 12) return `${i}nd`;
      if (j == 3 && k != 13) return `${i}rd`;
      return `${i}th`;
    },
  },

  /** -- */
  fontLoaded: false,
  loadFont() {
    if (this.fontLoaded === true) {
      return;
    }
    const WebFontConfig = {
      google: {
        families: [
          'Roboto:400,500,300,100,700:latin',
          'Montserrat:400,700:latin',
          'Roboto+Slab:700',
        ],
      },
    };
    const wf = document.createElement('script');
    wf.src = `${document.location.protocol == 'https:' ? 'https' : 'http'
    }://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js`;
    wf.type = 'text/javascript';
    wf.async = 'true';
    const s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(wf, s);
    this.fontLoaded = true;
  },

  handleResize() {
    this.browsers.forEach((browser) => { browser.updateLayout(); });
  },

  activeTipsy: undefined,
  colorScale: {
    converge: [
      d3.rgb('#ffffd9'),
      d3.rgb('#edf8b1'),
      d3.rgb('#c7e9b4'),
      d3.rgb('#7fcdbb'),
      d3.rgb('#41b6c4'),
      d3.rgb('#1d91c0'),
      d3.rgb('#225ea8'),
      d3.rgb('#253494'),
      d3.rgb('#081d58')],
    diverge: [
      d3.rgb('#8c510a'),
      d3.rgb('#bf812d'),
      d3.rgb('#dfc27d'),
      d3.rgb('#f6e8c3'),
      d3.rgb('#f5f5f5'),
      d3.rgb('#c7eae5'),
      d3.rgb('#80cdc1'),
      d3.rgb('#35978f'),
      d3.rgb('#01665e')],
  },

  /* -- */
  intersects(d3bound, leafletbound) {
    if (d3bound[0][0] > leafletbound._northEast.lng) return false;
    if (d3bound[0][1] > leafletbound._northEast.lat) return false;
    if (d3bound[1][0] < leafletbound._southWest.lng) return false;
    if (d3bound[1][1] < leafletbound._southWest.lat) return false;
    return true;
  },

  /** -- */
  gistPublic: true,
  gistLogin: false,
  getGistLogin() {
    if (this.githubToken === undefined) return;
    d3.request('https://api.github.com/user')
      .header('Authorization', `token ${kshf.githubToken}`)
      .get((error, data) => { kshf.gistLogin = JSON.parse(data.response).login; });
  },

  // kshfLogo: '<svg class="kshfLogo" viewBox="0 0 200 200">' +
  //   '<rect    class="kshfLogo_C1 kshfLogo_B" x="37.2" y="49.1" width="128.5" height="39.7" transform="matrix(-0.7071 0.7071 -0.7071 -0.7071 222.0549 46.0355)" />' +
  //   '<polygon class="kshfLogo_C1 kshfLogo_B" points="42.5,100.6 71,72 163,164.4 134.5,193" />' +
  //   '<polygon class="kshfLogo_C1 " points="132.2,13 53.5,91.3 79.3,117 158,38.7" />' +
  //   '<rect    class="kshfLogo_C2 kshfLogo_B" x="55.1" y="6.4" width="38.3" height="188.8" />' +
  //   '</svg>',

  kshfLogo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 131 131">' +
    '<defs>' +
    '<style>' +
    '.a{fill:#fff; width: 16px;}' +
    '.b{fill:#1c3353;}' +
    '.c{fill:#65abc1;}' +
    '</style>' +
    '</defs>' +
    '<circle class="a" cx="65.5" cy="65.5" r="57"/>' +
    '<path class="b" d="M56.56,84.05h5c18.62,0,31-10.63,31-26.66,0-15.29-11.6-25.48-29.16-25.48H43.53V44H62.92c10,0,16.69,5.41,16.69,13.44,0,8.89-6.72,14.74-16.69,14.74H56.54l-13,11.17v19h13V84.05"/>' +
    '<polyline class="c" points="56.54 72.48 43.53 83.66 43.53 102.67 56.54 102.67 56.54 84.41"/></svg>',
};

export default kshf;
