import BreadCrumb from './breadcrumb';

function Filter(_browser) {
  this.browser = _browser;

  this.filterID = this.browser.filterCount++;

  this.isFiltered = false;
  this.how = 'All';

  this.browser.records.forEach(function (record) {
    record.setFilterCache(this.filterID, true);
  }, this);

  this.filterCrumb = new BreadCrumb(this.browser, 'Filter', this);
}

Filter.prototype.addFilter = function addFilter() {
  this.isFiltered = true;

  this.browser.clearSelect_Highlight(true);

  if (this.onFilter) {
    this.onFilter.call(this);
  }

  let stateChanged = false;

  let how = 0;
  if (this.how === 'LessResults') {
    how = -1;
  }
  if (this.how === 'MoreResults') {
    how = 1;
  }

  this.browser.records.forEach((record) => {
    if (how < 0 && !record.isWanted) {
      return;
    }
    if (how > 0 && record.isWanted) {
      return;
    }
    stateChanged = record.updateWanted() || stateChanged;
  }, this);

  this.filterCrumb.showCrumb();

  this.browser.update_Records_Wanted_Count();
  this.browser.refresh_filterClearAll();
  if (stateChanged) {
    this.browser.updateAfterFilter();
  }
};

Filter.prototype.clearFilter = function clearFilter(forceUpdate) {
  if (!this.isFiltered) {
    return;
  } // TODO: Does this break anything?
  this.isFiltered = false;

  if (this.onClear) {
    this.onClear.call(this);
  }

  // clear filter cache - no other logic is necessary
  this.browser.records.forEach(function (record) {
    record.setFilterCache(this.filterID, true);
  }, this);

  if (forceUpdate !== false) {
    this.browser.records.forEach((record) => {
      if (!record.isWanted) record.updateWanted();
    });
  }

  this.filterCrumb.removeCrumb();

  if (forceUpdate !== false) {
    this.browser.update_Records_Wanted_Count();
    this.browser.refresh_filterClearAll();
    this.browser.updateAfterFilter();
  }
};

Filter.prototype.getRichText = function getRichText() {
  return `<b>${this.getTitle()}</b>: ${this.filterView_Detail()} `;
};

export default Filter;
