import * as d3 from 'd3';

function Record(d, idIndex) {
  this.data = d;
  this.idIndex = idIndex; // TODO: Items don't need to have ID index, only one per table is enough??

  // By default, each item is aggregated as 1
  // You can modify this with a non-negative value
  // Note that the aggregation currently works by summation only.
  this.measure_Self = 1;

  // Wanted item / not filtered out
  this.isWanted = true;

  // Rank order of the record
  this.recordRank = 0;

  // The data that's used for mapping this item, used as a cache.
  // This is accessed by filterID
  // Through this, you can also reach DOM of aggregates
  // DOM elements that this item is mapped to
  // - If this is a paper, it can be paper type. If this is author, it can be author affiliation.
  this._valueCache = []; // caching the values this item was mapped to

  // Aggregates which this record falls under
  this._aggrCache = [];

  this.DOM = { record: undefined };

  // If true, filter/wanted state is dirty and needs to be updated.
  this._filterCacheIsDirty = true;
  // Cacheing filter state per each summary
  this._filterCache = [];

  this.selectCompared_str = '';
  this.selectCompared = { A: false, B: false, C: false };
}

Record.prototype.id = function id() {
  return this.data[this.idIndex];
};

Record.prototype.setFilterCache = function setFilterCache(index, v) {
  if (this._filterCache[index] === v) return;
  this._filterCache[index] = v;
  this._filterCacheIsDirty = true;
};

Record.prototype.updateWanted = function updateWanted() {
  if (!this._filterCacheIsDirty) return false;
  const me = this;

  const oldWanted = this.isWanted;
  this.isWanted = this._filterCache.every(f => f);
  this._filterCacheIsDirty = false;

  // There is some change that affects computation
  if (this.measure_Self && this.isWanted !== oldWanted) {
    const valToAdd = (this.isWanted && !oldWanted)
      ? this.measure_Self /* add */
      : -this.measure_Self/* remove */;
    const cntToAdd = this.isWanted ? 1 : -1; // more record : less record
    this._aggrCache.forEach((aggr) => {
      aggr._measure.Active += valToAdd;
      aggr.recCnt.Active += cntToAdd;
    });
  }

  return this.isWanted !== oldWanted;
};

Record.prototype.setRecordDetails = function setRecodDetails(value) {
  this.showDetails = value;
  if (this.DOM.record) {
    d3.select(this.DOM.record).classed('showDetails', this.showDetails);
  }
};

Record.prototype.highlightRecord = function highlightRecord() {
  if (this.DOM.record) {
    this.DOM.record.setAttribute('selection', 'onRecord');
  }
  // summaries that this item appears in
  this._aggrCache.forEach(function (aggr) {
    if (aggr.DOM.aggrGlyph) {
      aggr.DOM.aggrGlyph.setAttribute('catselect', 'onRecord');
    }
    if (aggr.DOM.matrixRow) {
      aggr.DOM.matrixRow.setAttribute('catselect', 'onRecord');
    }
    if (aggr.summary && aggr.summary.setRecordValue) {
      aggr.summary.setRecordValue(this);
    }
  }, this);
};

Record.prototype.unhighlightRecord = function unhighlightRecord() {
  if (this.DOM.record) {
    this.DOM.record.removeAttribute('selection');
  }
  // summaries that this item appears in
  this._aggrCache.forEach((aggr) => {
    aggr.unselectAggregate();
    if (aggr.summary && aggr.summary.hideRecordValue) aggr.summary.hideRecordValue();
  }, this);
};

Record.prototype.addForHighlight = function addForHighlight() {
  if (!this.isWanted || this.highlighted) return;
  if (this.DOM.record) {
    const x = this.DOM.record;
    x.setAttribute('selection', 'highlighted');
    // SVG geo area - move it to the bottom of parent so that border can be displayed nicely.
    // TODO: improve the conditional check!
    if (x.nodeName === 'path') {
      d3.select(x.parentNode.appendChild(x));
    }
  }
  this._aggrCache.forEach(function (aggr) {
    if (this.measure_Self === null || this.measure_Self === 0) return;
    aggr._measure.Highlight += this.measure_Self;
    aggr.recCnt.Highlight++;
  }, this);
  this.highlighted = true;
};

Record.prototype.remForHighlight = function remForHighlight(distribute) {
  if (!this.isWanted || !this.highlighted) {
    return;
  }
  if (this.DOM.record) {
    this.DOM.record.removeAttribute('selection');
  }
  if (distribute) {
    this._aggrCache.forEach(function (aggr) {
      if (this.measure_Self === null || this.measure_Self === 0) {
        return;
      }
      aggr._measure.Highlight -= this.measure_Self;
      aggr.recCnt.Highlight--;
    }, this);
  }
  this.highlighted = false;
};

Record.prototype.setCompared = function setCompared(cT) {
  this.selectCompared_str += `${cT} `;
  this.selectCompared[cT] = true;
  this.domCompared();
};

Record.prototype.unsetCompared = function unsetCompared(cT) {
  this.selectCompared_str = this.selectCompared_str.replace(`${cT} `, '');
  this.selectCompared[cT] = false;
  this.domCompared();
};

Record.prototype.domCompared = function domCompared() {
  if (!this.DOM.record) {
    return;
  }
  if (this.selectCompared_str === '') {
    this.DOM.record.removeAttribute('rec_compared');
  } else {
    this.DOM.record.setAttribute('rec_compared', this.selectCompared_str);
  }
};

Record.prototype.initLinks = function initLinks() {
  this.DOM.links_To = [];
  this.DOM.links_From = [];
  this.links_To = [];
  this.links_From = [];
};

export default Record;
