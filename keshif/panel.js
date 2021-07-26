import * as d3 from 'd3';
import kshf from './kshf';
import SummaryCategorical from './summaryCategorical';

function Panel(options) {
  this.browser = options.browser;
  this.name = options.name;
  this.width_catLabel = options.width_catLabel;
  this.width_catBars = 0; // placeholder
  this.width_catMeasureLabel = 1; // placeholder
  this.summaries = [];

  this.DOM = {};
  this.DOM.root = options.parentDOM.append('div')
    .attr('hasSummaries', false)
    .attr('class', `panel panel_${options.name
    }${(options.name === 'left' || options.name === 'right') ? ' panel_side' : ''}`);
  this.initDOM_AdjustWidth();
  this.initDOM_DropZone();
}

Panel.prototype.getWidth_Total = function getWidth_Total() {
  if (this.name === 'bottom') {
    let w = this.browser.getWidth_Total();
    if (this.browser.authoringMode) {
      w -= kshf.attribPanelWidth;
    }
    return w;
  }
  return this.width_catLabel + this.width_catMeasureLabel + this.width_catBars + kshf.scrollWidth;
};

Panel.prototype.addSummary = function addSummary(summary, index) {
  let curIndex = -1;
  this.summaries.forEach((s, i) => { if (s === summary) curIndex = i; });
  if (curIndex === -1) { // summary is new to this panel
    if (index === this.summaries.length) { this.summaries.push(summary); } else { this.summaries.splice(index, 0, summary); }
    this.DOM.root.attr('hasSummaries', true);
    if (summary instanceof SummaryCategorical) { this.updateWidth_MeasureLabel(); }
  } else { // summary was in the panel. Change position
    this.summaries.splice(curIndex, 1);
    this.summaries.splice(index, 0, summary);
  }
  this.summaries.forEach((s, i) => { s.panelOrder = i; });
  this.addDOM_DropZone(summary.DOM.root.node());
  this.refreshAdjustWidth();
};

Panel.prototype.removeSummary = function removeSummary(summary) {
  let indexFrom = -1;
  this.summaries.forEach((s, i) => { if (s === summary) indexFrom = i; });
  if (indexFrom === -1) return; // given summary is not within this panel

  const toRemove = this.DOM.root.selectAll('.dropZone_between_wrapper').nodes()[indexFrom];
  toRemove.parentNode.removeChild(toRemove);

  this.summaries.splice(indexFrom, 1);
  this.summaries.forEach((s, i) => { s.panelOrder = i; });
  this.refreshDropZoneIndex();

  if (this.summaries.length === 0) {
    this.DOM.root.attr('hasSummaries', false);
  } else {
    this.updateWidth_MeasureLabel();
  }
  summary.panel = undefined;
  this.refreshAdjustWidth();
};

Panel.prototype.addDOM_DropZone = function addDOM_DropZone(beforeDOM) {
  const me = this;
  let zone;
  if (beforeDOM) {
    zone = this.DOM.root.insert('div', () => beforeDOM);
  } else {
    zone = this.DOM.root.append('div');
  }
  zone.attr('class', 'dropZone_between_wrapper')
    .on('mouseenter', function () {
      this.setAttribute('hovered', true);
      this.children[0].setAttribute('readyToDrop', true);
    })
    .on('mouseleave', function () {
      this.setAttribute('hovered', false);
      this.children[0].setAttribute('readyToDrop', false);
    })
    .on('mouseup', function () {
      const movedSummary = me.browser.movedSummary;
      if (movedSummary.panel) { // if the summary was in the panels already
        movedSummary.DOM.root.node().nextSibling.style.display = '';
        movedSummary.DOM.root.node().previousSibling.style.display = '';
      }

      movedSummary.addToPanel(me, this.__data__);

      me.browser.updateLayout();
    })
  ;

  const zone2 = zone.append('div').attr('class', 'dropZone dropZone_summary dropZone_between');
  zone2.append('div').attr('class', 'dropIcon fa fa-angle-double-down');
  zone2.append('div').attr('class', 'dropText').text('Drop summary');

  this.refreshDropZoneIndex();
};

Panel.prototype.initDOM_DropZone = function initDOM_DropZone(dom) {
  const me = this;
  this.DOM.dropZone_Panel = this.DOM.root.append('div').attr('class', 'dropZone dropZone_summary dropZone_panel')
    .attr('readyToDrop', false)
    .on('mouseenter', function (event) {
      this.setAttribute('readyToDrop', true);
      this.style.width = `${me.getWidth_Total()}px`;
    })
    .on('mouseleave', function (event) {
      this.setAttribute('readyToDrop', false);
      this.style.width = null;
    })
    .on('mouseup', (event) => {
      // If this panel has summaries within, dropping makes no difference.
      if (me.summaries.length !== 0) return;
      const movedSummary = me.browser.movedSummary;
      if (movedSummary === undefined) return;
      if (movedSummary.panel) { // if the summary was in the panels already
        movedSummary.DOM.root.node().nextSibling.style.display = '';
        movedSummary.DOM.root.node().previousSibling.style.display = '';
      }
      movedSummary.addToPanel(me);
      me.browser.updateLayout();
    });
  this.DOM.dropZone_Panel.append('span').attr('class', 'dropIcon fa fa-angle-double-down');
  this.DOM.dropZone_Panel.append('div').attr('class', 'dropText').text('Drop summary');

  this.addDOM_DropZone();
};

