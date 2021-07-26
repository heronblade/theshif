import * as d3 from 'd3';
import kshf from './kshf';
import SummaryInterval from './summaryInterval';
import SummaryBase from './summaryBase';
import Tipsy from './tipsy';

function RecordDisplay(browser, config) {
  const me = this;
  this.browser = browser;
  this.DOM = {};

  this.config = config;

  this.sortColWidth = this.config.sortColWidth || 50; // default is 50 px

  // this is the default behavior. No demo un-set's this. Keeping for future reference.
  this.autoExpandMore = true;
  this.collapsed = false;

  this.maxVisibleItems_Default = config.maxVisibleItems_Default || kshf.maxVisibleItems_Default;
  this.maxVisibleItems = this.maxVisibleItems_Default; // This is the dynamic property

  this.showRank = config.showRank || false;
  this.visMouseMode = 'pan';

  this.viewRecAs = 'list'; // Default. Options: 'grid', 'list', 'map', 'nodelink'

  this.linkBy = config.linkBy || [];
  if (!Array.isArray(this.linkBy)) this.linkBy = [this.linkBy];

  // implicitly set record view
  if (config.geo) this.viewRecAs = 'map';
  if (config.linkBy) this.viewRecAs = 'nodelink';
  // explicit setting by API
  if (config.displayType) this.viewRecAs = config.displayType;

  this.detailsToggle = config.detailsToggle || 'zoom'; // 'one', 'zoom', 'off' (any other string counts as off)

  this.textSearchSummary = null;
  this.recordViewSummary = null;

  this.sortAttrib = null;
  this.scatterAttrib = null;
  this.colorAttrib = null;

  if (config.scatterBy) this.setScatterAttrib(browser.summaries_by_name[config.scatterBy]);

  /** *********
   * SORTING OPTIONS
   ************************************************************************ */
  this.sortingOpts = config.sortBy || [{ name: this.browser.records[0].idIndex }]; // Sort by id by default
  if (!Array.isArray(this.sortingOpts)) this.sortingOpts = [this.sortingOpts];

  this.prepSortingOpts();
  const firstSortOpt = this.sortingOpts[0];
  // Add all interval summaries as sorting options
  this.browser.summaries.forEach(function (summary) {
    if (!(summary instanceof SummaryInterval)) return;
    if (summary.panel === undefined) return; // Needs to be within view
    this.addSortingOption(summary);
  }, this);
  this.prepSortingOpts();
  this.alphabetizeSortingOptions();

  if (this.sortingOpts.length > 0) {
    this.setSortAttrib(firstSortOpt || this.sortingOpts[0]);
  }

  this.DOM.root = this.browser.DOM.root.select('.recordDisplay')
    .attr('detailsToggle', this.detailsToggle)
    .attr('showRank', this.showRank)
    .attr('visMouseMode', this.visMouseMode);
  // .attrs({
  //   detailsToggle: this.detailsToggle,
  //   showRank: this.showRank,
  //   visMouseMode: this.visMouseMode,
  // });

  this.DOM.root.append('div').attr('class', 'dropZone dropZone_recordView')
    .on('mouseenter', function () { this.setAttribute('readyToDrop', true); })
    .on('mouseleave', function () { this.setAttribute('readyToDrop', false); })
    .on('mouseup', (event) => {
      const movedSummary = me.browser.movedSummary;
      if (movedSummary === null || movedSummary === undefined) return;

      movedSummary.refreshThumbDisplay();
      me.setRecordViewSummary(movedSummary);

      if (me.textSearchSummary === null) me.setTextSearchSummary(movedSummary);

      me.browser.updateLayout();
    })
    .append('div')
    .attr('class', 'dropIcon fa fa-list-ul');

  this.initDOM_RecordDisplayHeader();

  this.DOM.recordDisplayWrapper = this.DOM.root.append('div').attr('class', 'recordDisplayWrapper');

  if (config.recordView !== undefined) {
    if (typeof (config.recordView) === 'string') {
      // it may be a function definition if so, evaluate
      if (config.recordView.substr(0, 8) === 'function') {
        // Evaluate string to a function!!
        eval(`"use strict"; config.recordView = ${config.recordView}`);
      }
    }

    this.setRecordViewSummary(
      (typeof config.recordView === 'string') ?
        this.browser.summaries_by_name[config.recordView]
        :
        this.browser.createSummary('_Records', config.recordView, 'categorical'),
    );
  }

  if (config.recordView_Brief !== undefined) {
    if (typeof (config.recordView_Brief) === 'string') {
      if (config.recordView_Brief.substr(0, 8) === 'function') {
        eval(`"use strict"; config.recordView_Brief = ${config.recordView_Brief}`);
      }
    }
    this.setRecordViewBriefSummary(
      (typeof config.recordView_Brief === 'string') ?
        this.browser.summaries_by_name[config.recordView_Brief]
        :
        this.browser.createSummary('_Records_Brief', config.recordView_Brief, 'categorical'),
    );
  }

  if (config.textSearch) {
    // Find the summary. If it is not there, create it
    if (typeof (config.textSearch) === 'string') {
      this.setTextSearchSummary(this.browser.summaries_by_name[config.textSearch]);
    } else {
      const name = config.textSearch.name;
      const value = config.textSearch.value;
      if (name !== undefined) {
        let summary = this.browser.summaries_by_name[config.textSearch];
        if (!summary) {
          if (typeof (value) === 'function') {
            summary = browser.createSummary(name, value, 'categorical');
          } else if (typeof (value) === 'string') {
            summary = browser.changeSummaryName(value, name);
          }
        }
        this.setTextSearchSummary(summary);
      }
    }
  }
}

RecordDisplay.prototype.setHeight = function setHeight(v) {
  if (this.recordViewSummary === null) return;
  const me = this;
  this.curHeight = v;
  this.DOM.recordDisplayWrapper.style('height', `${v}px`);
  if (this.viewRecAs === 'map') {
    setTimeout(() => { me.leafletRecordMap.invalidateSize(); }, 1000);
  }
  if (this.viewRecAs === 'scatter') {
    this.refreshScatterVis(true);
  }
};

RecordDisplay.prototype.setWidth = function setWidth(v) {
  if (this.recordViewSummary === null) return;
  const me = this;
  this.curWidth = v;
  if (this.viewRecAs === 'map') {
    setTimeout(() => { me.leafletRecordMap.invalidateSize(); }, 1000);
  }
  if (this.viewRecAs === 'scatter') {
    this.refreshScatterVis(true);
  }
};
/** Encode by color or by sorting */
RecordDisplay.prototype.getRecordEncoding = function getRecordEncoding() {
  if (this.viewRecAs === 'map' || this.viewRecAs === 'nodelink') return 'color';
  if (this.viewRecAs === 'scatter') return 'scatter';
  return 'sort';
};

RecordDisplay.prototype.recMap_refreshColorScaleBins = function recMap_refreshColorScaleBins() {
  let invertColorScale = false;
  if (this.sortAttrib) invertColorScale = this.sortAttrib.invertColorScale;
  const mapColorTheme = kshf.colorScale[this.browser.mapColorTheme];
  this.DOM.recordColorScaleBins
    .style('background-color', d => mapColorTheme[invertColorScale ? (8 - d) : d]);
};

RecordDisplay.prototype.recMap_projectRecords = function recMap_projectRecords() {
  const me = this;
  this.DOM.kshfRecords.attr('d', record => me.recordGeoPath(record._geoFeat_));
};

RecordDisplay.prototype.recMap_zoomToActive = function recMap_zoomToActive() {
  // Insert the bounds for each record path
  const bs = [];
  this.browser.records.forEach((record) => {
    if (!record.isWanted) return;
    if (record._geoBound_ === undefined) return;
    const b = record._geoBound_;
    if (isNaN(b[0][0])) return;
    // Change wrapping (US World wrap issue)
    if (b[0][0] > kshf.map.wrapLongitude) b[0][0] -= 360;
    if (b[1][0] > kshf.map.wrapLongitude) b[1][0] -= 360;
    bs.push(L.latLng(b[0][1], b[0][0]));
    bs.push(L.latLng(b[1][1], b[1][0]));
  });

  const bounds = new L.latLngBounds(bs);
  if (!this.browser.finalized) { // First time: just fit bounds
    this.leafletRecordMap.fitBounds(bounds);
  } else {
    this.leafletRecordMap.flyToBounds(bounds, kshf.map.flyConfig);
  }
};

RecordDisplay.prototype.initDOM_RecordDisplayHeader = function initDOM_RecordDisplayHeader() {
  const me = this;

  this.DOM.recordDisplayHeader = this.DOM.root.append('div').attr('class', 'recordDisplayHeader');

  this.DOM.recordColorScaleBins = this.DOM.recordDisplayHeader.append('div').attr('class', 'recordColorScale')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'w', title: 'Change color scale' }); })
    .on('mouseover', function () { this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('click', () => {
      me.browser.mapColorTheme = (me.browser.mapColorTheme === 'converge') ? 'diverge' : 'converge';
      me.refreshRecordColors();
      me.recMap_refreshColorScaleBins();
      me.sortAttrib.map_refreshColorScale();
    })
    .selectAll('.recordColorScaleBin')
    .data([0, 1, 2, 3, 4, 5, 6, 7, 8])
    .enter()
    .append('div')
    .attr('class', 'recordColorScaleBin');

  this.recMap_refreshColorScaleBins();

  this.DOM.itemRank_control = this.DOM.recordDisplayHeader.append('div').attr('class', 'itemRank_control fa')
    .each(function () {
      this.tipsy = new Tipsy(this, { gravity: 'n',
        title() { return `${me.showRank ? 'Hide' : 'Show'} ranking`; } });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.setShowRank(!me.showRank); });

  this.initDOM_SortSelect();
  this.initDOM_GlobalTextSearch();

  // Change record display view
  let x = this.DOM.recordDisplayHeader.append('span').attr('class', 'recordDisplay_ViewGroup');
  x.append('span').text('View ').attr('class', 'recordView_HeaderSet');
  x = x.append('span').attr('class', 'pofffffff');
  x.selectAll('span.fa').data([
    { v: 'List', i: 'list-ul' },
    { v: 'Map', i: 'globe' },
    { v: 'NodeLink', i: 'share-alt' }],
  ).enter()
    .append('span')
    .attr('class', d => `recordDisplay_ViewAs${d.v}`)
    .each(function (d) { this.tipsy = new Tipsy(this, { gravity: 'n', title() { return d.v; } }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function (d) { this.tipsy.hide(); me.viewAs(d.v); })
    .append('span')
    .attr('class', d => ` fa fa-${d.i}`);
  x.append('span').attr('class', 'recordDisplay_ViewAsScatter')
    .each(function (d) { this.tipsy = new Tipsy(this, { gravity: 'n', title: 'Scatter' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.viewAs('scatter'); })
    .html('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24">' +
        '<path d="M 0 0 L 0 23 L 0 24 L 1 24 L 24 24 L 24 22 L 2 22 L 2 0 L 0 0 z"></path>' +
        '<circle cx="10" cy="10" r="3"/><circle cx="18" cy="15" r="3"/><circle cx="19" cy="7" r="3"/>' +
        '<circle cx="8" cy="17" r="3"/>' +
        '</svg>');


  this.DOM.recordDisplayName = this.DOM.recordDisplayHeader.append('div')
    .attr('class', 'recordDisplayName')
    .html(this.browser.recordName);

  // Collapse record display button
  this.DOM.recordDisplayHeader.append('div')
    .attr('class', 'buttonRecordViewCollapse fa fa-compress')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'e', title: 'Collapse' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.collapseRecordViewSummary(true); });
  // Expand record display button
  this.DOM.recordDisplayHeader.append('div')
    .attr('class', 'buttonRecordViewExpand fa fa-expand')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'e', title: 'Open' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.collapseRecordViewSummary(false); });
  // Remove record display button
  this.DOM.buttonRecordViewRemove = this.DOM.recordDisplayHeader.append('div')
    .attr('class', 'buttonRecordViewRemove fa fa-times-circle-o')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'ne', title: kshf.lang.cur.RemoveRecords }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.removeRecordViewSummary(); });

  this.DOM.scrollToTop = this.DOM.recordDisplayHeader.append('div').attr('class', 'scrollToTop fa fa-arrow-up')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'e', title: kshf.lang.cur.ScrollToTop }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); kshf.Util.scrollToPos_do(me.DOM.recordGroup, 0); });
};

