import * as d3 from 'd3';
import SummaryBase from './summaryBase';
import AggregateInterval from './aggregateInterval';
import kshf from './kshf';
import Tipsy from './tipsy';

function SummaryInterval() {}
// kshf.SummaryInterval.prototype = new kshf.SummaryBase();a
SummaryInterval.prototype = Object.create(SummaryBase.prototype);


SummaryInterval.prototype.initialize = function initialize(browser, name, attribFunc) {
  SummaryBase.prototype.initialize.call(this, browser, name, attribFunc);
  this.type = 'interval';

  // Call the parent's constructor
  const me = this;

  // pixel width settings...
  this.height_hist = 1; // Initial width (will be updated later...)
  this.height_hist_min = 10; // Minimum possible histogram height
  this.height_hist_max = 100; // Maximim possible histogram height
  this.height_slider = 12; // Slider height
  this.height_labels = 13; // Height for labels
  this.height_hist_topGap = 12; // Height for histogram gap on top.
  this.height_recEncoding = 20; // Record encoding chart height
  this.height_percentile = 32; // Percentile chart height
  this.width_barGap = 2; // The width between neighboring histgoram bars
  this.width_measureAxisLabel = 28; // ..
  this.optimumTickWidth = 45;

  this.hasFloat = false;
  this.timeTyped = {
    base: false,
    maxDateRes() {
      // if(this.hour ) return "hour";
      if (this.day) return 'Day';
      if (this.month) return 'Month';
      if (this.year) return 'Year';
    },
    minDateRes() {
      if (this.year) return 'Year';
      if (this.month) return 'Month';
      if (this.day) return 'Day';
      // if(this.hour ) return "hour";
    },
  };

  this.unitName = undefined; // the text appended to the numeric value (TODO: should not apply to time)
  this.percentileChartVisible = false;
  this.zoomed = false;
  this.encodesRecordsBy = false;
  this.invertColorScale = false;

  this.highlightRangeLimits_Active = false;

  this._aggrs = [];
  this.intervalTicks = [];
  this.intervalRange = {
    getActiveMax() {
      if (!me.stepTicks) return this.active.max;
      if (me.scaleType === 'time') {
        return new Date(this.active.max.getTime() + 1000); // TODO
      }
      return this.active.max + 1;
    },
    getTotalMax() {
      if (!me.stepTicks) return this.total.max;
      if (me.scaleType === 'time') {
        return new Date(this.total.max.getTime() + 1000); // TODO
      }
      return this.total.max + 1;
    },
  };

  if (this.records.length <= 1000) this.initializeAggregates();

  // only used if type is numeric (not timestamp)
  this.quantile_val = {};

  this.timeAxis_XFunc = function (aggr) {
    return (me.valueScale(aggr.minV) + me.valueScale(aggr.maxV)) / 2;
  };
};

SummaryInterval.prototype.isEmpty = function isEmpty() {
  return this._isEmpty;
};

SummaryInterval.prototype.isWideChart = function isWideChart() {
  return this.getWidth() > 400;
};

SummaryInterval.prototype.getHeight_Extra = function getHeight_Extra() {
  return 7 +
    this.height_hist_topGap +
    this.height_labels +
    this.height_slider +
    this.getHeight_Percentile() +
    this.getHeight_RecordEncoding();
};

SummaryInterval.prototype.getHeight_Extra_max = function getHeight_Extra_max() {
  return 7 +
    this.height_hist_topGap +
    this.height_labels +
    this.height_slider +
    this.height_recEncoding +
    this.height_percentile;
};

SummaryInterval.prototype.getHeight_RecordEncoding = function getHeight_RecordEncoding() {
  if (this.encodesRecordsBy && this.browser.recordDisplay) {
    if (this.browser.recordDisplay.viewRecAs === 'map' || this.browser.recordDisplay.viewRecAs === 'nodelink') { return this.height_recEncoding; }
  }
  return 0;
};

SummaryInterval.prototype.getHeight_Content = function getHeight_Content() {
  return this.height_hist + this.getHeight_Extra();
};

SummaryInterval.prototype.getHeight_Percentile = function getHeight_Percentile() {
  return this.percentileChartVisible ? this.height_percentile : 0;
};

SummaryInterval.prototype.getHeight_RangeMax = function getHeight_RangeMax() {
  return this.height_hist_max + this.getHeight_Header() + this.getHeight_Extra_max();
};

SummaryInterval.prototype.getHeight_RangeMin = function getHeight_RangeMin() {
  return this.height_hist_min + this.getHeight_Header() + this.getHeight_Extra_max();
};

SummaryInterval.prototype.getWidth_Chart = function getWidth_Chart() {
  if (!this.inBrowser()) return 30;
  return this.getWidth() - this.width_measureAxisLabel -
    (this.isWideChart() ? this.width_measureAxisLabel : 11);
};

SummaryInterval.prototype.getWidth_OptimumTick = function getWidth_OptimumTick() {
  if (!this.inBrowser()) return 10;
  let v = this.optimumTickWidth;
  if (this.unitName) v += 10 * this.unitName.length;
  return v;
};

SummaryInterval.prototype.getWidth_Bin = function getWidth_Bin() {
  return this.aggrWidth - this.width_barGap * 2;
};

SummaryInterval.prototype.isFiltered_min = function isFiltered_min() {
  if (this.summaryFilter.active.min > this.intervalRange.total.min) return true;
  if (this.scaleType === 'log') return this.isFiltered_max();
  return false;
};

SummaryInterval.prototype.isFiltered_max = function isFiltered_max() {
  return this.summaryFilter.active.max < this.intervalRange.getTotalMax();
};

SummaryInterval.prototype.isTimeStamp = function isTimeStamp() {
  return this.timeTyped.base;
};

SummaryInterval.prototype.createMonthSummary = function createMonthSummary() {
  if (!this.isTimeStamp()) return;
  if (this.summary_sub_month) return this.summary_sub_month;
  const summaryID = this.summaryID;
  this.summary_sub_month = this.browser.createSummary(
    `Month of ${this.summaryName}`,
    (d) => {
      const arr = d._valueCache[summaryID];
      return (arr === null) ? null : arr.getUTCMonth();
    },
    'categorical',
  );
  this.summary_sub_month.setSortingOptions('id');
  this.summary_sub_month.setCatLabel(_demo.Month);
  this.summary_sub_month.initializeAggregates();
  return this.summary_sub_month;
};

SummaryInterval.prototype.createDaySummary = function createDaySummary() {
  if (!this.isTimeStamp()) return;
  if (this.summary_sub_day) return this.summary_sub_day;
  const summaryID = this.summaryID;
  this.summary_sub_day = this.browser.createSummary(
    `WeekDay of ${this.summaryName}`,
    (d) => {
      const arr = d._valueCache[summaryID];
      return (arr === null) ? null : arr.getUTCDay();
    },
    'categorical',
  );
  this.summary_sub_day.setSortingOptions('id');
  this.summary_sub_day.setCatLabel(_demo.DayOfWeek);
  this.summary_sub_day.initializeAggregates();
  return this.summary_sub_day;
};

SummaryInterval.prototype.createHourSummary = function createHourSummary() {
  if (!this.isTimeStamp()) return;
  if (this.summary_sub_hour) return this.summary_sub_hour;
  const summaryID = this.summaryID;
  this.summary_sub_hour = this.browser.createSummary(
    `Hour of ${this.summaryName}`,
    (d) => {
      const arr = d._valueCache[summaryID];
      return (arr === null) ? null : arr.getUTCHours();
    },
    'interval',
  );
  this.summary_sub_hour.initializeAggregates();
  this.summary_sub_hour.setUnitName(':00');
  return this.summary_sub_hour;
};

SummaryInterval.prototype.setSkipZero = function setSkipZero() {
  if (!this.aggr_initialized) return;
  if (this.skipZero) return;
  if (this.timeTyped.base === true) return; // not time
  if (this.intervalRange.total.min > 0) return;
  const me = this;

  this.skipZero = true;

  this.records.forEach(function (record) {
    const v = record._valueCache[me.summaryID];
    if (v !== null && v <= 0) {
      record._valueCache[this.summaryID] = null;
      this.missingValueAggr.addRecord(record);
    }
  }, this);

  this.filteredRecords = this.records.filter((record) => {
    const v = me.getRecordValue(record);
    return (v !== undefined && v !== null);
  });

  this.updateIntervalRange_Total();

  this.refreshScaleType();
  this.resetFilterRangeToTotal();

  this.aggr_initialized = true;
  this.refreshViz_Nugget();
  this.refreshViz_EmptyRecords();
};

SummaryInterval.prototype.initializeAggregates = function initializeAggregates() {
  if (this.aggr_initialized) return;
  const me = this;

  // not part of the object, used by d3 min array calculation.
  this.getRecordValue = function (record) { return record._valueCache[me.summaryID]; };

  if (this.missingValueAggr.records.length > 0) {
    this.missingValueAggr.records = [];
    this.missingValueAggr.resetAggregateMeasures();
  }

  this.records.forEach(function (record) {
    let v = this.summaryFunc.call(record.data, record);
    if (v === undefined) v = null;
    if (isNaN(v)) v = null;
    if (v === 0 && me.skipZero) {
      v = null;
    }
    if (v !== null) {
      if (v instanceof Date) {
        this.timeTyped.base = true;
      } else if (typeof v !== 'number') {
        v = null;
      } else {
        this.hasFloat = this.hasFloat || v % 1 !== 0;
      }
    }
    record._valueCache[this.summaryID] = v;
    if (v === null) this.missingValueAggr.addRecord(record);
  }, this);

  if (this.timeTyped.base === true) {
    // Check time resolutions
    this.timeTyped.month = false;
    this.timeTyped.hour = false;
    this.timeTyped.day = false;
    this.timeTyped.year = false;
    let tempYear = null;
    this.records.forEach(function (record) {
      v = record._valueCache[this.summaryID];
      if (v) {
        if (v.getUTCMonth() !== 0) this.timeTyped.month = true;
        if (v.getUTCHours() !== 0) this.timeTyped.hour = true;
        if (v.getUTCDate() !== 1) this.timeTyped.day = true;
        if (!this.timeTyped.year) {
          if (tempYear === null) {
            tempYear = v.getUTCFullYear();
          } else if (tempYear !== v.getUTCFullYear()) this.timeTyped.year = true;
        }
      }
    }, this);

    // the print function for timestamp -- only considering year/month/day now
    let f = '';
    if (this.timeTyped.year) f = "'%y";
    if (this.timeTyped.month) f = `%b ${f}`;
    if (this.timeTyped.day) f = `%e ${f}`;
    if (this.timeTyped.year && !this.timeTyped.month) f = '%Y'; // Full year
    this.timeTyped.print = d3.utcFormat(f);
  }

  // remove records that map to null / undefined
  this.filteredRecords = this.records.filter((record) => {
    const v = me.getRecordValue(record);
    return (v !== undefined && v !== null);
  });

  // Sort the items by their attribute value
  const sortValue = this.isTimeStamp() ?
    function (a) { return me.getRecordValue(a).getTime(); } :
    function (a) { return me.getRecordValue(a); };
  this.filteredRecords.sort((a, b) => sortValue(a) - sortValue(b));

  this.updateIntervalRange_Total();

  this.refreshScaleType();
  this.resetFilterRangeToTotal();

  this.aggr_initialized = true;
  this.refreshViz_Nugget();
  this.refreshViz_EmptyRecords();
};

SummaryInterval.prototype.setStepTicks = function setStepTicks(v) {
  this.stepTicks = v;
  if (this.stepTicks && !this.zoomed) {
    // Hmm, this was breaking filter setting after zoom in/out. TODO - Check in more detail
    this.checkFilterRange();
  }
};

