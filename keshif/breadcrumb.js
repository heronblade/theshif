import Tipsy from './tipsy';
import kshf from './kshf';

function BreadCrumb(browser, selectType, _filter) {
  this.browser = browser;
  this.DOM = null;
  this.selectType = selectType;
  this.filter = _filter;
}

BreadCrumb.prototype.isCompareSelection = function isCompareSelection() {
  return this.selectType.substr(0, 7) === 'Compare';
};

BreadCrumb.prototype.showCrumb = function showCrumb(summary) {
  const _pre = this.browser.getHeight_PanelBasic();
  const _pre_ = parseInt(this.browser.DOM.panelsTop.style('margin-top'), 10);
  if (this.DOM === null) {
    this._insertDOM_crumb();
  }
  let details;
  if (this.selectType === 'Filter') {
    this.DOM.select('.crumbHeader').html(this.filter.getTitle());
    details = this.filter.filterView_Detail();
  } else {
    this.DOM.select('.crumbHeader').html(summary.summaryName);
    const selectedAggr = this.browser.selectedAggr[this.selectType];
    if (selectedAggr instanceof kshf.AggregateEmptyRecords) {
      details = kshf.lang.cur.NoData;
    } else if (summary.printAggrSelection) {
      details = summary.printAggrSelection(selectedAggr);
    } else {
      return;
    }
  }
  details = "" + details; // convert to string, in case the return value is a number...
  if (details) this.DOM.select('.crumbDetails').html(details.replace(/<br>/gi, ' '));

  if (this.selectType === 'Highlight') {
    const _post = this.browser.getHeight_PanelBasic();
    this.browser.DOM.panelsTop.style('margin-top', (_pre_+_pre-_post)+"px");
  } else {
    this.browser.DOM.panelsTop.style('margin-top', '0px');
  }
};

BreadCrumb.prototype.removeCrumb = function removeCrumb(noAnim) {
  if (this.DOM === null) return;
  const me = this;
  if (noAnim) {
    this.DOM.remove();
  } else {
    const _pre = this.browser.getHeight_PanelBasic();
    const _pre_ = parseInt(me.browser.DOM.panelsTop.style('margin-top'), 10);
    this.DOM.style('opacity', 0)
      .transition().delay(300).remove()
      .on('end', function() {
        const _post = me.browser.getHeight_PanelBasic();
        let v = _pre_+_pre-_post;
        if (me.selectType !== 'Highlight') {
          v = 0;
        }
        me.browser.DOM.panelsTop.style('margin-top', `${v}px`);
      });
  }
  this.DOM = null;
};

BreadCrumb.prototype._insertDOM_crumb = function _insertDOM_crumb() {
  const me = this;

  this.DOM = this.browser.DOM.breadcrumbs.append('span')
    .attr('class', `breadCrumb crumbMode_${this.selectType}`)
    .each(function() {
      if (me.selectType !== 'Highlight') {
        const l = this.parentNode.childNodes.length;
        if (l > 1) {
          this.parentNode.insertBefore(this, this.parentNode.childNodes[l - 2]);
        }
      }
      this.tipsy = new Tipsy(this, {
        gravity: 'n',
        title: function() {
          switch(me.selectType) {
            case 'Filter':
              return kshf.lang.cur.RemoveFilter;
            case 'Highlight':
              return 'Remove Highlight';
            default:
              return kshf.lang.cur.Unlock; // Compare_A, Compare_B, Compare_C
          }
        },
      });
    })
    .on('mouseenter', function() {
      this.tipsy.show();
      if (me.isCompareSelection()) {
        me.browser.refreshMeasureLabels(me.selectType);
      }
    })
    .on('mouseleave', function() {
      this.tipsy.hide();
      if (me.isCompareSelection()) {
        me.browser.refreshMeasureLabels('Active');
      }
    })
    .on('click', function() {
      this.tipsy.hide();
      if (me.selectType === 'Filter') {
        me.filter.clearFilter();
      } else if (me.selectType === 'Highlight') {
        me.browser.clearSelect_Highlight(true);
      } else {
        me.browser.clearSelect_Compare(me.selectType.substr(8));
        me.browser.refreshMeasureLabels('Active');
      }
    });

  this.DOM.append('span').attr('class', 'breadCrumbIcon fa');
  const y = this.DOM.append('span').attr('class', 'crumbText');
  y.append('span').attr('class', 'crumbHeader');
  y.append('span').attr('class', 'crumbDetails');

  this.DOM.style('opacity', 0).style('display', 'inline-block').transition().style('opacity', 1);

  // Push the save button to the end of list
  const dom = this.browser.DOM.saveSelection.node();
  dom.parentNode.appendChild(dom);
};

export default BreadCrumb;
