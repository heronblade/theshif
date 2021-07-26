import * as d3 from 'd3';
import kshf from './kshf';
import AggregateEmptyRecords from './aggregateEmptyRecords';
import SummarySet from './summarySet';
import Tipsy from './tipsy';

function SummaryBase() {

}

SummaryBase.prototype.initialize = function initialize(browser, name, attribFunc) {
  this.summaryID = browser.summaryCount++;
  this.browser = browser;

  this.summaryName = name;
  this.summaryColumn = attribFunc ? null : name;
  this.summaryFunc = attribFunc || function () { return this[name]; };

  this.missingValueAggr = new AggregateEmptyRecords(this);
  this.browser.allAggregates.push(this.missingValueAggr);

  this.DOM = { inited: false };

  if (SummarySet && this instanceof SummarySet) return;

  this.chartScale_Measure = d3.scaleLinear().clamp(true);
  this.chartScale_Measure_prev = d3.scaleLinear().clamp(true);

  this.records = this.browser.records;
  if (this.records === undefined || this.records === null || this.records.length === 0) {
    alert('Error: Browser.records is not defined...');
    return;
  }

  this.isRecordView = false;
  this.collapsed = false;
  this.aggr_initialized = false;

  this.createSummaryFilter();

  this.insertNugget();
};

SummaryBase.prototype.setSummaryName = function setSummaryName(name) {
  this.summaryName = name;
  // Refresh all the UI components which reflect summary name
  if (this.DOM.summaryName_text) {
    this.DOM.summaryName_text.html(this.summaryName);
  }
  if (this.summaryFilter.filterCrumb.DOM !== null) {
    this.summaryFilter.filterCrumb.DOM.select('.crumbHeader').html(this.summary.summaryName);
  }
  if (this.browser.recordDisplay) {
    if (this.sortingSummary) this.browser.recordDisplay.refreshSortingOptions();
  }
  if (this.isTextSearch) {
    this.browser.recordDisplay.DOM.recordTextSearch.select('input')
      .attr('placeholder', `${kshf.lang.cur.Search}: ${this.summaryName}`);
  }
  if (this.DOM.nugget) {
    this.DOM.nugget.select('.summaryName').html(this.summaryName);
    this.DOM.nugget.attr('state', (summary) => {
      if (summary.summaryColumn === null) return 'custom'; // calculated
      if (summary.summaryName === summary.summaryColumn) return 'exact';
      return 'edited';
    });
  }
};

SummaryBase.prototype.getDataType = function getDataType() {
  if (this.type === 'categorical') {
    var str = 'categorical';
    if (!this.aggr_initialized) return str += ' uninitialized';
    if (this.uniqueCategories()) str += ' unique';
    str += this.isMultiValued ? ' multivalue' : ' singlevalue';
    return str;
  }
  if (this.type === 'interval') {
    if (!this.aggr_initialized) return str += ' uninitialized';
    if (this.isTimeStamp()) return 'interval time';
    return 'interval numeric';
  }
  return '?';
};

SummaryBase.prototype.inBrowser = function inBrowser() {
  return this.panel !== undefined;
};

SummaryBase.prototype.isTimeStamp = function isTimeStamp() {
  return false; // False by default
};

SummaryBase.prototype.clearDOM = function clearDOM() {
  const dom = this.DOM.root.node();
  dom.parentNode.removeChild(dom);
};

SummaryBase.prototype.getWidth = function getWidth() {
  return this.panel.getWidth_Total();
};

SummaryBase.prototype.getHeight = function getHeight() {
  return this.getHeight_Header() + ((this.collapsed || this.isEmpty()) ? 0 : this.getHeight_Content());
};

SummaryBase.prototype.getHeight_Header = function getHeight_Header() {
  if (!this.DOM.inited) return 0;
  if (this._height_header == undefined) {
    this._height_header = this.DOM.headerGroup.node().offsetHeight;
  }
  return this._height_header;
};

SummaryBase.prototype.uniqueCategories = function uniqueCategories() {
  if (this.browser && this.browser.records[0].idIndex === this.summaryName) return true;
  return false;
};

SummaryBase.prototype.isFiltered = function isFiltered() {
  return this.summaryFilter.isFiltered;
};

SummaryBase.prototype.isEmpty = function isEmpty() {
  alert('Nope. Sth is wrong.'); // should not be executed
  return true;
};