SummaryInterval.prototype.setTimeFormat = function setTimeFormat(fmt) {
  let timeFormatFunc = null;
  if (fmt === '%Y') {
    timeFormatFunc = function (v) { if (v && v !== '') return new Date(1 * v, 0); };
  } else if (fmt === undefined || fmt === null) {
    return;
  } else {
    timeFormatFunc = d3.timeParse(fmt);
  }
  const f = this.summaryFunc;
  this.summaryFunc = function (record) {
    const v = f.call(this, record);
    if (v === undefined || v === null || v === '') return;
    return timeFormatFunc(v);
  };

  this.aggr_initialized = false;
};

SummaryInterval.prototype.refreshScaleType = function refreshScaleType() {
  if (this.isEmpty()) return;
  const me = this;
  this.stepTicks = false;

  if (this.isTimeStamp()) {
    this.setScaleType('time', true);
    return;
  }

  // decide scale type based on the filtered records
  const inViewRecords = function (record) {
    const v = record._valueCache[me.summaryID];
    if (v >= me.intervalRange.active.min && v < me.intervalRange.getActiveMax()) return v; // value is within filtered range
  };
  const deviation = d3.deviation(this.filteredRecords, inViewRecords);
  const activeRange = this.intervalRange.getActiveMax() - this.intervalRange.active.min;

  const _width_ = this.getWidth_Chart();
  const stepRange = (this.intervalRange.getActiveMax() - this.intervalRange.active.min) + 1;

  // Apply step range before you check for log - it has higher precedence
  if (!this.hasFloat && ((_width_ / this.getWidth_OptimumTick()) >= stepRange)) {
    this.setStepTicks(true);
    this.setScaleType('linear', false); // converted to step on display
    return;
  }

  // LOG SCALE
  if (deviation / activeRange < 0.12 && this.intervalRange.org.min > 0) {
    this.setScaleType('log', false);
    return;
  }

  // The scale can be linear or step after this stage
  if (!this.hasFloat && ((_width_ / this.getWidth_OptimumTick()) >= stepRange)) {
    this.setStepTicks(true);
  }
  this.setScaleType('linear', false);
};

SummaryInterval.prototype.createSummaryFilter = function createSummaryFilter() {
  this.summaryFilter = this.browser.createFilter('interval', this);
};

SummaryInterval.prototype.printAggrSelection = function printAggrSelection(aggr) {
  let minValue,
    maxValue;
  if (aggr) {
    minValue = aggr.minV;
    maxValue = aggr.maxV;
  } else {
    minValue = this.summaryFilter.active.min;
    maxValue = this.summaryFilter.active.max;
  }
  if (this.isTimeStamp()) {
    return `<b>${this.printWithUnitName(minValue)}</b> &mdash; ` +
      `<b>${this.printWithUnitName(maxValue)}</b>`;
  }
  if (this.stepTicks) {
    if (this.stepRange || aggr) {
      return `<b>${this.printWithUnitName(minValue)}</b>`;
    }
  }
  if (this.hasFloat) {
    minValue = minValue.toFixed(2);
    maxValue = maxValue.toFixed(2);
  }
  const minIsLarger = minValue > this.intervalRange.total.min;
  const maxIsSmaller = maxValue < this.intervalRange.getTotalMax();

  let printMax = maxValue;
  if (this.stepTicks) printMax--;

  if (minIsLarger && maxIsSmaller) {
    return `<b>${this.printWithUnitName(minValue)}</b> to <b>${this.printWithUnitName(printMax)}</b>`;
  } else if (minIsLarger) {
    return `<b>min. ${this.printWithUnitName(minValue)}</b>`;
  }
  return `<b>max. ${this.printWithUnitName(printMax)}</b>`;
};

SummaryInterval.prototype.refreshViz_Nugget = function refreshViz_Nugget() {
  if (this.DOM.nugget === undefined) return;

  const nuggetChart = this.DOM.nugget.select('.nuggetChart');

  this.DOM.nugget
    .attr('aggr_initialized', this.aggr_initialized ? true : null)
    .attr('datatype', this.getDataType());

  if (!this.aggr_initialized) return;

  if (this.uniqueCategories()) {
    this.DOM.nugget.select('.nuggetInfo').html("<span class='fa fa-tag'></span><br>Unique");
    nuggetChart.style('display', 'none');
    return;
  }

  const maxAggregate_Total = this.getMaxAggr('Total');

  if (this.intervalRange.org.min === this.intervalRange.org.max) {
    this.DOM.nugget.select('.nuggetInfo').html(`only<br>${this.intervalRange.org.min}`);
    nuggetChart.style('display', 'none');
    return;
  }

  const totalHeight = 17;
  nuggetChart.selectAll('.nuggetBar').data(this._aggrs).enter()
    .append('span')
    .attr('class', 'nuggetBar')
    .style('height', aggr => `${totalHeight * (aggr.records.length / maxAggregate_Total)}px`);

  this.DOM.nugget.select('.nuggetInfo').html(
    `<span class='num_left'>${this.intervalTickPrint(this.intervalRange.org.min)}</span>` +
    `<span class='num_right'>${this.intervalTickPrint(this.intervalRange.org.max)}</span>`);
};

SummaryInterval.prototype.resetActiveRangeToTotal = function resetActiveRangeToTotal() {
  this.intervalRange.active = {
    min: this.intervalRange.total.min,
    max: this.intervalRange.total.max,
  };
};

SummaryInterval.prototype.resetFilterRangeToTotal = function resetFilterRangeToTotal() {
  this.summaryFilter.active = {
    min: this.intervalRange.total.min,
    max: this.intervalRange.getTotalMax(),
  };
};

SummaryInterval.prototype.updateIntervalRange_Total = function updateIntervalRange_Total() {
  this.intervalRange.org = {
    min: d3.min(this.filteredRecords, this.getRecordValue),
    max: d3.max(this.filteredRecords, this.getRecordValue),
  };

  this._isEmpty = this.intervalRange.org.min === undefined;
  // if(this._isEmpty) this.setCollapsed(true);

  // Always integer
  if (this.isTimeStamp()) {
    this.intervalRange.total = {
      min: this.intervalRange.org.min,
      max: this.intervalRange.org.max,
    };
  } else {
    this.intervalRange.total = {
      min: Math.floor(this.intervalRange.org.min),
      max: Math.ceil(this.intervalRange.org.max),
    };

    if (this.scaleType === 'log' && this.intervalRange.total.min === 0) {
      this.intervalRange.total.min = this.intervalRange.org.min;
    }
  }

  if (this.stepTicks) {
    if (this.scaleType === 'time') {
      // TODO
    } else {
      this.intervalRange.total.max++;
    }
  }
  this.resetActiveRangeToTotal();
};

/** --- */
SummaryInterval.prototype.checkFilterRange = function checkFilterRange(fixTime) {
  const filterActive = this.summaryFilter.active;
  if (filterActive === undefined) return;

  // swap min/max if necessary
  if (filterActive.min > filterActive.max) {
    const _temp = filterActive.min;
    filterActive.min = filterActive.max;
    filterActive.max = _temp;
  }

  if (this.scaleType === 'time') {
    if (fixTime) {
      filterActive.min = this.getClosestTick(filterActive.min);
      filterActive.max = this.getClosestTick(filterActive.max);
    }
    return;
  }

  if (this.stepTicks || !this.hasFloat) {
    filterActive.min = Math.floor(filterActive.min);
    filterActive.max = Math.ceil(filterActive.max);
  }

  // Make sure the range is within the visible limits:
  filterActive.min = Math.max(filterActive.min, this.intervalRange.active.min);
  filterActive.max = Math.min(filterActive.max, this.intervalRange.getActiveMax());
};

SummaryInterval.prototype.setScaleType = function setScaleType(t, force) {
  const me = this;

  this.viewType = t === 'time' ? 'line' : 'bar';
  if (this.DOM.inited) {
    this.DOM.root.attr('viewType', this.viewType);
  }

  if (force === false && this.scaleType_locked) return;

  if (this.scaleType === t) return;

  this.scaleType = t;
  if (force) {
    this.scaleType_locked = this.scaleType;
  }

  if (this.DOM.inited) {
    this.DOM.summaryConfig.selectAll('.summaryConfig_ScaleType .configOption').attr('active', false);
    this.DOM.summaryConfig.selectAll(`.summaryConfig_ScaleType .pos_${this.scaleType}`).attr('active', true);
    this.DOM.summaryInterval.attr('scaleType', this.scaleType);
  }

  if (this.filteredRecords === undefined) return;

  // remove records with value:0 (because log(0) is invalid)
  if (this.scaleType === 'log') {
    if (this.intervalRange.total.min <= 0) {
      const x = this.filteredRecords.length;
      this.filteredRecords = this.filteredRecords.filter(function (record) {
        const v = this.getRecordValue(record) !== 0;
        if (v === false) {
          record._valueCache[this.summaryID] = null;
          // TODO: Remove from existing aggregate for this summary
          this.missingValueAggr.addRecord(record);
        }
        return v;
      }, this);
      this.updateIntervalRange_Total();
      this.resetFilterRangeToTotal();
    }
  }
  this.updateScaleAndBins(true);
  if (this.encodesRecordsBy && this.browser.recordDisplay) {
    this.browser.recordDisplay.changeOfScale();
  }
};

SummaryInterval.prototype.refreshPercentileChart = function refreshPercentileChart() {
  this.DOM.percentileGroup
    .attr('percentileChartVisible', this.percentileChartVisible ? true : null);
  if (this.percentileChartVisible) {
    this.DOM.percentileGroup.style('height', `${this.height_percentile - 2}px`);
  }
  this.DOM.summaryConfig.selectAll('.summaryConfig_Percentile .configOption').attr('active', false);
  this.DOM.summaryConfig.selectAll(`.summaryConfig_Percentile .pos_${this.percentileChartVisible}`).attr('active', true);
};

SummaryInterval.prototype.showPercentileChart = function showPercentileChart(v) {
  if (v === true) v = 'Extended';
  this.percentileChartVisible = v;
  if (this.DOM.inited) {
    const curHeight = this.getHeight();
    this.refreshPercentileChart();
    if (this.percentileChartVisible) this.updatePercentiles('Active');
    this.setHeight(curHeight);
    this.browser.updateLayout_Height();
  }
};

