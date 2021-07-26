import Filter from './filter';

function Filter_Interval(_browser, _summary) {
  Filter.call(this, _browser);
  this.summary = _summary;
}

Filter_Interval.prototype = Object.create(Filter.prototype);

Filter_Interval.prototype.getTitle = function getTitle() {
  return this.summary.summaryName;
};

Filter_Interval.prototype.onClear = function onClear() {
  const me = this.summary;
  me.missingValueAggr.filtered = false;
  if (this.filteredBin) {
    this.filteredBin = undefined;
  }
  if (me.DOM.root) me.DOM.root.attr('filtered', null);
  if (me.zoomed) me.setZoomed(false);
  me.resetFilterRangeToTotal();
  me.refreshIntervalSlider();
  if (me.DOM.missingValueAggr) me.DOM.missingValueAggr.classed('filtered', false);
  if (me.encodesRecordsBy === 'scatter' || me.encodesRecordsBy === 'sort') {
    me.browser.recordDisplay.refreshQueryBox_Filter();
  }
};

Filter_Interval.prototype.onFilter = function onFilter() {
  const me = this.summary;
  if (me.DOM.root) me.DOM.root.attr('filtered', true);
  const valueID = me.summaryID;
  if (me.missingValueAggr.filtered === 'in') {
    me.records.forEach(function (record) {
      record.setFilterCache(this.filterID, record._valueCache[valueID] === null);
    }, this);
    return;
  }
  if (me.missingValueAggr.filtered === 'out') {
    me.records.forEach(function (record) {
      record.setFilterCache(this.filterID, record._valueCache[valueID] !== null);
    }, this);
    return;
  }

  const i_min = this.active.min;
  const i_max = this.active.max;

  me.stepRange = false;

  if (me.stepTicks) {
    if (me.scaleType === 'time') {
      // TODO
    } else if (i_min + 1 === i_max) me.stepRange = true;
  }

  let isFilteredCb;
  if (me.isFiltered_min() && me.isFiltered_max()) {
    isFilteredCb = function (v) { return v >= i_min && v < i_max; };
  } else if (me.isFiltered_min()) {
    isFilteredCb = function (v) { return v >= i_min; };
  } else { // me.isFiltered_max()
    isFilteredCb = function (v) { return v < i_max; };
  }

  // TODO: Optimize: Check if the interval scale is extending/shrinking or completely updated...
  me.records.forEach(function (record) {
    const v = record._valueCache[valueID];
    record.setFilterCache(this.filterID, (v !== null) ? isFilteredCb(v) : false);
  }, this);

  let sign = 'plus';
  if (me.stepTicks) {
    if (me.scaleType === 'time') {
      if (me.timeTyped.maxDateRes() === me.timeTyped.activeRes.type) {
        sign = me.zoomed ? 'minus' : '';
      } else {
        sign = 'plus';
      }
    } else {
      sign = me.zoomed ? 'minus' : '';
    }
  }

  if (me.DOM.zoomControl) me.DOM.zoomControl.attr('sign', sign);

  me.refreshIntervalSlider();

  if (me.encodesRecordsBy === 'scatter' || me.encodesRecordsBy === 'sort') {
    me.browser.recordDisplay.refreshQueryBox_Filter();
  }
};

Filter_Interval.prototype.filterView_Detail = function filterView_Detail() {
  const me = this.summary;
  if (me.missingValueAggr.filtered === 'in') return kshf.lang.cur.NoData;
  if (me.missingValueAggr.filtered === 'out') return kshf.lang.cur.ValidData;
  return me.printAggrSelection();
};
// kshf.Filter_Interval.constructor = kshf.Filter_Interval;

export default Filter_Interval;