SummaryBase.prototype.getFuncString = function getFuncString() {
  const str = this.summaryFunc.toString();
  // replace the beginning, and the end
  return str.replace(/function\s*\(\w*\)\s*{\s*/, '').replace(/}$/, '');
};

/** returns the maximum active aggregate value per row in chart data */
SummaryBase.prototype.getMaxAggr = function getMaxAggr(sType) {
  if (this._aggrs === undefined || this.isEmpty()) return 0;
  return d3.max(this._aggrs, (aggr) => { if (aggr.usedAggr) return aggr.measure(sType); }) || 1;
};

/** returns the maximum active aggregate value per row in chart data */
SummaryBase.prototype.getMinAggr = function getMinAggr(sType) {
  if (this._aggrs === undefined || this.isEmpty()) return 0;
  return d3.min(this._aggrs, (aggr) => { if (aggr.usedAggr) return aggr.measure(sType); });
};

SummaryBase.prototype.getMaxAggr_All = function getMaxAggr_All() {
  let maxMeasureValue = this.getMaxAggr('Active');
  if (this.browser.measureFunc === 'Avg') {
    // consider all selections
    ['Highlight', 'Compare_A', 'Compare_B', 'Compare_C'].forEach(function (sType) {
      if (!this.browser.vizActive[sType]) return;
      maxMeasureValue = Math.max(maxMeasureValue, this.getMaxAggr(sType));
    }, this);
  }
  return maxMeasureValue;
};

SummaryBase.prototype.getMinAggr_All = function getMinAggr_All() {
  let minMeasureValue = this.getMinAggr('Active');
  if (this.browser.measureFunc === 'Avg') {
    // consider all selections
    ['Highlight', 'Compare_A', 'Compare_B', 'Compare_C'].forEach(function (sType) {
      if (!this.browser.vizActive[sType]) return;
      minMeasureValue = Math.min(minMeasureValue, this.getMinAggr(sType));
    }, this);
  }
  return minMeasureValue;
};

SummaryBase.prototype.addToPanel = function addToPanel(panel, index) {
  if (index === undefined) index = panel.summaries.length; // add to end
  if (this.panel === undefined) {
    this.panel = panel;
  } else if (this.panel && this.panel !== panel) {
    this.panel.removeSummary(this);
    this.panel = panel;
  } else { // this.panel === panel
    let curIndex;
    // this.panel is the same as panel...
    this.panel.summaries.forEach(function (s, i) { if (s === this) curIndex = i; }, this);
    // inserting the summary to the same index as current one
    if (curIndex === index) return;
    const toRemove = this.panel.DOM.root.selectAll('.dropZone_between_wrapper')._groups[0][curIndex];
    toRemove.parentNode.removeChild(toRemove);
  }
  const beforeDOM = this.panel.DOM.root.selectAll('.dropZone_between_wrapper')._groups[0][index];
  if (this.DOM.root) {
    this.DOM.root.style('display', '');
    panel.DOM.root.node().insertBefore(this.DOM.root.node(), beforeDOM);
  } else {
    this.initDOM(beforeDOM);
  }
  panel.addSummary(this, index);
  this.panel.refreshDropZoneIndex();
  this.refreshThumbDisplay();

  if (this.type == 'categorical') {
    this.refreshLabelWidth();
  }
  if (this.type === 'interval') {
    if (this.browser.recordDisplay) { this.browser.recordDisplay.addSortingOption(this); }
  }
  this.refreshWidth();
  this.browser.refreshMeasureSelectAction();
};

SummaryBase.prototype.removeFromPanel = function removeFromPanel() {
  if (this.panel === undefined) return;
  this.panel.removeSummary(this);
  this.refreshThumbDisplay();
};

SummaryBase.prototype.destroy = function destroy() {
  this.browser.destroySummary(this);
  if (this.DOM.root) {
    this.DOM.root.node().parentNode.removeChild(this.DOM.root.node());
  }
  if (this.DOM.nugget) {
    this.DOM.nugget.node().parentNode.removeChild(this.DOM.nugget.node());
  }
};