SummaryInterval.prototype.initDOM = function initDOM(beforeDOM) {
  this.initializeAggregates();
  if (this.isEmpty()) return;
  if (this.DOM.inited === true) return;
  const me = this;

  this.insertRoot(beforeDOM);
  this.DOM.root
    .attr('summary_type', 'interval')
    .attr('encodesRecordsBy', this.encodesRecordsBy)
    .attr('viewType', this.viewType);

  this.insertHeader();

  this.initDOM_IntervalConfig();

  this.DOM.summaryInterval = this.DOM.wrapper.append('div').attr('class', 'summaryInterval')
    .attr('scaleType', this.scaleType)
    .attr('zoomed', this.zoomed)
    .on('mousedown', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });

  this.DOM.histogram = this.DOM.summaryInterval.append('div').attr('class', 'histogram');
  this.DOM.histogram_bins = this.DOM.histogram.append('div').attr('class', 'aggrGroup')
    .on('mousemove', function () {
      if (d3.event.shiftKey) {
        const pointerPosition = me.valueScale.invert(d3.mouse(this)[0]);
        if (this.initPos === undefined) {
          this.initPos = pointerPosition;
        }
        let maxPos = d3.max([this.initPos, pointerPosition]);
        let minPos = d3.min([this.initPos, pointerPosition]);
        if (me.scaleType !== 'time' && !me.hasFloat) {
          maxPos = Math.round(maxPos);
          minPos = Math.round(minPos);
        }
        me.highlightRangeLimits_Active = true;
        // Set preview selection
        const records = [];
        me.filteredRecords.forEach((record) => {
          const v = me.getRecordValue(record);
          if (v >= minPos && v <= maxPos) records.push(record);
          else record.remForHighlight(true);
        });
        me.browser.flexAggr_Highlight.summary = me;
        me.browser.flexAggr_Highlight.records = records;
        me.browser.flexAggr_Highlight.minV = minPos;
        me.browser.flexAggr_Highlight.maxV = maxPos;
        me.browser.setSelect_Highlight();
        d3.event.preventDefault();
        d3.event.stopPropagation();
      } else if (me.highlightRangeLimits_Active) {
        this.initPos = undefined;
        me.browser.clearSelect_Highlight();
        d3.event.preventDefault();
        d3.event.stopPropagation();
      }
    })
    .on('click', function () {
      if (d3.event.shiftKey && me.highlightRangeLimits_Active) {
        // Lock for comparison
        me.browser.flexAggr_Compare_A.minV = me.browser.flexAggr_Highlight.minV;
        me.browser.flexAggr_Compare_A.maxV = me.browser.flexAggr_Highlight.maxV;
        me.browser.setSelect_Compare(false);
        this.initPos = undefined;
        d3.event.preventDefault();
        d3.event.stopPropagation();
      }
    });

  this.DOM.highlightRangeLimits = this.DOM.histogram_bins.selectAll('.highlightRangeLimits')
    .data([0, 1]).enter()
    .append('div')
    .attr('class', 'highlightRangeLimits');

  if (this.scaleType === 'time') {
    this.DOM.timeSVG = this.DOM.histogram.append('svg').attr('class', 'timeSVG')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .style('margin-left', `${this.width_barGap / 2}px`);

    const x = this.DOM.timeSVG.append('defs')
      .selectAll('marker')
      .data([
        'kshfLineChartTip_Active',
        'kshfLineChartTip_Highlight',
        'kshfLineChartTip_Compare_A',
        'kshfLineChartTip_Compare_B',
        'kshfLineChartTip_Compare_C',
      ]).enter()
      .append('marker')
      .attr('id', d => d)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('viewBox', '0 0 20 20')
      .attr('refX', 10)
      .attr('refY', 10)
      .attr('markerUnits', 'strokeWidth')
      .attr('markerWidth', 9)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .append('circle')
      .attr('r', 5)
      .attr('cx', 10)
      .attr('cy', 10);
  }

  this.insertChartAxis_Measure(this.DOM.histogram, 'w', 'nw');

  this.initDOM_Slider();
  this.initDOM_RecordMapColor();
  this.initDOM_Percentile();

  this.refreshScaleType();
  this.insertVizDOM();

  this.setCollapsed(this.collapsed);
  this.setUnitName(this.unitName);

  this.DOM.inited = true;
};

SummaryInterval.prototype.setZoomed = function setZoomed(v) {
  this.zoomed = v;
  this.DOM.summaryInterval.attr('zoomed', this.zoomed);
  if (this.zoomed) {
    this.intervalRange.active.min = this.summaryFilter.active.min;
    this.intervalRange.active.max = this.summaryFilter.active.max;
    this.DOM.zoomControl.attr('sign', 'minus');
  } else {
    this.resetActiveRangeToTotal();
    this.DOM.zoomControl.attr('sign', 'plus');
  }
  if (this.scaleType !== 'time') this.refreshScaleType(); // linear vs log
  this.updateScaleAndBins();
};

SummaryInterval.prototype.setUnitName = function setUnitName(v) {
  this.unitName = v;
  if (this.unitName && this.DOM.unitNameInput) this.DOM.unitNameInput.node().value = this.unitName;
  this.refreshValueTickLabels();
  if (this.encodesRecordsBy && this.browser.recordDisplay.recordViewSummary) {
    this.browser.recordDisplay.refreshRecordSortLabels();
  }
};

SummaryInterval.prototype.printWithUnitName = function printWithUnitName(v, noDiv) {
  if (v instanceof Date) return this.timeTyped.print(v);
  if (v === null) {
    v = '-';
  } else {
    v = v.toLocaleString();
  }
  if (this.unitName) {
    let s = noDiv ?
      this.unitName
      :
      (`<span class='unitName'>${this.unitName}</span>`);
    if (this.unitName === '$' || this.unitName === '€') {
      s += v;
      // replace abbrevation G with B
      s = s.replace('G', 'B');
    } else {
      s = v + s;
    }
    return s;
  }
  return v;
};

SummaryInterval.prototype.setEncodesRecordsBy = function setEncodesRecordsBy(type) {
  this.encodesRecordsBy = type;
  if (this.DOM.root) this.DOM.root.attr('encodesRecordsBy', this.encodesRecordsBy);
};

SummaryInterval.prototype.clearEncodesRecordsBy = function clearEncodesRecordsBy() {
  this.encodesRecordsBy = false;
  if (this.DOM.root) this.DOM.root.attr('encodesRecordsBy', null);
};

SummaryInterval.prototype.initDOM_IntervalConfig = function initDOM_IntervalConfig() {
  let me = this,
    x;

  this.DOM.summaryConfig_UnitName = this.DOM.summaryConfig.append('div')
    .attr('class', 'summaryConfig_UnitName summaryConfig_Option');
  this.DOM.summaryConfig_UnitName.append('span').text('Value Unit: ');
  this.DOM.unitNameInput = this.DOM.summaryConfig_UnitName.append('input').attr('type', 'text')
    .attr('class', 'unitNameInput')
    .attr('placeholder', kshf.unitName)
    .attr('maxlength', 5)
    .on('input', function () {
      if (this.timer) clearTimeout(this.timer);
      const x = this;
      const qStr = x.value.toLowerCase();
      this.timer = setTimeout(() => { me.setUnitName(qStr); }, 750);
    });

  // Show the linear/log scale transformation only if...
  if (this.scaleType !== 'time' && !this.stepTicks && this.intervalRange.org.min > 0) {
    this.DOM.summaryConfig_ScaleType = this.DOM.summaryConfig.append('div')
      .attr('class', 'summaryConfig_ScaleType summaryConfig_Option');
    this.DOM.summaryConfig_ScaleType.append('span').html("<i class='fa fa-arrows-h'></i> Bin Scale: ");
    x = this.DOM.summaryConfig_ScaleType.append('span').attr('class', 'optionGroup');
    x.selectAll('.configOption').data(
      [
        { l: "Linear <span style='font-size:0.8em; color: gray'>(1,2,3,4,5)</span>", v: 'Linear' },
        { l: "Log <span style='font-size:0.8em; color: gray'>(1,2,4,8,16)</span>", v: 'Log' },
      ])
      .enter()
      .append('span')
      .attr('class', d => `configOption pos_${d.v.toLowerCase()}`)
      .attr('active', d => d.v.toLowerCase() === me.scaleType)
      .html(d => d.l)
      .on('click', (d) => { me.setScaleType(d.v.toLowerCase(), true); });
  }

  this.DOM.summaryConfig_Percentile = this.DOM.summaryConfig.append('div')
    .attr('class', 'summaryConfig_Percentile summaryConfig_Option');
  this.DOM.summaryConfig_Percentile.append('span').text('Percentile Chart: ');
  this.DOM.summaryConfig_Percentile.append('span').attr('class', 'optionGroup')
    .selectAll('.configOption').data(
      [{ l: "<i class='bl_Active'></i><i class='bl_Highlight'></i>" +
        "<i class='bl_Compare_A'></i><i class='bl_Compare_B'></i><i class='bl_Compare_C'></i> Show",
      v: 'Extended' },
      { l: "<i class='fa fa-eye-slash'></i> Hide", v: false },
      ])
    .enter()
    .append('span')
    .attr('class', d => `configOption pos_${d.v}`)
    .attr('active', d => d.v === me.percentileChartVisible)
    .html(d => d.l)
    .on('click', (d) => { me.showPercentileChart(d.v); });
};

SummaryInterval.prototype.initDOM_Percentile = function initDOM_Percentile() {
  if (this.DOM.summaryInterval === undefined) return;

  const me = this;
  this.DOM.percentileGroup = this.DOM.summaryInterval.append('div').attr('class', 'percentileGroup');
  this.DOM.percentileGroup.append('span').attr('class', 'percentileTitle').html(kshf.lang.cur.Percentiles);

  function addPercentileDOM(distr) {
    const parent = me.DOM.percentileGroup.append('div').attr('class', `percentileChart_${distr}`);

    parent.selectAll('.aggrGlyph').data([
      [10, 20, 1], [20, 30, 2], [30, 40, 3], [40, 50, 4], [50, 60, 4], [60, 70, 3], [70, 80, 2], [80, 90, 1],
    ]).enter()
      .append('span')
      .attr('class', qb => `quantile aggrGlyph q_range qG${qb[2]}`)
      .each(function (qb) {
        this.__data__.summary = me;
        this.tipsy = new Tipsy(this, {
          gravity: 's',
          title() {
            return `${"<span style='font-weight:300; " +
              "text-decoration: underline'><b>"}${qb[0]}</b>% - <b>${qb[1]}</b>% Percentile<br></span>` +
              `<span style='font-weight:500'>${me.intervalTickPrint(me.quantile_val[distr + qb[0]])}</span> - ` +
              `<span style='font-weight:500'>${me.intervalTickPrint(me.quantile_val[distr + qb[1]])}</span>`;
          },
        });
      })
      .on('mouseover', function (qb) {
        this.tipsy.show();
        const records = [];
        me.filteredRecords.forEach((record) => {
          const v = me.getRecordValue(record);
          if (v >= me.quantile_val[distr + qb[0]] && v <= me.quantile_val[distr + qb[1]]) records.push(record);
        });
        me.browser.flexAggr_Highlight.summary = me;
        me.browser.flexAggr_Highlight.records = records;
        me.browser.flexAggr_Highlight.minV = me.quantile_val[distr + qb[0]];
        me.browser.flexAggr_Highlight.maxV = me.quantile_val[distr + qb[1]];
        me.highlightRangeLimits_Active = true;
        me.browser.setSelect_Highlight();
      })
      .on('mouseout', function () {
        this.tipsy.hide();
        me.browser.clearSelect_Highlight();
      })
      .on('click', (qb) => {
        if (d3.event.shiftKey) {
          me.browser.flexAggr_Compare_A.minV = me.quantile_val[distr + qb[0]];
          me.browser.flexAggr_Compare_A.maxV = me.quantile_val[distr + qb[1]];
          me.browser.setSelect_Compare(me.browser.flexAggr_Compare_A, false);
          return;
        }
        me.summaryFilter.active = {
          min: me.quantile_val[distr + qb[0]],
          max: me.quantile_val[distr + qb[1]],
        };
        me.summaryFilter.filteredBin = undefined;
        me.summaryFilter.addFilter();
      });

    parent.selectAll('.q_pos').data([10, 20, 30, 40, 50, 60, 70, 80, 90]).enter()
      .append('span')
      .attr('class', q => `quantile q_pos q_${q}`)
      .each(function (q) {
        this.tipsy = new Tipsy(this, {
          gravity: 's', title() { return `<u>Median:</u><br> ${me.quantile_val[distr + q]}`; },
        });
      })
      .on('mouseover', function () { this.tipsy.show(); })
      .on('mouseout', function () { this.tipsy.hide(); });
  }

  addPercentileDOM.call(this, 'Active');
  addPercentileDOM.call(this, 'Highlight');
  addPercentileDOM.call(this, 'Compare_C');
  addPercentileDOM.call(this, 'Compare_B');
  addPercentileDOM.call(this, 'Compare_A');

  this.refreshPercentileChart();
};

/** --
 Uses
 - this.scaleType
 - this.intervalRange
 Updates
 - this.intervalTickPrint
 - this.valueScale.nice()
 Return
 - the tick values in an array
 */
