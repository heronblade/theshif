import * as d3 from 'd3';
import kshf from './kshf';
import SummaryBase from './summaryBase';
import Record from './record';
import AggregateCategory from './aggregateCategory';
import SummarySet from './summarySet';
import Tipsy from './tipsy';

function SummaryCategorical() {}
SummaryCategorical.prototype = Object.create(SummaryBase.prototype);

SummaryCategorical.prototype.initialize = function initialize(browser, name, attribFunc) {
  SummaryBase.prototype.initialize.call(this, browser, name, attribFunc);
  this.type = 'categorical';

  this.heightCat = kshf.catHeight;
  this.show_set_matrix = false;
  this.scrollTop_cache = 0;
  this.firstCatIndexInView = 0;
  this.configRowCount = 0;
  this.minAggrValue = 1;
  this.catSortBy = [];
  this.viewType = 'list';

  this.setCatLabel('id');

  if (this.records.length <= 1000) {
    this.initializeAggregates();
  }
};

SummaryCategorical.prototype.initializeAggregates = function initializeAggregates() {
  if (this.aggr_initialized) return;
  if (this.catTableName === undefined) {
    // Create new table
    this.catTableName = `${this.summaryName}_h_${this.summaryID}`;
  }
  this.mapToAggregates();
  if (this.catSortBy.length === 0) this.setSortingOptions();

  this.aggr_initialized = true;
  this.refreshViz_Nugget();
};

SummaryCategorical.prototype.refreshViz_Nugget = function refreshViz_Nugget(force) {
  if (this.DOM.nugget === undefined) return;
  if (force === undefined) force = false;
  const nuggetChart = this.DOM.nugget.select('.nuggetChart');

  this.DOM.nugget
    .attr('aggr_initialized', this.aggr_initialized ? true : null)
    .attr('datatype', this.getDataType());

  if (!this.aggr_initialized && !force) return;

  if (this.uniqueCategories()) {
    this.DOM.nugget.select('.nuggetInfo').html("<span class='fa fa-tag'></span><br>Unique");
    nuggetChart.style('display', 'none');
    return;
  }

  nuggetChart.selectAll('.nuggetBar').data([]).exit().remove();

  const totalWidth = 25;
  const maxAggregate_Total = this.getMaxAggr('Total');
  nuggetChart.selectAll('.nuggetBar').data(this._aggrs).enter()
    .append('span')
    .attr('class', 'nuggetBar')
    .style('width', cat => `${totalWidth * (cat.records.length / maxAggregate_Total)}px`);

  this.DOM.nugget.select('.nuggetInfo').html(
    `<span class='fa fa-tag${this.isMultiValued ? 's' : ''}'></span><br>${
      this._aggrs.length}<br>rows<br>`);
};

/** *********************************
 * SIZE (HEIGH/WIDTH) QUERY FUNCTIONS
 ************************************ */
SummaryCategorical.prototype.getHeight_RangeMax = function getHeight_RangeMax() {
  if (this.viewType === 'map') {
    return this.getWidth() * 1.5;
  }
  if (this.isEmpty()) return this.getHeight_Header();
  // minimum 2 categories
  return this.getHeight_WithoutCats() + this._aggrs.length * this.heightCat;
};

SummaryCategorical.prototype.getHeight_RangeMin = function getHeight_RangeMin() {
  if (this.isEmpty()) return this.getHeight_Header();
  return this.getHeight_WithoutCats() + Math.min(this.catCount_Visible, 2) * this.heightCat;
};

SummaryCategorical.prototype.getHeight_WithoutCats = function getHeight_WithoutCats() {
  return this.getHeight_Header() + this.getHeight_Config() + this.getHeight_Bottom();
};

SummaryCategorical.prototype.getHeight_Config = function getHeight_Config() {
  return (this.showTextSearch ? 18 : 0) + (this.catSortBy.length > 1 ? 18 : 0);
};

SummaryCategorical.prototype.getHeight_Bottom = function getHeight_Bottom() {
  if (!this.areAllCatsInDisplay() || !this.panel.hideBarAxis || this._aggrs.length > 4) return 18;
  return 0;
};

SummaryCategorical.prototype.getHeight_Content = function getHeight_Content() {
  return this.categoriesHeight + this.getHeight_Config() + this.getHeight_Bottom();
};

SummaryCategorical.prototype.getHeight_VisibleAttrib = function getHeight_VisibleAttrib() {
  return this.catCount_Visible * this.heightCat;
};

SummaryCategorical.prototype.getWidth_Label = function getWidth_Label() {
  return this.panel.width_catLabel;
};

/** --  Label text + the measure text */
SummaryCategorical.prototype.getWidth_TotalText = function getWidth_TotalText() {
  return this.panel.width_catLabel + this.panel.width_catMeasureLabel;
};

SummaryCategorical.prototype.getWidth_CatChart = function getWidth_CatChart() {
  // This will make the bar width extend over to the scroll area.
  // Doesn't look better, the amount of space saved makes chart harder to read and breaks the regularly spaced flow.
  // if(!this.scrollBarShown())return this.panel.width_catBars+kshf.scrollWidth-5;
  return this.panel.width_catBars;
};


SummaryCategorical.prototype.areAllCatsInDisplay = function areAllCatsInDisplay() {
  return this.catCount_Visible === this.catCount_InDisplay;
};

SummaryCategorical.prototype.isEmpty = function isEmpty() {
  if (this._aggrs && this._aggrs.length === 0) return true;
  return this.summaryFunc === undefined;
};

SummaryCategorical.prototype.uniqueCategories = function uniqueCategories() {
  if (this._aggrs === undefined) return true;
  if (this._aggrs.length === 0) return true;
  return d3.max(this._aggrs, aggr => aggr.records.length) === 1;
};

SummaryCategorical.prototype.scrollBarShown = function scrollBarShown() {
  return this.categoriesHeight < this._aggrs.length * this.heightCat;
};

/** *********************************
 * SORTING FUNCTIONS
 ************************************ */
SummaryCategorical.prototype.insertSortingOption = function insertSortingOption(opt) {
  this.catSortBy.push(this.prepareSortingOption(opt));
};

SummaryCategorical.prototype.prepareSortingOption = function prepareSortingOption(opt) {
  if (Array.isArray(opt)) {
    const _lookup = {};
    opt.forEach((s, i) => {
      _lookup[s] = i;
    });
    return {
      inverse: false,
      no_resort: true,
      sortKey: opt,
      name: 'Custom Order',
      value() {
        const v = _lookup[this.id];
        if (v !== undefined) return v;
        return 99999; // unknown is 99999th item
      },
    };
  }
  opt.inverse = opt.inverse || false; // Default is false
  if (opt.value) {
    if (typeof (opt.value) === 'string') {
      const x = opt.value;
      opt.name = opt.name || x;
      opt.sortKey = x;
      opt.value = function () { return this[x]; };
    } else if (typeof (opt.value) === 'function') {
      if (opt.name === undefined) opt.name = 'custom';
    }
    opt.no_resort = true;
  } else {
    opt.name = opt.name || '# of Active';
  }
  if (opt.no_resort === undefined) opt.no_resort = (this._aggrs.length <= 4);
  return opt;
};

SummaryCategorical.prototype.setSortingOptions = function setSortingOptions(opts) {
  this.catSortBy = opts || {};

  if (!Array.isArray(this.catSortBy)) {
    this.catSortBy = [this.catSortBy];
  } else {
    // if it is an array, it might still be defining a sorting order for the categories
    if (this.catSortBy.every(v => (typeof v === 'string'))) {
      this.catSortBy = [this.catSortBy];
    }
  }

  this.catSortBy.forEach(function (opt, i) {
    if (typeof opt === 'string' || typeof opt === 'function') this.catSortBy[i] = { value: opt };
    this.catSortBy[i] = this.prepareSortingOption(this.catSortBy[i]);
  }, this);

  this.catSortBy_Active = this.catSortBy[0];

  this.updateCatSorting(0, true, true);
  this.refreshCatSortOptions();
  this.refreshSortButton();

  if (opts) {
    this.refreshViz_Nugget(true);
  }
};

SummaryCategorical.prototype.refreshSortButton = function refreshSortButton() {
  if (this.DOM.catSortButton === undefined) return;
  this.DOM.catSortButton
    .style('display', (this.catSortBy_Active.no_resort ? 'none' : 'inline-block'))
    .attr('inverse', this.catSortBy_Active.inverse);
};

SummaryCategorical.prototype.refreshCatSortOptions = function refreshCatSortOptions() {
  if (this.DOM.optionSelect === undefined) return;

  this.refreshConfigRowCount();

  this.DOM.optionSelect.style('display', (this.catSortBy.length > 1) ? 'block' : 'none');
  this.DOM.optionSelect.selectAll('.sort_label').remove(); // remove all existing options

  this.DOM.optionSelect.selectAll('.sort_label').data(this.catSortBy)
    .enter().append('option')
    .attr('class', 'sort_label')
    .text(d => d.name);
};

SummaryCategorical.prototype.sortCategories = function sortCategories() {
  const me = this;
  const inverse = this.catSortBy_Active.inverse;
  if (this.catSortBy_Active.prep) this.catSortBy_Active.prep.call(this);

  // idCompareFunc can be based on integer or string comparison
  let idCompareFunc = function (a, b) { return b.id() - a.id(); };
  if (typeof (this._aggrs[0].id()) === 'string') { idCompareFunc = function (a, b) { return b.id().localeCompare(a.id()); }; }

  let theSortFunc;
  const sortV = this.catSortBy_Active.value;
  // sortV can only be function. Just having the check for sanity
  if (sortV && typeof sortV === 'function') {
    // valueCompareFunc can be based on integer or string comparison
    let valueCompareFunc = function (a, b) { return a - b; };
    if (typeof (sortV.call(this._aggrs[0].data, this._aggrs[0])) === 'string') { valueCompareFunc = function (a, b) { return a.localeCompare(b); }; }

    // Of the given function takes 2 parameters, assume it defines a nice sorting order.
    if (sortV.length === 2) {
      theSortFunc = sortV;
    } else {
      // The value is a custom value that returns an integer
      theSortFunc = function (a, b) {
        let x = valueCompareFunc(sortV.call(a.data, a), sortV.call(b.data, b));
        if (x === 0) x = idCompareFunc(a, b);
        if (inverse) x = -x;
        return x;
      };
    }
  } else {
    theSortFunc = function (a, b) {
      // selected on top of the list
      if (!a.f_selected() && b.f_selected()) return 1;
      if (a.f_selected() && !b.f_selected()) return -1;
      // usedAggr === false => on the bottom
      if (!a.usedAggr && b.usedAggr) return 1;
      if (a.usedAggr && !b.usedAggr) return -1;
      // Rest
      let x = b.measure('Active') - a.measure('Active');
      if (x === 0) x = b.measure('Total') - a.measure('Total');
      if (x === 0) x = idCompareFunc(a, b); // stable sorting. ID's would be string most probably.
      if (inverse) x = -x;
      return x;
    };
  }
  this._aggrs.sort(theSortFunc);

  let lastRank = 0;
  this._aggrs.forEach((_cat, i) => {
    if (_cat.recCnt.Active || _cat.isVisible) {
      _cat.orderIndex = lastRank++;
    } else {
      _cat.orderIndex = -lastRank - 1;
    }
  });
};