SummaryBase.prototype.insertNugget = function insertNugget() {
  const me = this;
  if (this.DOM.nugget) return;
  this.attribMoved = false;

  this.DOM.nugget = this.browser.DOM.attributeList
    .append('div').attr('class', 'nugget')
    .each(function () { this.__data__ = me; })
    .attr('title', (this.summaryColumn !== undefined) ? this.summaryColumn : undefined)
    .attr('state', () => {
      if (me.summaryColumn === null) return 'custom'; // calculated
      if (me.summaryName === me.summaryColumn) return 'exact';
      return 'edited';
    })
    .attr('datatype', this.getDataType())
    .attr('aggr_initialized', this.aggr_initialized ? true : null)
    .on('dblclick', () => {
      me.browser.autoAddSummary(me);
      me.browser.updateLayout();
    })
    .on('mousedown', function () {
      if (d3.event.which !== 1) return; // only respond to left-click

      const _this = this;
      me.attribMoved = false;
      d3.select('body')
        .on('keydown.layout', () => {
          if (event.keyCode === 27) { // Escape key
            _this.removeAttribute('moved');
            me.browser.clearDropZones();
          }
        })
        .on('mousemove', () => {
          if (!me.attribMoved) {
            _this.setAttribute('moved', '');
            me.browser.prepareDropZones(me, 'attributePanel');
            me.attribMoved = true;
          }
          const mousePos = d3.mouse(me.browser.DOM.root.node());
          me.browser.DOM.attribDragBox.style('transform',
            `translate(${mousePos[0] - 20}px,${mousePos[1] + 5}px)`);
          d3.event.stopPropagation();
          d3.event.preventDefault();
        })
        .on('mouseup', () => {
          if (!me.attribMoved) return;
          _this.removeAttribute('moved');
          me.browser.DOM.root.attr('drag_cursor', null);
          me.browser.clearDropZones();
          d3.event.preventDefault();
        });
      d3.event.preventDefault();
    })
    .on('mouseup', () => {
      if (me.attribMoved === false) me.browser.unregisterBodyCallbacks();
    });

  this.DOM.nuggetViz = this.DOM.nugget.append('span').attr('class', 'nuggetViz')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity: 'e', title() { return (!me.aggr_initialized) ? 'Initialize' : me.getDataType(); },
      });
    })
    .on('mousedown', () => {
      if (!me.aggr_initialized) {
        d3.event.stopPropagation();
        d3.event.preventDefault();
      }
    })
    .on('click', () => {
      if (!me.aggr_initialized) me.initializeAggregates();
    });

  this.DOM.nuggetViz.append('span').attr('class', 'nuggetInfo fa');
  this.DOM.nuggetViz.append('span').attr('class', 'nuggetChart');

  this.DOM.nugget.append('span').attr('class', 'summaryName editableText')
    .attr('contenteditable', false)
    .html(this.summaryName)
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'w', title: kshf.lang.cur.EditTitle }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('mousedown', function () {
      this.tipsy.hide();

      const parentDOM = d3.select(this.parentNode);
      const summaryName = parentDOM.select('.summaryName');
      const summaryName_DOM = parentDOM.select('.summaryName').node();

      const curState = this.parentNode.getAttribute('edittitle');
      if (curState === null || curState === 'false') {
        this.parentNode.setAttribute('edittitle', true);
        summaryName_DOM.setAttribute('contenteditable', true);
        summaryName_DOM.focus();
      } else {
        /*
        this.parentNode.setAttribute("edittitle",false);
        summaryName_DOM.setAttribute("contenteditable",false);
        me.browser.changeSummaryName(me.summaryName,summaryName_DOM.textContent);
        */
      }
      // stop dragging event start
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('blur', function () {
      this.parentNode.setAttribute('edittitle', false);
      this.setAttribute('contenteditable', false);
      me.browser.changeSummaryName(me.summaryName, this.textContent);
      d3.event.preventDefault();
      d3.event.stopPropagation();
    })
    .on('keyup', () => { d3.event.stopPropagation(); })
    .on('keypress', () => { d3.event.stopPropagation(); })
    .on('keydown', function () {
      if (d3.event.keyCode === 13) { // ENTER
        this.parentNode.setAttribute('edittitle', false);
        this.setAttribute('contenteditable', false);
        me.browser.changeSummaryName(me.summaryName, this.textContent);
        d3.event.preventDefault();
      }
      d3.event.stopPropagation();
    });

  const X = this.DOM.nugget.append('div').attr('class', 'thumbIcons');

  X.append('div').attr('class', 'fa fa-code editCodeButton')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'w', title: kshf.lang.cur.EditFormula }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('mousedown', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('click', () => {
      var safeFunc,
        func = window.prompt('Specify the function:', me.getFuncString());
      if (func !== null) {
        var safeFunc;
        eval(`"use strict"; safeFunc = function(d){${func}}`);
        me.browser.createSummary(me.summaryName, safeFunc);
      }
      // stop dragging event start
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });

  X.append('div').attr('class', 'splitCatAttribute_Button fa fa-scissors')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'w', title: 'Split' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
      const catSplit = window.prompt('Split by text: (Ex: Splitting "A;B;C" by ";" will create 3 separate values: A,B,C', '');
      if (catSplit !== null) {
        me.setCatSplit(catSplit);
      }
    });

  X.append('div').attr('class', 'addFromAttribute_Button fa fa-plus-square')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity: 'w',
        title() {
          if (me.isMultiValued) return `Extract "# of${me.summaryName}"`;
          if (me.isTimeStamp()) {
            if (me.timeTyped.month && me.summary_sub_month === undefined) {
              return `Extract Month of ${me.summaryName}`;
            }
            if (me.timeTyped.day && me.summary_sub_day === undefined) {
              return `Extract WeekDay of ${me.summaryName}`;
            }
            if (me.timeTyped.hour && me.summary_sub_hour === undefined) {
              return `Extract Hour of ${me.summaryName}`;
            }
          }
          return '?';
        },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      d3.event.stopPropagation();
      d3.event.preventDefault();
      if (me.isMultiValued && !me.hasDegreeSummary) {
        me.createSetPairSummary();
        this.style.display = 'none';
        return;
      }
      if (me.isTimeStamp()) {
        if (me.timeTyped.month && me.summary_sub_month === undefined) {
          me.createMonthSummary();
        } else if (me.timeTyped.day && me.summary_sub_day === undefined) {
          me.createDaySummary();
        } else if (me.timeTyped.hour && me.summary_sub_hour === undefined) {
          me.createHourSummary();
        }
      }
    });

  this.refreshThumbDisplay();
  if (this.aggr_initialized) this.refreshViz_Nugget();
};

