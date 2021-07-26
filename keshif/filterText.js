import filter from './filter';

function FilterText(_browser, _recordDisplay) {
  filter.call(this, _browser);
  this.multiMode = 'and';
  this.recordDisplay = _recordDisplay;
  this.queryString = null; // This is the text query string, populated by user input
}

FilterText.prototype = Object.create(filter.prototype);

FilterText.prototype.getTitle = function getTitle() {
  return this.recordDisplay.textSearchSummary.summaryName;
};

FilterText.prototype.onClear = function onClear() {
  this.recordDisplay.DOM.recordTextSearch.select('.clearSearchText').style('display', 'none');
  this.recordDisplay.DOM.recordTextSearch.selectAll('.textSearchMode').style('display', 'none');
  this.recordDisplay.DOM.recordTextSearch.select('input').node().value = '';
};

FilterText.prototype.filterView_Detail = function filterView_Detail() {
  return `*${this.queryString}*`;
};

FilterText.prototype.setQueryString = function setQueryString(v) {
  this.queryString = v.toLowerCase();
  // convert string to query pieces
  this.filterQuery = [];
  if (this.queryString !== '') {
    // split the input by " character
    this.queryString.split('"').forEach(function (block, i) {
      if (i % 2 === 0) {
        block.split(/\s+/).forEach(function (q) { this.filterQuery.push(q); }, this);
      } else {
        this.filterQuery.push(block);
      }
    }, this);
    // Remove the empty strings
    this.filterQuery = this.filterQuery.filter(v => v !== '');
  }
};

FilterText.prototype.onFilter = function onFilter() {
  this.recordDisplay.DOM.recordTextSearch
    .select('.clearSearchText').style('display', 'inline-block');
  this.recordDisplay.DOM.recordTextSearch
    .selectAll('.textSearchMode').style('display', this.filterQuery.length > 1 ? 'inline-block' : 'none');

  // go over all the records in the list, search each keyword separately
  // If some search matches, return true (any function)
  const summaryID = this.recordDisplay.textSearchSummary.summaryID;
  this.browser.records.forEach(function (record) {
    let v = record._valueCache[summaryID];
    let f = false;
    if (v) {
      v = (`${v}`).toLowerCase();
      if (this.multiMode === 'or') {
        f = !this.filterQuery.every(v_i => v.indexOf(v_i) === -1);
      } else if (this.multiMode === 'and') {
        f = this.filterQuery.every(v_i => v.indexOf(v_i) !== -1);
      }
    }
    record.setFilterCache(this.filterID, f);
  }, this);
};

// kshf.FilterText.constructor = kshf.FilterText;

export default FilterText;