SummaryCategorical.prototype.setCatLabel = function setCatLabel(accessor) {
  // Clear all assignments
  this.catLabel_attr = null;
  this.catLabel_table = null;
  this.catLabel_Func = null;
  if (typeof (accessor) === 'function') {
    this.catLabel_Func = accessor;
  } else if (typeof (accessor) === 'string') {
    this.catLabel_attr = accessor;
    this.catLabel_Func = function () { return this[accessor]; };
  } else if (typeof (accessor) === 'object') {
    // specifies key->value
    this.catLabel_table = accessor;
    this.catLabel_Func = function () {
      const x = accessor[this.id];
      return x || this.id;
    };
  } else {
    alert('Bad parameter');
    return;
  }
  const me = this;
  if (this.DOM.catLabel) { this.DOM.catLabel.html(cat => me.catLabel_Func.call(cat.data)); }
};

SummaryCategorical.prototype.setCatTooltip = function setCatTooltip(catTooltip) {
  if (typeof (catTooltip) === 'function') {
    this.catTooltip = catTooltip;
  } else if (typeof (catTooltip) === 'string') {
    const x = catTooltip;
    this.catTooltip = function () { return this[x]; };
  } else {
    this.setCatTooltip = undefined;
    this.DOM.aggrGlyphs.attr('title', undefined);
    return;
  }
  if (this.DOM.aggrGlyphs) { this.DOM.aggrGlyphs.attr('title', cat => me.catTooltip.call(cat.data)); }
};

SummaryCategorical.prototype.setCatGeo = function setCatGeo(accessor) {
  if (typeof (accessor) === 'function') {
    this.catMap = accessor;
  } else if (typeof (accessor) === 'string' || typeof (accessor) === 'number') {
    const x = accessor;
    this.catMap = function () { return this[x]; };
  } else {
    this.catMap = undefined;
    return;
  }
  if (this.DOM.root) { this.DOM.root.attr('hasMap', true); }
};

SummaryCategorical.prototype.setCatTable = function setCatTable(tableName) {
  this.catTableName = tableName;
  this.catTableName_custom = true;
  if (this.aggr_initialized) {
    this.mapToAggregates();
    this.updateCats();
  }
};

SummaryCategorical.prototype.setCatSplit = function setCatSplit(catSplit) {
  this.catSplit = catSplit;
  if (this.aggr_initialized) {
    // Remove existing aggregations
    const aggrs = this.browser.allAggregates;
    this._aggrs.forEach((aggr) => { aggrs.splice(aggrs.indexOf(aggr), 1); }, this);
    if (this.DOM.aggrGroup) { this.DOM.aggrGroup.selectAll('.aggrGlyph').data([]).exit().remove(); }

    this.mapToAggregates();
    this.updateCats();
    this.insertCategories();
    this.updateCatSorting(0, true, true);
    this.refreshViz_Nugget();
  }
};

SummaryCategorical.prototype.createSummaryFilter = function createSummaryFilter() {
  this.summaryFilter = this.browser.createFilter('categorical', this);
};

/** --
 * Note: accesses summaryFilter, summaryFunc
 */
SummaryCategorical.prototype.mapToAggregates = function mapToAggregates() {
  const aggrTable_id = {};
  const aggrTable = [];
  let mmmm = false;

  // Converting from kshf.Record to kshf.Aggregate
  if (kshf.dt[this.catTableName] && kshf.dt[this.catTableName][0] instanceof Record) {
    kshf.dt[this.catTableName].forEach(function (record) {
      const aggr = new AggregateCategory(this, record.data, record.idIndex);

      aggrTable_id[aggr.id()] = aggr;
      aggrTable.push(aggr);
      this.browser.allAggregates.push(aggr);
    }, this);
  } else {
    mmmm = true;
  }

  this.catTable_id = aggrTable_id;
  this._aggrs = aggrTable;

  let maxDegree = 0;
  let hasString = false;

  this.records.forEach(function (record) {
    let mapping = this.summaryFunc.call(record.data, record);

    // Split
    if (this.catSplit && typeof mapping === 'string') {
      mapping = mapping.split(this.catSplit);
    }

    // make mapping an array if it is not
    if (!(mapping instanceof Array)) mapping = [mapping];

    mapping.forEach((d, i) => {
      const v = mapping[i];
      if (v && typeof v === 'string') mapping[i] = v.trim();
    });

    // Filter invalid / duplicate values
    const found = {};
    mapping = mapping.filter((e) => {
      if (e === undefined || e === '' || e === null || found[e] !== undefined) return false;
      return (found[e] = true);
    });

    // Record is not mapped to any value (missing value)
    if (mapping.length === 0) {
      record._valueCache[this.summaryID] = null;
      if (record._aggrCache[this.summaryID] !== this.missingValueAggr) { this.missingValueAggr.addRecord(record); }
      return;
    }

    record._valueCache[this.summaryID] = [];

    maxDegree = Math.max(maxDegree, mapping.length);

    mapping.forEach(function (v) {
      if (typeof (v) === 'string') hasString = true;

      let aggr = aggrTable_id[v];
      if (aggr === undefined) {
        aggr = new AggregateCategory(this, { id: v }, 'id');
        aggrTable_id[v] = aggr;
        this._aggrs.push(aggr);
        this.browser.allAggregates.push(aggr);
      }
      record._valueCache[this.summaryID].push(v);
      aggr.addRecord(record);
    }, this);
  }, this);

  if (mmmm && hasString) {
    this._aggrs.forEach((aggr) => { aggr.data.id = `${aggr.data.id}`; });
  }

  this.isMultiValued = maxDegree > 1;
  if (this.DOM.root) this.DOM.root.attr('isMultiValued', this.isMultiValued ? true : null);

  this.updateCats();

  this.unselectAllCategories();

  this.refreshViz_EmptyRecords();
};

SummaryCategorical.prototype.printAggrSelection = function mapToAggregates(aggr) {
  return this.catLabel_Func.call(aggr.data);
};

// Modified internal dataMap function - Skip rows with 0 active item count
SummaryCategorical.prototype.setMinAggrValue = function setMinAggrValue(v) {
  this.minAggrValue = Math.max(1, v);
  this._aggrs = this._aggrs.filter(function (cat) { return cat.records.length >= this.minAggrValue; }, this);
  this.updateCats();
};

SummaryCategorical.prototype.updateCats = function updateCats() {
  // Few categories. Disable resorting after filtering
  if (this._aggrs.length <= 4) {
    this.catSortBy.forEach((sortOpt) => { sortOpt.no_resort = true; });
  }
  this.showTextSearch = this._aggrs.length >= 20;
  this.updateCatCount_Active();
};

SummaryCategorical.prototype.updateCatCount_Active = function updateCatCount_Active() {
  this.catCount_Visible = 0;
  this.catCount_NowVisible = 0;
  this.catCount_NowInvisible = 0;
  this._aggrs.forEach(function (cat) {
    window.v = this.isCatActive(cat);
    cat.isActiveBefore = cat.isActive;
    cat.isActive = v;
    if (!cat.isActive && cat.isActiveBefore) this.catCount_NowInvisible++;
    if (cat.isActive && !cat.isActiveBefore) this.catCount_NowVisible++;
    if (cat.isActive) this.catCount_Visible++;
  }, this);
};

SummaryCategorical.prototype.refreshConfigRowCount = function refreshConfigRowCount() {
  this.configRowCount = 0;
  if (this.showTextSearch) this.configRowCount++;
  if (this.catSortBy.length > 1) this.configRowCount++;

  if (this.configRowCount > 0) this.DOM.summaryControls.style('display', 'block');
};

SummaryCategorical.prototype.initDOM = function initDOM(beforeDOM) {
  this.initializeAggregates();
  const me = this;

  if (this.DOM.inited === true) return;

  this.insertRoot(beforeDOM);

  // this.DOM.root.attrs({
  //   filtered_or: 0,
  //   filtered_and: 0,
  //   filtered_not: 0,
  //   isMultiValued: this.isMultiValued?true:null,
  //   summary_type: 'categorical',
  //   hasMap: this.catMap!==undefined,
  //   viewType: this.viewType
  // });

  this.DOM.root.filtered_or = 0;
  this.DOM.root.filtered_and = 0;
  this.DOM.root.filtered_not = 0;
  this.DOM.root.isMultiValued = this.isMultiValued ? true : null;
  this.DOM.root.summary_type = 'categorical';
  this.DOM.root.hasMap = this.catMap !== undefined;
  this.DOM.root.viewType = this.viewType;

  // this.DOM.root.attr({
  //   filtered_or: 0,
  //   filtered_and: 0,
  //   filtered_not: 0,
  //   isMultiValued: this.isMultiValued ? true : null,
  //   summary_type: 'categorical',
  //   hasMap: this.catMap !== undefined,
  //   viewType: this.viewType,
  // });

  this.insertHeader();

  if (!this.isEmpty()) this.init_DOM_Cat();

  this.setCollapsed(this.collapsed);

  this.DOM.summaryConfig_CatHeight = this.DOM.summaryConfig.append('div')
    .attr('class', 'summaryConfig_CatHeight summaryConfig_Option');
  this.DOM.summaryConfig_CatHeight.append('span').html("<i class='fa fa-arrows-v'></i> Row Height: ");
  const x = this.DOM.summaryConfig_CatHeight.append('span').attr('class', 'optionGroup');
  x.selectAll('.configOption').data(
    [
      { l: "<i class='fa fa-minus'></i>", v: 'minus' },
      { l: 'Short', v: 18 },
      { l: 'Long', v: 35 },
      { l: "<i class='fa fa-plus'></i>", v: 'plus' },
    ])
    .enter()
    .append('span')
    .attr('class', d => `configOption pos_${d.v}`)
    .attr('active', d => d.v === me.heightCat)
    .html(d => d.l)
    .on('click', (d) => {
      if (d.v === 'minus') {
        me.setHeight_Category(me.heightCat - 1);
      } else if (d.v === 'plus') {
        me.setHeight_Category(me.heightCat + 1);
      } else {
        me.setHeight_Category(d.v);
      }
    });

  this.DOM.inited = true;
};