SummaryInterval.prototype.getValueTicks = function getValueTicks(optimalTickCount) {
  const me = this;
  let ticks;

  // HANDLE TIME CAREFULLY
  if (this.scaleType === 'time') {
    // 1. Find the appropriate aggregation interval (day, month, etc)
    const timeRange_ms = this.intervalRange.getActiveMax() - this.intervalRange.active.min; // in milliseconds
    let timeInterval;
    optimalTickCount *= 1.3;

    // Listing time resolutions, from high-res to low-res
    const timeMult = {
      Second: 1000,
      Minute: 1000 * 60,
      Hour: 1000 * 60 * 60,
      Day: 1000 * 60 * 60 * 24,
      Month: 1000 * 60 * 60 * 24 * 30,
      Year: 1000 * 60 * 60 * 24 * 365,
    };

    const timeRes = [
      {
        type: 'Second',
        step: 1,
        format: '%S',
      }, {
        type: 'Second',
        step: 5,
        format: '%S',
      }, {
        type: 'Second',
        step: 15,
        format: '%S',
      }, {
        type: 'Minute',
        step: 1,
        format: '%M',
      }, {
        type: 'Minute',
        step: 5,
        format: '%M',
      }, {
        type: 'Minute',
        step: 15,
        format: '%M',
      }, {
        type: 'Hour',
        step: 1,
        format: '%H',
      }, {
        type: 'Hour',
        step: 6,
        format: '%H',
      }, {
        type: 'Day',
        step: 1,
        format: '%e',
      }, {
        type: 'Day',
        step: 4,
        format(v) {
          const suffix = kshf.Util.ordinal_suffix_of(v.getUTCDate());
          const first = d3.utcFormat('%-b')(v);
          return `${suffix}<br>${first}`;
        },
        twoLine: true,
      }, {
        type: 'Month',
        step: 1,
        format(v) {
          const nextTick = timeInterval.offset(v, 1);
          const first = d3.utcFormat('%-b')(v);
          let s = first;
          if (first === 'Jan') s += `<br><span class='secondLayer'>${d3.utcFormat('%Y')(nextTick)}</span>`;
          return s;
        },
        twoLine: true,
      }, {
        type: 'Month',
        step: 3,
        format(v) {
          const nextTick = timeInterval.offset(v, 3);
          const first = d3.utcFormat('%-b')(v);
          let s = first;
          if (first === 'Jan') s += `<br><span class='secondLayer'>${d3.utcFormat('%Y')(nextTick)}</span>`;
          return s;
        },
        twoLine: true,
      }, {
        type: 'Month',
        step: 6,
        format(v) {
          const nextTick = timeInterval.offset(v, 6);
          const first = d3.utcFormat('%-b')(v);
          let s = first;
          if (first === 'Jan') s += `<br>${d3.utcFormat('%Y')(nextTick)}`;
          return s;
        },
        twoLine: true,
      }, {
        type: 'Year',
        step: 1,
        format: '%Y',
      }, {
        type: 'Year',
        step: 2,
        format: '%Y',
      }, {
        type: 'Year',
        step: 3,
        format: '%Y',
      }, {
        type: 'Year',
        step: 5,
        format: '%Y',
      }, {
        type: 'Year',
        step: 10,
        format: '%Y',
      }, {
        type: 'Year',
        step: 25,
        format: '%Y',
      }, {
        type: 'Year',
        step: 50,
        format: '%Y',
      }, {
        type: 'Year',
        step: 100,
        format: '%Y',
      }, {
        type: 'Year',
        step: 500,
        format: '%Y',
      },
    ];

    timeRes.every(function (tRes, i) {
      let stopIteration = i === timeRes.length - 1 ||
        timeRange_ms / (timeMult[tRes.type] * tRes.step) < optimalTickCount;
      if (stopIteration) {
        if (tRes.type === 'Day' && this.timeTyped.maxDateRes() === 'Month') stopIteration = false;
        if (tRes.type === 'Day' && this.timeTyped.maxDateRes() === 'Year') stopIteration = false;
        if (tRes.type === 'Month' && this.timeTyped.maxDateRes() === 'Year') stopIteration = false;
        if (tRes.type === 'Hour' && this.timeTyped.maxDateRes() === 'Day') stopIteration = false;
      }
      if (stopIteration) {
        // TODO: Fix D3
        timeInterval = d3[`utc${[tRes.type]}`];
        this.timeTyped.activeRes = tRes;
        if (typeof tRes.format === 'string') {
          this.intervalTickPrint = d3.utcFormat(tRes.format);
        } else {
          this.intervalTickPrint = tRes.format;
        }
        this.height_labels = (tRes.twoLine) ? 28 : 13;
      }

      return !stopIteration;
    }, this);

    this.setStepTicks(this.timeTyped.activeRes.step === 1);

    this.valueScale.nice(timeInterval, this.timeTyped.activeRes.step);
    ticks = this.valueScale.ticks(timeInterval, this.timeTyped.activeRes.step);
  } else if (this.stepTicks) {
    ticks = [];
    for (let i = this.intervalRange.active.min; i <= this.intervalRange.getActiveMax(); i++) { // DONT CHANGE!
      ticks.push(i);
    }
    this.intervalTickPrint = d3.format('d');
  } else if (this.scaleType === 'log') {
    if (this.valueScale.domain()[0] === 0) { this.valueScale.domain([this.intervalRange.org.min, this.valueScale.domain()[1]]); }
    this.valueScale.nice();
    // Generate ticks
    ticks = this.valueScale.ticks(); // ticks cannot be customized directly
    while (ticks.length > optimalTickCount * 1.6) {
      ticks = ticks.filter((d, i) => i % 2 === 0);
    }
    if (!this.hasFloat) { ticks = ticks.filter(d => d % 1 === 0); }

    var d3Formating = d3.format(floatNumTicks ? '.2f' : '.2s');
    this.intervalTickPrint = function (d) {
      if (!me.hasFloat && d < 10) return d;
      if (!me.hasFloat && Math.abs(ticks[1] - ticks[0]) < 1000) return d;
      return d3Formating(d);
    };
  } else {
    this.valueScale.nice(optimalTickCount);
    ticks = this.valueScale.ticks(optimalTickCount);

    if (!this.hasFloat) ticks = ticks.filter(tick => tick === 0 || tick % 1 === 0);

    // Do ticks have a floating number?
    var floatNumTicks = ticks.some(tick => tick % 1 !== 0);

    var d3Formating = d3.format(floatNumTicks ? '.2f' : '.2s');
    this.intervalTickPrint = function (d) {
      if (!me.hasFloat && d < 10) return d;
      if (!me.hasFloat && Math.abs(ticks[1] - ticks[0]) < 1000) return d;
      return d3Formating(d);
    };
  }

  // Make sure the non-extreme ticks are between intervalRange.active.min and intervalRange.active.max
  for (let tickNo = 1; tickNo < ticks.length - 1;) {
    const tick = ticks[tickNo];
    if (tick < this.intervalRange.active.min) {
      ticks.splice(tickNo - 1, 1); // remove the tick
    } else if (tick > this.intervalRange.getActiveMax()) {
      ticks.splice(tickNo + 1, 1); // remove the tick
    } else {
      tickNo++;
    }
  }

  if (!this.stepTicks) { this.valueScale.domain([ticks[0], ticks[ticks.length - 1]]); }

  return ticks;
};

/**
 Uses
 - optimumTickWidth
 - this.intervalRang
 Updates:
 - scaleType (step vs linear)
 - valueScale
 - intervalTickPrint
 */
SummaryInterval.prototype.updateScaleAndBins = function updateScaleAndBins(force) {
  const me = this;
  if (this.isEmpty()) return;

  switch (this.scaleType) {
    case 'linear': this.valueScale = d3.scaleLinear(); break;
    case 'log': this.valueScale = d3.scaleLog().base(2); break;
    case 'time': this.valueScale = d3.scaleUtc(); break;
  }

  const _width_ = this.getWidth_Chart();

  let minn = this.intervalRange.active.min;
  let maxx = this.intervalRange.getActiveMax();

  this.valueScale
    .domain([minn, maxx])
    .range([0, _width_]);

  const old_height_labels = this.height_labels;
  const curHeight = this.getHeight();

  let ticks = this.getValueTicks(_width_ / this.getWidth_OptimumTick());

  if (ticks.length === 0) return;

  // Maybe the ticks still follow step-function ([3,4,5] - [12,13,14,15,16,17] - [2010,2011,2012,2013,2014] etc. )
  if (!this.stepTicks && !this.hasFloat && this.scaleType === 'linear' && ticks.length > 2) {
    if ((ticks[1] === ticks[0] + 1) && (ticks[ticks.length - 1] === ticks[ticks.length - 2] + 1)) {
      this.setStepTicks(true);
      ticks = this.getValueTicks(_width_ / this.getWidth_OptimumTick());

      minn = this.intervalRange.active.min;
      maxx = this.intervalRange.getActiveMax();

      this.valueScale
        .domain([minn, maxx])
        .range([0, _width_]);
    }
  }

  // width for one aggregate - fixed width
  this.aggrWidth = this.valueScale(ticks[1]) - this.valueScale(ticks[0]);

  if (force ||
    this.intervalTicks.length !== ticks.length ||
    this.intervalTicks[0] !== ticks[0] ||
    this.intervalTicks[this.intervalTicks.length - 1] !== ticks[ticks.length - 1]
  ) {
    this.intervalTicks = ticks;

    // Remove existing aggregates from browser
    if (this._aggrs) {
      const aggrs = this.browser.allAggregates;
      this._aggrs.forEach((aggr) => { aggrs.splice(aggrs.indexOf(aggr), 1); }, this);
    }

    this._aggrs = [];
    // Create _aggrs as kshf.Aggregate
    this.intervalTicks.forEach(function (tick, i) {
      const d = new AggregateInterval(this, tick, this.intervalTicks[i + 1]);
      d.summary = this;
      this._aggrs.push(d);
      me.browser.allAggregates.push(d);
    }, this);

    this._aggrs.pop(); // remove last bin

    // distribute records across bins
    this.filteredRecords.forEach(function (record) {
      const v = this.getRecordValue(record);
      // DO NOT CHANGE BELOW
      if (v === null || v === undefined || v < this.intervalRange.active.min || v > this.intervalRange.getActiveMax()) return;
      let binI = null;
      this.intervalTicks.every((tick, i) => {
        if (v >= tick) {
          binI = i;
          return true; // keep going
        }
        return false; // stop iteration
      });
      const bin = this._aggrs[Math.min(binI, this._aggrs.length - 1)];

      // If the record already had a bin for this summary, remove that bin
      let existingBinIndex = null;
      record._aggrCache.some(function (aggr, i) {
        if (aggr.summary && aggr.summary === this) {
          existingBinIndex = i;
          return true;
        }
        return false;
      }, this);
      if (existingBinIndex !== null) { record._aggrCache.splice(existingBinIndex, 1); }
      // ******************************************************************

      if (bin) bin.addRecord(record);
    }, this);

    if (this.stepTicks) this.intervalTicks.pop();

    this.updateBarScale2Active();

    if (this.DOM.root) this.insertVizDOM();

    this.updatePercentiles('Active');
  }

  if (this.DOM.root) {
    if (this.DOM.aggrGlyphs === undefined) this.insertVizDOM();

    if (old_height_labels !== this.height_labels) {
      this.setHeight(curHeight);
    }

    this.refreshBins_Translate();
    setTimeout(() => {
      me.refreshViz_Scale();
    }, 10);

    this.refreshValueTickPos();

    this.refreshIntervalSlider();
  }
};

SummaryInterval.prototype.getClosestTick = function getClosestTick(v) {
  let t = this.intervalTicks[0];
  // Can be improved computationally, but does the job, only a few ticks!
  this.intervalTicks.forEach((tick) => {
    const difNew = Math.abs(tick.getTime() - v.getTime());
    const difOld = Math.abs(t.getTime() - v.getTime());
    if (difNew < difOld) t = tick;
  });
  return t;
};

