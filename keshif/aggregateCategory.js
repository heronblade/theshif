import Aggregate from './aggregate';

function AggregateCategory(summary, d, idIndex) {
  Aggregate.call(this, summary);

  // What this aggregate represents
  this.data = d;

  // Categories can be indexed
  this.idIndex = idIndex;

  // Selection state
  //  1: selected for inclusion (AND)
  //  2: selected for inclusion (OR)
  // -1: selected for removal (NOT query)
  //  0: not selected
  this.selected = 0;
}

AggregateCategory.prototype = Object.create(Aggregate.prototype);

AggregateCategory.prototype.id = function id() {
  return this.data[this.idIndex];
};

AggregateCategory.prototype.f_selected = function f_selected() {
  return this.selected !== 0;
};

AggregateCategory.prototype.f_included = function f_included() {
  return this.selected > 0;
};

AggregateCategory.prototype.is_NONE = function is_NONE() {
  return this.selected === 0;
};

AggregateCategory.prototype.is_NOT = function is_NOT() {
  return this.selected === -1;
};

AggregateCategory.prototype.is_AND = function is_AND() {
  return this.selected === 1;
};

AggregateCategory.prototype.is_OR = function is_OR() {
  return this.selected === 2;
};

AggregateCategory.prototype.set_NONE = function set_NONE() {
  if (this.inList !== undefined) {
    this.inList.splice(this.inList.indexOf(this), 1);
  }
  this.inList = undefined;
  this.selected = 0; this._refreshCatDOMSelected();
};

AggregateCategory.prototype.set_NOT = function set_NOT(l) {
  if (this.is_NOT()) {
    return;
  }
  this._insertToList(l);
  this.selected = -1;
  this._refreshCatDOMSelected();
};

AggregateCategory.prototype.set_AND = function set_AND(l) {
  if (this.is_AND()) {
    return;
  }
  this._insertToList(l);
  this.selected = 1;
  this._refreshCatDOMSelected();
};

AggregateCategory.prototype.set_OR = function set_OR(l) {
  if (this.is_OR()) {
    return;
  }
  this._insertToList(l);
  this.selected = 2;
  this._refreshCatDOMSelected();
};

AggregateCategory.prototype._insertToList = function _insertToList(l) {
  if (this.inList !== undefined) {
    this.inList.splice(this.inList.indexOf(this), 1);
  }
  this.inList = l;
  l.push(this);
};

AggregateCategory.prototype._refreshCatDOMSelected = function _refreshCatDOMSelected() {
  if (this.DOM.aggrGlyph) {
    if (this.selected === 0) {
      this.DOM.aggrGlyph.removeAttribute('cFiltered'); return;
    }
    let v = '?';
    switch (this.selected) {
      case 1: v = 'AND'; break;
      case 2: v = 'OR'; break;
      case -1:v = 'NOT'; break;
      default: break;
    }
    this.DOM.aggrGlyph.setAttribute('cFiltered', v);
  }
};

export default AggregateCategory;