SummaryCategorical.prototype.init_DOM_Cat = function init_DOM_Cat() {
  const me = this;
  this.DOM.summaryCategorical = this.DOM.wrapper.append('div').attr('class', 'summaryCategorical');

  this.DOM.summaryControls = this.DOM.summaryCategorical.append('div').attr('class', 'summaryControls');
  this.initDOM_CatTextSearch();
  this.initDOM_CatSortButton();
  this.initDOM_CatSortOpts();

  if (this.showTextSearch) this.DOM.catTextSearch.style('display', 'block');

  this.refreshConfigRowCount();

  this.DOM.scrollToTop = this.DOM.summaryCategorical.append('div').attr('class', 'scrollToTop fa fa-arrow-up')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'e', title: kshf.lang.cur.ScrollToTop }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); kshf.Util.scrollToPos_do(me.DOM.aggrGroup, 0); });

  this.DOM.aggrGroup = this.DOM.summaryCategorical.append('div').attr('class', 'aggrGroup')
    .on('mousedown', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('scroll', () => {
      if (kshf.Util.ignoreScrollEvents === true) return;
      me.scrollTop_cache = me.DOM.aggrGroup.node().scrollTop;

      me.DOM.scrollToTop.style('visibility', me.scrollTop_cache > 0 ? 'visible' : 'hidden');

      me.DOM.chartCatLabelResize.style('top', `${me.scrollTop_cache}px`);
      me.firstCatIndexInView = Math.floor(me.scrollTop_cache / me.heightCat);
      me.refreshScrollDisplayMore(me.firstCatIndexInView + me.catCount_InDisplay);
      me.updateCatIsVisible();
      me.cullAttribs();
      me.refreshMeasureLabel();
    });
  this.DOM.aggrGroup_list = this.DOM.aggrGroup;

  this.DOM.catMap_Base = this.DOM.summaryCategorical.append('div').attr('class', 'catMap_Base');

  // with this, I make sure that the (scrollable) div height is correctly set to visible number of categories
  this.DOM.chartBackground = this.DOM.aggrGroup.append('span').attr('class', 'chartBackground');

  this.DOM.chartCatLabelResize = this.DOM.chartBackground.append('span').attr('class', 'chartCatLabelResize dragWidthHandle')
    .on('mousedown', function (d, i) {
      const resizeDOM = this;
      me.panel.DOM.root.attr('catLabelDragging', true);

      me.browser.DOM.pointerBlock.attr('active', '');
      me.browser.DOM.root.style('cursor', 'col-resize');
      me.browser.setNoAnim(true);
      const mouseDown_x = d3.mouse(d3.select('body').node())[0];
      const initWidth = me.panel.width_catLabel;

      d3.select('body').on('mousemove', () => {
        const mouseDown_x_diff = d3.mouse(d3.select('body').node())[0] - mouseDown_x;
        me.panel.setWidthCatLabel(initWidth + mouseDown_x_diff);
      }).on('mouseup', () => {
        me.panel.DOM.root.attr('catLabelDragging', false);
        me.browser.DOM.pointerBlock.attr('active', null);
        me.browser.DOM.root.style('cursor', 'default');
        me.browser.setNoAnim(false);
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
    });

  this.DOM.belowCatChart = this.DOM.summaryCategorical.append('div').attr('class', 'belowCatChart');

  this.insertChartAxis_Measure(this.DOM.belowCatChart, 'e', 'e');

  this.DOM.scroll_display_more = this.DOM.belowCatChart.append('div')
    .attr('class', 'hasLabelWidth scroll_display_more')
    .on('click', () => {
      kshf.Util.scrollToPos_do(
        me.DOM.aggrGroup, me.DOM.aggrGroup.node().scrollTop + me.heightCat);
    });

  this.insertCategories();
  this.refreshLabelWidth();
  this.updateCatSorting(0, true, true);
};

SummaryCategorical.prototype.initDOM_CatSortButton = function initDOM_CatSortButton() {
  const me = this;
  // Context dependent
  this.DOM.catSortButton = this.DOM.summaryControls.append('span').attr('class', 'catSortButton sortButton fa')
    .on('click', (d) => {
      if (me.dirtySort) {
        me.dirtySort = false;
        me.DOM.catSortButton.attr('resort', true);
      } else {
        me.catSortBy_Active.inverse = !me.catSortBy_Active.inverse;
        me.refreshSortButton();
      }
      me.updateCatSorting(0, true);
    })
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity: 'w', title() { return kshf.lang.cur[me.dirtySort ? 'Reorder' : 'ReverseOrder']; },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); });
  this.refreshSortButton();
};

SummaryCategorical.prototype.initDOM_CatSortOpts = function initDOM_CatSortOpts() {
  const me = this;
  const x = this.DOM.summaryControls.append('span').attr('class', 'sortOptionSelectGroup hasLabelWidth');

  this.DOM.optionSelect = x.append('select').attr('class', 'optionSelect')
    .on('change', function () {
      me.catSortBy_Active = me.catSortBy[this.selectedIndex];
      me.refreshSortButton();
      me.updateCatSorting(0, true);
    });

  this.refreshCatSortOptions();
};

SummaryCategorical.prototype.initDOM_CatTextSearch = function initDOM_CatTextSearch() {
  const me = this;
  this.DOM.catTextSearch = this.DOM.summaryControls.append('div').attr('class', 'textSearchBox catTextSearch hasLabelWidth');
  this.DOM.catTextSearchControl = this.DOM.catTextSearch.append('span')
    .attr('class', 'textSearchControl fa')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity: 'nw', title: 'Clear text search',
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      me.DOM.catTextSearchControl.attr('showClear', false);
      me.summaryFilter.clearFilter();
    });
  this.DOM.catTextSearchInput = this.DOM.catTextSearch.append('input')
    .attr('class', 'textSearchInput')
    .attr('type', 'text')
    .attr('placeholder', kshf.lang.cur.Search)
    .on('keydown', () => { d3.event.stopPropagation(); })
    .on('keypress', () => { d3.event.stopPropagation(); })
    .on('keyup', () => { d3.event.stopPropagation(); })
    .on('input', function () {
      if (this.timer) clearTimeout(this.timer);
      const x = this;
      this.timer = setTimeout(() => {
        me.unselectAllCategories();
        let query = [];

        // split the query by " character
        const processed = x.value.toLowerCase().split('"');
        processed.forEach((block, i) => {
          if (i % 2 === 0) {
            block.split(/\s+/).forEach((q) => { query.push(q); });
          } else {
            query.push(block);
          }
        });

        // Remove the empty strings
        query = query.filter(v => v !== '');

        if (query.length > 0) {
          me.DOM.catTextSearchControl.attr('showClear', true);
          const labelFunc = me.catLabel_Func;
          const tooltipFunc = me.catTooltip;
          me._aggrs.forEach((_category) => {
            const catLabel = labelFunc.call(_category.data).toString().toLowerCase();
            const f = query.every((query_str) => {
              if (catLabel.indexOf(query_str) !== -1) { return true; }
              if (tooltipFunc) {
                const tooltipText = tooltipFunc.call(_category.data);
                return (tooltipText && tooltipText.toLowerCase().indexOf(query_str) !== -1);
              }
              return false;
            });
            if (f) {
              _category.set_OR(me.summaryFilter.selected_OR);
            } else {
              _category.set_NONE(me.summaryFilter.selected_OR);
            }
          });

          // All categories are process, and the filtering state is set. Now, process the summary as a whole
          if (me.summaryFilter.selectedCount_Total() === 0) {
            me.skipTextSearchClear = true;
            me.summaryFilter.clearFilter();
            me.skipTextSearchClear = false;
          } else {
            me.summaryFilter.how = 'All';
            me.missingValueAggr.filtered = false;
            me.summaryFilter.addFilter();
          }
        } else {
          me.summaryFilter.clearFilter();
        }
      }, 750);
    });
};

SummaryCategorical.prototype._update_Selected = function _update_Selected() {
  if (this.DOM.root) {
    // this.DOM.root.attrs({
    //   "filtered":     this.isFiltered()?"true":null,
    //   "filtered_or":  this.summaryFilter.selected_OR .length,
    //   "filtered_and": this.summaryFilter.selected_AND.length,
    //   "filtered_not": this.summaryFilter.selected_NOT.length,
    // })
    // this.DOM.root.attr('filt')
  }
};

SummaryCategorical.prototype.unselectAllCategories = function unselectAllCategories() {
  this._aggrs.forEach((aggr) => {
    if (aggr.f_selected() && aggr.DOM.aggrGlyph) aggr.DOM.aggrGlyph.removeAttribute('catselect');
    aggr.set_NONE();
  });
  // TODO: Check why this can cause a problem
  if (this.summaryFilter.selected_All_clear) this.summaryFilter.selected_All_clear();
  if (this.DOM.inited) this.DOM.missingValueAggr.classed('filtered', false);
};

SummaryCategorical.prototype.clearCatTextSearch = function clearCatTextSearch() {
  if (!this.showTextSearch) return;
  if (this.skipTextSearchClear) return;
  this.DOM.catTextSearchControl.attr('showClear', false);
  this.DOM.catTextSearchInput.node().value = '';
};

SummaryCategorical.prototype.updateChartScale_Measure = function updateChartScale_Measure() {
  if (!this.aggr_initialized || this.isEmpty()) return; // nothing to do
  const maxMeasureValue = this.getMaxAggr_All();
  let minMeasureValue = 0;
  if (this.browser.measureFunc !== 'Count' && this.browser.measureSummary.intervalRange.org.min < 0) {
    minMeasureValue = this.getMinAggr_All();
  }

  this.chartScale_Measure_prev
    .domain(this.chartScale_Measure.domain())
    .range(this.chartScale_Measure.range())
    .nice(this.chartAxis_Measure_TickSkip())
    .clamp(false);

  this.chartScale_Measure
    .domain([minMeasureValue, maxMeasureValue])
    .range([0, this.getWidth_CatChart()])
    .nice(this.chartAxis_Measure_TickSkip());
  this.refreshViz_All();
};

SummaryCategorical.prototype.setHeight = function setHeight(newHeight) {
  const me = this;
  if (this.isEmpty()) return;
  // take into consideration the other components in the summary
  const attribHeight_old = this.categoriesHeight;
  newHeight -= this.getHeight_Header() + this.getHeight_Config() + this.getHeight_Bottom();
  if (this.viewType === 'map') {
    this.categoriesHeight = newHeight;
    return;
  }

  this.categoriesHeight = Math.min(newHeight, this.heightCat * this.catCount_Visible);
  if (this.onCatHeight && attribHeight_old !== this.categoriesHeight) this.onCatHeight(this);
};

SummaryCategorical.prototype.setHeight_Category = function setHeight_Category(h) {
  this.heightCat = Math.min(50, Math.max(10, h));
  if (!this.DOM.inited) return;
  if (this.viewType === 'list') {
    this.refreshHeight_Category();
  } else {
    this.heightRow_category_dirty = true;
  }
};