SummaryInterval.prototype.insertVizDOM = function insertVizDOM() {
  if (this.scaleType === 'time' && this.DOM.root) {
    const zeroPos = this.chartScale_Measure(0);

    // delete existing DOM:
    // TODO: Find  a way to avoid this?
    this.DOM.timeSVG.selectAll('[class^="measure_"]').remove();

    this.DOM.measure_Total_Area = this.DOM.timeSVG
      .append('path')
      .attr('class', 'measure_Total_Area')
      .datum(this._aggrs)
      .attr('d',
        d3.area()
          .curve(d3.curveMonotoneX)
          .x(this.timeAxis_XFunc)
          .y0(this.height_hist + 2 - zeroPos)
          .y1(this.height_hist + 2 - zeroPos),
      );
    this.DOM.measure_Active_Area = this.DOM.timeSVG
      .append('path')
      .attr('class', 'measure_Active_Area')
      .datum(this._aggrs)
      .attr('d',
        d3.area()
          .curve(d3.curveMonotoneX)
          .x(this.timeAxis_XFunc)
          .y0(this.height_hist + 2 - zeroPos)
          .y1(this.height_hist + 2 - zeroPos),
      );
    this.DOM.lineTrend_ActiveLine = this.DOM.timeSVG.selectAll('.measure_Active_Line')
      .data(this._aggrs, (d, i) => i)
      .enter().append('line')
      .attr('class', 'measure_Active_Line')
      .attr('marker-end', 'url(#kshfLineChartTip_Active)')
      .attr('x1', this.timeAxis_XFunc)
      .attr('x2', this.timeAxis_XFunc)
      .attr('y1', this.height_hist + 3 - zeroPos)
      .attr('y2', this.height_hist + 3 - zeroPos);

    this.DOM.measure_Highlight_Area = this.DOM.timeSVG
      .append('path').attr('class', 'measure_Highlight_Area').datum(this._aggrs);
    this.DOM.measure_Highlight_Line = this.DOM.timeSVG.selectAll('.measure_Highlight_Line')
      .data(this._aggrs, (d, i) => i)
      .enter().append('line')
      .attr('class', 'measure_Highlight_Line')
      .attr('marker-end', 'url(#kshfLineChartTip_Highlight)');

    this.DOM.measure_Compare_Area_A = this.DOM.timeSVG
      .append('path').attr('class', 'measure_Compare_Area_A measure_Compare_A').datum(this._aggrs);
    this.DOM.measure_Compare_Line_A = this.DOM.timeSVG.selectAll('.measure_Compare_Line_A')
      .data(this._aggrs, (d, i) => i)
      .enter().append('line')
      .attr('class', 'measure_Compare_Line_A measure_Compare_A')
      .attr('marker-end', 'url(#kshfLineChartTip_Compare_A)');
    this.DOM.measure_Compare_Area_B = this.DOM.timeSVG
      .append('path').attr('class', 'measure_Compare_Area_B measure_Compare_B').datum(this._aggrs);
    this.DOM.measure_Compare_Line_B = this.DOM.timeSVG.selectAll('.measure_Compare_Line_B')
      .data(this._aggrs, (d, i) => i)
      .enter().append('line')
      .attr('class', 'measure_Compare_Line_B measure_Compare_B')
      .attr('marker-end', 'url(#kshfLineChartTip_Compare_B)');
    this.DOM.measure_Compare_Area_C = this.DOM.timeSVG
      .append('path').attr('class', 'measure_Compare_Area_C measure_Compare_C').datum(this._aggrs);
    this.DOM.measure_Compare_Line_C = this.DOM.timeSVG.selectAll('.measure_Compare_Line_C')
      .data(this._aggrs, (d, i) => i)
      .enter().append('line')
      .attr('class', 'measure_Compare_Line_C measure_Compare_C')
      .attr('marker-end', 'url(#kshfLineChartTip_Compare_C)');
  }

  this.insertBins();
  this.refreshViz_Axis();
  this.refreshMeasureLabel();
  this.updateValueTicks();
};
/** --- */
SummaryInterval.prototype.refreshValueTickPos = function refreshValueTickPos() {
  const me = this;
  this.DOM.valueTickGroup.style('left', `${this.stepTicks ? (this.aggrWidth / 2) : 0}px`);
  this.DOM.valueTickGroup.selectAll('.valueTick')
    .style('left', d => `${me.valueScale(d.tickValue)}px`);
};

SummaryInterval.prototype.updateValueTicks = function updateValueTicks() {
  const me = this;

  // Insert middle-ticks to show that this is log-scale
  let ticks = [];
  if (this.scaleType === 'log') {
    ticks = [{ tickValue: this.intervalTicks[0], major: true }];
    for (let i = 1; i < this.intervalTicks.length; i++) {
      var _min = me.valueScale(this.intervalTicks[i - 1]);
      var _max = me.valueScale(this.intervalTicks[i]);
      [1, 1, 1, 1].forEach(() => {
        const x = (_min + _max) / 2;
        ticks.push({ tickValue: me.valueScale.invert(x), major: false });
        _min = x;
      });
      ticks.push({ tickValue: this.intervalTicks[i], major: true });
    }
  } else {
    this.intervalTicks.forEach((p) => { ticks.push({ tickValue: p, major: true }); });
  }

  const ddd = this.DOM.valueTickGroup.selectAll('.valueTick').data(ticks, d => d.tickValue);
  ddd.style('opacity', 1).classed('major', d => d.major);

  ddd.exit().style('opacity', 0);

  const X = ddd.enter().append('span').attr('class', 'valueTick')
    .style('opacity', 1)
    .classed('major', d => d.major);
  X.append('span').attr('class', 'line');
  X.append('span').attr('class', 'text');

  this.DOM.valueTickGroup.selectAll('.valueTick > .text')
    .each(function (d) {
      this.bin = null;
      me._aggrs.every(function (bin) {
        if (bin.minV === d.tickValue) {
          this.bin = bin;
          return false;
        }
        return true;
      }, this);
    })
    .on('mouseover', function (d) {
      if (this.bin) me.onAggrHighlight(this.bin);
    })
    .on('mouseleave', function (d) {
      if (this.bin === null) return;
      me.onAggrLeave(this.bin);
    })
    .on('click', function (d) {
      if (this.bin) me.onAggrClick(this.bin);
    });

  this.refreshValueTickLabels();
};

SummaryInterval.prototype.refreshValueTickLabels = function refreshValueTickLabels() {
  const me = this;
  if (this.DOM.valueTickGroup === undefined) return;
  this.DOM.valueTickGroup.selectAll('.valueTick > .text').html(d => me.printWithUnitName(me.intervalTickPrint(d.tickValue)));
};

SummaryInterval.prototype.onAggrHighlight = function onAggrHighlight(aggr) {
  d3.select(aggr.DOM.aggrGlyph).classed('showlock', true);
  aggr.DOM.aggrGlyph.setAttribute('selection', 'selected');
  if (!this.browser.ratioModeActive) {
    this.DOM.highlightedMeasureValue
      .style('transform', `translateY(${this.height_hist - this.chartScale_Measure(aggr.measure('Active'))}px)`)
      .style('opacity', 1);
  }
  this.browser.setSelect_Highlight(aggr);
};

SummaryInterval.prototype.onAggrLeave = function onAggrLeave(aggr) {
  aggr.unselectAggregate();
  this.browser.clearSelect_Highlight();
};

SummaryInterval.prototype.onAggrClick = function onAggrClick(aggr) {
  if (this.highlightRangeLimits_Active) return;
  if (d3.event && d3.event.shiftKey) {
    this.browser.setSelect_Compare(true);
    return;
  }
  if (this.summaryFilter.filteredBin === this) {
    this.summaryFilter.clearFilter();
    return;
  }

  this.stepRange = this.stepTicks;

  // store histogram state
  this.summaryFilter.active = {
    min: aggr.minV,
    max: aggr.maxV,
  };
  this.summaryFilter.filteredBin = null;
  this.summaryFilter.addFilter();
};

SummaryInterval.prototype.insertBins = function insertBins() {
  const me = this;

  const zeroPos = this.chartScale_Measure(0);
  const width = this.getWidth_Bin();
  const offset = (this.stepTicks) ? this.width_barGap : 0;

  // just remove all aggrGlyphs that existed before.
  this.DOM.histogram_bins.selectAll('.aggrGlyph').data([]).exit().remove();

  const activeBins = this.DOM.histogram_bins.selectAll('.aggrGlyph').data(this._aggrs, (d, i) => i);

  const newBins = activeBins.enter().append('span').attr('class', 'aggrGlyph rangeGlyph')
    .each(function (aggr) {
      aggr.isVisible = true;
      aggr.DOM.aggrGlyph = this;
    })
    .on('mouseenter', function (aggr) {
      if (aggr.recCnt.Active === 0) return;
      if (me.highlightRangeLimits_Active) return;
      // mouse is moving slow, just do it.
      if (me.browser.mouseSpeed < 0.2) {
        me.onAggrHighlight(aggr);
        return;
      }
      // mouse is moving fast, should wait a while...
      this.highlightTimeout = window.setTimeout(
        () => { me.onAggrHighlight(aggr); },
        me.browser.mouseSpeed * 300);
    })
    .on('mouseleave', function (aggr) {
      if (aggr.recCnt.Active === 0) return;
      if (me.highlightRangeLimits_Active) return;
      if (this.highlightTimeout) window.clearTimeout(this.highlightTimeout);
      me.onAggrLeave(aggr);
    })
    .on('click', (aggr) => { me.onAggrClick(aggr); });

  ['Total', 'Active', 'Highlight', 'Compare_A', 'Compare_B', 'Compare_C'].forEach((m) => {
    const X = newBins.append('span').attr('class', `measure_${m}`)
      .style('transform', `translateY(${me.height_hist - zeroPos}px) scale(${width},0)`);
    if (m !== 'Total' && m !== 'Active' && m !== 'Highlight') {
      X.on('mouseenter', function () {
        me.browser.refreshMeasureLabels(this.classList[0].substr(8));
      });
      X.on('mouseleave', () => {
        me.browser.refreshMeasureLabels('Active');
      });
    }
  }, this);

  newBins.append('span').attr('class', 'total_tip');
  newBins.append('span').attr('class', 'lockButton fa')
    .each(function (aggr) {
      this.tipsy = new Tipsy(this, {
        gravity: 's',
        title() {
          const isLocked = me.browser.selectedAggr.Compare_A === aggr ||
            me.browser.selectedAggr.Compare_B === aggr ||
            me.browser.selectedAggr.Compare_C === aggr;
          return kshf.lang.cur[!isLocked ? 'LockToCompare' : 'Unlock'];
        },
      });
    })
    .on('click', function (aggr) {
      this.tipsy.hide();
      me.browser.setSelect_Compare(true);
      d3.event.stopPropagation();
    })
    .on('mouseenter', function (aggr) {
      this.tipsy.hide();
      this.tipsy.show();
      d3.event.stopPropagation();
    })
    .on('mouseleave', function (aggr) {
      this.tipsy_title = undefined;
      this.tipsy.hide();
      d3.event.stopPropagation();
    });

  newBins.append('span').attr('class', 'measureLabel');

  this.DOM.aggrGlyphs = this.DOM.histogram_bins.selectAll('.aggrGlyph');
  this.DOM.measureLabel = this.DOM.aggrGlyphs.selectAll('.measureLabel');
  this.DOM.measureTotalTip = this.DOM.aggrGlyphs.selectAll('.total_tip');
  this.DOM.lockButton = this.DOM.aggrGlyphs.selectAll('.lockButton');
  ['Total', 'Active', 'Highlight', 'Compare_A', 'Compare_B', 'Compare_C'].forEach(function (m) {
    this.DOM[`measure_${m}`] = this.DOM.aggrGlyphs.selectAll(`.measure_${m}`);
  }, this);
};

SummaryInterval.prototype.map_refreshColorScale = function map_refreshColorScale() {
  const me = this;
  this.DOM.mapColorBlocks
    .style('background-color', (d) => {
      if (me.invertColorScale) d = 8 - d;
      return kshf.colorScale[me.browser.mapColorTheme][d];
    });
};