Panel.prototype.initDOM_AdjustWidth = function initDOM_AdjustWidth() {
  if (this.name === 'middle' || this.name === 'bottom') return; // cannot have adjust handles for now
  const me = this;
  const root = this.browser.DOM.root;
  this.DOM.panelAdjustWidth = this.DOM.root.append('span')
    .attr('class', 'panelAdjustWidth')
    .on('mousedown', function (d, i) {
      if (d3.event.which !== 1) return; // only respond to left-click
      const adjustDOM = this;
      adjustDOM.setAttribute('dragging', '');
      root.style('cursor', 'ew-resize');
      me.browser.DOM.pointerBlock.attr('active', '');
      me.browser.setNoAnim(true);
      const mouseDown_x = d3.mouse(document.body)[0];
      const mouseDown_width = me.width_catBars;
      d3.select('body').on('mousemove', () => {
        const mouseMove_x = d3.mouse(document.body)[0];
        let mouseDif = mouseMove_x - mouseDown_x;
        if (me.name === 'right') mouseDif *= -1;
        const oldhideBarAxis = me.hideBarAxis;
        me.setWidthCatBars(mouseDown_width + mouseDif);
        me.browser.updateMiddlePanelWidth();
        if (me.hideBarAxis !== oldhideBarAxis) {
          me.browser.updateLayout_Height();
        }
        // TODO: Adjust other panel widths
      }).on('mouseup', () => {
        adjustDOM.removeAttribute('dragging');
        root.style('cursor', 'default');
        me.browser.DOM.pointerBlock.attr('active', null);
        me.browser.setNoAnim(false);
        // unregister mouse-move callbacks
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
    })
    .on('click', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });
};

Panel.prototype.refreshDropZoneIndex = function refreshDropZoneIndex() {
  const me = this;
  this.DOM.root.selectAll('.dropZone_between_wrapper')
    .attr('panel_index', function (d, i) {
      this.__data__ = i;
      if (i === 0) return 'first';
      if (i === me.summaries.length) return 'last';
      return 'middle';
    });
};

Panel.prototype.refreshAdjustWidth = function refreshAdjustWidth() {
  if (this.name === 'middle' || this.name === 'bottom') return; // cannot have adjust handles for now
  this.DOM.panelAdjustWidth.style('opacity', (this.summaries.length > 0) ? 1 : 0);
};

Panel.prototype.setTotalWidth = function setTotalWidth(_w_) {
  this.width_catBars = _w_ - this.width_catLabel - this.width_catMeasureLabel - kshf.scrollWidth;
};

Panel.prototype.collapseAllSummaries = function collapseAllSummaries(exceptThisOne) {
  this.summaries.forEach((summary) => { if (summary !== exceptThisOne) summary.setCollapsed(true); });
};

Panel.prototype.setWidthCatLabel = function setWidthCatLabel(_w_) {
  _w_ = Math.max(90, _w_); // use at least 90 pixels for the category label.
  if (_w_ === this.width_catLabel) return;
  const widthDif = this.width_catLabel - _w_;
  this.width_catLabel = _w_;
  this.summaries.forEach((summary) => {
    if (summary instanceof SummaryCategorical) { summary.refreshLabelWidth(); }
  });
  this.setWidthCatBars(this.width_catBars + widthDif);
};

Panel.prototype.setWidthCatBars = function setWidthCatBars(_w_, up) {
  _w_ = Math.max(_w_, 0);
  this.width_catBars = _w_;
  this.hideBarAxis = _w_ <= 20;

  this.DOM.root
    .attr('hideBars', _w_ <= 5 ? true : null)
    .attr('hideBarAxis', this.hideBarAxis ? true : null);
  this.updateSummariesWidth(up);
};

Panel.prototype.updateSummariesWidth = function updateSummariesWidth(up) {
  this.summaries.forEach((summary) => {
    if (up && !(summary instanceof SummaryCategorical)) return;
    summary.refreshWidth();
  });
};

Panel.prototype.updateWidth_MeasureLabel = function updateWidth_MeasureLabel() {
  let maxTotalCount = d3.max(this.summaries, (summary) => {
    if (summary.type !== 'categorical') return 0; // only align categorical summaries
    if (summary.getMaxAggr === undefined) return 0;
    return summary.getMaxAggr('Total');
  });

  if (maxTotalCount === 0) {
    this.width_catMeasureLabel = 0;
    return;
  }

  const _w_total_ = this.getWidth_Total();

  const width_old = this.width_catMeasureLabel;

  this.width_catMeasureLabel = 10;
  // compute number of digits
  let digits = 1;
  while (maxTotalCount > 9) { digits++; maxTotalCount = Math.floor(maxTotalCount / 10); }
  if (digits > 3) {
    digits = 2;
    this.width_catMeasureLabel += 4; // "." character is used to split. It takes some space
  }
  this.width_catMeasureLabel += digits * 6;

  // TODO: Account for the unitName displayed
  if (this.browser.measureFunc !== 'Count' && this.browser.measureSummary) {
    if (this.browser.measureSummary.unitName) {
      // TODO: Use the rendered width, instead of 7
      const unitNameWidth = 2 + this.browser.measureSummary.unitName.length * 7;
      this.width_catMeasureLabel += unitNameWidth;
    }
  }

  if (width_old !== this.width_catMeasureLabel) {
    this.summaries.forEach((summary) => {
      if (summary instanceof SummaryCategorical) summary.refreshLabelWidth();
    });
    const v = _w_total_ - this.width_catLabel - this.width_catMeasureLabel - kshf.scrollWidth;
    this.setWidthCatBars(v, true); // should not update interval summary width
  }
};

export default Panel;