SummaryCategorical.prototype.refreshHeight_Category_do = function refreshHeight_Category_do() {
  this.DOM.aggrGlyphs.style('height', `${this.heightCat}px`);
  this.DOM.aggrGlyphs.selectAll('.catLabelGroup').style('padding-top', `${this.heightCat / 2 - 8}px`);
  this.DOM.aggrGlyphs.selectAll('.measureLabel').style('padding-top', `${this.heightCat / 2 - 8}px`);
  let fontSize = null;
  if (this.heightCat < 15) fontSize = `${this.heightCat - 2}px`;
  if (this.heightCat > 25) fontSize = '15px';
  if (this.heightCat > 30) fontSize = '17px';
  if (this.heightCat > 35) fontSize = '19px';
  this.DOM.catLabel.style('font-size', fontSize);

  this.DOM.chartBackground.style('height', `${this.getHeight_VisibleAttrib()}px`);

  if (this.DOM.summaryConfig_CatHeight) {
    this.DOM.summaryConfig_CatHeight.selectAll('.configOption').attr('active', false);
    this.DOM.summaryConfig_CatHeight.selectAll(`.pos_${this.heightCat}`).attr('active', true);
  }
};

SummaryCategorical.prototype.refreshHeight_Category = function refreshHeight_Category() {
  const me = this;
  this.heightRow_category_dirty = false;
  this.browser.setNoAnim(true);

  this.browser.updateLayout();

  this.DOM.aggrGlyphs.style('transform', aggr => `translate(${aggr.posX}px,${me.heightCat * aggr.orderIndex}px)`);

  this.refreshHeight_Category_do();

  if (this.onCatHeight) this.onCatHeight(this);

  setTimeout(() => { me.browser.setNoAnim(false); }, 100);
};

SummaryCategorical.prototype.updateAfterFilter = function updateAfterFilter() {
  if (this.isEmpty() || this.collapsed || !this.inBrowser()) return;
  const me = this;

  if (this.viewType === 'map') {
    this.updateCatCount_Active();
    this.refreshMeasureLabel();
    this.refreshViz_Active();
    return;
  }

  this.updateChartScale_Measure();
  this.refreshMeasureLabel();

  this.refreshViz_EmptyRecords();

  if (this.show_set_matrix) {
    this.dirtySort = true;
    this.DOM.catSortButton.attr('resort', true);
  }
  if (!this.dirtySort) {
    this.updateCatSorting();
  } else {
    this.refreshViz_All();
    this.refreshMeasureLabel();
  }
};

SummaryCategorical.prototype.refreshWidth = function refreshWidth() {
  if (this.DOM.summaryCategorical === undefined) return;
  this.updateChartScale_Measure();
  this.DOM.summaryCategorical.style('width', `${this.getWidth()}px`);
  this.DOM.summaryName.style('max-width', `${this.getWidth() - 40}px`);
  this.DOM.chartAxis_Measure.selectAll('.scaleModeControl').style('width', `${this.getWidth_CatChart() + 5}px`);
  this.refreshViz_Axis();
};

SummaryCategorical.prototype.refreshViz_Total = function refreshViz_Total() {
  if (this.isEmpty() || this.collapsed || this.viewType === 'map') return;
  const me = this;
  const width_Text = this.getWidth_TotalText();

  const maxWidth = this.chartScale_Measure.range()[1];
  const ratioMode = this.browser.ratioModeActive;
  const zeroPos = this.chartScale_Measure(0);

  this.DOM.measure_Total
    .style('opacity', ratioMode ? 0.5 : null)
    .style('transform', (_cat) => {
      const _h = ratioMode ? maxWidth : me.chartScale_Measure(_cat.measure('Total'));
      return `translateX(${width_Text + zeroPos}px) ` + `scaleX(${_h - zeroPos})`;
    });
  this.DOM.measureTotalTip
    .style('transform', `translateX(${me.chartScale_Measure.range()[1] + width_Text}px)`)
    .style('opacity', (_cat) => {
      if (ratioMode) return 0;
      return (_cat.measure('Total') > me.chartScale_Measure.domain()[1]) ? 1 : 0;
    });
};

SummaryCategorical.prototype.setShowSetMatrix = function setShowSetMatrix(v) {
  this.show_set_matrix = v;
  this.DOM.root.attr('show_set_matrix', this.show_set_matrix);

  if (this.show_set_matrix) {
    if (this.setSummary === undefined) {
      this.setSummary = new SummarySet();
      this.setSummary.initialize(this.browser, this);
      this.browser.summaries.push(this.setSummary);
    } else {
      this.setSummary.prepareSetMatrixSorting();
    }
  } else {
    // remove sorting option
    this.catSortBy = this.catSortBy.filter(sortingOpt => sortingOpt.name !== 'Relatedness');

    this.catSortBy_Active = this.catSortBy[0];
    this.refreshCatSortOptions();
    this.refreshSortButton();
    this.updateCatSorting(0, true);

    this.onCatSort = undefined;
  }
};

SummaryCategorical.prototype.refreshMapColorScaleBounds = function refreshMapColorScaleBounds(boundMin, boundMax) {
  if (boundMin === undefined && boundMax === undefined) {
    const maxAggr_Active = this.getMaxAggr('Active');
    if (this.browser.ratioModeActive) {
      boundMin = 0;
      boundMax = 100;
    } else if (this.browser.percentModeActive) {
      boundMin = 0;
      boundMax = 100 * maxAggr_Active / this.browser.allRecordsAggr.measure('Active');
    } else {
      boundMin = d3.min(this._aggrs, _cat => _cat.measure('Active')),
      boundMax = maxAggr_Active;
    }
  }

  this.mapColorScale = d3.scaleLinear().range([0, 9]).domain([boundMin, boundMax]);

  this.DOM.catMapColorScale.select('.boundMin').html(this.browser.getTickLabel(boundMin));
  this.DOM.catMapColorScale.select('.boundMax').html(this.browser.getTickLabel(boundMax));
};

SummaryCategorical.prototype.refreshViz_Active = function refreshViz_Active() {
  if (this.isEmpty() || this.collapsed) return;
  const me = this;
  const ratioMode = this.browser.ratioModeActive;

  if (this.viewType === 'map') {
    this.refreshMapColorScaleBounds();

    const allRecordsAggr_measure_Active = me.browser.allRecordsAggr.measure('Active');

    this.DOM.measure_Active
      .attr('fill', (_cat) => {
        let v = _cat.measure('Active');
        if (v <= 0 || v === undefined) return 'url(#diagonalHatch)';
        if (me.browser.percentModeActive) {
          v = 100 * v / allRecordsAggr_measure_Active;
        }
        let vv = me.mapColorScale(v);
        if (ratioMode) vv = 0;
        return me.mapColorQuantize(vv);
      })
      .attr('stroke', (_cat) => {
        let v = _cat.measure('Active');
        if (me.browser.percentModeActive) {
          v = 100 * v / allRecordsAggr_measure_Active;
        }
        let vv = 9 - me.mapColorScale(v);
        if (ratioMode) vv = 8;
        return me.mapColorQuantize(vv);
      });
    return;
  }

  const maxWidth = this.chartScale_Measure.range()[1];
  const zeroPos = this.chartScale_Measure(0);
  const width_Text = this.getWidth_TotalText();

  this.DOM.aggrGlyphs
    .attr('NoActiveRecords', aggr => ((aggr._measure.Active === 0) ? 'true' : null));

  this.DOM.measure_Active.style('transform', (_cat) => {
    let scaleX = (ratioMode ? zeroPos : me.chartScale_Measure(_cat.measure('Active')));
    if (_cat.recCnt.Active === 0) scaleX = 0;
    scaleX -= zeroPos;
    return `translateX(${width_Text + zeroPos}px) scaleX(${scaleX})`;
  });
  this.DOM.lockButton
    .style('left', _cat => `${width_Text + (ratioMode ?
      ((_cat.recCnt.Active === 0) ? 0 : maxWidth) :
      Math.min((me.chartScale_Measure(_cat.measure('Active'))), maxWidth)
    )}px`)
    .attr('inside', (_cat) => {
      if (ratioMode) return '';
      if (maxWidth - me.chartScale_Measure(_cat.measure('Active')) < 10) return '';
      return null; // nope, not inside
    });
};

SummaryCategorical.prototype.refreshViz_Highlight = function refreshViz_Highlight() {
  if (this.isEmpty() || this.collapsed || !this.DOM.inited || !this.inBrowser()) return;
  const me = this;

  this.refreshViz_EmptyRecords();
  this.refreshMeasureLabel();

  const ratioMode = this.browser.ratioModeActive;
  const isThisIt = this === this.browser.highlightSelectedSummary;
  const maxWidth = this.chartScale_Measure.range()[1];
  const width_Text = this.getWidth_TotalText();

  if (this.browser.vizActive.Highlight) {
    if (this.browser.ratioModeActive) {
      if (this.viewType !== 'map') {
        this.DOM.highlightedMeasureValue.styles({
          opacity: 1,
          transform: `translateX(${this.browser.allRecordsAggr.ratioHighlightToTotal() * maxWidth}px)` });
      }
    }
  } else {
    this.DOM.highlightedMeasureValue.style('opacity', 0);
  }

  if (this.viewType == 'map') {
    if (!this.browser.vizActive.Highlight) {
      this.refreshViz_Active();
      return;
    }
    if (!isThisIt || this.isMultiValued) {
      const boundMin = ratioMode ?
        d3.min(this._aggrs, (_cat) => {
          if (_cat.recCnt.Active === 0 || _cat.recCnt.Highlight === 0) return null;
          return 100 * _cat.ratioHighlightToActive();
        }) :
        1; // d3.min(this._aggrs, function(_cat){ return _cat.measure.Active; }),
      const boundMax = ratioMode ?
        d3.max(this._aggrs, _cat => ((_cat._measure.Active === 0) ? null : 100 * _cat.ratioHighlightToActive())) :
        d3.max(this._aggrs, (_cat) => {
          if (_cat.usedAggr) return _cat.measure('Highlight');
        });

      this.refreshMapColorScaleBounds(boundMin, boundMax);
    }

    const allRecordsAggr_measure_Active = me.browser.allRecordsAggr.measure('Active');

    this.DOM.measure_Active
      .attr('fill', (_cat) => {
        // if(_cat === me.browser.selectedAggr.Highlight) return "";
        let _v;
        if (me.isMultiValued || !isThisIt) {
          v = _cat.measure('Highlight');
          if (ratioMode) v = 100 * v / _cat.measure('Active');
        } else {
          v = _cat.measure('Active');
          if (me.browser.percentModeActive) {
            v = 100 * v / allRecordsAggr_measure_Active;
          }
        }
        if (v <= 0 || v === undefined) return 'url(#diagonalHatch)';
        return me.mapColorQuantize(me.mapColorScale(v));
      });
  } else { // this.viewType==='list'
    let totalC = this.browser.getActiveCompareSelCount();
    if (this.browser.measureFunc === 'Avg') totalC++;
    const barHeight = (this.heightCat - 8) / (totalC + 1);

    const zeroPos = this.chartScale_Measure(0);

    this.DOM.measure_Highlight.style('transform', (aggr) => {
      let p = aggr.measure('Highlight');
      if (me.browser.preview_not) p = aggr._measure.Active - aggr._measure.Highlight;
      const scaleX = (ratioMode ? ((p / aggr._measure.Active) * maxWidth) : me.chartScale_Measure(p));
      return `translateX(${width_Text + zeroPos}px) translateY(4px) scale(${scaleX - zeroPos},${barHeight})`;
    });
  }
};