SummaryBase.prototype.createSetPairSummary = function createSetPairSummary() {
  const setpair_summary = this.browser.createSummary(
    `# of ${this.summaryName}`,
    function (d) {
      const arr = d._valueCache[this.summaryID];
      return (arr === null) ? null : arr.length;
    },
    'interval',
  );
  setpair_summary.initializeAggregates();
  this.hasDegreeSummary = true;
  this.style.display = 'none';
};

SummaryBase.prototype.refreshThumbDisplay = function refreshThumbDisplay() {
  if (this.DOM.nugget === undefined) return;
  const me = this;
  const nuggetHidden = (this.panel || this.isRecordView);
  if (nuggetHidden) {
    this.DOM.nugget.attr('anim', 'disappear');
    setTimeout(() => {
      me.DOM.nugget.attr('hidden', 'true');
    }, 700);
  } else {
    this.DOM.nugget.attr('hidden', false);
    setTimeout(() => {
      me.DOM.nugget.attr('anim', 'appear');
    }, 300);
  }
};

SummaryBase.prototype.insertRoot = function insertRoot(beforeDOM) {
  const me = this;
  this.DOM.root = this.panel.DOM.root.insert('div', () => beforeDOM);
  this.DOM.root
    .attr('class', 'kshfSummary')
    .attr('summary_id', this.summaryID) // can be used to customize a specific summary using CSS
    .each(function () { this.__data__ = me; });
};