RecordDisplay.prototype.initDOM_SortSelect = function initDOM_SortSelect() {
  const me = this;

  this.DOM.recordSortOptions = this.DOM.recordDisplayHeader.append('div').attr('class', 'recordSortOptions');

  this.DOM.recordSortSelectbox = this.DOM.recordSortOptions.append('select')
    .attr('class', 'recordSortSelectbox')
    .on('change', function () { me.setSortAttrib(this.selectedOptions[0].__data__); });

  this.refreshSortingOptions();

  this.DOM.recordDisplayHeader.append('span')
    .attr('class', 'recordReverseSortButton sortButton fa')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'w', title: kshf.lang.cur.ReverseOrder }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      me.sortAttrib.inverse = !me.sortAttrib.inverse;
      this.setAttribute('inverse', me.sortAttrib.inverse);
      // TODO: Do not show no-value items on top, reversing needs to be a little smarter.
      me.browser.records.reverse();

      me.updateRecordRanks();
      me.refreshRecordDOM();
      me.refreshRecordRanks(me.DOM.recordRanks);

      me.refreshRecordDOMOrder();
    });
};

RecordDisplay.prototype.initDOM_GlobalTextSearch = function initDOM_GlobalTextSearch() {
  const me = this;

  this.DOM.recordTextSearch = this.DOM.recordDisplayHeader.append('span').attr('class', 'recordTextSearch');

  const x = this.DOM.recordTextSearch.append('div').attr('class', 'dropZone_textSearch')
    .on('mouseenter', function () { this.style.backgroundColor = 'rgb(255, 188, 163)'; })
    .on('mouseleave', function () { this.style.backgroundColor = ''; })
    .on('mouseup', () => { me.setTextSearchSummary(me.movedSummary); });
  x.append('div').attr('class', 'dropZone_textSearch_text').text('Text search');

  const processKeyEvent = function (dom) {
    me.textFilter.setQueryString(dom.value);

    if (event.key === 'Enter') { // Enter pressed
      dom.tipsy.hide();
      if (d3.event.shiftKey) {
        // Compare selection
        if (me.textFilter.queryString !== '') {
          me.browser.setSelect_Compare();
        } else {
          me.textFilter.clearFilter();
        }
      } else {
        // Filter selection
        if (me.textFilter.queryString !== '') {
          me.textFilter.addFilter();
        } else {
          me.textFilter.clearFilter();
        }
      }
      return;
    }

    // Highlight selection
    if (dom.timer) clearTimeout(dom.timer);
    dom.timer = setTimeout(() => {
      if (me.textFilter.filterQuery.length == 0) {
        dom.tipsy.hide();
        me.browser.clearSelect_Highlight();
        return;
      }
      dom.tipsy.show();
      // Highlight selection
      const summaryID = me.textSearchSummary.summaryID;
      const records = [];
      me.browser.records.forEach((record) => {
        let v = record._valueCache[summaryID];
        let f = false;
        if (v) {
          v = (`${v}`).toLowerCase();
          if (me.textFilter.multiMode === 'or') {
            f = !me.textFilter.filterQuery.every(v_i => v.indexOf(v_i) === -1);
          } else if (me.textFilter.multiMode === 'and') {
            f = me.textFilter.filterQuery.every(v_i => v.indexOf(v_i) !== -1);
          }
          if (f) records.push(record);
        }
      });
      me.browser.clearSelect_Highlight();
      me.browser.flexAggr_Highlight.records = records;
      me.browser.flexAggr_Highlight.summary = me.textSearchSummary;
      me.browser.flexAggr_Highlight.data = { id: `*${me.textFilter.queryString}*` };
      me.browser.setSelect_Highlight();
      dom.timer = null;
    }, 250);
  };

  this.DOM.recordTextSearch.append('i').attr('class', 'fa fa-search searchIcon');
  this.DOM.recordTextSearch.append('input').attr('type', 'text').attr('class', 'textSearchInput')
    .each(function () {
      this.tipsy = new Tipsy(this, { gravity: 'n',
        title: '<b><u>Enter</u></b> to filter <i class="fa fa-filter"></i><br><br>' +
            '<b><u>Shift+Enter</u></b> to lock <i class="fa fa-lock"></i>' });
    })
    .on('blur', function () { this.tipsy.hide(); })
    .on('keydown', () => { d3.event.stopPropagation(); })
    .on('keypress', () => { d3.event.stopPropagation(); })
    .on('keyup', function () {
      processKeyEvent(this);
      d3.event.stopPropagation();
    });
  this.DOM.recordTextSearch.append('span').attr('class', 'fa fa-times-circle clearSearchText')
    .attr('mode', 'and')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'ne', title: kshf.lang.cur.RemoveFilter }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.textFilter.clearFilter(); });

  this.DOM.recordTextSearch.selectAll('.textSearchMode').data(['and', 'or']).enter()
    .append('span')
    .attr('class', 'textSearchMode')
    .attr('mode', d => d)
    .each(function (d) {
      this.tipsy = new Tipsy(this, {
        gravity: 'ne',
        title: (d === 'and') ? 'All words<br> must appear.' : 'At least one word<br> must appear.' });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function (d) {
      this.tipsy.hide();
      me.DOM.recordTextSearch.attr('mode', d);
      me.textFilter.multiMode = d;
      me.textFilter.addFilter();
    });
};

RecordDisplay.prototype.setDrawSelect = function setDrawSelect(v) {
  this.drawSelect = v;
  this.DOM.recordDisplayWrapper.attr('drawSelect', this.drawSelect);
};

