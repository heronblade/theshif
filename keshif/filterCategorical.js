import Filter from './filter';
import kshf from './kshf';

function FilterCategorical(_browser, _summary) {
  Filter.call(this, _browser);
  this.summary = _summary;
  this.selected_AND = [];
  this.selected_OR = [];
  this.selected_NOT = [];
}

FilterCategorical.prototype = Object.create(Filter.prototype);

FilterCategorical.prototype.getTitle = function getTitle() {
  return this.summary.summaryName;
};

FilterCategorical.prototype.selectedCount_Total = function selectedCount_Total() {
  return this.selected_AND.length + this.selected_OR.length + this.selected_NOT.length;
};

FilterCategorical.prototype.selected_Any = function selected_Any() {
  return this.selected_AND.length > 0
    || this.selected_OR.length > 0
    || this.selected_NOT.length > 0;
};

FilterCategorical.prototype.selected_All_clear = function selected_All_clear() {
  kshf.Util.clearArray(this.selected_AND);
  kshf.Util.clearArray(this.selected_OR);
  kshf.Util.clearArray(this.selected_NOT);
};

FilterCategorical.prototype.onClear = function onClear() {
  const me = this.summary;
  me.missingValueAggr.filtered = false;
  me.clearCatTextSearch();
  me.unselectAllCategories();
  me._update_Selected();
};

FilterCategorical.prototype.onFilter = function onFilter() {
  const me = this.summary;
  // at least one category is selected in some modality (and/ or/ not)
  me._update_Selected();

  const nullOut = me.missingValueAggr.filtered === 'out';
  const nullIn = me.missingValueAggr.filtered === 'in';

  me.records.forEach(function (record) {
    const recordVal_s = record._valueCache[me.summaryID];
    if (nullIn) {
      record.setFilterCache(this.filterID, recordVal_s === null);
      return;
    }
    if (recordVal_s === null) {
      if (nullOut) {
        record.setFilterCache(this.filterID, false);
        return;
      }
      // survives if AND and OR is not selected
      record.setFilterCache(this.filterID,
        this.selected_AND.length === 0
        && this.selected_OR.length === 0);
      return;
    }

    // Check NOT selections - If any mapped record is NOT, return false
    // Note: no other filtering depends on NOT state.
    // This is for ,multi-level filtering using not query
    /*            if(this.selected_NOT.length>0){
        if(!recordVal_s.every(function(record){
            return !record.is_NOT() && record.isWanted;
        })){
            record.setFilterCache(this.filterID,false); return;
        }
    } */

    function getAggr(v) { return me.catTable_id[v]; }

    // If any of the record values are selected with NOT, the record will be removed
    if (this.selected_NOT.length > 0) {
      if (!recordVal_s.every(v => !getAggr(v).is_NOT())) {
        record.setFilterCache(this.filterID, false); return;
      }
    }
    // All AND selections must be among the record values
    if (this.selected_AND.length > 0) {
      let t = 0; // Compute the number of record values selected with AND.
      recordVal_s.forEach((v) => {
        if (getAggr(v).is_AND()) {
          t++;
        }
      });
      if (t !== this.selected_AND.length) {
        record.setFilterCache(this.filterID, false); return;
      }
    }
    // One of the OR selections must be among the record values
    if (this.selected_OR.length > 0) {
      record.setFilterCache(this.filterID, recordVal_s.some(v => (getAggr(v).is_OR())));
      return;
    }
    // only NOT selection
    record.setFilterCache(this.filterID, true);
  }, this);
};

FilterCategorical.prototype.filterView_Detail = function filterView_Detail() {
  const me = this.summary;
  if (me.missingValueAggr.filtered === 'in') {
    return kshf.lang.cur.NoData;
  }
  // 'this' is the Filter
  // go over all records and prepare the list
  let selectedItemsText = '';

  if (me.missingValueAggr.filtered === 'out') {
    selectedItemsText = kshf.lang.cur.ValidData;
  }

  const catTooltip = me.catTooltip;

  const totalSelectionCount = this.selectedCount_Total();

  const query_and = ` <span class='AndOrNot AndOrNot_And'>${kshf.lang.cur.And}</span> `;
  const query_or = ` <span class='AndOrNot AndOrNot_Or'>${kshf.lang.cur.Or}</span> `;
  const query_not = ` <span class='AndOrNot AndOrNot_Not'>${kshf.lang.cur.Not}</span> `;

  if (totalSelectionCount > 4) {
    selectedItemsText = `<b>${totalSelectionCount}</b> selected`;
    // Note: Using selected because selections can include not, or,and etc (a variety of things)
  } else {
    let selectedItemsCount = 0;

    // OR selections
    if (this.selected_OR.length > 0) {
      const useBracket_or = this.selected_AND.length > 0 || this.selected_NOT.length > 0;
      if (useBracket_or) selectedItemsText += '[';
      // X or Y or ....
      this.selected_OR.forEach((category, i) => {
        selectedItemsText += `${(i !== 0 || selectedItemsCount > 0) ? query_or : ''}<span class='attribName'>${
          me.catLabel_Func.call(category.data)}</span>`;
        selectedItemsCount++;
      });
      if (useBracket_or) selectedItemsText += ']';
    }
    // AND selections
    this.selected_AND.forEach((category, i) => {
      selectedItemsText += `${(selectedItemsText !== '') ? query_and : ''
      }<span class='attribName'>${me.catLabel_Func.call(category.data)}</span>`;
      selectedItemsCount++;
    });
    // NOT selections
    this.selected_NOT.forEach((category, i) => {
      selectedItemsText += `${query_not}<span class='attribName'>${me.catLabel_Func.call(category.data)}</span>`;
      selectedItemsCount++;
    });
  }
  return selectedItemsText;
};

export default FilterCategorical;