SummaryBase.prototype.insertHeader = function insertHeader() {
  const me = this;

  this.DOM.headerGroup = this.DOM.root.append('div').attr('class', 'headerGroup')
    .on('mousedown', function () {
      if (d3.event.which !== 1) return; // only respond to left-click
      if (!me.browser.authoringMode) {
        d3.event.preventDefault();
        return;
      }
      const _this = this;
      const _this_nextSibling = _this.parentNode.nextSibling;
      const _this_previousSibling = _this.parentNode.previousSibling;
      let moved = false;
      d3.select('body')
        .style('cursor', 'move')
        .on('keydown.layout', () => {
          if (event.keyCode === 27) { // ESP key
            _this.style.opacity = null;
            me.browser.clearDropZones();
          }
        })
        .on('mousemove', () => {
          if (!moved) {
            _this_nextSibling.style.display = 'none';
            _this_previousSibling.style.display = 'none';
            _this.parentNode.style.opacity = 0.5;
            me.browser.prepareDropZones(me, 'browser');
            moved = true;
          }
          const mousePos = d3.mouse(me.browser.DOM.root.node());
          me.browser.DOM.attribDragBox.style('transform',
            `translate(${mousePos[0] - 20}px,${mousePos[1] + 5}px)`);
          d3.event.stopPropagation();
          d3.event.preventDefault();
        })
        .on('mouseup', () => {
          d3.select('body').style('cursor', null);
          // Mouse up on the body
          me.browser.clearDropZones();
          if (me.panel !== undefined || true) {
            _this.parentNode.style.opacity = null;
            _this_nextSibling.style.display = '';
            _this_previousSibling.style.display = '';
          }
          d3.event.preventDefault();
        });
      d3.event.preventDefault();
    });

  const header_display_control = this.DOM.headerGroup.append('span').attr('class', 'header_display_control');

  this.DOM.buttonSummaryRemove = header_display_control.append('span')
    .attr('class', 'buttonSummaryRemove fa fa-times-circle-o')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity() { return me.panelOrder !== 0 ? 'sw' : 'nw'; }, title: kshf.lang.cur.RemoveSummary,
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      me.removeFromPanel();
      me.clearDOM();
      me.browser.updateLayout();
    });

  this.DOM.buttonSummaryCollapse = header_display_control.append('span')
    .attr('class', 'buttonSummaryCollapse fa fa-compress')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity() { return me.panelOrder !== 0 ? 'sw' : 'nw'; },
        title: kshf.lang.cur.MinimizeSummary,
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      if (me instanceof SummarySet) {
        me.setListSummary.setShowSetMatrix(false);
      } else {
        me.setCollapsedAndLayout(true);
      }
    });

  this.DOM.buttonSummaryOpen = header_display_control.append('span')
    .attr('class', 'buttonSummaryOpen fa fa-expand')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity() { return me.panelOrder !== 0 ? 'sw' : 'nw'; },
        title: kshf.lang.cur.OpenSummary,
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      if (me instanceof SummarySet) {
        // me.setListSummary.setShowSetMatrix(false);
      } else {
        me.setCollapsedAndLayout(false);
      }
    });

  this.DOM.buttonSummaryExpand = header_display_control.append('span')
    .attr('class', 'buttonSummaryExpand fa fa-arrows-alt')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity() { return me.panelOrder !== 0 ? 'sw' : 'nw'; }, title: kshf.lang.cur.MaximizeSummary,
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      me.panel.collapseAllSummaries(me);
      me.browser.updateLayout_Height();
    });

  this.DOM.summaryName = this.DOM.headerGroup.append('span')
    .attr('class', 'summaryName')
    .attr('edittitle', false)
    .on('click', () => { if (me.collapsed) me.setCollapsedAndLayout(false); });

  this.DOM.clearFilterButton = this.DOM.summaryName.append('div')
    .attr('class', 'clearFilterButton fa')
    .each(function (d) { this.tipsy = new Tipsy(this, { gravity: 'e', title: kshf.lang.cur.RemoveFilter }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.summaryFilter.clearFilter(); });

  this.DOM.summaryName_text = this.DOM.summaryName.append('span').attr('class', 'summaryName_text editableText')
    .attr('contenteditable', false)
    .each(function (summary) { this.tipsy = new Tipsy(this, { gravity: 'w', title: kshf.lang.cur.EditTitle }); })
    .on('mouseenter', function () {
      if (!me.browser.authoringMode) return;
      this.tipsy.show();
    })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('mousedown', () => {
      // stop dragging event start
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('click', function () {
      if (!me.browser.authoringMode) return;
      const curState = this.parentNode.getAttribute('edittitle');
      if (curState === null || curState === 'false') {
        this.parentNode.setAttribute('edittitle', true);
        var parentDOM = d3.select(this.parentNode);
        var v = parentDOM.select('.summaryName_text').node();
        v.setAttribute('contenteditable', true);
        v.focus();
      } else {
        this.parentNode.setAttribute('edittitle', false);
        var parentDOM = d3.select(this.parentNode);
        var v = parentDOM.select('.summaryName_text').node();
        v.setAttribute('contenteditable', false);
        me.browser.changeSummaryName(me.summaryName, v.textContent);
      }
    })
    .on('blur', function () {
      this.parentNode.setAttribute('edittitle', false);
      this.setAttribute('contenteditable', false);
      me.browser.changeSummaryName(me.summaryName, this.textContent);
    })
    .on('keydown', function () {
      if (event.keyCode === 13) { // ENTER
        this.parentNode.setAttribute('edittitle', false);
        this.setAttribute('contenteditable', false);
        me.browser.changeSummaryName(me.summaryName, this.textContent);
      }
    })
    .html(this.summaryName);

  this.DOM.summaryIcons = this.DOM.headerGroup.append('span').attr('class', 'summaryIcons');

  this.DOM.summaryConfigControl = this.DOM.summaryIcons.append('span')
    .attr('class', 'summaryConfigControl fa fa-gear')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'ne', title: 'Configure' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      const open = me.DOM.root.attr('showConfig') === null;
      if (open) {
        if (me.browser.summaryWithOpenConfig) {
          // Close the open summary
          me.browser.summaryWithOpenConfig.DOM.root.attr('showConfig', null);
        }
        me.browser.summaryWithOpenConfig = me;
      } else {
        me.browser.summaryWithOpenConfig = undefined;
      }
      me.DOM.root.attr('showConfig', open ? true : null);
    });

  this.DOM.summaryIcons.append('span').attr('class', 'setMatrixButton fa fa-tags')
    .each(function (d) {
      this.tipsy = new Tipsy(this, {
        gravity: 'ne',
        title() { return `${!me.show_set_matrix ? 'Show' : 'Hide'} pair-wise relations`; },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.setShowSetMatrix(!me.show_set_matrix); });

  // These shouldn't be visible if there is not active record display.
  this.DOM.summaryIcons.selectAll('.encodeRecordButton').data(['sort', 'scatter', 'color'])
    .enter()
    .append('span')
    .attr('class', 'encodeRecordButton fa')
    .attr('encodingType', t => t)
    .each(function (t) {
      this.tipsy = new Tipsy(this, {
        gravity: 'ne', title() { return `Use to ${t} ${me.browser.recordName}`; },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function (t) {
      this.tipsy.hide();
      const recDisplay = me.browser.recordDisplay;
      if (t === 'scatter') {
        recDisplay.setScatterAttrib(me);
      } else {
        recDisplay.setSortAttrib(me);
        recDisplay.refreshSortingOptions();
      }
    });

  this.DOM.summaryIcons.append('span')
    .attr('class', 'summaryViewAs_Map fa fa-globe')
    .attr('viewAs', 'map')
    .each(function (d) {
      this.tipsy = new Tipsy(this, { gravity: 'ne', title() { return 'View as Map'; } });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.viewAs('map'); });

  this.DOM.summaryIcons.append('span')
    .attr('class', 'summaryViewAs_List fa fa-list-ul')
    .attr('viewAs', 'map')
    .each(function (d) {
      this.tipsy = new Tipsy(this, { gravity: 'ne', title() { return 'View as List'; } });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.viewAs('list'); });

  this.DOM.summaryDescription = this.DOM.summaryIcons.append('span')
    .attr('class', 'summaryDescription fa fa-info')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'ne', title() { return me.description; } }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); });
  this.setDescription(this.description);

  this.DOM.summaryConfig = this.DOM.root.append('div').attr('class', 'summaryConfig');
  this.DOM.wrapper = this.DOM.root.append('div').attr('class', 'wrapper');

  this.insertDOM_EmptyAggr();
};

SummaryBase.prototype.setDescription = function setDescription(description) {
  this.description = description;
  if (this.DOM.summaryDescription === undefined) return;
  this.DOM.summaryDescription.style('display', this.description === undefined ? null : 'inline-block');
};
/** -- Shared - Summary Base -- */
SummaryBase.prototype.insertChartAxis_Measure = function insertChartAxis_Measure(dom, pos1, pos2) {
  const me = this;
  this.DOM.chartAxis_Measure = dom.append('div').attr('class', 'chartAxis_Measure');
  this.DOM.measurePercentControl = this.DOM.chartAxis_Measure.append('span').attr('class', 'measurePercentControl')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity: pos1,
        title() {
          return `Label as ${kshf.lang.cur[(me.browser.percentModeActive ? 'Absolute' : 'Percent')]}`;
        },
      });
    })
    .on('click', function () { this.tipsy.hide(); me.browser.setPercentLabelMode(!me.browser.percentModeActive); })
    .on('mouseenter', function () { this.tipsy.show(); me.browser.DOM.root.attr('measurePercentControl', true); })
    .on('mouseleave', function () { this.tipsy.hide(); me.browser.DOM.root.attr('measurePercentControl', null); });

  // Two controls, one for each side of the scale
  this.DOM.scaleModeControl = this.DOM.chartAxis_Measure.selectAll('.scaleModeControl').data(['1', '2'])
    .enter().append('span')
    .attr('class', d => `scaleModeControl measureAxis_${d}`)
    .each(function (d) {
      let pos = pos2;
      if (pos2 === 'nw' && d === '2') pos = 'ne';
      this.tipsy = new Tipsy(this, {
        gravity: pos,
        title() {
          return `${kshf.lang.cur[me.browser.ratioModeActive ? 'AbsoluteSize' : 'PartOfSize']
          } <span class='fa fa-arrows-h'></span>`;
        },
      });
    })
    .on('click', function () { this.tipsy.hide(); me.browser.setScaleMode(!me.browser.ratioModeActive); })
    .on('mouseenter', function () { this.tipsy.show(); me.browser.showScaleModeControls(true); })
    .on('mouseleave', function () { this.tipsy.hide(); me.browser.showScaleModeControls(false); });

  this.DOM.chartAxis_Measure_TickGroup = this.DOM.chartAxis_Measure.append('div').attr('class', 'tickGroup');

  this.DOM.highlightedMeasureValue = this.DOM.chartAxis_Measure.append('div').attr('class', 'highlightedMeasureValue longRefLine');
  this.DOM.highlightedMeasureValue.append('div').attr('class', 'fa fa-mouse-pointer highlightedAggrValuePointer');
};