/** To initialize the positions of the compare blocks properly */
SummaryCategorical.prototype.refreshViz_Compare_Force = function refreshViz_Compare_Force() {
  this.refreshViz_Compare('A', 2, 2);
  this.refreshViz_Compare('B', 2, 3);
  this.refreshViz_Compare('C', 2, 4);
};

SummaryCategorical.prototype.refreshViz_Compare = function refreshViz_Compare(cT, curGroup, totalGroups) {
  if (this.isEmpty() || this.collapsed || !this.inBrowser() || this.viewType == 'map') return;
  let me = this,
    ratioMode = this.browser.ratioModeActive,
    maxWidth = this.chartScale_Measure.range()[1];
  const width_Text = this.getWidth_TotalText();

  const zeroPos = this.chartScale_Measure(0);

  const _translateX = `translateX(${width_Text + zeroPos}px) `;
  const barHeight = (this.heightCat - 8) / totalGroups;
  const _translateY = `translateY(${barHeight * (curGroup + 1) + 4}px)`; // 4pixel is the b=top gap
  const compId = `Compare_${cT}`;

  this.DOM[`measure_Compare_${cT}`].style('transform', (aggr) => {
    let sx = (me.browser.vizActive[compId]) ?
      (ratioMode ? (aggr.ratioCompareToActive(cT) * maxWidth) : me.chartScale_Measure(aggr.measure(compId))) : 0;
    sx -= zeroPos;
    return `${_translateX + _translateY}scale(${sx},${barHeight})`;
  });
};

SummaryCategorical.prototype.refreshViz_Axis = function refreshViz_Axis() {
  if (this.isEmpty() || this.collapsed) return;

  const me = this;
  let tickValues,
    posFunc,
    transformFunc;
  const chartWidth = this.getWidth_CatChart();

  let axis_Scale = d3.scaleLinear()
    .clamp(false)
    .domain(this.chartScale_Measure.domain())
    .range(this.chartScale_Measure.range());

  function setCustomAxis(maxValue) {
    axis_Scale = d3.scaleLinear()
      .rangeRound([0, chartWidth])
      .nice(me.chartAxis_Measure_TickSkip())
      .clamp(true)
      .domain([0, maxValue]);
  }

  if (this.browser.ratioModeActive) {
    setCustomAxis(100);
  } else if (this.browser.percentModeActive) {
    setCustomAxis(Math.round(100 * me.getMaxAggr('Active') / me.browser.allRecordsAggr.measure('Active')));
  }

  // GET TICK VALUES ***********************************************************
  tickValues = axis_Scale.ticks(this.chartAxis_Measure_TickSkip());
  if (this.browser.measureFunc === 'Count' || true) {
    // remove 0-tick // TODO: The minimum value can be below zero, and you may wish to label 0-line
    tickValues = tickValues.filter(d => d !== 0);
  }
  // Remove non-integer values is appropriate
  if ((this.browser.measureFunc === 'Count') || (this.browser.measureFunc === 'Sum' && !this.browser.measureSummary.hasFloat)) {
    tickValues = tickValues.filter(d => d % 1 === 0);
  }

  const tickDoms = this.DOM.chartAxis_Measure_TickGroup.selectAll('span.tick')
    .data(tickValues, i => i);

  // Remove old ones
  tickDoms.exit().transition().style('opacity', 0).transition()
    .remove();

  // Add new ones
  const tickData_new = tickDoms.enter().append('span').attr('class', 'tick');

  tickData_new.append('span').attr('class', 'line longRefLine')
    .style('top', `-${this.categoriesHeight + 3}px`)
    .style('height', `${this.categoriesHeight - 1}px`);
  tickData_new.append('span').attr('class', 'text measureAxis_1');
  if (this.configRowCount > 0) {
    tickData_new.append('span').attr('class', 'text measureAxis_2').style('top', `${-this.categoriesHeight - 21}px`);
    this.DOM.chartAxis_Measure.selectAll('.scaleModeControl.measureAxis_2').style('top', `${-(this.categoriesHeight + 14)}px`);
  }

  // Place the doms at the zero-point, so their position can be animated.
  tickData_new.style('transform', d => `translateX(${me.chartScale_Measure_prev(d) - 0.5}px)`);

  this.DOM.chartAxis_Measure_TickGroup.selectAll('.text')
    .html(d => me.browser.getTickLabel(d));

  this.DOM.wrapper.attr('showMeasureAxis_2', me.configRowCount > 0 ? 'true' : null);
  setTimeout(() => {
    me.DOM.chartAxis_Measure_TickGroup.selectAll('span.tick')
      .style('transform', d => `translateX(${axis_Scale(d) - 0.5}px)`)
      .style('opacity', 1);
  });
};

SummaryCategorical.prototype.refreshLabelWidth = function refreshLabelWidth() {
  if (this.isEmpty()) return;
  if (this.DOM.summaryCategorical === undefined) return;

  const width_Label = this.getWidth_Label();
  const width_totalText = this.getWidth_TotalText();

  this.DOM.chartCatLabelResize.style('left', `${width_Label + 1}px`);
  this.DOM.summaryCategorical.selectAll('.hasLabelWidth').style('width', `${width_Label}px`);

  this.DOM.measureLabel.attr('style', `left: ${width_Label}px; width ${this.panel.width_catMeasureLabel}px`);
  // this.DOM.measureLabel.styles({
  //   left:  width_Label+"px",
  //   width: this.panel.width_catMeasureLabel+"px"
  // });
  // this.DOM.measureLabel.style.left = `${width_Label}px`;
  // this.DOM.measureLabel.style.width = `${this.panel.width_catMeasureLabel}px`;

  this.DOM.chartAxis_Measure.style('transform', `translateX(${width_totalText}px)`);

  this.DOM.catSortButton.attr('style', `left: ${width_Label}px; width: ${this.panel.width_catMeasureLabel}px`);
  // this.DOM.catSortButton.styles({
  //   left: width_Label+"px",
  //   width: this.panel.width_catMeasureLabel+"px"
  // });
  // this.DOM.catSortButton.style.left = `${width_Label}px`;
  // this.DOM.catSortButton.style.width = `${this.panel.width_catMeasureLabel}px`;
};

SummaryCategorical.prototype.refreshScrollDisplayMore = function refreshScrollDisplayMore(bottomItem) {
  if (this._aggrs.length <= 4) {
    this.DOM.scroll_display_more.style('display', 'none');
    return;
  }
  let moreTxt = `${this.catCount_Visible} ${kshf.lang.cur.Rows}`;
  const below = this.catCount_Visible - bottomItem;
  if (below > 0) moreTxt += ` <span class='fa fa-angle-down'></span>${below} ${kshf.lang.cur.More}`;
  this.DOM.scroll_display_more.html(moreTxt);
};

SummaryCategorical.prototype.refreshHeight = function refreshHeight() {
  if (this.isEmpty()) return;

  // update catCount_InDisplay
  var c = Math.floor(this.categoriesHeight / this.heightCat);
  var c = Math.floor(this.categoriesHeight / this.heightCat);
  if (c < 0) c = 1;
  if (c > this.catCount_Visible) c = this.catCount_Visible;
  if (this.catCount_Visible <= 2) {
    c = this.catCount_Visible;
  } else {
    c = Math.max(c, 2);
  }
  this.catCount_InDisplay = c + 1;
  this.catCount_InDisplay = Math.min(this.catCount_InDisplay, this.catCount_Visible);

  this.refreshScrollDisplayMore(this.firstCatIndexInView + this.catCount_InDisplay);

  this.updateCatIsVisible();
  this.cullAttribs();

  this.DOM.headerGroup.attr('allCatsInDisplay', this.areAllCatsInDisplay());

  this.updateChartScale_Measure();

  const h = this.categoriesHeight;
  this.DOM.wrapper.style('height', `${this.collapsed ? '0' : this.getHeight_Content()}px`);
  this.DOM.aggrGroup.style('height', `${h}px`);
  this.DOM.chartCatLabelResize.style('height', `${h}px`);
  this.DOM.root.style('max-height', `${this.getHeight() + 1}px`);

  this.DOM.chartAxis_Measure.selectAll('.longRefLine').style('top', `${-h + 1}px`).style('height', `${h - 2}px`);
  this.DOM.chartAxis_Measure.selectAll('.text.measureAxis_2').style('top', `${-h - 21}px`);
  this.DOM.chartAxis_Measure.selectAll('.scaleModeControl.measureAxis_2').style('top', `${-h - 14}px`);

  if (this.viewType === 'map') {
    this.DOM.catMap_Base.style('height', `${h}px`);
    if (this.leafletAttrMap) this.leafletAttrMap.invalidateSize();
  }
};

SummaryCategorical.prototype.isCatActive = function isCatActive(category) {
  if (!category.usedAggr) return false;
  if (category.f_selected()) return true;
  if (category.recCnt.Active !== 0) return true;
  // summary is not filtered yet, don't show categories with no records
  if (!this.isFiltered()) return category.recCnt.Active !== 0;
  if (this.viewType === 'map') return category.recCnt.Active !== 0;
  // Hide if multiple options are selected and selection is and
  //        if(this.summaryFilter.selecttype==="SelectAnd") return false;
  // TODO: Figuring out non-selected, zero-active-item attribs under "SelectOr" is tricky!
  return true;
};

SummaryCategorical.prototype.isCatSelectable = function isCatSelectable(category) {
  if (category.f_selected()) return true;
  if (category.recCnt.Active !== 0) return true;
  // Show if multiple attributes are selected and the summary does not include multi value records
  if (this.isFiltered() && !this.isMultiValued) return true;
  // Hide
  return false;
};

/**
 When clicked on an attribute ...
 what: AND / OR / NOT / NONE
 how: MoreResults / LessResults
 */