SummaryInterval.prototype.setRangeFilter = function setRangeFilter(_min, _max, useTimer) {
  this.summaryFilter.active.min = _min;
  this.summaryFilter.active.max = _max;

  this.refreshRangeFilter(useTimer);
};

SummaryInterval.prototype.refreshRangeFilter = function refreshRangeFilter(useTimer) {
  if (useTimer === undefined) useTimer = false;
  this.checkFilterRange(useTimer);
  this.refreshIntervalSlider();

  const me = this;
  const doFilter = function () {
    if (me.isFiltered_min() || me.isFiltered_max()) {
      me.summaryFilter.filteredBin = undefined;
      me.summaryFilter.addFilter();
    } else {
      me.summaryFilter.clearFilter();
    }
    delete me.rangeFilterTimer;
  };
  if (useTimer === undefined) {
    doFilter(this);
  } else {
    if (this.rangeFilterTimer) clearTimeout(this.rangeFilterTimer);
    this.rangeFilterTimer = setTimeout(doFilter, 250);
  }
};

SummaryInterval.prototype.initDOM_RecordMapColor = function initDOM_RecordMapColor() {
  const me = this;

  this.DOM.mapColorBar = this.DOM.summaryInterval.append('div').attr('class', 'mapColorBar');

  this.DOM.mapColorBar.append('span').attr('class', 'invertColorScale fa fa-adjust')
    .each(function (d) { this.tipsy = new Tipsy(this, { gravity: 'sw', title: 'Invert Color Scale' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', () => {
      me.invertColorScale = !me.invertColorScale;
      me.browser.recordDisplay.refreshRecordColors();
      me.browser.recordDisplay.recMap_refreshColorScaleBins();
      me.map_refreshColorScale();
    });

  this.DOM.mapColorBlocks = this.DOM.mapColorBar.selectAll('mapColorBlock')
    .data([0, 1, 2, 3, 4, 5, 6, 7, 8]).enter()
    .append('div')
    .attr('class', 'mapColorBlock')
    .each(function (d) {
      const r = me.valueScale.range()[1] / 9;
      this._minValue = me.valueScale.invert(d * r);
      this._maxValue = me.valueScale.invert((d + 1) * r);

      if (!me.hasFloat) {
        this._minValue = Math.floor(this._minValue);
        this._maxValue = Math.ceil(this._maxValue);
      }

      this.tipsy = new Tipsy(this, {
        gravity: 's',
        title() {
          return `<b>${me.intervalTickPrint(this._minValue)}</b> to ` +
            `<b>${me.intervalTickPrint(this._maxValue)}</b>`;
        },
      });
    })
    .on('mouseenter', function (d, i) {
      this.tipsy.show();
      this.style.borderColor = (i < 4) ? 'black' : 'white';

      const r = me.valueScale.range()[1] / 9;
      const records = [];
      me.filteredRecords.forEach(function (record) {
        const v = me.getRecordValue(record);
        if (v >= this._minValue && v <= this._maxValue) records.push(record);
      }, this);
      me.browser.flexAggr_Highlight.summary = me;
      me.browser.flexAggr_Highlight.records = records;
      me.browser.flexAggr_Highlight.minV = this._minValue;
      me.browser.flexAggr_Highlight.maxV = this._maxValue;
      me.highlightRangeLimits_Active = true;
      me.browser.setSelect_Highlight();
    })
    .on('mouseleave', function () {
      this.tipsy.hide();
      me.browser.clearSelect_Highlight();
    })
    .on('click', function () {
      me.summaryFilter.active = {
        min: this._minValue,
        max: this._maxValue,
      };
      me.summaryFilter.filteredBin = undefined;
      me.summaryFilter.addFilter();
    });
  this.map_refreshColorScale();
};

SummaryInterval.prototype.dragRange = function dragRange(initPos, curPos, initMin, initMax) {
  if (this.scaleType === 'log') {
    var targetDif = curPos - initPos;
    this.summaryFilter.active.min = this.valueScale.invert(this.valueScale(initMin) + targetDif);
    this.summaryFilter.active.max = this.valueScale.invert(this.valueScale(initMax) + targetDif);
  } else if (this.scaleType === 'time') {
    return; // TODO
  } else if (this.scaleType === 'linear') {
    var targetDif = this.valueScale.invert(curPos) - this.valueScale.invert(initPos);
    if (!this.hasFloat) targetDif = Math.round(targetDif);

    this.summaryFilter.active.min = initMin + targetDif;
    this.summaryFilter.active.max = initMax + targetDif;

    // Limit the active filter to expand beyond the current min/max of the view.
    if (this.summaryFilter.active.min < this.intervalRange.active.min) {
      this.summaryFilter.active.min = this.intervalRange.active.min;
      this.summaryFilter.active.max = this.intervalRange.active.min + (initMax - initMin);
    }
    if (this.summaryFilter.active.max > this.intervalRange.getActiveMax()) {
      this.summaryFilter.active.max = this.intervalRange.getActiveMax();
      this.summaryFilter.active.min = this.intervalRange.getActiveMax() - (initMax - initMin);
    }
  }
  this.refreshRangeFilter(true);
};

SummaryInterval.prototype.initDOM_Slider = function initDOM_Slider() {
  const me = this;

  this.DOM.intervalSlider = this.DOM.summaryInterval.append('div').attr('class', 'intervalSlider');

  this.DOM.zoomControl = this.DOM.intervalSlider.append('span').attr('class', 'zoomControl fa')
    .attr('sign', 'plus')
    .each(function (d) {
      this.tipsy = new Tipsy(this, {
        gravity: 'w', title() { return (this.getAttribute('sign') === 'plus') ? 'Zoom into range' : 'Zoom out'; },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.setZoomed(this.getAttribute('sign') === 'plus'); });

  const controlLine = this.DOM.intervalSlider.append('div').attr('class', 'controlLine')
    .on('mousedown', function () {
      if (d3.event.which !== 1) return; // only respond to left-click
      me.browser.DOM.root.attr('adjustWidth', true).attr('pointerEvents', false);
      const e = this.parentNode;
      const initPos = me.valueScale.invert(d3.mouse(e)[0]);
      d3.select('body').on('mousemove', () => {
        const targetPos = me.valueScale.invert(d3.mouse(e)[0]);
        me.setRangeFilter(d3.min([initPos, targetPos]), d3.max([initPos, targetPos]));
      }).on('mouseup', () => {
        me.browser.DOM.root.attr('adjustWidth', null).attr('pointerEvents', true);
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
    });

  controlLine.append('span').attr('class', 'base total');

  this.DOM.activeBaseRange = controlLine.append('span').attr('class', 'base active')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 's', title: kshf.lang.cur.DragToFilter }); })
    // TODO: The problem is, the x-position (left-right) of the tooltip is not correctly calculated
    // because the size of the bar is set by scaling, not through width....
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('mousedown', function () {
      this.tipsy.hide();
      if (d3.event.which !== 1) return; // only respond to left-click
      if (me.scaleType === 'time') return; // time is not supported for now.

      me.browser.DOM.root.attr('adjustWidth', true).attr('pointerEvents', false);

      const e = this.parentNode;
      const initMin = me.summaryFilter.active.min;
      const initMax = me.summaryFilter.active.max;
      const initPos = d3.mouse(e)[0];

      d3.select('body').on('mousemove', () => {
        me.dragRange(initPos, d3.mouse(e)[0], initMin, initMax);
      }).on('mouseup', () => {
        me.browser.DOM.root.attr('adjustWidth', null).attr('pointerEvents', true);
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
      d3.event.stopPropagation();
    });

  this.DOM.rangeHandle = controlLine.selectAll('.rangeHandle').data(['min', 'max']).enter()
    .append('span')
    .attr('class', d => `rangeHandle ${d}`)
    .each(function (d, i) {
      this.tipsy = new Tipsy(this, { gravity: i == 0 ? 'w' : 'e', title: kshf.lang.cur.DragToFilter });
    })
    .on('mouseenter', function () { if (!this.dragging) { this.tipsy.show(); this.setAttribute('dragging', true); } })
    .on('mouseleave', function () {
      if (!this.dragging) {
        this.tipsy.hide(); this.removeAttribute('dragging');
      }
    })
    .on('dblclick', function (d) {
      if (typeof Pikaday === 'undefined') return;
      if (this.pikaday === undefined) {
        this.pikaday = new Pikaday({
          field: this,
          firstDay: 1,
          defaultDate: me.summaryFilter.active[d],
          setDefaultDate: true,
          minDate: me.intervalRange.total.min,
          maxDate: me.intervalRange.total.max,
          onSelect(date) {
            const selectedDate = this.getDate();
            if (d === 'min' && selectedDate < me.summaryFilter.active.min) {
              if (me.zoomed) me.setZoomed(false);
            }
            if (d === 'max' && selectedDate > me.summaryFilter.active.max) {
              if (me.zoomed) me.setZoomed(false);
            }
            me.summaryFilter.active[d] = this.getDate();
            me.refreshRangeFilter();
          },
        });
      } else {
        this.pikaday.setDate(me.summaryFilter.active[d]);
      }
      this.pikaday.show();
    })
    .on('mousedown', function (d, i) {
      this.tipsy.hide();
      if (d3.event.which !== 1) return; // only respond to left-click

      me.browser.DOM.root.attr('adjustWidth', true).attr('pointerEvents', false);
      this.setAttribute('dragging', true);

      const mee = this;
      mee.dragging = true;
      const e = this.parentNode;
      d3.select('body').on('mousemove', () => {
        me.summaryFilter.active[d] = me.valueScale.invert(d3.mouse(e)[0]);
        // Swap is min > max
        if (me.summaryFilter.active.min > me.summaryFilter.active.max) {
          const t = me.summaryFilter.active.min;
          me.summaryFilter.active.min = me.summaryFilter.active.max;
          me.summaryFilter.active.max = t;
          if (d === 'min') d = 'max'; else d = 'min'; // swap
        }
        me.refreshRangeFilter(true);
      }).on('mouseup', () => {
        mee.dragging = false;
        mee.removeAttribute('dragging');
        me.browser.DOM.root.attr('adjustWidth', null).attr('pointerEvents', true);
        d3.select('body').style('cursor', 'auto').on('mousemove', null).on('mouseup', null);
      });
      d3.event.stopPropagation();
    });

  this.DOM.recordValue = controlLine.append('div').attr('class', 'recordValue');
  this.DOM.recordValue.append('span').attr('class', 'recordValueScaleMark');
  this.DOM.recordValueText = this.DOM.recordValue
    .append('span').attr('class', 'recordValueText')
    .append('span').attr('class', 'recordValueText-v');

  this.DOM.valueTickGroup = this.DOM.intervalSlider.append('div').attr('class', 'valueTickGroup');
};

SummaryInterval.prototype.updateBarScale2Active = function updateBarScale2Active() {
  const maxMeasureValue = this.getMaxAggr_All();
  let minMeasureValue = 0;
  if (this.browser.measureFunc !== 'Count' && this.browser.measureSummary.intervalRange.org.min < 0) {
    minMeasureValue = Math.min(0, this.getMinAggr_All());
  }
  this.getMinAggr_All();
  // store previous state
  this.chartScale_Measure_prev
    .domain(this.chartScale_Measure.domain())
    .range(this.chartScale_Measure.range())
    .clamp(false);
  // store previous state
  this.chartScale_Measure
    .domain([minMeasureValue, maxMeasureValue])
    .range([0, this.height_hist]);
};

SummaryInterval.prototype.refreshBins_Translate = function refreshBins_Translate() {
  const me = this;
  const offset = (this.stepTicks) ? this.width_barGap : 0;
  if (this.scaleType === 'time') {
    this.DOM.aggrGlyphs
      .style('width', aggr => `${me.valueScale(aggr.maxV) - me.valueScale(aggr.minV)}px`)
      .style('transform', aggr => `translateX(${me.valueScale(aggr.minV) + 1}px)`);
  } else {
    this.DOM.aggrGlyphs
      .style('width', `${this.getWidth_Bin()}px`)
      .style('transform', aggr => `translateX(${me.valueScale(aggr.minV) + offset}px)`);
  }
};

SummaryInterval.prototype.refreshViz_Scale = function refreshViz_Scale() {
  this.refreshViz_Total();
  this.refreshViz_Active();
};

SummaryInterval.prototype.refreshViz_Total = function refreshViz_Total() {
  if (this.isEmpty() || this.collapsed) return;
  const me = this;
  const width = this.getWidth_Bin();

  const ratioMode = this.browser.ratioModeActive;

  const zeroPos = this.chartScale_Measure(0);
  const heightTotal = function (aggr) {
    if (aggr._measure.Total === 0) return -zeroPos;
    if (me.browser.ratioModeActive) return me.height_hist - zeroPos;
    return me.chartScale_Measure(aggr.measure('Total')) - zeroPos;
  };

  if (this.scaleType === 'time') {
    this.DOM.measure_Total_Area
      .style('opacity', ratioMode ? 0.5 : null)
      .transition().duration(this.browser.noAnim ? 0 : 700).ease(d3.easeCubic)
      .attr('d',
        d3.area()
          .curve(d3.curveMonotoneX)
          .x(this.timeAxis_XFunc)
          .y0(this.height_hist - zeroPos)
          .y1(aggr => ((aggr._measure.Total === 0) ? (me.height_hist - zeroPos) : (me.height_hist - heightTotal(aggr))) - zeroPos));
  } else {
    this.DOM.measure_Total
      .style('opacity', ratioMode ? 0.5 : null)
      .style('transform', aggr => `translateY(${me.height_hist - zeroPos}px) scale(${width},${heightTotal(aggr)})`);
    if (!this.browser.ratioModeActive) {
      this.DOM.measureTotalTip
        .style('opacity', aggr => ((aggr.measure('Total') > me.chartScale_Measure.domain()[1]) ? 1 : 0))
        .style('width', `${width}px`);
    } else {
      this.DOM.measureTotalTip.style('opacity', 0);
    }
  }
};

SummaryInterval.prototype.refreshViz_Active = function refreshViz_Active() {
  if (this.isEmpty() || this.collapsed) return;
  const me = this;
  const width = this.getWidth_Bin();

  const zeroPos = this.chartScale_Measure(0);
  const heightActive = function (aggr) {
    if (aggr._measure.Active === 0) return -zeroPos;
    if (me.browser.ratioModeActive) return zeroPos; // me.height_hist-zeroPos;
    return me.chartScale_Measure(aggr.measure('Active')) - zeroPos;
  };

  this.DOM.aggrGlyphs
    .attr('NoActiveRecords', aggr => ((aggr._measure.Active === 0) ? 'true' : null));

  // Position the lock button
  this.DOM.lockButton
    .style('transform', (aggr) => {
      const x = heightActive(aggr);
      let translateY = me.height_hist - x - 10;
      if (x > 0) translateY -= zeroPos; else translateY = zeroPos - 8;
      return `translateY(${translateY}px)`;
    })
    .attr('inside', (aggr) => {
      if (me.browser.ratioModeActive) return '';
      if (me.height_hist - heightActive(aggr) < 6) return '';
    });

  // Time (line chart) update
  if (this.scaleType === 'time') {
    const durationTime = this.browser.noAnim ? 0 : 700;
    const yFunc = function (aggr) {
      return ((aggr._measure.Active === 0) ? (me.height_hist - zeroPos) : (me.height_hist - heightActive(aggr))) - zeroPos;
    };
    this.DOM.measure_Active_Area
      .transition().duration(durationTime).ease(d3.easeCubic)
      .attr('d',
        d3.area()
          .curve(d3.curveMonotoneX)
          .x(this.timeAxis_XFunc)
          .y0(this.height_hist - zeroPos)
          .y1(yFunc),
      );

    this.DOM.lineTrend_ActiveLine.transition().duration(durationTime)
      .attr('x1', this.timeAxis_XFunc)
      .attr('x2', this.timeAxis_XFunc)
      .attr('y1', this.height_hist - zeroPos)
      .attr('y2', yFunc);
  }

  if (!this.isFiltered() || this.scaleType === 'time' || this.stepTicks) {
    // No partial rendering
    this.DOM.measure_Active.style('transform', aggr => `translateY(${me.height_hist - zeroPos}px) scale(${width},${heightActive(aggr)})`);
  } else {
    // Partial rendering
    // is filtered & not step scale
    const filter_min = this.summaryFilter.active.min;
    const filter_max = this.summaryFilter.active.max;
    const minPos = this.valueScale(filter_min);
    const maxPos = this.valueScale(filter_max);
    this.DOM.measure_Active.style('transform', (aggr) => {
      let translateX = '';
      let width_self = width;
      const aggr_min = aggr.minV;
      const aggr_max = aggr.maxV;
      if (aggr._measure.Active > 0) {
        // it is within the filtered range
        if (aggr_min < filter_min) {
          const lostWidth = minPos - me.valueScale(aggr_min);
          translateX = `translateX(${lostWidth}px) `;
          width_self -= lostWidth;
        }
        if (aggr_max > filter_max) {
          width_self -= me.valueScale(aggr_max) - maxPos - me.width_barGap * 2;
        }
      }
      return `translateY(${me.height_hist}px) ${translateX}scale(${width_self},${heightActive(aggr)})`;
    });
  }
};

SummaryInterval.prototype.refreshViz_Compare = function refreshViz_Compare(cT, curGroup, totalGroups) {
  if (this.isEmpty() || this.collapsed || !this.inBrowser()) return;

  const me = this;
  const width = this.getWidth_Bin();
  const binWidth = width / totalGroups;
  const ratioModeActive = this.browser.ratioModeActive;

  const compId = `Compare_${cT}`;

  // Percentile chart
  if (this.percentileChartVisible) {
    if (this.browser.vizActive[compId]) {
      this.DOM.percentileGroup.select('.compared_percentileChart').style('display', 'block');
      if (this.browser.vizActive[compId]) this.updatePercentiles(`Compare_${cT}`);
    } else {
      this.DOM.percentileGroup.select('.compared_percentileChart').style('display', 'none');
    }
  }

  const zeroPos = this.chartScale_Measure(0);
  const heightCompare = function (aggr) {
    let _h = 0;
    if (aggr._measure[compId] !== 0) {
      _h = ratioModeActive ? aggr.ratioCompareToActive(cT) * me.height_hist
        : me.chartScale_Measure(aggr.measure(compId));
    }
    return _h - zeroPos;
  };

  // Time line update
  if (this.scaleType === 'time') {
    const yFunc = function (aggr) {
      return ((aggr._measure[compId] === 0) ? (me.height_hist - zeroPos) : (me.height_hist - heightCompare(aggr))) - zeroPos;
    };

    const dTime = 200;
    this.DOM[`measure_Compare_Area_${cT}`]
      .transition().duration(dTime)
      .attr('d', d3.area()
        .curve(d3.curveMonotoneX)
        .x(this.timeAxis_XFunc)
        // .y(me.height_hist+2-zeroPos)
        .y(yFunc));

    this.DOM[`measure_Compare_Line_${cT}`].transition().duration(dTime)
      .attr('y1', me.height_hist + 3 - zeroPos)
      .attr('y2', yFunc)
      .attr('x1', this.timeAxis_XFunc)
      .attr('x2', this.timeAxis_XFunc);
    return;
  }

  const _translateY = `translateY(${me.height_hist - zeroPos}px) `;
  const _translateX = `translateX(${(curGroup + 1) * binWidth}px) `;

  if (!this.isFiltered() || this.scaleType === 'time' || this.stepTicks) {
    // No partial rendering
    this.DOM[`measure_Compare_${cT}`].style('transform', aggr => `${_translateY + _translateX}scale(${binWidth},${heightCompare(aggr)})`);
  } else {
    // partial rendering
    const filter_min = this.summaryFilter.active.min;
    const filter_max = this.summaryFilter.active.max;
    const minPos = this.valueScale(filter_min);
    const maxPos = this.valueScale(filter_max);
    this.DOM[`measure_Compare_${cT}`].style('transform', (aggr) => {
      let translateX = '';
      let width_self = (curGroup * binWidth);
      const aggr_min = aggr.minV;
      const aggr_max = aggr.maxV;
      if (aggr._measure.Active > 0) {
        // it is within the filtered range
        if (aggr_min < filter_min) {
          const lostWidth = minPos - me.valueScale(aggr_min);
          translateX = `translateX(${lostWidth}px) `;
          width_self -= lostWidth;
        }
        if (aggr_max > filter_max) {
          width_self -= me.valueScale(aggr_max) - maxPos - me.width_barGap * 2;
        }
      }
      return `${_translateY + translateX}scale(${width_self / 2},${heightCompare(aggr)})`;
    });
  }
};

SummaryInterval.prototype.refreshViz_Highlight = function refreshViz_Highlight() {
  if (this.isEmpty() || this.collapsed || !this.DOM.inited || !this.inBrowser()) return;
  const me = this;
  const width = this.getWidth_Bin();

  this.refreshViz_EmptyRecords();
  this.refreshMeasureLabel();

  let totalC = this.browser.getActiveCompareSelCount();
  if (this.browser.measureFunc === 'Avg') totalC++;

  if (this.browser.vizActive.Highlight) {
    this.updatePercentiles('Highlight');
    this.DOM.highlightedMeasureValue
      .style('transform', `translateY(${this.height_hist * (1 - this.browser.allRecordsAggr.ratioHighlightToTotal())}px)`)
      .style('opacity', (this.browser.ratioModeActive ? 1 : 0));
  } else {
    // Highlight not active
    this.DOM.percentileGroup.select('.percentileChart_Highlight').style('opacity', 0);
    this.DOM.highlightedMeasureValue.style('opacity', 0);
    this.refreshMeasureLabel();
    this.highlightRangeLimits_Active = false;
  }

  this.DOM.highlightRangeLimits
    .style('opacity', (this.highlightRangeLimits_Active && this.browser.vizActive.Highlight) ? 1 : 0)
    .style('left', d => `${me.valueScale(me.browser.flexAggr_Highlight[(d === 0) ? 'minV' : 'maxV'])}px`);

  const zeroPos = this.chartScale_Measure(0);
  const getAggrHeight_Preview = function (aggr) {
    let p = aggr.measure('Highlight');
    if (me.browser.preview_not) p = aggr.measure('Active') - p;
    if (me.browser.ratioModeActive) {
      if (aggr._measure.Active === 0) return -zeroPos;
      return (p / aggr.measure('Active')) * me.height_hist - zeroPos;
    }
    return me.chartScale_Measure(p) - zeroPos;
  };

  if (this.scaleType === 'time') {
    const yFunc = function (aggr) {
      return ((aggr._measure.Highlight === 0) ? (me.height_hist - zeroPos) : (me.height_hist - getAggrHeight_Preview(aggr))) - zeroPos;
    };
    const dTime = 250;
    const x = this.DOM.measure_Highlight_Area
      .style('opacity', 1)
      .transition().duration(dTime).ease(d3.easeCubic)
      .attr('d',
        d3.area()
          .curve(d3.curveMonotoneX)
          .x(this.timeAxis_XFunc)
          .y0(this.height_hist - zeroPos)
          .y1(yFunc));
    const y = this.DOM.measure_Highlight_Line.transition().duration(dTime)
      .style('opacity', 1)
      .attr('y1', me.height_hist - zeroPos)
      .attr('y2', yFunc)
      .attr('x1', this.timeAxis_XFunc)
      .attr('x2', this.timeAxis_XFunc);
    if (!this.browser.vizActive.Highlight) {
      x.transition().style('opacity', 0);
      y.transition().style('opacity', 0);
    }
  } else {
    if (!this.browser.vizActive.Highlight) {
      this.DOM.measure_Highlight.style('transform',
        `translateY(${this.height_hist - zeroPos}px) ` +
        `scale(${width / (totalC + 1)},0)`);
      return;
    }

    const _translateY = `translateY(${me.height_hist - zeroPos}px) `;

    let range_min = this.valueScale.domain()[0];
    let range_max = this.valueScale.domain()[1];
    let rangeFill = false;
    if (this.isFiltered()) {
      range_min = Math.max(range_min, this.summaryFilter.active.min);
      range_max = Math.max(range_min, this.summaryFilter.active.max);
      rangeFill = true;
    }
    if (this.highlightRangeLimits_Active) {
      range_min = Math.max(range_min, this.browser.flexAggr_Highlight.minV);
      range_max = Math.max(range_min, this.browser.flexAggr_Highlight.maxV);
      rangeFill = true;
    }
    const minPos = this.valueScale(range_min);
    const maxPos = this.valueScale(range_max);

    this.DOM.measure_Highlight.style('transform', (aggr) => {
      let _translateX = '';
      let barWidth = width;
      if (aggr._measure.Active > 0 && rangeFill) {
        const aggr_min = aggr.minV;
        const aggr_max = aggr.maxV;
        // it is within the filtered range
        if (aggr_min < range_min) {
          const lostWidth = minPos - me.valueScale(aggr_min);
          _translateX = `translateX(${lostWidth}px) `;
          barWidth -= lostWidth;
        }
        if (aggr_max > range_max) {
          barWidth -= me.valueScale(aggr_max) - maxPos - me.width_barGap * 2;
        }
      }
      if (!rangeFill) {
        barWidth /= (totalC + 1);
      }
      const _scale = `scale(${barWidth},${getAggrHeight_Preview(aggr)})`;
      return _translateY + _translateX + _scale;
    });
  }
};

SummaryInterval.prototype.refreshViz_Axis = function refreshViz_Axis() {
  if (this.isEmpty() || this.collapsed) return;

  const me = this;
  let tickValues,
    maxValue;
  const chartAxis_Measure_TickSkip = me.height_hist / 17;
  let axis_Scale = d3.scaleLinear()
    .clamp(false)
    .domain(this.chartScale_Measure.domain())
    .range(this.chartScale_Measure.range());

  if (this.browser.ratioModeActive || this.browser.percentModeActive) {
    maxValue = (this.browser.ratioModeActive) ? 100
      : Math.round(100 * me.getMaxAggr('Active') / me.browser.allRecordsAggr.measure('Active'));
    axis_Scale = d3.scaleLinear()
      .rangeRound([0, this.height_hist])
      .domain([0, maxValue])
      .clamp(true);
  }

  // GET TICK VALUES ***********************************************************
  tickValues = axis_Scale.ticks(chartAxis_Measure_TickSkip);
  if (axis_Scale.domain()[0] >= 0) {
    // remove 0-tick // TODO: The minimum value can be below zero, and you may wish to label 0-line
    tickValues = tickValues.filter(d => d !== 0);
  }
  // Remove non-integer values is appropriate
  if ((this.browser.measureFunc === 'Count') || (this.browser.measureFunc === 'Sum' && !this.browser.measureSummary.hasFloat)) {
    tickValues = tickValues.filter(d => d % 1 === 0);
  }

  const tickDoms = this.DOM.chartAxis_Measure_TickGroup.selectAll('span.tick')
    .data(tickValues, i => i);

  // remove old ones
  tickDoms.exit().transition().style('opacity', 0).transition()
    .remove();

  // add new ones
  const tickData_new = tickDoms.enter().append('span').attr('class', 'tick').style('opacity', 0);

  tickData_new.append('span').attr('class', 'line');
  tickData_new.append('span').attr('class', 'text measureAxis_1');
  tickData_new.append('span').attr('class', 'text measureAxis_2');

  tickData_new.style('transform', d => `translateY(${me.height_hist - me.chartScale_Measure_prev(d)}px)`);

  this.DOM.chartAxis_Measure_TickGroup.selectAll('.text')
    .html(d => me.browser.getTickLabel(d));

  this.browser.setNoAnim(false);

  let transformFunc;
  if (me.browser.ratioModeActive) {
    transformFunc = function (d) {
      return `translateY(${me.height_hist - d * me.height_hist / 100}px)`;
    };
  } else if (me.browser.percentModeActive) {
    transformFunc = function (d) {
      return `translateY(${me.height_hist - (d / maxValue) * me.height_hist}px)`;
    };
  } else {
    transformFunc = function (d) {
      return `translateY(${me.height_hist - axis_Scale(d)}px)`;
    };
  }

  setTimeout(() => {
    me.DOM.chartAxis_Measure_TickGroup.selectAll('span.tick')
      .style('opacity', 1)
      .style('transform', transformFunc);
  });
};

SummaryInterval.prototype.refreshIntervalSlider = function refreshIntervalSlider() {
  if (this.DOM.intervalSlider === undefined) return;

  const minn = this.summaryFilter.active.min;
  let minPos = this.valueScale(minn);
  const maxx = this.summaryFilter.active.max;
  let maxPos = this.valueScale(maxx);

  if (maxx > this.intervalRange.active.max) {
    maxPos = this.valueScale.range()[1];
  }
  if (minn === this.intervalRange.active.min) {
    minPos = this.valueScale.range()[0];
  }

  this.DOM.intervalSlider.select('.base.active')
    .attr('filtered', this.isFiltered())
    .each(function (d) {
      this.style.left = `${minPos}px`;
      this.style.width = `${maxPos - minPos}px`;
      // kshf.Util.setTransform(this,"translateX("+minPos+"px) scaleX("+(maxPos-minPos)+")");
      // Rendering update slowdown if the above translation is used. Weird...
    });
  this.DOM.intervalSlider.selectAll('.rangeHandle')
    .style('transform', d => `translateX(${(d === 'min') ? minPos : maxPos}px)`);
};

SummaryInterval.prototype.refreshHeight = function refreshHeight() {
  if (!this.DOM.inited) return;
  this.DOM.valueTickGroup.style('height', `${this.height_labels}px`);
  // this.DOM.rangeHandle.styles({
  //   height: ( this.height_hist+23)+"px",
  //   top:    (-this.height_hist-13)+"px" });
  // this.DOM.rangeHandle.attr('style', `height: ${this.height_hist + 23}px; top: ${-this.height_hist - 13}px`);
  this.DOM.rangeHandle.style.height = `${this.height_hist + 23}px`;
  this.DOM.rangeHandle.style.top = `${-this.height_hist - 13}px`;
  this.DOM.highlightRangeLimits.style('height', `${this.height_hist}px`);

  this.DOM.histogram.style('height', `${this.height_hist + this.height_hist_topGap}px`);
  this.DOM.wrapper.style('height', `${this.collapsed ? '0' : this.getHeight_Content()}px`);
  this.DOM.root.style('max-height', `${this.getHeight() + 1}px`);

  this.refreshBins_Translate();

  this.refreshViz_Scale();
  this.refreshViz_Highlight();
  this.refreshViz_Compare_All();
  this.refreshViz_Axis();
};

SummaryInterval.prototype.refreshWidth = function refreshWidth() {
  this.refreshScaleType();
  this.updateScaleAndBins();
  if (this.DOM.inited === false) return;
  const wideChart = this.isWideChart();

  this.DOM.wrapper.attr('showMeasureAxis_2', wideChart ? 'true' : null);

  // this.DOM.summaryInterval.styles({
  //   'width'        : this.getWidth()+"px",
  //   'padding-left' : this.width_measureAxisLabel+"px",
  //   'padding-right': ( wideChart ? this.width_measureAxisLabel : 11)+"px" });
  // this.DOM.summaryInterval.attr('style', `width: ${this.getWidth()}px; padding-left: ${this.width_measureAxisLabel}px; padding-right: ${(wideChart ? this.width_measureAxisLabel : 11)}px;`);
  this.DOM.summaryInterval.style.width = `${this.getWidth()}px`;
  this.DOM.summaryInterval.style.paddingLeft = `${this.width_measureAxisLabel}px`;
  this.DOM.summaryInterval.style.paddingRight = `${(wideChart ? this.width_measureAxisLabel : 11)}px`;

  this.DOM.summaryName.style('max-width', `${this.getWidth() - 40}px`);
};

SummaryInterval.prototype.setHeight = function setHeight(targetHeight) {
  if (this._aggrs === undefined) return;
  const c = targetHeight - this.getHeight_Header() - this.getHeight_Extra();
  if (this.height_hist === c) return;
  this.height_hist = c;
  this.updateBarScale2Active();
};

SummaryInterval.prototype.updateAfterFilter = function updateAfterFilter() {
  if (this.isEmpty() || this.collapsed || !this.inBrowser()) return;
  this.updateChartScale_Measure();
  this.refreshMeasureLabel();
  this.refreshViz_EmptyRecords();
  this.updatePercentiles('Active');
};

SummaryInterval.prototype.updateChartScale_Measure = function updateChartScale_Measure() {
  if (!this.aggr_initialized || this.isEmpty()) return; // nothing to do
  const me = this;
  this.updateBarScale2Active();
  this.refreshBins_Translate();
  this.refreshViz_Scale();
  this.refreshViz_Highlight();
  this.refreshViz_Compare_All();
  this.refreshViz_Axis();
};

SummaryInterval.prototype.setRecordValue = function setRecordValue(record) {
  if (!this.inBrowser() || !this.DOM.inited || this.valueScale === undefined) return;
  const v = this.getRecordValue(record);
  if (v === null || (this.scaleType === 'log' && v <= 0)) return;

  const me = this;
  const offset = (this.stepTicks && !this.isTimeStamp()) ? this.aggrWidth / 2 : 0;
  this.DOM.recordValue
    .style('transform', `translateX(${me.valueScale(v) + offset}px)`)
    .style('display', 'block');
  this.DOM.recordValueText.html(this.printWithUnitName(v));
};

SummaryInterval.prototype.hideRecordValue = function hideRecordValue() {
  if (!this.DOM.inited) return;
  this.DOM.recordValue.style('display', null);
};

SummaryInterval.prototype.updatePercentiles = function updatePercentiles(distr) {
  if (this.percentileChartVisible === false) return;

  const me = this;
  // get active values into an array
  // the items are already sorted by their numeric value, it's just a linear pass.
  let collectFunc,
    values = [];
  if (distr === 'Active') {
    collectFunc = function (record) { if (record.isWanted) values.push(me.getRecordValue(record)); };
  } else if (distr === 'Highlight') {
    collectFunc = function (record) { if (record.highlighted) values.push(me.getRecordValue(record)); };
  } else { // Compare_A / Compare_B / Compare_C
    const cT = distr.substr(8);
    collectFunc = function (record) { if (record.selectCompared[cT]) values.push(me.getRecordValue(record)); };
    // Below doesn't work: The values will not be in sorted order!!
    /*      this.browser.selectedAggr[distr].records.forEach(function(record){
        val v = me.getRecordValue(record);
        if(v!==null) values.push(v);
      }); */
  }
  this.filteredRecords.forEach(collectFunc);

  [10, 20, 30, 40, 50, 60, 70, 80, 90].forEach(function (q) {
    this.quantile_val[distr + q] = d3.quantile(values, q / 100);
  }, this);

  const percentileChart = this.DOM.percentileGroup.select(`.percentileChart_${distr}`);

  percentileChart.styles({ opacity: 1, 'margin-left': (this.stepTicks ? (`${this.aggrWidth / 2}px`) : null) });
  percentileChart.selectAll('.q_pos')
    .style('transform', q => `translateX(${me.valueScale(me.quantile_val[distr + q])}px)`);
  percentileChart.selectAll('.quantile.aggrGlyph')
    .style('transform', (qb) => {
      const pos_1 = me.valueScale(me.quantile_val[distr + qb[0]]);
      const pos_2 = me.valueScale(me.quantile_val[distr + qb[1]]);
      return `translateX(${pos_1}px) scaleX(${pos_2 - pos_1})`;
    });
};

export default SummaryInterval;