SummaryBase.prototype.setCollapsedAndLayout = function setCollapsedAndLayout(collapsed) {
  this.setCollapsed(collapsed);
  this.browser.updateLayout_Height();
};

SummaryBase.prototype.setCollapsed = function setCollapsed(collapsed) {
  this.collapsed = collapsed;
  if (this.DOM.root) {
    this.DOM.root
      .attr('collapsed', this.collapsed ? true : null)
      .attr('showConfig', null);
    if (!this.collapsed) {
      this.refreshViz_All();
      this.refreshMeasureLabel();
    }
  }
  if (this.setSummary) {
    this.setShowSetMatrix(false);
  }
};

SummaryBase.prototype.refreshViz_All = function refreshViz_All() {
  if (this.isEmpty() || this.collapsed || !this.inBrowser()) return;
  this.refreshViz_Total();
  this.refreshViz_Active();
  this.refreshViz_Highlight();
  this.refreshViz_Compare_All();
  this.refreshViz_Axis();
};

SummaryBase.prototype.insertDOM_EmptyAggr = function insertDOM_EmptyAggr() {
  const me = this;
  this.DOM.missingValueAggr = this.DOM.wrapper.append('span').attr('class', 'missingValueAggr aggrGlyph fa fa-ban')
    .each(function () {
      me.missingValueAggr.DOM.aggrGlyph = this;
      this.tipsy = new Tipsy(this, { gravity: 'w',
        title() {
          const x = me.browser.getMeasureLabel(me.missingValueAggr, me);
          // TODO: Number should depend on filtering state, and also reflect percentage-mode
          return `<b>${x}</b> ${me.browser.getMeasureFuncTypeText()}${me.browser.recordName} ${kshf.lang.cur.NoData}`;
        } });
    })
    .on('mouseover', function () {
      this.tipsy.show();
      me.browser.setSelect_Highlight(me.missingValueAggr);
    })
    .on('mouseout', function () {
      this.tipsy.hide();
      me.browser.clearSelect_Highlight();
    })
    .on('click', function () {
      if (d3.event.altKey) {
        me.missingValueAggr.filtered = 'out';
        me.summaryFilter.addFilter();
        return;
      }
      if (d3.event.shiftKey) {
        me.browser.setSelect_Compare(true);
        return;
      }
      if (me.summaryFilter.isFiltered) {
        if (me.missingValueAggr.filtered) {
          me.summaryFilter.clearFilter();
        } else {
          me.summaryFilter.clearFilter();
          me.missingValueAggr.filtered = 'in';
          me.summaryFilter.how = 'All';
          me.summaryFilter.addFilter();
        }
      } else {
        me.missingValueAggr.filtered = 'in';
        me.summaryFilter.how = 'All';
        me.summaryFilter.addFilter();
      }
      d3.select(this).classed('filtered', me.missingValueAggr.filtered);
    });
};