RecordDisplay.prototype.initDOM_MapView = function initDOM_MapView() {
  const me = this;
  if (this.DOM.recordBase_Map) {
    this.DOM.recordGroup = this.DOM.recordMap_SVG.select('.recordGroup');
    this.DOM.kshfRecords = this.DOM.recordGroup.selectAll('.kshfRecord');
    return; // Do not initialize twice
  }

  this.DOM.recordBase_Map = this.DOM.recordDisplayWrapper.append('div').attr('class', 'recordBase_Map');

  // init _geo_ property
  let _geo_ = this.config.geo;
  if (typeof _geo_ === 'string') {
    if (_geo_.substr(0, 8) === 'function') {
      eval(`"use strict"; _geo_ = ${_geo_}`);
    } else {
      const x = _geo_;
      _geo_ = function () { return this[x]; };
    }
  }
  // Compute _geoFeat_ of each record
  this.browser.records.forEach((record) => {
    const feature = _geo_.call(record.data);
    if (feature) record._geoFeat_ = feature;
  });
  // Compute _geoBound_ of each record
  this.browser.records.forEach((record) => {
    if (record._geoFeat_) record._geoBound_ = d3.geoBounds(record._geoFeat_);
  });

  this.spatialFilter = this.browser.createFilter('spatial', this);

  function updateRectangle(bounds) {
    const north_west = me.leafletRecordMap.latLngToLayerPoint(bounds.getNorthWest());
    const south_east = me.leafletRecordMap.latLngToLayerPoint(bounds.getSouthEast());
    this.style.left = `${north_west.x}px`;
    this.style.top = `${north_west.y}px`;
    this.style.height = `${Math.abs(south_east.y - north_west.y)}px`;
    this.style.width = `${Math.abs(south_east.x - north_west.x)}px`;
  }

  this.leafletRecordMap = L.map(this.DOM.recordBase_Map.node(), kshf.map.config)
    .addLayer(new L.TileLayer(kshf.map.tileTemplate, kshf.map.tileConfig))
    .setView(L.latLng(0, 0), 0)
    .on('viewreset', () => {
      me.recMap_projectRecords();
    })
    .on('movestart', function () {
      me.DOM.recordDisplayWrapper.attr('dragging', true);
      me.browser.DOM.root.attr('pointerEvents', false);
      this._zoomInit_ = this.getZoom();
    })
    .on('moveend', function () {
      me.DOM.recordDisplayWrapper.attr('dragging', null);
      me.browser.DOM.root.attr('pointerEvents', true);
      me.refreshViz_Compare_All();
      me.refreshQueryBox_Filter();
      me.DOM.recordDisplayWrapper.select('.spatialQueryBox_Highlight')
        .each(function (d) {
          const bounds = me.browser.flexAggr_Highlight.bounds;
          if (bounds) updateRectangle.call(this, bounds);
        });
      me.DOM.recordDisplayWrapper.selectAll("[class*='spatialQueryBox_Comp']")
        .each(function (d) {
          const bounds = me.browser[`flexAggr_${d}`].bounds;
          if (bounds) updateRectangle.call(this, bounds);
        });
      if (this.getZoom() !== this._zoomInit_) me.recMap_projectRecords();
    });

  this.recordGeoPath = d3.geoPath().projection(
    d3.geoTransform({
      // Use Leaflet to implement a D3 geometric transformation.
      point(x, y) {
        if (x > kshf.map.wrapLongitude) x -= 360;
        const point = me.leafletRecordMap.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
      },
    }),
  );

  this.insertQueryBoxes(this.DOM.recordBase_Map.select('.leaflet-overlay-pane'),
    (t) => {
      if (d3.event.which !== 1) return; // only respond to left-click
      me.setDrawSelect('Drag');
      me.DOM.recordDisplayWrapper.attr('dragging', true);
      let bounds;
      d3.select('body').on('mousemove', (e) => {
        const curPos = d3.mouse(me.DOM.recordBase_Map.select('.leaflet-tile-pane').node());
        // var curLatLong = me.leafletRecordMap.layerPointToLatLng(L.point(curPos[0], curPos[1]));
        const north_west = me.leafletRecordMap.latLngToLayerPoint(me.spatialFilter.bounds.getNorthWest());
        const south_east = me.leafletRecordMap.latLngToLayerPoint(me.spatialFilter.bounds.getSouthEast());
        if (t === 'l') {
          north_west.x = curPos[0];
        }
        if (t === 'r') {
          south_east.x = curPos[0];
        }
        if (t === 't') {
          north_west.y = curPos[1];
        }
        if (t === 'b') {
          south_east.y = curPos[1];
        }
        bounds = L.latLngBounds([
          me.leafletRecordMap.layerPointToLatLng(L.point(north_west.x, north_west.y)),
          me.leafletRecordMap.layerPointToLatLng(L.point(south_east.x, south_east.y)),
        ]);
        me.refreshQueryBox_Filter(bounds);
      }).on('mouseup', () => {
        me.spatialFilter.bounds = bounds;
        me.spatialFilter.addFilter();
        me.setDrawSelect(null);
        me.DOM.recordDisplayWrapper.attr('dragging', null);
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
      d3.event.stopPropagation();
    },
    (t) => {
      if (d3.event.which !== 1) return; // only respond to left-click
      me.setDrawSelect('Drag');
      me.DOM.recordDisplayWrapper.attr('dragging', true);
      const initPos = d3.mouse(me.DOM.recordBase_Map.select('.leaflet-tile-pane').node());
      const north_west = me.leafletRecordMap.latLngToLayerPoint(me.spatialFilter.bounds.getNorthWest());
      const south_east = me.leafletRecordMap.latLngToLayerPoint(me.spatialFilter.bounds.getSouthEast());
      d3.select('body').on('mousemove', (e) => {
        const curPos = d3.mouse(me.DOM.recordBase_Map.select('.leaflet-tile-pane').node());
        const difPos = [initPos[0] - curPos[0], initPos[1] - curPos[1]];
        // TODO: Move the bounds, do not draw a new one
        const bounds = L.latLngBounds([
          me.leafletRecordMap.layerPointToLatLng(
            L.point(north_west.x - difPos[0], north_west.y - difPos[1])),
          me.leafletRecordMap.layerPointToLatLng(
            L.point(south_east.x - difPos[0], south_east.y - difPos[1])),
        ]);
        me.spatialFilter.bounds = bounds;
        me.refreshQueryBox_Filter(bounds);
      }).on('mouseup', () => {
        me.spatialFilter.addFilter();
        me.setDrawSelect(null);
        me.DOM.recordDisplayWrapper.attr('dragging', null);
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
      d3.event.stopPropagation();
    },
    function (d) {
      if (d === 'Filter') {
        me.spatialFilter.clearFilter();
      } else if (d !== 'Highlight') {
        me.browser.clearSelect_Compare(d.substr(8));
      }
      this.tipsy.hide();
    },
  );

  this.drawSelect = null;
  this.DOM.recordBase_Map.select('.leaflet-tile-pane')
    .on('mousedown', function () {
      if (me.visMouseMode !== 'draw') return;
      if (me.drawSelect === 'Highlight') return;
      me.DOM.recordDisplayWrapper.attr('dragging', true);
      me.setDrawSelect('Filter');
      me.drawingStartPoint = me.leafletRecordMap
        .layerPointToLatLng(L.point(d3.mouse(this)[0], d3.mouse(this)[1]));
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('mouseup', () => {
      if (me.drawSelect === 'Drag') return;
      if (me.visMouseMode !== 'draw') return;
      me.DOM.recordDisplayWrapper.attr('dragging', null);
      if (me.drawSelect === 'Filter') {
        me.spatialFilter.addFilter();
      } else if (me.drawSelect === 'Highlight') {
        const bounds = me.browser.flexAggr_Highlight.bounds;
        const cT = me.browser.setSelect_Compare(false, true);
        me.browser[`flexAggr_Compare_${cT}`].bounds = bounds;
        me.DOM.recordDisplayWrapper.select(`.spatialQueryBox_Compare_${cT}`)
          .attr('active', true)
          .each(function () { updateRectangle.call(this, bounds); });
      }
      me.setDrawSelect(null);
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('mousemove', function () {
      if (me.visMouseMode !== 'draw') return;
      if (me.drawSelect === 'Drag') return;
      if (me.drawSelect !== 'Filter' && !d3.event.shiftKey) {
        me.DOM.recordDisplayWrapper.attr('dragging', null);
        me.setDrawSelect(null);
        me.browser.clearSelect_Highlight();
        return;
      }
      me.DOM.recordDisplayWrapper.attr('dragging', true);
      const mousePos = d3.mouse(this);
      const curLatLong = me.leafletRecordMap.layerPointToLatLng(L.point(mousePos[0], mousePos[1]));
      if (d3.event.shiftKey && !me.drawSelect) {
        me.setDrawSelect('Highlight');
        me.drawingStartPoint = curLatLong;
      }
      if (!me.drawSelect) return;

      const bounds = L.latLngBounds([me.drawingStartPoint, curLatLong]);
      if (me.drawSelect === 'Highlight') {
        me.DOM.recordDisplayWrapper.select('.spatialQueryBox_Highlight')
          .each(function (d) { updateRectangle.call(this, bounds); });

        if (this.tempTimer) clearTimeout(this.tempTimer);
        this.tempTimer = setTimeout(() => {
          const records = [];
          me.browser.records.forEach((record) => {
            if (!record.isWanted) return;
            if (record._geoBound_ === undefined) return;
            // already have "bounds" variable
            if (kshf.intersects(record._geoBound_, bounds)) {
              records.push(record);
            } else {
              record.remForHighlight(true);
            }
          });
          me.browser.flexAggr_Highlight.summary = me.recordViewSummary; // record display
          me.browser.flexAggr_Highlight.records = records;
          me.browser.flexAggr_Highlight.bounds = bounds;
          me.browser.setSelect_Highlight();
        }, 150);
      } else {
        me.spatialFilter.bounds = bounds;
        me.refreshQueryBox_Filter(bounds);
      }
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });

  this.DOM.recordMap_SVG = d3.select(this.leafletRecordMap.getPanes().overlayPane)
    .append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('class', 'recordMap_SVG');

  // The fill pattern definition in SVG, used to denote geo-objects with no data.
  // http://stackoverflow.com/questions/17776641/fill-rect-with-pattern
  this.DOM.recordMap_SVG.append('defs')
    .append('pattern')
    .attrs({
      id: 'diagonalHatch',
      patternUnits: 'userSpaceOnUse',
      width: 4,
      height: 4,
    })
    .append('path')
    .attrs({
      d: 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2',
      stroke: 'gray',
      'stroke-width': 1,
    });

  this.DOM.recordGroup = this.DOM.recordMap_SVG.append('g').attr('class', 'leaflet-zoom-hide recordGroup');

  this.initDOM_CustomControls();
};

RecordDisplay.prototype.initDOM_CustomControls = function initDOM_CustomControls() {
  const me = this;
  if (this.DOM.visViewControl) return;

  const X = this.DOM.recordDisplayWrapper.append('span').attr('class', 'visViewControl');
  this.DOM.visViewControl = X;

  // **************************************************
  // SCATTER OPTIONS
  var s = X.append('span').attr('class', 'ScatterControl-ScatterAttrib visViewControlButton');
  s.append('span').text('→ Vs: ');
  s.append('select').on('change', function () { me.setScatterAttrib(this.selectedOptions[0].__data__); });
  this.refreshScatterOptions();

  // ***************************************************
  // LINK OPTIONS
  var s = X.append('span').attr('class', 'LinkControl-LinkAttrib visViewControlButton').append('select')
    .on('change', () => {
      // TODO
    });
  s.selectAll('option').data(this.linkBy).enter().append('option')
    .text(d => d);

  // **************************************************
  // FORCE LAYOUT OPTIONS
  X.append('span').attr('class', 'NodeLinkControl-LinkIcon visViewControlButton fa fa-share-alt')
    .each(function () {
      this.tipsy = new Tipsy(this, { gravity: 's',
        title() {
          return `${me.DOM.root.classed('hideLinks') ? 'Show' : 'Hide'} All Links`;
        } });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      me.DOM.root.classed('hideLinks', me.DOM.root.classed('hideLinks') ? null : true);
    });
  X.append('span')
    .attr('class', 'NodeLinkControl-AnimPlay visViewControlButton fa fa-play')
    .on('click', () => {
      me.nodelink_Force.alpha(0.5);
      me.nodelink_restart();
    });
  X.append('span')
    .attr('class', 'NodeLinkControl-AnimPause visViewControlButton fa fa-pause')
    .on('click', () => {
      me.nodelink_Force.stop();
      me.DOM.root.attr('NodeLinkState', 'stopped');
      me.DOM.root.classed('hideLinks', null);
    });

  // **************************************************
  // MAP OPTIONS
  X.append('span')
    .attr('class', 'MapControl-ShowHideMap visViewControlButton fa fa-map-o')
    .attr('title', 'Show/Hide Map')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 's', title: 'Show/Hide Map' }); })
    .on('mouseover', function () { this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('dblclick', () => {
      d3.event.preventDefault();
      d3.event.stopPropagation();
    })
    .on('click', function () {
      const x = d3.select(me.leafletRecordMap.getPanes().tilePane);
      x.attr('showhide', x.attr('showhide') === 'hide' ? 'show' : 'hide');
      d3.select(this).attr('class', `MapControl-ShowHideMap visViewControlButton fa fa-map${(x.attr('showhide') === 'hide') ? '' : '-o'}`);
      d3.event.preventDefault();
      d3.event.stopPropagation();
    });

  // **************************************************
  // SHARED OPTIONS
  X.selectAll('.MouseMode').data(['draw', 'pan']).enter().append('span')
    .attr('class', t => `visViewControlButton MouseMode-${t} fa ` + `fa-${t === 'draw' ? 'square-o' : 'hand-rock-o'}`)
    .each(function (t) {
      this.tipsy = new Tipsy(this, { gravity: 's', title() { return `Click &amp; drag mouse to ${t}`; } });
    })
    .on('mouseover', function () { this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('click', (t) => {
      me.visMouseMode = me.visMouseMode = t;
      me.DOM.root.attr('visMouseMode', me.visMouseMode);
      if (me.DOM.recordGroupHolder) {
        if (t === 'draw') {
          me.DOM.recordGroupHolder
            .on('wheel.zoom', null)
            .on('mousedown.zoom', null)
            .on('dblclick.zoom', null)
            .on('touchstart.zoom', null)
            .on('touchmove.zoom', null)
            .on('touchend.zoom touchcancel.zoom', null);
        } else {
          me.DOM.recordGroupHolder.call(me.scatterZoom);
        }
      } else {
      }
    });

  X.append('span')
    .attr('class', 'visViewControlButton fa fa-plus')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 's', title: 'Zoom in' }); })
    .on('mouseover', function () { this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('click', () => {
      if (me.viewRecAs === 'map') {
        me.leafletRecordMap.zoomIn();
      } else if (me.viewRecAs === 'scatter') {
        me.scatterPositionAnim = true;
        me.scatterZoom.scaleBy(me.DOM.recordGroupHolder, 2);
        me.scatterPositionAnim = false;
      } else if (me.viewRecAs === 'nodelink') {
        me.nodeZoomBehavior.scaleBy(me.DOM.recordBase_NodeLink, 2);
        me._refreshNodeLinkSVG_Transform();
      }
    });
  X.append('span')
    .attr('class', 'visViewControlButton fa fa-minus')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 's', title: 'Zoom out' }); })
    .on('mouseover', function () { this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('click', () => {
      if (me.viewRecAs === 'map') {
        me.leafletRecordMap.zoomOut();
      } else if (me.viewRecAs === 'scatter') {
        me.scatterPositionAnim = true;
        me.scatterZoom.scaleBy(me.DOM.recordGroupHolder, 1 / 2);
        me.scatterPositionAnim = false;
      } else if (me.viewRecAs === 'nodelink') {
        me.nodeZoomBehavior.scaleBy(me.DOM.recordBase_NodeLink, 1 / 2);
        me._refreshNodeLinkSVG_Transform();
      }
    });
  X.append('span')
    .attr('class', 'visViewControlButton fa fa-arrows-alt')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 's', title: kshf.lang.cur.ZoomToFit }); })
    .on('mouseover', function () { this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('dblclick', () => {
      d3.event.preventDefault();
      d3.event.stopPropagation();
    })
    .on('click', () => {
      if (me.viewRecAs === 'map') {
        me.recMap_zoomToActive();
      } else if (me.viewRecAs === 'nodelink') {
        me.nodelink_zoomToActive();
      } else if (me.viewRecAs === 'scatter') {
        me.resetScatterZoom();
      }
      d3.event.preventDefault();
      d3.event.stopPropagation();
    });
};

RecordDisplay.prototype.resetScatterZoom = function resetScatterZoom() {
  this.scatterPositionAnim = true;
  const i = d3.zoomIdentity.translate(20, 15);
  this.scatterZoom.transform(this.DOM.recordGroupHolder, i);
  this.scatterPositionAnim = false;
};

RecordDisplay.prototype.refreshQueryBox_Filter = function refreshQueryBox_Filter(bounds) {
  if (this.viewRecAs !== 'scatter' && this.viewRecAs !== 'map') return;
  let _left,
    _right,
    _top,
    _bottom;

  if (this.viewRecAs === 'map' && bounds === undefined && this.spatialFilter.isFiltered) {
    const north_west = this.leafletRecordMap.latLngToLayerPoint(this.spatialFilter.bounds.getNorthWest());
    const south_east = this.leafletRecordMap.latLngToLayerPoint(this.spatialFilter.bounds.getSouthEast());
    _left = north_west.x;
    _right = south_east.x;
    _top = north_west.y;
    _bottom = south_east.y;
  }

  if ((typeof L !== 'undefined') && bounds instanceof L.LatLngBounds) {
    const north_west = this.leafletRecordMap.latLngToLayerPoint(bounds.getNorthWest());
    const south_east = this.leafletRecordMap.latLngToLayerPoint(bounds.getSouthEast());
    _left = north_west.x;
    _right = south_east.x;
    _top = north_west.y;
    _bottom = south_east.y;
  } else if (this.viewRecAs === 'scatter') {
    if (bounds === undefined) {
      // use summary filter ranges
      _left = this.scatterAttrib.summaryFilter.active.min;
      _right = this.scatterAttrib.summaryFilter.active.max;
      _top = this.sortAttrib.summaryFilter.active.max;
      _bottom = this.sortAttrib.summaryFilter.active.min;

      if (!this.scatterAttrib.isFiltered()) {
        _left = this.scatterAttrib.intervalRange.total.min;
        if (_left === 0) _left = -1000;
        _left = (_left > 0) ? -_left * 100 : _left * 100;
        _right = this.scatterAttrib.intervalRange.total.max;
        if (_right === 0) _right = 1000;
        _right = (_right > 0) ? _right * 100 : -_right * 100;
      } else if (this.scatterAttrib.stepTicks) {
        _left -= 0.5;
        _right -= 0.5;
      }
      if (!this.sortAttrib.isFiltered()) {
        _top = this.sortAttrib.intervalRange.total.max;
        if (_top === 0) _top = 1000;
        _top = (_top > 0) ? _top * 100 : -_top * 100;
        _bottom = this.sortAttrib.intervalRange.total.min;
        if (_bottom === 0) _bottom = -1000;
        _bottom = (_bottom > 0) ? -_bottom * 100 : _bottom * 100;
      } else if (this.sortAttrib.stepTicks) {
        _top -= 0.5;
        _bottom -= 0.5;
      }
    } else {
      // use provided bounds
      if (bounds.left > bounds.right) {
        const temp = bounds.left;
        bounds.left = bounds.right;
        bounds.right = temp;
      }
      if (bounds.top < bounds.bottom) {
        const temp = bounds.top;
        bounds.top = bounds.bottom;
        bounds.bottom = temp;
      }
      _left = bounds.left;
      _right = bounds.right;
      _top = bounds.top;
      _bottom = bounds.bottom;
    }

    // convert from domain to screen coordinates
    let _left = this.scatterScaleX(_left);
    if (isNaN(_left)) _left = -1000; // log scale fix
    let _right = this.scatterScaleX(_right);
    let _top = this.scatterScaleY(_top);
    let _bottom = this.scatterScaleY(_bottom);
    if (isNaN(_bottom)) _bottom = 1000; // log scale fix

    // give more room
    _left -= 3;
    _right += 3;
    _top -= 3;
    _bottom += 3;
  }

  this.DOM.recordDisplayWrapper.select('.spatialQueryBox_Filter')
    .attr('active', (
      bounds ||
        (this.scatterAttrib && this.scatterAttrib.isFiltered()) ||
        (this.sortAttrib && this.sortAttrib.isFiltered()) ||
        (this.spatialFilter && this.spatialFilter.isFiltered)
    ) ? true : null)
    .style('left', `${_left}px`)
    .style('top', `${_top}px`)
    .style('width', `${Math.abs(_right - _left)}px`)
    .style('height', `${Math.abs(_bottom - _top)}px`);
};

RecordDisplay.prototype.initDOM_ScatterView = function initDOM_ScatterView() {
  const me = this;

  if (this.DOM.recordBase_Scatter) {
    this.DOM.recordGroup = this.DOM.recordBase_Scatter.select('.recordGroup');
    this.DOM.kshfRecords = this.DOM.recordGroup.selectAll('.kshfRecord');
    this.DOM.linkGroup = this.DOM.recordGroup_Scatter.select('.linkGroup');
    return; // Do not initialize twice
  }

  this.scatterTransform = { x: 0, y: 0, z: 1 };
  this.scatterPositionAnim = false;
  this.scatterZoom = d3.zoom()
    .scaleExtent([0.5, 8]) // 1 can cover the whole dataset.
    .on('start', () => {
      me.DOM.recordDisplayWrapper.attr('dragging', true);
    })
    .on('end', () => {
      me.DOM.recordDisplayWrapper.attr('dragging', null);
    })
    .on('zoom', () => {
      const old_z = me.scatterTransform.z;
      me.scatterTransform.x = d3.event.transform.x;
      me.scatterTransform.y = d3.event.transform.y;
      me.scatterTransform.z = d3.event.transform.k;
      me.DOM.recordGroup_Scatter
        .style('transform',
          `translate(${d3.event.transform.x}px,${d3.event.transform.y}px) ` +
            `scale(${d3.event.transform.k},${d3.event.transform.k}) `,
        );
      if (me.scatterTransform.z !== old_z) {
        me.refreshScatterVis();
      } else {
        me.refreshScatterTicks();
      }
    });

  this.DOM.recordBase_Scatter = this.DOM.recordDisplayWrapper.append('div').attr('class', 'recordBase_Scatter');
  this.DOM.scatterAxisGroup = this.DOM.recordBase_Scatter.append('div').attr('class', 'scatterAxisGroup');

  const scatterAxisTemplate = "<div class='tickGroup'></div><div class='onRecordLine'><div class='tickLine'></div><div class='tickText'></div></div>";
  this.DOM.scatterAxis_X = this.DOM.scatterAxisGroup.append('div')
    .attr('class', 'scatterAxis scatterAxis_X')
    .html(scatterAxisTemplate);
  this.DOM.scatterAxis_Y = this.DOM.scatterAxisGroup.append('div')
    .attr('class', 'scatterAxis scatterAxis_Y')
    .html(scatterAxisTemplate);

  function updateRectangle(bounds) {
    const _left = me.scatterScaleX(bounds.left);
    const _right = me.scatterScaleX(bounds.right);
    const _top = me.scatterScaleY(bounds.top);
    const _bottom = me.scatterScaleY(bounds.bottom);
    d3.select(this)
      .style('left', `${_left}px`)
      .style('top', `${_top}px`)
      .style('width', `${Math.abs(_right - _left)}px`)
      .style('height', `${Math.abs(_bottom - _top)}px`);
  }

  this.drawSelect = null;
  this.DOM.recordGroupHolder = this.DOM.recordBase_Scatter.append('div').attr('class', 'recordGroupHolder')
    .on('mousedown', function () {
      if (me.visMouseMode !== 'draw') return;
      if (me.drawSelect === 'Highlight') return;
      me.DOM.recordDisplayWrapper.attr('dragging', true);
      me.setDrawSelect('Filter');
      const mousePos = d3.mouse(this);
      me.drawingStartPoint = [
        me.scatterAxisScale_X.invert(mousePos[0]), me.scatterAxisScale_Y.invert(mousePos[1]),
      ];
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('mouseup', function () {
      if (me.visMouseMode !== 'draw') return;
      if (me.drawSelect === 'Drag') return;
      if (me.drawSelect === null) return;
      me.DOM.recordDisplayWrapper.attr('dragging', null);
      if (me.drawSelect === 'Filter') {
        const mousePos = d3.mouse(this);
        const curMousePos = [
          me.scatterAxisScale_X.invert(mousePos[0]), me.scatterAxisScale_Y.invert(mousePos[1]),
        ];
        if (curMousePos[1] !== me.drawingStartPoint[1] && me.drawingStartPoint[0] !== curMousePos[0]) {
          me.sortAttrib.setRangeFilter(me.drawingStartPoint[1], curMousePos[1]);
          me.scatterAttrib.setRangeFilter(me.drawingStartPoint[0], curMousePos[0]);
        }
      } else if (me.drawSelect === 'Highlight') {
        // Set compare selection
        const cT = me.browser.setSelect_Compare(false, true);
        const bounds = me.browser.flexAggr_Highlight.bounds;
        me.browser[`flexAggr_Compare_${cT}`].bounds = bounds;
        me.DOM.recordDisplayWrapper.select(`.spatialQueryBox_Compare_${cT}`)
          .attr('active', true)
          .each(function () {
            // TODO: FIX!
            updateRectangle.call(this, bounds);
          });
      }
      me.setDrawSelect(null);
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('mousemove', function () {
      if (me.visMouseMode !== 'draw') return;
      const mousePos = d3.mouse(this);
      const curMousePos = [
        me.scatterAxisScale_X.invert(mousePos[0]), me.scatterAxisScale_Y.invert(mousePos[1]),
      ];
      if (me.drawSelect === null) {
        if (d3.event.shiftKey) {
          me.setDrawSelect('Highlight');
          me.drawingStartPoint = curMousePos;
        } else {
          return;
        }
      } else if (me.drawSelect === 'Highlight') {
        if (!d3.event.shiftKey) {
          me.setDrawSelect(null);
          me.browser.clearSelect_Highlight();
        } else {
          // Highlight the area
          const bounds = {
            left: curMousePos[0],
            right: me.drawingStartPoint[0],
            top: curMousePos[1],
            bottom: me.drawingStartPoint[1],
          };
          if (bounds.left > bounds.right) {
            const temp = bounds.left;
            bounds.left = bounds.right;
            bounds.right = temp;
          }
          if (bounds.top < bounds.bottom) {
            const temp = bounds.top;
            bounds.top = bounds.bottom;
            bounds.bottom = temp;
          }
          me.DOM.recordDisplayWrapper.select('.spatialQueryBox_Highlight')
            .each(function () { updateRectangle.call(this, bounds); });

          if (this.tempTimer) clearTimeout(this.tempTimer);
          this.tempTimer = setTimeout(() => {
            const records = [];
            const yID = me.sortAttrib.summaryID;
            const xID = me.scatterAttrib.summaryID;
            me.browser.records.forEach((record) => {
              if (!record.isWanted) return;
              const _x = record._valueCache[xID];
              const _y = record._valueCache[yID];
              if (_x >= bounds.left && _x < bounds.right && _y >= bounds.bottom && _y < bounds.top) {
                records.push(record);
              } else {
                record.remForHighlight(true);
              }
            });
            me.browser.flexAggr_Highlight.records = records;
            me.browser.flexAggr_Highlight.summary = me.textSearchSummary;
            me.browser.flexAggr_Highlight.bounds = bounds;
            me.browser.flexAggr_Highlight.data = { id: "<i class='fa fa-square-o'></i> (Area)" };
            me.browser.setSelect_Highlight();
          }, 150);
        }
      } else if (me.drawSelect === 'Filter') {
        const bounds = {
          left: curMousePos[0],
          right: me.drawingStartPoint[0],
          top: curMousePos[1],
          bottom: me.drawingStartPoint[1],
        };
        me.refreshQueryBox_Filter(bounds);
      }
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });

  this.DOM.recordGroupHolder.call(this.scatterZoom);

  this.DOM.recordGroup_Scatter = this.DOM.recordGroupHolder.append('div').attr('class', 'recordGroup_Scatter');

  const _svg = this.DOM.recordGroup_Scatter.append('svg').attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('class', 'asdasdasdsadas');

  if (this.linkBy.length > 0) {
    this.DOM.linkGroup = _svg.append('g').attr('class', 'linkGroup');
    this.prepareRecordLinks();
    this.insertDOM_RecordLinks();
  }

  this.DOM.recordGroup = _svg.append('g').attr('class', 'recordGroup');

  this.insertQueryBoxes(this.DOM.recordGroup_Scatter,
    (t) => {
      if (d3.event.which !== 1) return; // only respond to left-click
      me.DOM.recordDisplayWrapper.attr('dragging', true);
      const mousePos = d3.mouse(me.DOM.recordGroupHolder.node());
      const newPos = [
        me.scatterAxisScale_X.invert(mousePos[0]),
        me.scatterAxisScale_Y.invert(mousePos[1]),
      ];
      const bounds = {
        left: me.scatterAttrib.summaryFilter.active.min,
        right: me.scatterAttrib.summaryFilter.active.max,
        top: me.sortAttrib.summaryFilter.active.max,
        bottom: me.sortAttrib.summaryFilter.active.min,
      };
      d3.select('body').on('mousemove', (e) => {
        const mousePos = d3.mouse(me.DOM.recordGroupHolder.node());
        const targetPos = [
          me.scatterAxisScale_X.invert(mousePos[0]),
          me.scatterAxisScale_Y.invert(mousePos[1]),
        ];
        if (t === 'l') {
          me.scatterAttrib.setRangeFilter(targetPos[0], me.scatterAttrib.summaryFilter.active.max, true);
          bounds.left = targetPos[0];
        }
        if (t === 'r') {
          me.scatterAttrib.setRangeFilter(me.scatterAttrib.summaryFilter.active.min, targetPos[0], true);
          bounds.right = targetPos[0];
        }
        if (t === 't') {
          me.sortAttrib.setRangeFilter(me.sortAttrib.summaryFilter.active.min, targetPos[1], true);
          bounds.top = targetPos[1];
        }
        if (t === 'b') {
          me.sortAttrib.setRangeFilter(targetPos[1], me.sortAttrib.summaryFilter.active.max, true);
          bounds.bottom = targetPos[1];
        }
        me.refreshQueryBox_Filter(bounds);
      }).on('mouseup', () => {
        // update range filter
        me.DOM.recordDisplayWrapper.attr('dragging', null);
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
      d3.event.stopPropagation();
    },
    (t) => {
      if (d3.event.which !== 1) return; // only respond to left-click
      me.DOM.recordDisplayWrapper.attr('dragging', true);
      const mousePos = d3.mouse(me.DOM.recordGroupHolder.node());
      const initPos = [
        me.scatterAttrib.valueScale(me.scatterAxisScale_X.invert(mousePos[0])),
        me.sortAttrib.valueScale(me.scatterAxisScale_Y.invert(mousePos[1])),
      ];
      const initMin_X = me.scatterAttrib.summaryFilter.active.min;
      const initMax_X = me.scatterAttrib.summaryFilter.active.max;
      const initMin_Y = me.sortAttrib.summaryFilter.active.min;
      const initMax_Y = me.sortAttrib.summaryFilter.active.max;
      d3.select('body').on('mousemove', (e) => {
        const mousePos = d3.mouse(me.DOM.recordGroupHolder.node());
        const curPos = [
          me.scatterAttrib.valueScale(me.scatterAxisScale_X.invert(mousePos[0])),
          me.sortAttrib.valueScale(me.scatterAxisScale_Y.invert(mousePos[1])),
        ];
        me.scatterAttrib.dragRange(initPos[0], curPos[0], initMin_X, initMax_X);
        me.sortAttrib.dragRange(initPos[1], curPos[1], initMin_Y, initMax_Y);
        const bounds = {
          left: me.scatterAttrib.summaryFilter.active.min,
          right: me.scatterAttrib.summaryFilter.active.max,
          top: me.sortAttrib.summaryFilter.active.max,
          bottom: me.sortAttrib.summaryFilter.active.min,
        };
        me.refreshQueryBox_Filter(bounds);
      }).on('mouseup', () => {
        me.DOM.recordDisplayWrapper.attr('dragging', null);
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
      d3.event.stopPropagation();
    },
    function (d) {
      if (d === 'Filter') {
        me.scatterAttrib.summaryFilter.clearFilter();
        me.sortAttrib.summaryFilter.clearFilter();
      } else if (d !== 'Highlight') { // Compare_X
        me.browser.clearSelect_Compare(d.substr(8));
      }
      this.tipsy.hide();
    },
  );

  this.initDOM_CustomControls();
};

RecordDisplay.prototype.insertQueryBoxes = function insertQueryBoxes(parent, setSizeCb, dragCb, clearCb) {
  const me = this;
  const queryBoxes = parent.selectAll('.spatialQueryBox')
    .data(['Filter', 'Highlight', 'Compare_A', 'Compare_B', 'Compare_C'])
    .enter()
    .append('div')
    .attr('class', d => `spatialQueryBox spatialQueryBox_${d}`);

  queryBoxes.selectAll('.setSize').data(['l', 'r', 't', 'b'])
    .enter().append('div')
    .attr('class', k => `setSize-${k}`)
    .on('mousedown', setSizeCb);

  queryBoxes.append('div').attr('class', 'dragSelection fa fa-arrows')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'se', title: 'Drag' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('mousedown', dragCb);

  queryBoxes.append('div').attr('class', 'clearFilterButton fa')
    .each(function (d) {
      this.tipsy = new Tipsy(this, { gravity: 'nw',
        title: (d === 'Filter') ? kshf.lang.cur.RemoveFilter : kshf.lang.cur.Unlock,
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('mouseup', () => {
      if (me.drawSelect) return;
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('mousedown', () => {
      if (me.drawSelect) return;
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('click', clearCb);
};

RecordDisplay.prototype.initDOM_NodeLinkView = function initDOM_NodeLinkView() {
  const me = this;

  if (this.DOM.recordBase_NodeLink) {
    this.DOM.recordGroup = this.DOM.recordBase_NodeLink.select('.recordGroup');
    this.DOM.kshfRecords = this.DOM.recordGroup.selectAll('.kshfRecord');
    this.DOM.linkGroup = this.DOM.recordBase_NodeLink.select('.linkGroup');
    return; // Do not initialize twice
  }

  this.nodeZoomBehavior = d3.zoom()
    .scaleExtent([0.1, 80])
    .on('start', () => {
      me.DOM.recordDisplayWrapper.attr('dragging', true);
    })
    .on('end', () => {
      me.DOM.recordDisplayWrapper.attr('dragging', null);
    })
    .on('zoom', () => {
      gggg.attr('transform',
        `translate(${d3.event.transform.x},${d3.event.transform.y}) ` +
          `scale(${d3.event.transform.k})`);
      me.refreshNodeLinkVis();
    });

  this.DOM.recordBase_NodeLink = this.DOM.recordDisplayWrapper
    .append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('class', 'recordBase_NodeLink')

    .call(this.nodeZoomBehavior);

  const gggg = this.DOM.recordBase_NodeLink.append('g');
  this.DOM.linkGroup = gggg.append('g').attr('class', 'linkGroup');
  this.DOM.recordGroup = gggg.append('g').attr('class', 'recordGroup');

  const x = this.DOM.recordDisplayWrapper.node();
  this.DOM.recordBase_NodeLink.call(
    this.nodeZoomBehavior.transform,
    d3.zoomIdentity.translate(x.offsetWidth / 2, x.offsetHeight / 2).scale(1),
  );

  this.initDOM_CustomControls();
};

RecordDisplay.prototype.initDOM_ListView = function initDOM_ListView() {
  const me = this;

  if (this.DOM.recordGroup_List) return;

  this.DOM.recordGroup_List = this.DOM.recordDisplayWrapper.append('div').attr('class', 'recordGroup_List');

  this.DOM.recordGroup = this.DOM.recordGroup_List.append('div').attr('class', 'recordGroup')
    .on('scroll', function (d) {
      if (this.scrollHeight - this.scrollTop - this.offsetHeight < 10) {
        if (me.autoExpandMore) {
          me.showMoreRecordsOnList();
        } else {
          me.DOM.showMore.attr('showMoreVisible', true);
        }
      } else {
        me.DOM.showMore.attr('showMoreVisible', false);
      }
      me.DOM.scrollToTop.style('visibility', this.scrollTop > 0 ? 'visible' : 'hidden');
      me.DOM.adjustSortColumnWidth.style('top', `${this.scrollTop - 2}px`);
    });

  this.DOM.adjustSortColumnWidth = this.DOM.recordGroup.append('div')
    .attr('class', 'adjustSortColumnWidth dragWidthHandle')
    .on('mousedown', function (d, i) {
      if (d3.event.which !== 1) return; // only respond to left-click
      me.browser.DOM.root.style('cursor', 'ew-resize');
      const _this = this;
      const mouseDown_x = d3.mouse(document.body)[0];
      const mouseDown_width = me.sortColWidth;

      me.browser.DOM.pointerBlock.attr('active', '');

      me.browser.DOM.root.on('mousemove', () => {
        _this.setAttribute('dragging', '');
        me.setSortColumnWidth(mouseDown_width + (d3.mouse(document.body)[0] - mouseDown_x));
      }).on('mouseup', () => {
        me.browser.DOM.root.style('cursor', 'default');
        me.browser.DOM.pointerBlock.attr('active', null);
        me.browser.DOM.root.on('mousemove', null).on('mouseup', null);
        _this.removeAttribute('dragging');
      });
      d3.event.preventDefault();
    });

  this.DOM.showMore = this.DOM.root.append('div').attr('class', 'showMore')
    .attr('showMoreVisible', false)
    .on('mouseenter', function () { d3.select(this).selectAll('.loading_dots').attr('anim', true); })
    .on('mouseleave', function () { d3.select(this).selectAll('.loading_dots').attr('anim', null); })
    .on('click', () => { me.showMoreRecordsOnList(); });
  this.DOM.showMore.append('span').attr('class', 'MoreText').html('Show More');
  this.DOM.showMore.append('span').attr('class', 'Count CountAbove');
  this.DOM.showMore.append('span').attr('class', 'Count CountBelow');
  this.DOM.showMore.append('span').attr('class', 'loading_dots loading_dots_1');
  this.DOM.showMore.append('span').attr('class', 'loading_dots loading_dots_2');
  this.DOM.showMore.append('span').attr('class', 'loading_dots loading_dots_3');
};

RecordDisplay.prototype.setRecordViewSummary = function setRecordViewSummary(summary) {
  if (summary === undefined || summary === null) {
    this.removeRecordViewSummary();
    return;
  }
  if (this.recordViewSummary === summary) return;
  if (this.recordViewSummary) this.removeRecordViewSummary();

  this.DOM.root.attr('hasRecordView', true);
  this.recordViewSummary = summary;
  this.recordViewSummary.initializeAggregates();
  this.recordViewSummary.isRecordView = true;
  this.recordViewSummary.refreshThumbDisplay();

  this.setRecordViewBriefSummary(summary);

  if (this.spatialFilter) {
    this.spatialFilter.summary = this.recordViewSummary;
    this.recordViewSummary.summaryFilter = this.spatialFilter;
  }

  // TODO: Delete existing record DOM's and regenerate them
  if (this.DOM.recordGroup) { this.DOM.recordGroup.selectAll('.kshfRecord').data([]).exit().remove(); }

  this.viewAs(this.viewRecAs);
};

RecordDisplay.prototype.setRecordViewBriefSummary = function setRecordViewBriefSummary(summary) {
  this.recordViewSummaryBrief = summary;
  this.recordViewSummaryBrief.initializeAggregates();
};

RecordDisplay.prototype.removeRecordViewSummary = function removeRecordViewSummary() {
  if (this.recordViewSummary === null) return;
  this.DOM.root.attr('hasRecordView', null);
  this.recordViewSummary.isRecordView = false;
  this.recordViewSummary.refreshThumbDisplay();
  this.recordViewSummary = null;
  this.browser.DOM.root.attr('recordEncoding', null);
};

RecordDisplay.prototype.setTextSearchSummary = function setTextSearchSummary(summary) {
  if (summary === undefined || summary === null) return;
  this.textSearchSummary = summary;
  this.textSearchSummary.initializeAggregates();
  this.textSearchSummary.isTextSearch = true;
  this.DOM.recordTextSearch
    .attr('isActive', true)
    .select('input').attr('placeholder', `${kshf.lang.cur.Search}: ${summary.summaryName}`);
  this.textFilter = this.browser.createFilter('text', this);
  this.textSearchSummary.summaryFilter = this.textFilter;
};

RecordDisplay.prototype.collapseRecordViewSummary = function collapseRecordViewSummary(collapsed) {
  this.collapsed = collapsed;
  this.DOM.root.attr('collapsed', collapsed ? true : null);
  this.browser.updateLayout_Height();
};

RecordDisplay.prototype.refreshRecordRanks = function refreshRecordRanks(d3_selection) {
  if (!this.showRank) return; // Do not refresh if not shown...
  d3_selection.text(record => ((record.recordRank < 0) ? '' : record.recordRank + 1));
};

RecordDisplay.prototype.refreshRecordDOMOrder = function refreshRecordDOMOrder() {
  this.DOM.kshfRecords = this.DOM.recordGroup.selectAll('.kshfRecord')
    .data(this.browser.records, record => record.id())
    .order();
  kshf.Util.scrollToPos_do(this.DOM.recordGroup, 0);
};

RecordDisplay.prototype.refreshViz_Compare_All = function refreshViz_Compare_All() {
  const me = this;
  this.DOM.root.selectAll("[class*='spatialQueryBox_Comp']")
    .attr('active', d => (me.browser.vizActive[d] ? true : null));
};

RecordDisplay.prototype.setSortColumnWidth = function setSortColumnWidth(v) {
  if (this.viewRecAs !== 'list') return;
  this.sortColWidth = Math.max(Math.min(v, 110), 30); // between 30 and 110 pixels
  this.DOM.recordSortValue.style('width', `${this.sortColWidth}px`);
  this.refreshAdjustSortColumnWidth();
};

RecordDisplay.prototype.getSortingLabel = function getSortingLabel(record) {
  let s = this.sortAttrib.sortLabel.call(record.data, record);
  if (s === null || s === undefined || s === '') return '';
  if (typeof s !== 'string') s = this.sortColFormat(s);
  return this.sortAttrib.printWithUnitName(s);
};

RecordDisplay.prototype.refreshRecordSortLabels = function refreshRecordSortLabels(d3_selection) {
  if (this.viewRecAs !== 'list') return; // Only list-view allows sorting
  if (d3_selection === undefined) d3_selection = this.DOM.recordSortValue;

  const me = this;
  d3_selection.html((record) => {
    const v = me.getSortingLabel(record);
    return (v === '') ? '-' : v;
  });
};

RecordDisplay.prototype.addSortingOption = function addSortingOption(summary) {
  // If parameter summary is already a sorting option, nothing else to do
  if (this.sortingOpts.some(o => o === summary)) return;

  this.sortingOpts.push(summary);

  summary.sortLabel = summary.summaryFunc;
  summary.sortInverse = false;
  summary.sortFunc = this.getSortFunc(summary.summaryFunc);

  this.prepSortingOpts();
  this.refreshSortingOptions();
};

RecordDisplay.prototype.refreshScatterOptions = function refreshScatterOptions() {
  if (this.DOM.root === undefined) return;
  if (this.viewRecAs !== 'scatter') return;
  this.DOM.root.selectAll('.ScatterControl-ScatterAttrib > select > option').remove();
  this.DOM.root.selectAll('.ScatterControl-ScatterAttrib > select').selectAll('option')
    .data(this.getScatterAttributes()).enter()
    .append('option')
    .text(summary => summary.summaryName)
    .attr('selected', summary => (summary.encodesRecordsBy === 'scatter' ? true : null));
};

RecordDisplay.prototype.refreshSortingOptions = function refreshSortingOptions() {
  if (this.DOM.recordSortSelectbox === undefined) return;
  this.DOM.recordSortSelectbox.selectAll('option').remove();
  const me = this;
  let scatterID = -1;
  if (this.scatterAttrib) scatterID = this.scatterAttrib.summaryID;
  this.DOM.recordSortSelectbox.selectAll('option').data(
    this.sortingOpts.filter(summary => summary.summaryID !== scatterID),
  ).enter()
    .append('option')
    .html(summary => summary.summaryName)
    .attr('selected', summary => (summary.encodesRecordsBy === 'sort' ? true : null));
  this.refreshScatterOptions();
};

RecordDisplay.prototype.prepSortingOpts = function prepSortingOpts() {
  this.sortingOpts.forEach(function (sortOpt, i) {
    if (sortOpt.summaryName) return; // It already points to a summary
    if (typeof (sortOpt) === 'string') {
      sortOpt = { name: sortOpt };
    }
    // Old API
    if (sortOpt.title) sortOpt.name = sortOpt.title;

    let summary = this.browser.summaries_by_name[sortOpt.name];
    if (summary === undefined) {
      if (typeof (sortOpt.value) === 'string') {
        summary = this.browser.changeSummaryName(sortOpt.value, sortOpt.name);
      } else {
        summary = this.browser.createSummary(sortOpt.name, sortOpt.value, 'interval');
        if (sortOpt.unitName) { summary.setUnitName(sortOpt.unitName); }
      }
    }

    summary.sortingSummary = true;
    summary.sortLabel = sortOpt.label || summary.summaryFunc;
    summary.sortInverse = sortOpt.inverse || false;
    summary.sortFunc = sortOpt.sortFunc || this.getSortFunc(summary.summaryFunc);

    this.sortingOpts[i] = summary;
  }, this);

  // Only interval summaries can be used as sorting options
  this.sortingOpts = this.sortingOpts.filter(s => s instanceof SummaryInterval);
};

RecordDisplay.prototype.alphabetizeSortingOptions = function alphabetizeSortingOptions() {
  this.sortingOpts.sort((s1, s2) => s1.summaryName.localeCompare(s2.summaryName, { sensitivity: 'base' }));
};

RecordDisplay.prototype.setScatterAttrib = function setScatterAttrib(attrib) {
  if (this.scatterAttrib) {
    this.scatterAttrib.clearEncodesRecordsBy();
  }
  this.scatterAttrib = attrib;
  this.scatterAttrib.setEncodesRecordsBy('scatter');

  if (this.recordViewSummary === null) return;
  if (this.DOM.root === undefined) return;

  this.refreshScatterVis(true);
  this.refreshSortingOptions();
};

RecordDisplay.prototype.setSortAttrib = function setSortAttrib(index) {
  if (this.sortAttrib) {
    var curHeight = this.sortAttrib.getHeight();
    this.sortAttrib.clearEncodesRecordsBy();
    this.sortAttrib.setHeight(curHeight);
  }

  if (typeof index === 'number') {
    if (index < 0 || index >= this.sortingOpts.length) return;
    this.sortAttrib = this.sortingOpts[index];
  } else if (index instanceof SummaryBase) {
    this.sortAttrib = index;
  }

  if (this.config.onSort) this.config.onSort.call(this);

  {
    var curHeight = this.sortAttrib.getHeight();
    this.sortAttrib.setEncodesRecordsBy('sort');
    this.sortAttrib.setHeight(curHeight);
  }

  // Sort column format function
  this.sortColFormat = function (a) { return a.toLocaleString(); };
  if (this.sortAttrib.isTimeStamp()) {
    this.sortColFormat = this.sortAttrib.timeTyped.print;
  }

  if (this.recordViewSummary === null) return;
  if (this.DOM.root === undefined) return;

  switch (this.viewRecAs) {
    case 'map':
    case 'nodelink':
      this.refreshRecordColors();
      break;
    case 'scatter':
      this.refreshSortingOptions();
      this.refreshScatterVis(true);
      break;
    case 'list':
    case 'grid':
      this.sortRecords();
      if (this.DOM.recordGroup) {
        this.refreshRecordDOM();
        this.refreshRecordDOMOrder();
        this.refreshRecordRanks(this.DOM.recordRanks);
        this.refreshRecordSortLabels();
      }
      break;
  }
};

RecordDisplay.prototype.refreshAdjustSortColumnWidth = function refreshAdjustSortColumnWidth() {
  if (this.viewRecAs !== 'list') return;
  this.DOM.adjustSortColumnWidth.style('left', `${(this.sortColWidth - 2) + (this.showRank ? 15 : 0)}px`);
};

RecordDisplay.prototype.setShowRank = function setShowRank(v) {
  this.showRank = v;
  this.DOM.root.attr('showRank', this.showRank);
  this.refreshRecordRanks(this.DOM.recordRanks);
  this.refreshAdjustSortColumnWidth();
};

RecordDisplay.prototype.nodelink_restart = function nodelink_restart() {
  this.nodelink_Force.restart();
  this.DOM.root.attr('NodeLinkState', 'started');
  if (this.recordLinks.length > 1000) this.DOM.root.classed('hideLinks', true);
};

RecordDisplay.prototype.refreshVis_Nodes = function refreshVis_Nodes() {
  const t = d3.zoomTransform(this.DOM.recordBase_NodeLink.node());
  const scale = `scale(${1 / t.k})`;
  this.DOM.kshfRecords.attr('transform', d => `translate(${d.x},${d.y}) ${scale}`);
};

RecordDisplay.prototype.refreshScatterVis = function refreshScatterVis(animate) {
  if (this.DOM.recordBase_Scatter === undefined) return;
  const me = this;
  const scale = `scale(${1 / this.scatterTransform.z})`;

  const sX = this.scatterAttrib;
  const sY = this.sortAttrib;

  const accX = sX.summaryID;
  const accY = sY.summaryID;

  this.scatterScaleX = sX.scaleType === 'log' ? d3.scaleLog().base(2) : d3.scaleLinear();
  this.scatterScaleX.domain([sX.intervalRange.active.min, sX.intervalRange.active.max])
    .range([0, (this.curWidth - 80)])
    .clamp(false);

  this.scatterScaleY = sY.scaleType === 'log' ? d3.scaleLog().base(2) : d3.scaleLinear();
  this.scatterScaleY.domain([sY.intervalRange.active.min, sY.intervalRange.active.max])
    .range([(this.curHeight - 80), 0])
    .clamp(false);

  let x = this.DOM.kshfRecords;
  if (animate) x = x.transition().duration(700).ease(d3.easeCubic);
  x.attr('transform', (record) => {
    record.x = me.scatterScaleX(record._valueCache[accX]);
    record.y = me.scatterScaleY(record._valueCache[accY]);
    return `translate(${record.x},${record.y}) ${scale}`;
  });
  this.refreshScatterTicks();

  if (this.DOM.recordLinks) {
    // position & direction of the links
    this.DOM.recordLinks
      .attr('x1', link => link.source.x)
      .attr('y1', link => link.source.y)
      .attr('x2', link => link.target.x)
      .attr('y2', link => link.target.y);
  }
};

RecordDisplay.prototype.refreshScatterTicks = function refreshScatterTicks() {
  const me = this;

  // Compute bounds in SVG coordinates after transform is applied.
  const minX_real = (-this.scatterTransform.x) / this.scatterTransform.z;
  const maxX_real = minX_real + (this.curWidth - 35) / this.scatterTransform.z;
  const minY_real = (-this.scatterTransform.y) / this.scatterTransform.z;
  const maxY_real = minY_real + (this.curHeight - 50) / this.scatterTransform.z;

  const minX_v = this.scatterScaleX.invert(minX_real);
  const maxX_v = this.scatterScaleX.invert(maxX_real);
  const minY_v = this.scatterScaleY.invert(minY_real);
  const maxY_v = this.scatterScaleY.invert(maxY_real);

  let tGroup;
  let hm = true;

  if (this.scatterAxisScale_X) {
    this.scatterAxisScale_X_old = this.scatterAxisScale_X.copy();
    this.scatterAxisScale_Y_old = this.scatterAxisScale_Y.copy();
    hm = false;
  }

  this.scatterAxisScale_X = this.scatterScaleX.copy()
    .domain([minX_v, maxX_v])
    .range([0, this.curWidth - 35]);
  this.scatterAxisScale_Y = this.scatterScaleY.copy()
    .domain([minY_v, maxY_v])
    .range([0, this.curHeight - 50]);

  if (hm) {
    this.scatterAxisScale_X_old = this.scatterAxisScale_X.copy();
    this.scatterAxisScale_Y_old = this.scatterAxisScale_Y.copy();
  }

  const ticks = {};
  ticks.X = this.scatterAxisScale_X.ticks(Math.floor((this.curWidth - 40) / 30));
  if (!this.scatterAttrib.hasFloat) {
    ticks.X = ticks.X.filter(t => t % 1 === 0);
  }

  ticks.Y = this.scatterAxisScale_Y.ticks(Math.floor((this.curHeight - 50) / 30));
  if (!this.sortAttrib.hasFloat) {
    ticks.Y = ticks.Y.filter(t => t % 1 === 0);
  }

  // TODO: add translateZ to reduce redraw (but causes flickering on chrome)
  const addTicks = function (axis, _translate) {
    const tGroup = me.DOM[`scatterAxis_${axis}`].select('.tickGroup');
    const axisScale = me[`scatterAxisScale_${axis}`];
    const axisScale_old = me[`scatterAxisScale_${axis}_old`];

    const hm = tGroup.selectAll('.hmTicks').data(ticks[axis], t => t);
    hm.style('transform', tick => `${_translate + axisScale(tick)}px) translateZ(0)`);
    hm.exit()
      .style('transform', tick => `${_translate + axisScale(tick)}px) translateZ(0)`)
      .style('opacity', 0).transition()
      .duration(0)
      .delay(500)
      .remove();
    const tk = hm.enter().append('div').attr('class', 'hmTicks')
      .attr('zero', tick => (tick === 0 ? true : null))
      .style('transform', tick => `${_translate + axisScale_old(tick)}px) translateZ(0)`);
    tk.transition().duration(0).delay(10)
      .style('transform', tick => `${_translate + axisScale(tick)}px) translateZ(0)`)
      .style('opacity', 1);
    tk.append('div').attr('class', 'tickText');
    tk.append('div').attr('class', 'tickLine');
  };

  addTicks('X', 'translateX(');
  addTicks('Y', 'translateY(');

  this.DOM.scatterAxis_X.selectAll('.tickText')
    .html(tick => me.scatterAttrib.printWithUnitName(me.browser.getTickLabel(tick)));
  this.DOM.scatterAxis_Y.selectAll('.tickText')
    .html(tick => me.sortAttrib.printWithUnitName(me.browser.getTickLabel(tick)));

  this.refreshQueryBox_Filter();
};

RecordDisplay.prototype.refreshNodeLinkVis = function refreshNodeLinkVis() {
  if (this.DOM.recordLinks === undefined) return;

  // position & direction of the links
  this.DOM.recordLinks
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  this.refreshVis_Nodes();
};

RecordDisplay.prototype.nodelink_zoomToActive = function nodelink_zoomToActive() {
  var _translate,
    _scale;

  let bounds_x = [null, null];
  let bounds_y = [null, null];

  let grav_x = 0;
  let grav_y = 0;

  // compute rectangular bounding box of the nodes
  const recs = this.browser.records.filter(record => record.isWanted);
  recs.forEach((d) => {
    const _min_x = d.x - 0.2;
    const _max_x = d.x + 0.2;
    const _min_y = d.y - 0.2;
    const _max_y = d.y + 0.2;

    grav_x += d.x;
    grav_y += d.y;

    if (bounds_x[0] === null) {
      bounds_x = [_min_x, _max_x];
      bounds_y = [_min_y, _max_y];
    } else {
      if (_min_x < bounds_x[0]) bounds_x[0] = _min_x;
      if (_min_y < bounds_y[0]) bounds_y[0] = _min_y;
      if (_max_x > bounds_x[1]) bounds_x[1] = _max_x;
      if (_max_x > bounds_x[1]) bounds_x[1] = _max_x;
    }
  });

  var _translate = [grav_x / recs.length, grav_y / recs.length];

  const x = this.DOM.recordDisplayWrapper.node();

  var _scale = x.offsetHeight / ((bounds_y[1] - bounds_y[0]) * 3);

  this.DOM.recordBase_NodeLink.transition().duration(750).call(
    this.nodeZoomBehavior.transform,
    d3.zoomIdentity
      .translate(x.offsetWidth / 2, x.offsetHeight / 2)
      .scale(_scale),
  );

  this.refreshNodeLinkVis();
};

RecordDisplay.prototype._refreshNodeLinkSVG_Transform = function _refreshNodeLinkSVG_Transform() {
  const t = d3.zoomTransform(this.DOM.recordBase_NodeLink.node());
  const _scale = t.k;
  const _translate = [t.x, t.y];
  this.DOM.recordBase_NodeLink.select('.gggg')
    .attr('transform', `translate(${_translate[0]},${_translate[1]}) scale(${_scale})`);

  this.refreshVis_Nodes();
};

RecordDisplay.prototype.prepareRecordLinks = function prepareRecordLinks() {
  this.browser.records.forEach((record) => { record.initLinks(); });

  const recordsIndexed = kshf.dt_id[browser.primaryTableName];
  const linkAttribName = this.linkBy[0];

  this.recordLinks = [];

  this.browser.records.forEach(function (recordFrom) {
    const links = recordFrom.data[linkAttribName];
    if (links) {
      links.forEach(function (recordTo_id) {
        const recordTo = recordsIndexed[recordTo_id];
        if (recordTo) {
          recordFrom.links_To.push(recordTo);
          recordTo.links_From.push(recordFrom);
          this.recordLinks.push({ source: recordFrom, target: recordTo });
        }
      }, this);
    }
  }, this);
};

RecordDisplay.prototype.insertDOM_RecordLinks = function insertDOM_RecordLinks() {
  this.DOM.linkGroup.selectAll('.recordLink').remove();
  this.DOM.recordLinks = this.DOM.linkGroup.selectAll('.recordLink').data(this.recordLinks)
    .enter().append('line')
    .attr('class', 'recordLink')
    .each(function (link) {
      const recordFrom = link.source;
      const recordTo = link.target;
      recordFrom.DOM.links_To.push(this);
      recordTo.DOM.links_From.push(this);
    });
};

RecordDisplay.prototype.setNodeLink = function setNodeLink() {
  const me = this;

  this.prepareRecordLinks();
  this.insertDOM_RecordLinks();

  this.nodelink_Force = d3.forceSimulation()
    .force('charge', d3.forceManyBody().strength(-5))
    .force('link', d3.forceLink(this.recordLinks).strength(0.05).iterations(3))
    .alphaMin(0.1)
    .velocityDecay(0.3)
  // .force("center", d3.forceCenter())
  // Old params
  // .charge(-60)
  // .gravity(0.8)
  // .alpha(0.4)
    .on('end', () => {
      me.DOM.root.attr('NodeLinkState', 'stopped');
      me.DOM.root.classed('hideLinks', null);
    })
    .on('tick', () => {
      me.refreshNodeLinkVis();
    });

  this.nodelink_Force.nodes(this.browser.records);
};

RecordDisplay.prototype.changeOfScale = function changeOfScale() {
  if (this.viewRecAs !== 'map' && this.viewRecAs !== 'nodelink') {
    this.refreshRecordColors();
  }
  if (this.viewRecAs === 'scatter') {
    this.refreshScatterVis(true);
  }
};

RecordDisplay.prototype.refreshRecordColors = function refreshRecordColors() {
  if (!this.recordViewSummary) return;
  if (this.viewRecAs !== 'map' && this.viewRecAs !== 'nodelink') return;
  if (!this.sortAttrib) return;

  const me = this;
  const s_f = this.sortAttrib.summaryFunc;
  let s_log;

  if (this.sortAttrib.scaleType === 'log') {
    this.recordColorScale = d3.scaleLog();
    s_log = true;
  } else {
    this.recordColorScale = d3.scaleLinear();
    s_log = false;
  }
  let min_v = this.sortAttrib.intervalRange.total.min;
  let max_v = this.sortAttrib.intervalRange.total.max;
  if (this.sortAttrib.intervalRange.active) {
    min_v = this.sortAttrib.intervalRange.active.min;
    max_v = this.sortAttrib.intervalRange.active.max;
  }
  if (min_v === undefined) min_v = d3.min(this.browser.records, d => s_f.call(d.data));
  if (max_v === undefined) max_v = d3.max(this.browser.records, d => s_f.call(d.data));
  this.recordColorScale
    .range([0, 9])
    .domain([min_v, max_v]);

  this.colorQuantize = d3.scaleQuantize()
    .domain([0, 9])
    .range(kshf.colorScale[me.browser.mapColorTheme]);

  const undefinedFill = (this.viewRecAs === 'map') ? 'url(#diagonalHatch)' : 'white';

  const fillFunc = function (d) {
    let v = s_f.call(d.data);
    if (s_log && v <= 0) v = undefined;
    if (v === undefined) return undefinedFill;
    let vv = me.recordColorScale(v);
    if (me.sortAttrib.invertColorScale) vv = 9 - vv;
    return me.colorQuantize(vv);
  };

  if (this.viewRecAs === 'map') {
    this.DOM.kshfRecords.each(function (d) {
      let v = s_f.call(d.data);
      if (s_log && v <= 0) v = undefined;
      if (v === undefined) {
        this.style.fill = undefinedFill;
        this.style.stroke = 'gray';
        return;
      }
      let vv = me.recordColorScale(v);
      if (me.sortAttrib.invertColorScale) vv = 9 - vv;
      this.style.fill = me.colorQuantize(vv);
      this.style.stroke = me.colorQuantize(vv >= 5 ? 0 : 9);
    });
  }
  if (this.viewRecAs === 'nodelink') {
    this.DOM.kshfRecords.style('fill', (d) => {
      let v = s_f.call(d.data);
      if (s_log && v <= 0) v = undefined;
      if (v === undefined) return undefinedFill;
      let vv = me.recordColorScale(v);
      if (me.sortAttrib.invertColorScale) vv = 9 - vv;
      return me.colorQuantize(vv);
    });
  }
};

RecordDisplay.prototype.highlightLinked = function highlightLinked(recordFrom) {
  if (recordFrom.DOM.links_To === undefined) return;
  recordFrom.DOM.links_To.forEach((dom) => {
    dom.style.display = 'block';
  });
  const links = recordFrom.data[this.linkBy[0]];
  if (!links) return;
  const recordsIndexed = kshf.dt_id[browser.primaryTableName];
  links.forEach((recordTo_id) => {
    const recordTo = recordsIndexed[recordTo_id];
    if (recordTo) {
      if (recordTo.DOM.record) {
        d3.select(recordTo.DOM.record.parentNode.appendChild(recordTo.DOM.record));
        recordTo.DOM.record.setAttribute('selection', 'related');
      }
    }
  }, this);
};

RecordDisplay.prototype.unhighlightLinked = function unhighlightLinked(recordFrom) {
  if (recordFrom.DOM.links_To === undefined) return;
  recordFrom.DOM.links_To.forEach((dom) => {
    dom.style.display = null;
  });
  const links = recordFrom.data[this.linkBy[0]];
  if (!links) return;
  const recordsIndexed = kshf.dt_id[browser.primaryTableName];
  links.forEach((recordTo_id) => {
    const recordTo = recordsIndexed[recordTo_id];
    if (recordTo) {
      if (recordTo.DOM.record) {
        recordTo.DOM.record.removeAttribute('selection');
      }
    }
  }, this);
};

RecordDisplay.prototype.onRecordMouseOver = function onRecordMouseOver(record) {
  record.highlightRecord();
  this.highlightLinked(record);
  if (this.viewRecAs === 'scatter') {
    this.DOM.root.selectAll('.onRecordLine').style('opacity', 1);
    const accX = this.scatterAttrib.summaryID;
    const accY = this.sortAttrib.summaryID;

    const recX = this.scatterAxisScale_X(record._valueCache[accX]);
    const recY = this.scatterAxisScale_Y(record._valueCache[accY]);
    this.DOM.scatterAxis_X.select('.onRecordLine').style('transform', `translate(  ${recX}px,0px)`);
    this.DOM.scatterAxis_Y.select('.onRecordLine').style('transform', `translate(0px,${recY}px)`);

    this.DOM.scatterAxis_X.select('.onRecordLine > .tickText')
      .html(this.scatterAttrib.printWithUnitName(record._valueCache[accX]));
    this.DOM.scatterAxis_Y.select('.onRecordLine > .tickText')
      .html(this.sortAttrib.printWithUnitName(record._valueCache[accY]));
  }
  if (this.viewRecAs === 'map' || this.viewRecAs === 'nodelink' || this.viewRecAs === 'scatter') {
    // reorder dom so it appears on top.
    record.DOM.record.parentNode.appendChild(record.DOM.record);
  }
};

RecordDisplay.prototype.onRecordMouseLeave = function onRecordMouseLeave(record) {
  record.unhighlightRecord();
  this.unhighlightLinked(record);
  if (this.viewRecAs === 'scatter') {
    this.DOM.root.selectAll('.onRecordLine').style('opacity', null);
  }
};

RecordDisplay.prototype.refreshRecordDOM = function refreshRecordDOM() {
  let me = this,
    x;
  const records = (
    this.viewRecAs === 'map' ||
      this.viewRecAs === 'nodelink' ||
      this.viewRecAs === 'scatter'
  ) ?
  // all records
    this.browser.records
    :
  // only top-sorted records
    this.browser.records.filter(record => record.isWanted && (record.recordRank < me.maxVisibleItems));

  let newRecords = this.DOM.recordGroup.selectAll('.kshfRecord')
    .data(records, record => record.id()).enter();

  const nodeType = ({
    map: 'path',
    nodelink: 'circle',
    scatter: 'circle',
    list: 'div',
    grid: 'div',
  })[this.viewRecAs];

  const briefSummaryID = this.recordViewSummaryBrief.summaryID;
  const mainSummaryID = this.recordViewSummary.summaryID;

  // Shared structure per record view
  newRecords = newRecords
    .append(nodeType)
    .attr('class', 'kshfRecord')
    .attr('id', record => `kshfRecord_${record.id()}`) // can be used to apply custom CSS
    .attr('rec_compared', record => (record.selectCompared_str ? record.selectCompared_str : null))
    .each(function (record) {
      record.DOM.record = this;
      if (me.viewRecAs === 'map' || me.viewRecAs === 'scatter' || me.viewRecAs === 'nodelink') {
        this.tipsy = new Tipsy(this, {
          gravity: 'e',
          className: 'recordTip',
          title: (me.viewRecAs === 'scatter' || me.viewRecAs === 'nodelink') ?
          // scatter, nodelink
            function () { return record._valueCache[mainSummaryID]; } :
          // map
            function () {
              const v = me.sortAttrib.summaryFunc.call(record.data, record);
              return `${'' +
                  "<span class='mapItemName'>"}${record._valueCache[mainSummaryID]}</span>` +
                  `<span class='mapTooltipLabel'>${me.sortAttrib.summaryName}</span>: ` +
                  `<span class='mapTooltipValue'>${me.sortAttrib.printWithUnitName(v)}</span>`;
            },
        });
      }
    })
    .on('mouseenter', function (record) {
      const DOM = this;
      const event = d3.event;
      if (this.highlightTimeout) clearTimeout(this.highlightTimeout);
      this.highlightTimeout = setTimeout(() => {
        if (DOM.tipsy) {
          DOM.tipsy.show();
          if (me.viewRecAs === 'map') {
            const browserPos = me.browser.DOM.root.node().getBoundingClientRect();
            DOM.tipsy.jq_tip.node().style.left =
                `${event.pageX - browserPos.left - DOM.tipsy.tipWidth - 10}px`;
            DOM.tipsy.jq_tip.node().style.top =
                `${event.pageY - browserPos.top - DOM.tipsy.tipHeight / 2}px`;
          }
        }
        me.onRecordMouseOver(record);
      }, (me.browser.mouseSpeed < 0.2) ? 0 : me.browser.mouseSpeed * 300);
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('mouseleave', function (record) {
      if (this.highlightTimeout) window.clearTimeout(this.highlightTimeout);
      if (this.tipsy) this.tipsy.hide();
      me.onRecordMouseLeave(record);
    })
    .on('mousedown', function () {
      this._mousemove = false;
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('mousemove', function () {
      this._mousemove = true;
      if (me.viewRecAs === 'map' && this.tipsy && this.tipsy.jq_tip) {
        const browserPos = me.browser.DOM.root.node().getBoundingClientRect();
        this.tipsy.jq_tip.node().style.left =
            `${d3.event.pageX - browserPos.left - this.tipsy.tipWidth - 10}px`;
        this.tipsy.jq_tip.node().style.top =
            `${d3.event.pageY - browserPos.top - this.tipsy.tipHeight / 2}px`;
      }
    })
    .on('click', function (_record) {
      if (this.tipsy) this.tipsy.hide();
      if (this._mousemove) return; // Do not show the detail view if the mouse was used to drag the map
      if (me.viewRecAs === 'map' || me.viewRecAs === 'nodelink' || me.viewRecAs === 'scatter') {
        me.browser.updateRecordDetailPanel(_record);
      }
    });

  if (this.viewRecAs === 'list' || this.viewRecAs === 'grid') {
    newRecords.attr('details', false);
    // RANK
    x = newRecords.append('span').attr('class', 'recordRank')
      .each(function (_record) {
        this.tipsy = new Tipsy(this, {
          gravity: 'e',
          title() { return kshf.Util.ordinal_suffix_of((_record.recordRank + 1)); },
        });
      })
      .on('mouseenter', function () { this.tipsy.show(); })
      .on('mouseout', function () { this.tipsy.hide(); });
    this.refreshRecordRanks(x);
    // SORTING VALUE LABELS
    if (this.viewRecAs === 'list') {
      x = newRecords.append('div').attr('class', 'recordSortValue').style('width', `${this.sortColWidth}px`);
      this.refreshRecordSortLabels(x);
    }
    // TOGGLE DETAIL
    newRecords.append('div').attr('class', 'recordToggleDetail fa')
      .each(function (d) {
        this.tipsy = new Tipsy(this, {
          gravity: 's',
          title() {
            if (me.detailsToggle === 'one' && this.viewRecAs === 'list') { return d.showDetails === true ? 'Show less' : 'Show more'; }
            return kshf.lang.cur.ShowMoreInfo;
          },
        });
      })
      .on('mouseenter', function () { this.tipsy.show(); })
      .on('mouseleave', function () { this.tipsy.hide(); })
      .on('click', function (record) {
        this.tipsy.hide();
        if (me.detailsToggle === 'one' && me.viewRecAs === 'list') {
          record.setRecordDetails(!record.showDetails);
        }
        if (me.detailsToggle === 'zoom') {
          me.browser.updateRecordDetailPanel(record);
        }
      });

    // Insert the content
    newRecords.append('div').attr('class', 'content')
      .html(record => record._valueCache[mainSummaryID]);

    // Fixes ordering problem when new records are made visible on the list
    // TODO: Try to avoid this.
    this.DOM.recordGroup.selectAll('.kshfRecord').order();
  }

  if (this.viewRecAs === 'nodelink' || this.viewRecAs === 'scatter') {
    newRecords.attr('r', 4);
  }

  // Call the onDOM function for all the records that have been inserted to the page
  if (this.config.onDOM) {
    newRecords.each((record) => { me.config.onDOM.call(record.data, record); });
  }

  this.DOM.kshfRecords = this.DOM.recordGroup.selectAll('.kshfRecord');

  if (this.viewRecAs === 'map') {
    this.recMap_zoomToActive();
    this.recMap_projectRecords();
    this.refreshRecordColors();
  } else if (this.viewRecAs === 'nodelink') {
    this.refreshRecordColors();
  } else if (this.viewRecAs === 'scatter') {
    // Nothing...
  } else {
    this.DOM.recordSortValue = this.DOM.recordGroup.selectAll('.recordSortValue');
    this.DOM.recordRanks = this.DOM.recordGroup.selectAll('.recordRank');
    this.DOM.recordToggleDetail = this.DOM.recordGroup.selectAll('.recordToggleDetail');
  }

  this.updateRecordVisibility();
};

RecordDisplay.prototype.showMoreRecordsOnList = function showMoreRecordsOnList() {
  if (this.viewRecAs === 'map' || this.viewRecAs === 'nodelink' || this.viewRecAs === 'scatter') return;
  this.DOM.showMore.attr('showMoreVisible', false);
  this.maxVisibleItems += Math.min(this.maxVisibleItems, 250);
  this.refreshRecordDOM();
};
/** Sort all records given the active sort option
   *  Records are only sorted on init & when active sorting option changes.
   *  They are not resorted on filtering. ** Filtering does not affect record sorting.
   */
RecordDisplay.prototype.sortRecords = function sortRecords() {
  const sortValueFunc = this.sortAttrib.summaryFunc;
  const sortFunc = this.sortAttrib.sortFunc;
  const inverse = this.sortAttrib.sortInverse;

  this.browser.records.sort(
    (record_A, record_B) => {
      // Put filtered/remove data to later position
      // !! Don't do above!! Then, when you filter set, you'd need to re-order
      // Now, you don't need to re-order after filtering, which is a nice property to have.
      let v_a = sortValueFunc.call(record_A.data, record_A);
      let v_b = sortValueFunc.call(record_B.data, record_B);

      if (isNaN(v_a)) v_a = undefined;
      if (isNaN(v_b)) v_b = undefined;
      if (v_a === null) v_a = undefined;
      if (v_b === null) v_b = undefined;

      if (v_a === undefined && v_b !== undefined) return 1;
      if (v_b === undefined && v_a !== undefined) return -1;
      if (v_b === undefined && v_a === undefined) return 0;

      let dif = sortFunc(v_a, v_b);
      if (dif === 0) dif = record_B.id() - record_A.id();
      if (inverse) return -dif;
      return dif; // use unique IDs to add sorting order as the last option
    },
  );

  this.updateRecordRanks();
};
/** Returns the sort value type for given sort Value function */
RecordDisplay.prototype.getSortFunc = function getSortFunc(sortValueFunc) {
  // 0: string, 1: date, 2: others
  let sortValueFunction;
  let same;

  // find appropriate sortvalue type
  for (let k = 0, same = 0; true; k++) {
    if (same === 3 || k === this.browser.records.length) break;
    const item = this.browser.records[k];
    const f = sortValueFunc.call(item.data, item);
    let sortValueType_temp2;
    switch (typeof f) {
      case 'string': sortValueType_temp2 = kshf.Util.sortFunc_List_String; break;
      case 'number': sortValueType_temp2 = kshf.Util.sortFunc_List_Number; break;
      case 'object':
        if (f instanceof Date) { sortValueType_temp2 = kshf.Util.sortFunc_List_Date; } else { sortValueType_temp2 = kshf.Util.sortFunc_List_Number; }
        break;
      default: sortValueType_temp2 = kshf.Util.sortFunc_List_Number; break;
    }

    if (sortValueType_temp2 === sortValueFunction) {
      same++;
    } else {
      sortValueFunction = sortValueType_temp2;
      same = 0;
    }
  }
  return sortValueFunction;
};

RecordDisplay.prototype.updateRecordVisibility = function updateRecordVisibility() {
  const me = this;
  if (this.DOM.kshfRecords === undefined) return;

  if (this.viewRecAs === 'map' || this.viewRecAs === 'nodelink' || this.viewRecAs === 'scatter') {
    this.DOM.kshfRecords.each(function (record) {
      this.style.opacity = record.isWanted ? 0.9 : 0.2;
      this.style.pointerEvents = record.isWanted ? '' : 'none';
      this.style.display = 'block'; // Have this bc switching views can invalidate display
    });
  } else { // list or grid
    let visibleItemCount = 0;
    this.DOM.kshfRecords.each(function (record) {
      const recordIsVisible = (record.recordRank >= 0) && (record.recordRank < me.maxVisibleItems);
      if (recordIsVisible) visibleItemCount++;
      this.style.display = recordIsVisible ? null : 'none';
    });
    this.DOM.showMore.select('.CountAbove').html(`&#x25B2;${visibleItemCount} shown`);
    this.DOM.showMore.select('.CountBelow').html(`${this.browser.recordsWantedCount - visibleItemCount} below&#x25BC;`);
  }
  if (this.viewRecAs === 'nodelink') {
    this.DOM.recordLinks.each(function (link) {
      this.style.display = (!link.source.isWanted || !link.target.isWanted) ? 'none' : null;
    });
  }
};

RecordDisplay.prototype.updateAfterFilter = function updateAfterFilter() {
  if (this.recordViewSummary === null) return;
  if (this.viewRecAs === 'map') {
    this.updateRecordVisibility();
    // this.recMap_zoomToActive();
  } else if (this.viewRecAs === 'nodelink') {
    this.updateRecordVisibility();
  } else if (this.viewRecAs === 'scatter') {
    this.updateRecordVisibility();
  } else {
    const me = this;
    let startTime = null;
    const scrollDom = this.DOM.recordGroup.node();
    const scrollInit = scrollDom.scrollTop;
    const easeFunc = d3.easeCubic;
    const animateToTop = function (timestamp) {
      if (startTime === null) {
        startTime = timestamp;
      }
      // complete animation in 500 ms
      const progress = (timestamp - startTime) / 1000;
      scrollDom.scrollTop = (1 - easeFunc(progress)) * scrollInit;
      if (scrollDom.scrollTop !== 0) {
        window.requestAnimationFrame(animateToTop);
        return;
      }
      me.updateRecordRanks();
      me.refreshRecordDOM();
      me.refreshRecordRanks(me.DOM.recordRanks);
    };
    window.requestAnimationFrame(animateToTop);
  }
};

RecordDisplay.prototype.updateRecordRanks = function updateRecordRanks() {
  let wantedCount = 0;
  let unwantedCount = 1;
  this.browser.records.forEach((record) => {
    if (record.isWanted) {
      record.recordRank = wantedCount;
      wantedCount++;
    } else {
      record.recordRank = -unwantedCount;
      unwantedCount++;
    }
  });
  this.maxVisibleItems = this.maxVisibleItems_Default;
};

RecordDisplay.prototype.getScatterAttributes = function getScatterAttributes() {
  const me = this;
  return this.sortingOpts.filter(s => s.scaleType !== 'time' && s.summaryID !== me.sortAttrib.summaryID);
};

RecordDisplay.prototype.viewAs = function viewAs(_type) {
  this.viewRecAs = _type.toLowerCase();
  this.DOM.root.attr('displayType', this.viewRecAs);

  if (this.recordViewSummary === null) return;

  const viewAsOptions = { List: true }; // list-view is always available
  if (this.config.geo) viewAsOptions.Map = true;
  if (this.linkBy.length) viewAsOptions.NodeLink = true;
  viewAsOptions.Scatter = this.getScatterAttributes();

  this.DOM.root.select('.recordDisplay_ViewAsList')
    .style('display', 'inline-block');
  this.DOM.root.select('.recordDisplay_ViewAsMap')
    .style('display', (viewAsOptions.Map) ? 'inline-block' : null);
  this.DOM.root.select('.recordDisplay_ViewAsNodeLink')
    .style('display', (viewAsOptions.NodeLink) ? 'inline-block' : null);
  this.DOM.root.select('.recordDisplay_ViewAsScatter')
    .style('display', (viewAsOptions.Scatter.length > 0) ? 'inline-block' : null);

  this.browser.DOM.root.attr('recordEncoding', this.getRecordEncoding()); // "sort" / "color"

  this.DOM.recordDisplayHeader.select('.recordDisplay_ViewGroup')
    .style('display',
      (viewAsOptions.Map || viewAsOptions.NodeLink || viewAsOptions.Scatter.length > 0)
        ? 'inline-block'
        : null,
    );

  switch (this.viewRecAs) {
    case 'list':
    case 'grid':
      this.initDOM_ListView();
      this.sortRecords();
      this.refreshRecordDOM();
      this.setSortColumnWidth(this.sortColWidth || 50); // default: 50px;
      this.DOM.kshfRecords = this.DOM.recordGroup_List.selectAll('.kshfRecord');
      break;
    case 'map':
      this.initDOM_MapView();
      this.refreshRecordDOM();
      this.refreshRecordColors();
      break;
    case 'nodelink':
      this.initDOM_NodeLinkView();
      this.setNodeLink();
      this.refreshRecordDOM();
      this.refreshRecordColors();
      this.nodelink_restart();
      break;
    case 'scatter':
      if (this.scatterAttrib === null) {
        this.setScatterAttrib(viewAsOptions.Scatter[0]);
      }
      this.initDOM_ScatterView();
      this.refreshRecordDOM();
      this.refreshScatterVis();
      this.resetScatterZoom();
      this.refreshQueryBox_Filter();
      break;
  }

  if (this.nodelink_Force && this.viewRecAs !== 'nodelink') {
    this.nodelink_Force.stop();
    this.DOM.root.attr('NodeLinkState', 'stopped');
    this.DOM.root.classed('hideLinks', null);
  }

  // set style after initializing dom...
  this.DOM.root.select('.LinkControl-LinkAttrib').style('display', this.linkBy.length ? 'inline-block' : 'none');

  this.updateRecordVisibility();

  this.DOM.kshfRecords.each(function (record) { record.DOM.record = this; });
};

RecordDisplay.prototype.exportConfig = function exportConfig() {
  const c = {};
  if (this.textSearchSummary) {
    c.textSearch = this.textSearchSummary.summaryName;
  }
  if (typeof (this.recordViewSummary.summaryColumn) === 'string') {
    c.recordView = this.recordViewSummary.summaryColumn;
  } else {
    c.recordView = this.recordViewSummary.summaryFunc.toString(); // converts function to string
  }

  c.displayType = this.viewRecAs;
  if (this.sortAttrib) c.sortBy = this.sortAttrib.summaryName;
  if (this.scatterAttrib) c.scatterBy = this.scatterAttrib.summaryName;
  if (this.colorAttrib) c.colorBy = this.colorAttrib.summaryName;
  c.sortColWidth = this.sortColWidth;
  c.detailsToggle = this.detailsToggle;
  return c;
};

export default RecordDisplay;
