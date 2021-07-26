import * as d3 from 'd3';
import kshf from './kshf';

function Aggregate(summary) {
  // Which summary does this aggregate appear in?
  this.summary = summary;
  // Records which are mapped to this aggregate
  this.records = [];
  // To signal that this aggregate should not be shown, set this to false;
  this.usedAggr = true;
  // DOM
  this.DOM = { aggrGlyph: undefined };
  // Reset
  this.resetAggregateMeasures();
}

Aggregate.prototype.resetAggregateMeasures = function resetAggregateMeasures() {
  this._measure = {
    Total: 0,
    Active: 0,
    Highlight: 0,
    Compare_A: 0,
    Compare_B: 0,
    Compare_C: 0,
  };
  this.recCnt = {
    Total: 0,
    Active: 0,
    Highlight: 0,
    Compare_A: 0,
    Compare_B: 0,
    Compare_C: 0,
  };
  this.records.forEach(function (record) {
    if (record.measure_Self === null) {
      return;
    }
    this._measure.Total += record.measure_Self;
    this.recCnt.Total++;
    if (record.isWanted) {
      this._measure.Active += record.measure_Self;
      this.recCnt.Active++;
    }
  }, this);
};

Aggregate.prototype.addRecord = function addRecord(record) {
  this.records.push(record);
  record._aggrCache.push(this);
  if (record.measure_Self === null) {
    return;
  }
  this._measure.Total += record.measure_Self;
  this.recCnt.Total++;
  if (record.isWanted) {
    this._measure.Active += record.measure_Self;
    this.recCnt.Active++;
  }
};

Aggregate.prototype.removeRecord = function removeRecord(record) {
  this.records.splice(this.records.indexOf(record), 1);
  record._aggrCache.splice(record._aggrCache.indexOf(this), 1);
  if (record.measure_Self === null) {
    return;
  }
  this._measure.Total -= record.measure_Self;
  this.recCnt.Total--;
  if (record.isWanted) {
    this._measure.Active -= record.measure_Self;
    this.recCnt.Active--;
  }
};

Aggregate.prototype.measure = function measure(v) {
  if (kshf.browser.measureFunc === 'Avg') {
    const r = this.recCnt[v];
    return (r === 0) ? 0 : this._measure[v] / r; // avoid division by zero.
  }
  return this._measure[v];
};

Aggregate.prototype.ratioHighlightToTotal = function ratioHighlightToTotal() {
  return this._measure.Highlight / this._measure.Total;
};

Aggregate.prototype.ratioHighlightToActive = function ratioHighlightToActive() {
  return this._measure.Highlight / this._measure.Active;
};

Aggregate.prototype.ratioCompareToActive = function ratioCompareToActive(cT) {
  return this._measure[`Compare_${cT}`] / this._measure.Active;
};

Aggregate.prototype.unselectAggregate = function unselectAggregate() {
  if (this.DOM.aggrGlyph) {
    d3.select(this.DOM.aggrGlyph).attr('catselect', null).classed('showlock', false);
  }
  if (this.DOM.matrixRow) {
    this.DOM.matrixRow.removeAttribute('selection');
    this.DOM.matrixRow.removeAttribute('catselect');
  }
};

Aggregate.prototype.selectCompare = function selectCompare(cT) {
  d3.select(this.DOM.aggrGlyph).classed('locked', true);
  this.compared = cT;
  this.records.forEach((record) => { record.setCompared(cT); });
};

Aggregate.prototype.clearCompare = function clearCompare(cT) {
  d3.select(this.DOM.aggrGlyph).classed('locked', false).attr('compare', null);
  this.compared = false;
  this.records.forEach((record) => { record.unsetCompared(cT); });
};

Aggregate.prototype.selectHighlight = function selectHighlight() {
  this.records.forEach((record) => { record.addForHighlight(); });
};

Aggregate.prototype.clearHighlight = function clearHighlight() {
  this.records.forEach((record) => { record.remForHighlight(false); });
};

export default Aggregate;