SummaryCategorical.prototype.filterCategory = function filterCategory(ctgry, what, how) {
  if (this.browser.skipSortingFacet) {
    // you can now sort the last filtered summary, attention is no longer there.
    this.browser.skipSortingFacet.dirtySort = false;
    this.browser.skipSortingFacet.DOM.catSortButton.attr('resort', false);
  }
  this.browser.skipSortingFacet = this;
  this.browser.skipSortingFacet.dirtySort = true;
  this.browser.skipSortingFacet.DOM.catSortButton.attr('resort', true);

  const i = 0;

  const preTest = (this.summaryFilter.selected_OR.length > 0 && (this.summaryFilter.selected_AND.length > 0 ||
    this.summaryFilter.selected_NOT.length > 0));

  // if selection is in same mode, "undo" to NONE.
  if (what === 'NOT' && ctgry.is_NOT()) what = 'NONE';
  if (what === 'AND' && ctgry.is_AND()) what = 'NONE';
  if (what === 'OR' && ctgry.is_OR()) what = 'NONE';

  if (what === 'NONE') {
    if (ctgry.is_AND() || ctgry.is_NOT()) {
      this.summaryFilter.how = 'MoreResults';
    }
    if (ctgry.is_OR()) {
      this.summaryFilter.how = this.summaryFilter.selected_OR.length === 0 ? 'MoreResults' : 'LessResults';
    }
    ctgry.set_NONE();
    if (this.summaryFilter.selected_OR.length === 1 && this.summaryFilter.selected_AND.length === 0) {
      this.summaryFilter.selected_OR.forEach(function (a) {
        a.set_NONE();
        a.set_AND(this.summaryFilter.selected_AND);
      }, this);
    }
    if (!this.summaryFilter.selected_Any()) {
      this.dirtySort = false;
      this.DOM.catSortButton.attr('resort', false);
    }
  }
  if (what === 'NOT') {
    if (ctgry.is_NONE()) {
      if (ctgry.recCnt.Active === this.browser.allRecordsAggr.recCnt.Active) {
        alert('Removing this category will create an empty result list, so it is not allowed.');
        return;
      }
      this.summaryFilter.how = 'LessResults';
    } else {
      this.summaryFilter.how = 'All';
    }
    ctgry.set_NOT(this.summaryFilter.selected_NOT);
  }
  if (what === 'AND') {
    ctgry.set_AND(this.summaryFilter.selected_AND);
    this.summaryFilter.how = 'LessResults';
  }
  if (what === 'OR') {
    if (!this.isMultiValued && this.summaryFilter.selected_NOT.length > 0) {
      const temp = [];
      this.summaryFilter.selected_NOT.forEach((a) => { temp.push(a); });
      temp.forEach((a) => { a.set_NONE(); });
    }
    if (this.summaryFilter.selected_OR.length === 0 && this.summaryFilter.selected_AND.length === 1) {
      this.summaryFilter.selected_AND.forEach(function (a) {
        a.set_NONE();
        a.set_OR(this.summaryFilter.selected_OR);
      }, this);
    }
    ctgry.set_OR(this.summaryFilter.selected_OR);
    this.summaryFilter.how = 'MoreResults';
  }
  if (how) this.summaryFilter.how = how;

  if (preTest) {
    this.summaryFilter.how = 'All';
  }
  if (this.summaryFilter.selected_OR.length > 0 && (this.summaryFilter.selected_AND.length > 0 ||
    this.summaryFilter.selected_NOT.length > 0)) {
    this.summaryFilter.how = 'All';
  }
  if (this.missingValueAggr.filtered === 'in') {
    this.summaryFilter.how = 'All';
  }

  if (this.summaryFilter.selectedCount_Total() === 0) {
    this.summaryFilter.clearFilter();
    return;
  }
  this.clearCatTextSearch();
  if (this.missingValueAggr.filtered === 'in') {
    this.missingValueAggr.filtered = false;
  }
  this.summaryFilter.addFilter();
};

SummaryCategorical.prototype.onCatClick = function onCatClick(ctgry) {
  if (!this.isCatSelectable(ctgry)) return;

  if (d3.event && d3.event.altKey) {
    this.filterCategory(ctgry, 'NOT');
    return;
  }

  if (d3.event && d3.event.shiftKey) {
    this.browser.setSelect_Compare(true);
    return;
  }

  if (this.dblClickTimer) { // double click
    if (!this.isMultiValued) return;
    this.unselectAllCategories();
    this.filterCategory('AND', 'All');
    return;
  }

  if (ctgry.is_NOT()) {
    this.filterCategory(ctgry, 'NOT');
  } else if (ctgry.is_AND()) {
    this.filterCategory(ctgry, 'AND');
  } else if (ctgry.is_OR()) {
    this.filterCategory(ctgry, 'OR');
  } else {
    // remove the single selection if it is defined with OR
    if (!this.isMultiValued && this.summaryFilter.selected_Any()) {
      if (this.summaryFilter.selected_OR.indexOf(ctgry) < 0) {
        var temp = [];
        this.summaryFilter.selected_OR.forEach((a) => { temp.push(a); });
        temp.forEach((a) => { a.set_NONE(); });
      }
      if (this.summaryFilter.selected_AND.indexOf(ctgry) < 0) {
        var temp = [];
        this.summaryFilter.selected_AND.forEach((a) => { temp.push(a); });
        temp.forEach((a) => { a.set_NONE(); });
      }
      if (this.summaryFilter.selected_NOT.indexOf(ctgry) < 0) {
        var temp = [];
        this.summaryFilter.selected_NOT.forEach((a) => { temp.push(a); });
        temp.forEach((a) => { a.set_NONE(); });
      }
      this.filterCategory(ctgry, 'AND', 'All');
    } else {
      this.filterCategory(ctgry, 'AND');
    }
  }

  if (this.isMultiValued) {
    const x = this;
    this.dblClickTimer = setTimeout(() => { x.dblClickTimer = null; }, 500);
  }
};

SummaryCategorical.prototype.onAggrHighlight = function onAggrHighlight(aggr) {
  if (!this.isCatSelectable(aggr)) return;

  if (aggr.DOM.matrixRow) aggr.DOM.matrixRow.setAttribute('selection', 'selected');

  aggr.DOM.aggrGlyph.setAttribute('catselect', 'and');

  // Comes after setting select type of the category - visual feedback on selection...
  if (!this.isMultiValued && this.summaryFilter.selected_AND.length !== 0) return;

  // Show the highlight (preview)
  if (aggr.is_NOT()) return;
  if (this.isMultiValued || this.summaryFilter.selected_AND.length === 0) {
    d3.select(aggr.DOM.aggrGlyph).classed('showlock', true);
    this.browser.setSelect_Highlight(aggr);
    if (!this.browser.ratioModeActive) {
      this.DOM.highlightedMeasureValue
        .style('opacity', 1)
        .style('transform', `translateX(${
          this.viewType === 'map'
            ? (`${100 * (this.mapColorScale(aggr.measure('Highlight')) / 9)}%`)
            : (`${this.chartScale_Measure(aggr.measure('Active'))}px`)
        })`,
        );
    }
  }
};

SummaryCategorical.prototype.onAggrLeave = function onAggrLeave(ctgry) {
  ctgry.unselectAggregate();
  if (!this.isCatSelectable(ctgry)) return;
  this.browser.clearSelect_Highlight();
  if (this.viewType === 'map') this.DOM.highlightedMeasureValue.style('opacity', 0);
};

SummaryCategorical.prototype.onCatEnter_OR = function onCatEnter_OR(ctgry) {
  this.browser.clearSelect_Highlight();
  ctgry.DOM.aggrGlyph.setAttribute('catselect', 'or');
  if (this.summaryFilter.selected_OR.length > 0) {
    if (this.viewType === 'map') this.DOM.highlightedMeasureValue.style('opacity', 0);
  }
  if (d3.event) {
    d3.event.stopPropagation();
  }
};

SummaryCategorical.prototype.onCatLeave_OR = function onCatLeave_OR(ctgry) {
  ctgry.DOM.aggrGlyph.setAttribute('catselect', 'and');
};

SummaryCategorical.prototype.onCatClick_OR = function onCatClick_OR(ctgry) {
  this.filterCategory(ctgry, 'OR');

  if (this.browser.helpin) {
    this.browser.helpin.topicHistory.push(_material._topics.T_FilterOr);
  }
  if (d3.event) {
    d3.event.stopPropagation();
    d3.event.preventDefault();
  }
};

SummaryCategorical.prototype.onCatEnter_NOT = function onCatEnter_NOT(ctgry) {
  ctgry.DOM.aggrGlyph.setAttribute('catselect', 'not');
  this.browser.preview_not = true;
  this.browser.setSelect_Highlight(ctgry);
  this.browser.refreshMeasureLabels('Highlight');
  if (d3.event) {
    d3.event.stopPropagation();
  }
};

SummaryCategorical.prototype.onCatLeave_NOT = function onCatLeave_NOT(ctgry) {
  ctgry.DOM.aggrGlyph.setAttribute('catselect', 'and');
  this.browser.preview_not = false;
  this.browser.setSelect_Highlight(ctgry);
  if (this.viewType === 'map') this.DOM.highlightedMeasureValue.style('opacity', 0);
};

SummaryCategorical.prototype.onCatClick_NOT = function onCatClick_NOT(ctgry) {
  const me = this;
  this.browser.preview_not = true;
  this.filterCategory(ctgry, 'NOT');
  setTimeout(() => { me.browser.preview_not = false; }, 1000);

  if (this.browser.helpin) {
    this.browser.helpin.topicHistory.push(_material._topics.T_FilterNot);
  }

  if (d3.event) {
    d3.event.stopPropagation();
    d3.event.preventDefault();
  }
};