SummaryBase.prototype.refreshViz_EmptyRecords = function refreshViz_EmptyRecords() {
  if (!this.DOM.missingValueAggr) return;
  const me = this;
  const interp = d3.interpolateHsl(d3.rgb(211, 211, 211), d3.rgb(255, 69, 0));

  this.DOM.missingValueAggr
    .style('display', this.missingValueAggr.recCnt.Active > 0 ? 'block' : 'none')
    .style('color', () => {
      if (me.missingValueAggr.recCnt.Active === 0) return;
      return interp(me.missingValueAggr.ratioHighlightToActive());
    });
};

SummaryBase.prototype.refreshViz_Compare_All = function refreshViz_Compare_All() {
  let totalC = this.browser.getActiveCompareSelCount();
  if (totalC === 0) return;
  totalC++; // 1 more for highlight
  if (this.browser.measureFunc === 'Avg') totalC++;
  let activeNum = totalC - 2;
  if (this.browser.vizActive.Compare_A) {
    this.refreshViz_Compare('A', activeNum, totalC);
    activeNum--;
  }
  if (this.browser.vizActive.Compare_B) {
    this.refreshViz_Compare('B', activeNum, totalC);
    activeNum--;
  }
  if (this.browser.vizActive.Compare_C) {
    this.refreshViz_Compare('C', activeNum, totalC);
    activeNum--;
  }
};

