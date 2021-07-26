import Filter from './filter';

function FilterSpatial(_browser, _recordDisplay) {
  Filter.call(this, _browser);
  this.recordDisplay = _recordDisplay;
}

FilterSpatial.prototype = Object.create(Filter.prototype);

FilterSpatial.prototype.getTitle = function getTitle() {
  return 'Spatial';
};

FilterSpatial.prototype.onClear = function onClear() {
  this.recordDisplay.DOM.root.select('.spatialQueryBox_Filter').attr('active', null);
};

FilterSpatial.prototype.filterView_Detail = function filterView_Detail() {
  return "<i class='fa fa-square-o'></i> (Area)";
};

FilterSpatial.prototype.onFilter = function onFilter() {
  this.recordDisplay.DOM.root.select('.spatialQueryBox_Filter').attr('active', true);
  this.browser.records.forEach(function (record) {
    if (record._geoBound_ === undefined) {
      record.setFilterCache(this.filterID, false);
      return;
    }
    record.setFilterCache(this.filterID, kshf.intersects(record._geoBound_, this.bounds));
  }, this);
};
// kshf.FilterSpatial.constructor = kshf.FilterSpatial;

export default FilterSpatial;