/** - */
SummaryCategorical.prototype.insertCategories = function insertCategories() {
  const me = this;
  if (typeof this.DOM.aggrGroup === 'undefined') return;

  const aggrGlyphSelection = this.DOM.aggrGroup.selectAll('.aggrGlyph')
    .data(this._aggrs, aggr => aggr.id());

  const DOM_cats_new = aggrGlyphSelection.enter()
    .append(this.viewType == 'list' ? 'span' : 'g')
    .attr('class', `aggrGlyph ${this.viewType == 'list' ? 'cat' : 'map'}Glyph`) // mapGlyph, catGlyph
    .attr('title', me.catTooltip ? _cat => me.catTooltip.call(_cat.data) : null);

  this.updateCatIsVisible();

  if (this.viewType === 'list') {
    DOM_cats_new
      .style('height', `${this.heightCat}px`)
      .style('transform', 'translateY(0px)')
      .on('mouseenter', function (_cat) {
        this.setAttribute('mouseOver', true);
        if (me.browser.mouseSpeed < 0.2) {
          me.onAggrHighlight(_cat);
        } else {
          this.highlightTimeout = window.setTimeout(() => { me.onAggrHighlight(_cat); }, me.browser.mouseSpeed * 500);
        }
      })
      .on('mouseleave', function (_cat) {
        this.removeAttribute('mouseOver');
        if (this.highlightTimeout) window.clearTimeout(this.highlightTimeout);
        me.onAggrLeave(_cat);
      })
      .on('click', (aggr) => { me.onCatClick(aggr); });

    DOM_cats_new.append('span').attr('class', 'lockButton fa')
      .on('mouseenter', function (aggr) {
        this.tipsy = new Tipsy(this, {
          gravity: me.panel.name === 'right' ? 'se' : 'w',
          title() {
            const isLocked = me.browser.selectedAggr.Compare_A === aggr ||
              me.browser.selectedAggr.Compare_B === aggr ||
              me.browser.selectedAggr.Compare_C === aggr;
            return kshf.lang.cur[!isLocked ? 'LockToCompare' : 'Unlock'];
          },
        });
        this.tipsy.show();
      })
      .on('mouseleave', function () { this.tipsy.hide(); })
      .on('click', function (_cat) {
        this.tipsy.hide();
        me.browser.setSelect_Compare(true);
        d3.event.preventDefault();
        d3.event.stopPropagation();
      });

    const domAttrLabel = DOM_cats_new.append('span').attr('class', 'catLabelGroup hasLabelWidth')
      .style('padding-top', `${this.heightCat / 2 - 8}px`);

    const filterButtons = domAttrLabel.append('span').attr('class', 'filterButtons');
    filterButtons.append('span').attr('class', 'AndOrNot_Or')
      .text(kshf.lang.cur.Or)
      .on('mouseover', (_cat) => { me.onCatEnter_OR(_cat); })
      .on('mouseout', (_cat) => { me.onCatLeave_OR(_cat); })
      .on('click', (_cat) => { me.onCatClick_OR(_cat); });
    filterButtons.append('span').attr('class', 'AndOrNot_Not')
      .text(kshf.lang.cur.Not)
      .on('mouseover', (_cat) => { me.onCatEnter_NOT(_cat); })
      .on('mouseout', (_cat) => { me.onCatLeave_NOT(_cat); })
      .on('click', (_cat) => { me.onCatClick_NOT(_cat); });

    domAttrLabel.append('span').attr('class', 'catLabel')
      .html(aggr => me.catLabel_Func.call(aggr.data));
    DOM_cats_new.append('span').attr('class', 'measureLabel');

    ['Total', 'Active', 'Highlight', 'Compare_A', 'Compare_B', 'Compare_C'].forEach((m) => {
      DOM_cats_new.append('span').attr('class', `measure_${m}`)
        .on('mouseenter', () => {
          if (m === 'Compare_A' || m === 'Compare_B' || m === 'Compare_C') {
            // (if active)
            if (me.browser.vizActive[m]) me.browser.refreshMeasureLabels(m);
          } else if (m === 'Total' || m === 'Active') {
            // nothing
          } else if (me.browser.measureLabelType === 'Highlight') {
            // nothing
          } else {
            me.browser.refreshMeasureLabels(m);
          }
          d3.event.preventDefault();
          d3.event.stopPropagation();
        });
    });
    DOM_cats_new.append('span').attr('class', 'total_tip');
  } else if (this.viewType === 'map') {
    DOM_cats_new
      .each(function (_cat) {
        this.tipsy = new Tipsy(this, {
          gravity: 'e',
          className: 'recordTip',
          title() {
            let str = '';
            str += `<span class='mapItemName'>${me.catLabel_Func.call(_cat.data)}</span>`;
            str += "<span style='font-weight: 300'>";
            str += `${me.browser.getMeasureLabel(_cat)} ${me.browser.getMeasureFuncTypeText_Brief()}`;
            if (me.browser.measureFunc !== 'Count') {
              str += `<br>in ${_cat.recCnt.Active} ${me.browser.recordName}`;
            }
            str += '</span>';
            return str;
          },
        });
      })
      .on('mouseenter', function (_cat) {
        if (this.tipsy) {
          this.tipsy.show();
          let left = (d3.event.pageX - this.tipsy.tipWidth - 10);
          let top = (d3.event.pageY - this.tipsy.tipHeight / 2);

          const browserPos = kshf.browser.DOM.root.node().getBoundingClientRect();
          left -= browserPos.left;
          top -= browserPos.top;

          this.tipsy.jq_tip.node().style.left = `${left}px`;
          this.tipsy.jq_tip.node().style.top = `${top}px`;
        }
        if (me.browser.mouseSpeed < 0.2) {
          me.onAggrHighlight(_cat);
        } else {
          this.highlightTimeout = window.setTimeout(() => { me.onAggrHighlight(_cat); }, me.browser.mouseSpeed * 500);
        }
      })
      .on('mousemove', function () {
        const browserPos = kshf.browser.DOM.root.node().getBoundingClientRect();
        const left = (d3.event.pageX - browserPos.left - this.tipsy.tipWidth - 10); // left - browserPos.left;
        const top = (d3.event.pageY - browserPos.top - this.tipsy.tipHeight / 2); // top - browserPos.top;

        this.tipsy.jq_tip.node().style.left = `${left}px`;
        this.tipsy.jq_tip.node().style.top = `${top}px`;
      })
      .on('mouseleave', function (_cat) {
        if (this.tipsy) this.tipsy.hide();
        if (this.highlightTimeout) window.clearTimeout(this.highlightTimeout);
        me.onAggrLeave(_cat);
      });

    DOM_cats_new.append('path').attr('class', 'measure_Active')
      .on('click', (aggr) => { me.onCatClick(aggr); });
    DOM_cats_new.append('text').attr('class', 'measureLabel'); // label on top of (after) all the rest
  }
  this.refreshDOMcats();

  if (this.viewType === 'list') {
    this.refreshViz_Compare_Force();
  }
};

SummaryCategorical.prototype.refreshDOMcats = function refreshDOMcats() {
  this.DOM.aggrGlyphs = this.DOM.aggrGroup.selectAll('.aggrGlyph').each(function (aggr) { aggr.DOM.aggrGlyph = this; });

  this.DOM.measureLabel = this.DOM.aggrGlyphs.selectAll('.measureLabel');
  this.DOM.measureTotalTip = this.DOM.aggrGlyphs.selectAll('.total_tip');
  ['Total', 'Active', 'Highlight', 'Compare_A', 'Compare_B', 'Compare_C'].forEach(function (m) {
    this.DOM[`measure_${m}`] = this.DOM.aggrGlyphs.selectAll(`.measure_${m}`);
  }, this);

  if (this.viewType === 'list') {
    this.DOM.catLabel = this.DOM.aggrGlyphs.selectAll('.catLabel');
    this.DOM.lockButton = this.DOM.aggrGlyphs.selectAll('.lockButton');

    this.refreshHeight_Category_do();
  }
};

SummaryCategorical.prototype.updateCatIsVisible = function updateCatIsVisible() {
  if (this.viewType === 'map') {
    this._aggrs.forEach((_cat) => { _cat.isVisible = true; });
  } else if (this.viewType === 'list') {
    const maxVisible = Math.ceil((this.scrollTop_cache + this.categoriesHeight) / this.heightCat);

    this._aggrs.forEach(function (_cat) {
      _cat.isVisibleBefore = _cat.isVisible;
      _cat.isVisible = _cat.isActive &&
        (_cat.orderIndex >= this.firstCatIndexInView) &&
        (_cat.orderIndex < maxVisible);
    }, this);
  }
};

SummaryCategorical.prototype.cullAttribs = function cullAttribs() {
  if (this.viewType === 'map') return; // no culling on maps, for now.
  this.DOM.aggrGlyphs.style('display', (_cat) => { if (!_cat.isVisible) return 'none'; });
  if (this.onCatCull) this.onCatCull.call(this);
};

SummaryCategorical.prototype.updateCatSorting = function updateCatSorting(sortDelay, force, noAnim) {
  if (this.viewType === 'map') return;
  if (this._aggrs === undefined) return;
  if (this._aggrs.length === 0) return;
  if (this.uniqueCategories() && this.panel === undefined) return; // Nothing to sort...
  if (this.catSortBy_Active.no_resort === true && force !== true) return;

  const me = this;

  this.updateCatCount_Active();
  this.sortCategories();

  if (this.panel === undefined) return;
  // The rest deals with updating UI
  if (this.DOM.aggrGlyphs === undefined) return;

  this.updateCatIsVisible();

  const xRemoveOffset = -100; // disappear direction, depends on the panel location
  if (this.onCatSort) this.onCatSort.call(this);

  // Categories outside the view are invisible, expand the background box and makes the scroll bar visible if necessary.
  this.DOM.chartBackground.style('height', `${this.getHeight_VisibleAttrib()}px`);

  // scroll to top when re-sorted
  if (this.scrollTop_cache !== 0) kshf.Util.scrollToPos_do(me.DOM.aggrGroup, 0);

  this.refreshScrollDisplayMore(this.firstCatIndexInView + this.catCount_InDisplay);

  if (noAnim) {
    // black magic of the worst kind
    // these are not regular DOM elements they're d3
    // this.DOM.aggrGlyphs.styles({
    //   opacity: 1,
    //   transform: function(_cat){
    //     _cat.posX = 0;
    //     _cat.posY = me.heightCat * _cat.orderIndex;
    //     return "translate("+_cat.posX+"px,"+_cat.posY+"px)";
    //   }
    // });
    this.DOM.aggrGlyphs.style.opacity = 1;
    this.DOM.aggrGlyphs.style('transform', (_cat) => {
      _cat.posX = 0;
      _cat.posY = me.heightCat * _cat.orderIndex;
      return `translate(${_cat.posX}px,${_cat.posY}px)`;
    });
    this.cullAttribs();
    return;
  }

  if (sortDelay === undefined) sortDelay = 1000;
  const perCatDelay = 30;

  this.DOM.aggrGlyphs
    .filter(_cat => !_cat.isActiveBefore && !_cat.isActive)
    .style('display', 'none');

  // Disappear animation
  this.DOM.aggrGlyphs
    .filter(_cat => _cat.isActiveBefore && !_cat.isActive)
    .transition()
    .duration(1)
    .delay(sortDelay)
    .on('end', function (_cat) {
      this.style.opacity = 0;
      _cat.posX = xRemoveOffset;
      _cat.posY = _cat.posY;
      this.style.transform = `translate(${_cat.posX}px,${_cat.posY}px)`;
    })
    .transition()
    .duration(1000)
    .on('end', function (_cat) {
      this.style.display = 'none';
    });

  // Appear animation (initial position)
  this.DOM.aggrGlyphs
    .filter(_cat => !_cat.isActiveBefore && _cat.isActive)
    .transition()
    .duration(1)
    .delay(sortDelay)
    .on('end', function (_cat) {
      this.style.opacity = 0;
      this.style.display = 'block';
      _cat.posX = xRemoveOffset;
      _cat.posY = me.heightCat * _cat.orderIndex;
      this.style.transform = `translate(${_cat.posX}px,${_cat.posY}px)`;
    });

  // Sort animation
  this.DOM.aggrGlyphs
    .filter(_cat => _cat.isActive)
    .style('display', 'block')
    .transition()
    .duration(1)
    .delay((_cat) => {
      if (_cat.isVisibleBefore && !_cat.isVisible) return sortDelay;
      const x = _cat.isActiveBefore ? 0 : (me.catCount_InDisplay - 5) * perCatDelay; // appear animation is further delayed
      return 100 + sortDelay + x + Math.min(_cat.orderIndex, me.catCount_InDisplay + 2) * perCatDelay;
    })
    .on('end', function (_cat) {
      this.style.opacity = 1;
      _cat.posX = 0;
      _cat.posY = me.heightCat * _cat.orderIndex;
      this.style.transform = `translate(${_cat.posX}px,${_cat.posY}px)`;
    })
    .transition()
    .duration(250)
    .on('end', function (_cat) {
      if (!(_cat.isVisible || _cat.isVisibleBefore)) {
        this.style.display = 'none';
      }
    });
};