SummaryBase.prototype.exportConfig = function exportConfig() {
  const config = {
    name: this.summaryName,
    panel: this.panel.name,
  };
  // config.value
  if (this.summaryColumn !== this.summaryName) {
    config.value = this.summaryColumn;
    if (config.value === null) {
      // custom function
      config.value = this.summaryFunc.toString(); // if it is function, converts it to string representation
    }
  }
  if (this.collapsed) config.collapsed = true;
  if (this.description) config.description = this.description;
  if (this.catLabel_attr) { // Indexed string
    if (this.catLabel_attr !== 'id') config.catLabel = this.catLabel_attr;
  } else if (this.catLabel_table) { // Lookup table
    config.catLabel = this.catLabel_table;
  } else if (this.catLabel_Func) {
    config.catLabel = this.catLabel_Func.toString(); // Function to string
  }
  if (this.minAggrValue > 1) config.minAggrValue = this.minAggrValue;
  if (this.unitName) config.unitName = this.unitName;
  if (this.scaleType_locked) config.intervalScale = this.scaleType_locked;
  if (this.percentileChartVisible) config.showPercentile = this.percentileChartVisible;
  // catSortBy
  if (this.catSortBy) {
    const _sortBy = this.catSortBy[0];
    if (_sortBy.sortKey) {
      config.catSortBy = _sortBy.sortKey; // string or lookup table
    } else if (_sortBy.value) {
      config.catSortBy = _sortBy.value.toString();
    }
    // TODO: support 'inverse' option
  }
  if (this.catTableName_custom) {
    config.catTableName = this.catTableName;
  }
  if (this.catSplit) {
    config.catSplit = this.catSplit;
  }
  if (this.viewType) {
    if (this.viewType === 'map') config.viewAs = this.viewType;
  }
  if (this.heightCat !== kshf.catHeight) {
    config.catHeight = this.heightCat;
  }
  return config;
};

SummaryBase.prototype.refreshMeasureLabel = function refreshMeasureLabel() {
  if (this.isEmpty() || this.collapsed || !this.inBrowser() || this.DOM.measureLabel === undefined) return;
  const me = this;
  this.DOM.measureLabel.html(aggr => me.browser.getMeasureLabel(aggr, me));
};

export default SummaryBase;