SummaryCategorical.prototype.chartAxis_Measure_TickSkip = function chartAxis_Measure_TickSkip() {
  const width = this.chartScale_Measure.range()[1];
  let ticksSkip = width / 25;
  if (this.getMaxAggr('Active') > 100000) {
    ticksSkip = width / 30;
  }
  if (this.browser.ratioModeActive) {
    ticksSkip /= 1.1;
  } else if (this.browser.percentModeActive) {
    ticksSkip /= 1.1;
  }
  return ticksSkip;
};

/** --  */
SummaryCategorical.prototype.map_projectCategories = function map_projectCategories() {
  if (this.panel === undefined) return;
  // the following is temporary
  if (this.sourceDescr && this.sourceDescr.onMapProject) this.sourceDescr.onMapProject.call(this);
  //
  const me = this;
  this.DOM.measure_Active.attr('d', function (_cat) {
    _cat._d_ = me.catMap.call(_cat.data, _cat);
    if (_cat._d_ === undefined) {
      this.parentNode.style.display = 'none';
      return;
    }
    return me.geoPath(_cat._d_);
  });
  this.DOM.measure_Highlight.attr('d', _cat => me.geoPath(_cat._d_));
  this.DOM.measureLabel
    .attr('transform', (_cat) => {
      const centroid = me.geoPath.centroid(_cat._d_);
      return `translate(${centroid[0]},${centroid[1]})`;
    })
    .style('display', (aggr) => {
      const bounds = me.geoPath.bounds(aggr._d_);
      const width = Math.abs(bounds[0][0] - bounds[1][0]);
      return (width < me.panel.width_catMeasureLabel) ? 'none' : 'block';
    })
  ;
};

SummaryCategorical.prototype.map_refreshBounds_Active = function map_refreshBounds_Active() {
  // Insert the bounds for each record path into the bs
  const bs = [];
  const me = this;
  this._aggrs.forEach((_cat) => {
    if (!_cat.isActive) return;
    const feature = me.catMap.call(_cat.data, _cat);
    if (typeof feature === 'undefined') return;
    const b = d3.geoBounds(feature);
    if (isNaN(b[0][0])) return;
    // Change wrapping
    if (b[0][0] > kshf.map.wrapLongitude) b[0][0] -= 360;
    if (b[1][0] > kshf.map.wrapLongitude) b[1][0] -= 360;
    bs.push(L.latLng(b[0][1], b[0][0]));
    bs.push(L.latLng(b[1][1], b[1][0]));
  });

  this.mapBounds_Active = new L.latLngBounds(bs);
};

/** --  */
SummaryCategorical.prototype.catMap_zoomToActive = function catMap_zoomToActive() {
  const me = this;
  if (this.asdsds === undefined) { // First time: just fit bounds
    this.asdsds = true;
    if (this.sourceDescr.mapInitView) {
      this.leafletAttrMap.setView(
        L.latLng(this.sourceDescr.mapInitView[0], this.sourceDescr.mapInitView[1]),
        this.sourceDescr.mapInitView[2]);
      delete this.sourceDescr.mapInitView;
    } else {
      this.leafletAttrMap.fitBounds(this.mapBounds_Active);
      setTimeout(() => { me.catMap_zoomToActive(); }, 1000); // need to call again to refresh. Hmmm. TODO
    }
    return;
  }

  this.leafletAttrMap.flyToBounds(this.mapBounds_Active, kshf.map.flyConfig);
};

SummaryCategorical.prototype.map_refreshColorScale = function map_refreshColorScale() {
  const me = this;
  this.DOM.mapColorBlocks
    .style('background-color', (d) => {
      if (me.invertColorScale) d = 8 - d;
      return kshf.colorScale[me.browser.mapColorTheme][d];
    });
};

SummaryCategorical.prototype.viewAs = function viewAs(_type) {
  const me = this;
  this.viewType = _type;
  this.DOM.root.attr('viewType', this.viewType);
  if (this.viewType === 'list') {
    this.DOM.aggrGroup = this.DOM.aggrGroup_list;
    if (this.heightRow_category_dirty) this.refreshHeight_Category();
    this.refreshDOMcats();
    this.updateCatCount_Active();
    this.updateCatSorting(0, true, true);
    this.DOM.measureLabel.style('display', null);
    this.refreshViz_All();
    return;
  }

  // this.viewType => 'map'

  if (this.setSummary) this.setShowSetMatrix(false);
  // The map view is already initialized
  if (this.leafletAttrMap) {
    this.DOM.aggrGroup = this.DOM.summaryCategorical.select('.catMap_SVG > .aggrGroup');
    this.refreshDOMcats();

    this.map_refreshBounds_Active();
    this.catMap_zoomToActive();
    this.map_projectCategories();
    this.refreshViz_Active();
    this.refreshViz_All();
    return;
  }

  // See http://leaflet-extras.github.io/leaflet-providers/preview/ for alternative layers
  this.leafletAttrMap = L.map(this.DOM.catMap_Base.node(), kshf.map.config)
    .addLayer(new L.TileLayer(kshf.map.tileTemplate, kshf.map.tileConfig))
    .on('viewreset', () => {
      me.map_projectCategories();
    })
    .on('movestart', function () {
      me.browser.DOM.root.attr('pointerEvents', false);
      this._zoomInit_ = this.getZoom();
      me.DOM.catMap_SVG.style('opacity', 0.3);
    })
    .on('moveend', function () {
      me.browser.DOM.root.attr('pointerEvents', true);
      me.DOM.catMap_SVG.style('opacity', null);
      if (this._zoomInit_ !== this.getZoom()) me.map_projectCategories();
    });

  // var width = 500, height = 500;
  // var projection = d3.geo.albersUsa().scale(900).translate([width / 2, height / 2]);
  this.geoPath = d3.geoPath().projection(
    d3.geoTransform({
      // Use Leaflet to implement a D3 geometric transformation.
      point(x, y) {
        if (x > kshf.map.wrapLongitude) x -= 360;
        const point = me.leafletAttrMap.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
      },
    }),
  );

  this.mapColorQuantize = d3.scaleQuantize()
    .domain([0, 9])
    .range(kshf.colorScale.converge);

  this.DOM.catMap_SVG = d3.select(this.leafletAttrMap.getPanes().overlayPane)
    .append('svg').attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('class', 'catMap_SVG');

  // The fill pattern definition in SVG, used to denote geo-objects with no data.
  // http://stackoverflow.com/questions/17776641/fill-rect-with-pattern
  this.DOM.catMap_SVG.append('defs')
    .append('pattern')
    .attr('id', 'diagonalHatch')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 4)
    .attr('height', 4)
    .append('path')
    .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
    .attr('stroke', 'gray')
    .attr('stroke-width', 1);

  // Add custom controls

  const X = this.DOM.summaryCategorical.append('div').attr('class', 'visViewControl');

  X.append('div')
    .attr('class', 'visViewControlButton fa fa-plus')
    .attr('title', 'Zoom in')
    .on('click', () => { me.leafletAttrMap.zoomIn(); });
  X.append('div')
    .attr('class', 'visViewControlButton fa fa-minus')
    .attr('title', 'Zoom out')
    .on('click', () => { me.leafletAttrMap.zoomOut(); });
  X.append('div')
    .attr('class', 'visViewControlButton viewFit fa fa-arrows-alt')
    .attr('title', kshf.lang.cur.ZoomToFit)
    .on('dblclick', () => {
      d3.event.preventDefault();
      d3.event.stopPropagation();
    })
    .on('click', () => {
      me.map_refreshBounds_Active();
      me.catMap_zoomToActive();
      d3.event.preventDefault();
      d3.event.stopPropagation();
    });

  this.DOM.aggrGroup = this.DOM.catMap_SVG.append('g').attr('class', 'leaflet-zoom-hide aggrGroup');

  // Now this will insert map svg component
  this.insertCategories();

  this.DOM.catMapColorScale = this.DOM.belowCatChart.append('div').attr('class', 'catMapColorScale');

  this.DOM.catMapColorScale.append('span').attr('class', 'scaleBound boundMin');
  this.DOM.catMapColorScale.append('span').attr('class', 'scaleBound boundMax');
  this.DOM.catMapColorScale.append('span').attr('class', 'scaleModeControl fa fa-arrows-h')
    .each(function () {
      this.tipsy = new Tipsy(this, { gravity: 'e',
        title() {
          return kshf.lang.cur[me.browser.ratioModeActive ? 'AbsoluteSize' : 'PartOfSize'];
        },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); me.browser.showScaleModeControls(true); })
    .on('mouseleave', function () { this.tipsy.hide(); me.browser.showScaleModeControls(false); })
    .on('click', function () { this.tipsy.hide(); me.browser.setScaleMode(!me.browser.ratioModeActive); });
  this.DOM.scaleModeControl = this.DOM.root.selectAll('scaleModeControl');

  this.DOM.measurePercentControl = this.DOM.catMapColorScale.append('span').attr('class', 'measurePercentControl')
    .each(function () {
      this.tipsy = new Tipsy(this, { gravity: 'w',
        title() {
          return `<span class='fa fa-eye'></span> ${kshf.lang.cur[(me.browser.percentModeActive ? 'Absolute' : 'Percent')]}`;
        },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); me.browser.DOM.root.attr('measurePercentControl', true); })
    .on('mouseleave', function () { this.tipsy.hide(); me.browser.DOM.root.attr('measurePercentControl', null); })
    .on('click', function () { this.tipsy.hide(); me.browser.setPercentLabelMode(!me.browser.percentModeActive); });

  this.DOM.highlightedMeasureValue = this.DOM.catMapColorScale.append('span').attr('class', 'highlightedMeasureValue');
  this.DOM.highlightedMeasureValue.append('div').attr('class', 'fa fa-mouse-pointer highlightedAggrValuePointer');

  this.DOM.mapColorBlocks = this.DOM.catMapColorScale.selectAll('.mapColorBlock')
    .data([0, 1, 2, 3, 4, 5, 6, 7, 8]).enter()
    .append('div')
    .attr('class', 'mapColorBlock')
    .each(function (d) {
      this.tipsy = new Tipsy(this, {
        gravity: 's',
        title() {
          const _minValue = Math.round(me.mapColorScale.invert(d));
          const _maxValue = Math.round(me.mapColorScale.invert(d + 1));
          return `${Math.round(_minValue)} &mdash; ${Math.round(_maxValue)}`;
        },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); });

  // Set height
  const h = this.categoriesHeight;
  this.DOM.catMap_Base.style('height', `${h}px`);
  if (this.DOM.catMap_SVG) this.DOM.catMap_SVG.style('height', `${h}px`);
  if (this.leafletAttrMap) this.leafletAttrMap.invalidateSize();
  this.DOM.aggrGroup.style('height', `${h}px`);

  this.map_refreshColorScale();
  this.map_refreshBounds_Active();
  this.catMap_zoomToActive();
  this.map_projectCategories();
  this.refreshMeasureLabel();
  this.refreshViz_Active();
};

SummaryCategorical.prototype.printAggrSelection = function printAggrSelection(aggr) {
  return this.catLabel_Func.call(aggr.data);
};

export default SummaryCategorical;
