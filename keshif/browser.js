import * as d3 from 'd3';
import axios from 'axios';
import kshf from './kshf';
import BreadCrumb from './breadcrumb';
import Tipsy from './tipsy';
import Panel from './panel';
import Record from './record';
import RecordDisplay from './recordDisplay';
import Aggregate from './aggregate';
import Aggregate_Category from './aggregateCategory';
import SummaryCategorical from './summaryCategorical';
import SummaryInterval from './summaryInterval';
import FilterCategorical from './filterCategorical';
import Filter_Interval from './filterInterval';
import FilterText from './filterText';
import FilterSpatial from './filterSpatial';

function Browser(options) {
  this.options = options;

  if (kshf.lang.cur === null) {
    kshf.lang.cur = kshf.lang.en; // English is Default language
  }

  // BASIC OPTIONS
  this.summaryCount = 0;
  this.filterCount = 0;
  this.summaries = [];
  this.summaries_by_name = {};
  this.panels = {};

  this.filters = [];

  this.authoringMode = false;

  this.ratioModeActive = false;
  this.percentModeActive = false;
  this.isFullscreen = false;

  this.showDropZones = false;
  this.asyncDataLoadedCnt = 0;
  this.asyncDataWaitedCnt = 0;

  this.mapColorTheme = 'converge';
  this.measureFunc = 'Count';

  this.mouseSpeed = 0; // includes touch-screens...

  this.noAnim = false;

  this.measureLabelType = 'Active';

  this.domID = options.domID;

  this.thumbvizSortFunction = function (summary_A, summary_B) {
    const a_cat = summary_A instanceof SummaryCategorical;
    const b_cat = summary_B instanceof SummaryCategorical;
    if (a_cat && !b_cat) return -1;
    if (!a_cat && b_cat) return 1;
    if (a_cat && b_cat && summary_A._aggrs && summary_B._aggrs) {
      return summary_A._aggrs.length - summary_B._aggrs.length;
    }
    return summary_A.summaryName.localeCompare(summary_B.summaryName, { sensitivity: 'base' });
  };

  this.vizActive = {
    Highlight: false,
    Compare_A: false,
    Compare_B: false,
    Compare_C: false,
  };

  this.selectedAggr = {
    Highlight: null,
    Compare_A: null,
    Compare_B: null,
    Compare_C: null,
  };

  this.highlightSelectedSummary = null;
  this.highlightCrumbTimeout_Hide = undefined;

  // this.crumb_Highlight = new kshf.BreadCrumb(this,"Highlight");
  // this.crumb_Compare_A = new kshf.BreadCrumb(this,"Compare_A");
  // this.crumb_Compare_B = new kshf.BreadCrumb(this,"Compare_B");
  // this.crumb_Compare_C = new kshf.BreadCrumb(this,"Compare_C");
  this.crumb_Highlight = new BreadCrumb(this, 'Highlight');
  this.crumb_Compare_A = new BreadCrumb(this, 'Compare_A');
  this.crumb_Compare_B = new BreadCrumb(this, 'Compare_B');
  this.crumb_Compare_C = new BreadCrumb(this, 'Compare_C');

  this.allRecordsAggr = new Aggregate();
  this.flexAggr_Highlight = new Aggregate();
  this.flexAggr_Compare_A = new Aggregate();
  this.flexAggr_Compare_B = new Aggregate();
  this.flexAggr_Compare_C = new Aggregate();

  this.allAggregates = [];
  this.allAggregates.push(this.allRecordsAggr);

  // Callbacks
  this.onReady = options.onReady || options.readyCb;
  if (typeof this.onReady === 'string' && this.onReady.substr(0, 8) === 'function') {
    eval(`"use strict"; this.onReady = ${this.onReady}`);
  }

  this.onLoad = options.onLoad || options.loadedCb;
  if (typeof this.onLoad === 'string' && this.onLoad.substr(0, 8) === 'function') {
    eval(`"use strict"; this.onLoad = ${this.onLoad}`);
  }

  this.preview_not = false;

  this.recordName = options.itemName || options.recordName || '';
  if (options.itemDisplay) options.recordDisplay = options.itemDisplay;

  if (typeof this.options.enableAuthoring === 'undefined') this.options.enableAuthoring = false;

  const me = this;
  this.DOM = {};
  this.DOM.root = d3.select(this.domID)
    .classed('kshf', true)
    .attr('noanim', true)
    .attr('measureFunc', this.measureFunc)
    .attr('pointerEvents', true)
    .style('position', 'relative')
    .on('mousemove', (d, e) => {
      // Compute mouse moving speed, to adjust repsonsiveness
      if (me.lastMouseMoveEvent === undefined) {
        me.lastMouseMoveEvent = d3.event;
        return;
      }
      const timeDif = d3.event.timeStamp - me.lastMouseMoveEvent.timeStamp;
      if (timeDif === 0) return;

      const xDif = Math.abs(d3.event.x - me.lastMouseMoveEvent.x);
      const yDif = Math.abs(d3.event.y - me.lastMouseMoveEvent.y);
      // controls highlight selection delay
      me.mouseSpeed = Math.min(Math.sqrt(xDif * xDif + yDif * yDif) / timeDif, 2);

      me.lastMouseMoveEvent = d3.event;
    });

  // remove any DOM elements under this domID, kshf takes complete control over what's inside
  const rootDomNode = this.DOM.root.node();
  while (rootDomNode.hasChildNodes()) rootDomNode.removeChild(rootDomNode.lastChild);

  this.DOM.pointerBlock = this.DOM.root.append('div').attr('class', 'pointerBlock');
  this.DOM.attribDragBox = this.DOM.root.append('div').attr('class', 'attribDragBox');

  this.insertDOM_Infobox();
  this.insertDOM_WarningBox();

  this.DOM.panel_Wrapper = this.DOM.root.append('div').attr('class', 'panel_Wrapper');

  this.insertDOM_PanelBasic();

  this.DOM.panelsTop = this.DOM.panel_Wrapper.append('div').attr('class', 'panels_Above');

  this.panels.left = new Panel({
    width_catLabel: options.leftPanelLabelWidth || options.categoryTextWidth || 115,
    browser: this,
    name: 'left',
    parentDOM: this.DOM.panelsTop,
  });

  this.DOM.middleColumn = this.DOM.panelsTop.append('div').attr('class', 'middleColumn');
  this.DOM.middleColumn.append('div').attr('class', 'recordDisplay');

  this.panels.middle = new Panel({
    width_catLabel: options.middlePanelLabelWidth || options.categoryTextWidth || 115,
    browser: this,
    name: 'middle',
    parentDOM: this.DOM.middleColumn,
  });
  this.panels.right = new Panel({
    width_catLabel: options.rightPanelLabelWidth || options.categoryTextWidth || 115,
    browser: this,
    name: 'right',
    parentDOM: this.DOM.panelsTop,
  });
  this.panels.bottom = new Panel({
    width_catLabel: options.categoryTextWidth || 115,
    browser: this,
    name: 'bottom',
    parentDOM: this.DOM.panel_Wrapper,
  });

  this.insertDOM_AttributePanel();

  this.DOM.root.selectAll('.panel').on('mouseleave', () => {
    setTimeout(() => {
      if (me.needToRefreshLayout) {
        me.updateLayout_Height();
        me.needToRefreshLayout = false;
      }
    }, 1500); // update layout after 1.5 seconds
  });

  kshf.loadFont();

  kshf.browsers.push(this);
  kshf.browser = this;

  if (options.source) {
    window.setTimeout(() => { me.loadSource(options.source); }, 10);
  } else {
    this.panel_overlay.attr('show', 'source');
  }
}

Browser.prototype.setNoAnim = function setNoAniqm(v) {
  // if(v===this.noAnim) return;
  if (this.finalized === undefined) return;
  this.noAnim = v;
  this.DOM.root.attr('noanim', this.noAnim);
};

Browser.prototype.destroySummary = function destroySummary(summary) {
  summary.removeFromPanel();

  let indexFrom = -1;
  this.summaries.forEach((s, i) => {
    if (s === summary) indexFrom = i;
  });
  if (indexFrom === -1) return; // given summary is not within this panel
  this.summaries.splice(indexFrom, 1);

  // if the summary is within the record display sorting list, remove!
  if (this.recordDisplay) {
    const sortIndex = this.recordDisplay.sortingOpts.indexOf(summary);
    if (sortIndex !== -1) {
      this.recordDisplay.sortingOpts.splice(sortIndex, 1);
      this.recordDisplay.refreshSortingOptions();
    }
  }

  delete this.summaries_by_name[summary.summaryName];
  if (summary.summaryColumn) delete this.summaries_by_name[summary.summaryColumn];
};

Browser.prototype.getAttribTypeFromFunc = function getAttribTypeFromFunc(attribFunc) {
  let type = null;
  this.records.some((item, i) => {
    var item = attribFunc.call(item.data, item);
    if (item === null) return false;
    if (item === undefined) return false;
    if (typeof (item) === 'number' || item instanceof Date) {
      type = 'interval';
      return true;
    }
    // TODO": Think about boolean summaries
    if (typeof (item) === 'string' || typeof (item) === 'boolean') {
      type = 'categorical';
      return true;
    }
    if (Array.isArray(item)) {
      type = 'categorical';
      return true;
    }
    return false;
  }, this);
  return type;
};

Browser.prototype.createSummary = function createSummary(name, func, type) {
  if (this.summaries_by_name[name] !== undefined) {
    console.log(`createSummary: The summary name[${name }] is already used. Returning existing summary.`);
    return this.summaries_by_name[name];
  }
  if (typeof (func) === 'string') {
    const x = func;
    func = function () { return this[x]; };
  }

  const attribFunc = func || function () { return this[name]; };
  if (type === undefined) {
    type = this.getAttribTypeFromFunc(attribFunc);
  }
  if (type === null) {
    console.log(`Summary data type could not be detected for summary name:${name}`);
    return;
  }

  let summary;
  if (type === 'categorical') {
    summary = new SummaryCategorical();
  } else if (type === 'interval') {
    summary = new SummaryInterval();
  }

  summary.initialize(this, name, func);

  this.summaries.push(summary);
  this.summaries_by_name[name] = summary;

  return summary;
};

Browser.prototype.changeSummaryName = function changeSummaryName(curName, newName) {
  if (curName === newName) return;
  const summary = this.summaries_by_name[curName];
  if (summary === undefined) {
    console.log('changeSummaryName: The given summary name is not there.');
    return;
  }
  if (this.summaries_by_name[newName] !== undefined) {
    if (newName !== this.summaries_by_name[newName].summaryColumn) {
      console.log('changeSummaryName: The new summary name is already used. It must be unique. Try again');
      return;
    }
  }
  // remove the indexing using oldName IFF the old name was not original column name
  if (curName !== summary.summaryColumn) {
    delete this.summaries_by_name[curName];
  }
  this.summaries_by_name[newName] = summary;
  summary.setSummaryName(newName);
  return summary;
};

Browser.prototype.setRecordName = function setRecordName(v) {
  this.recordName = v;
  this.DOM.recordName.html(this.recordName);
  if (this.recordDisplay && this.recordDisplay.recordViewSummary) {
    this.recordDisplay.DOM.recordDisplayName.html(`<i class="fa fa-angle-down"></i> ${this.recordName}`);
  }
};

Browser.prototype.updateWidth_Total = function updateWidth_Total() {
  this.divWidth = parseInt(this.DOM.root.style('width'));
};

Browser.prototype.getWidth_Total = function getWidth_Total() {
  return this.divWidth;
};

Browser.prototype.getWidth_Browser = function getWidth_Browser() {
  return this.divWidth - (this.authoringMode ? kshf.attribPanelWidth : 0);
};

Browser.prototype.getActiveCompareSelCount = function getActiveCompareSelCount() {
  return this.vizActive.Compare_A + this.vizActive.Compare_B + this.vizActive.Compare_C;
};

Browser.prototype.createFilter = function createFilter(_type, _parent) {
  let newFilter;
  switch (_type) {
    case 'categorical':
      newFilter = new FilterCategorical(this, _parent); break;
    case 'interval':
      newFilter = new Filter_Interval(this, _parent); break;
    case 'text':
      newFilter = new FilterText(this, _parent); break;
    case 'spatial':
      newFilter = new FilterSpatial(this, _parent); break;
  }
  this.filters.push(newFilter);
  return newFilter;
};

Browser.prototype.insertDOM_WarningBox = function insertDOM_WarningBox() {
  this.panel_warningBox = this.DOM.root.append('div').attr('class', 'warningBox_wrapper').attr('shown', false);
  const x = this.panel_warningBox.append('span').attr('class', 'warningBox');
  this.DOM.warningText = x.append('span').attr('class', 'warningText');
  x.append('span').attr('class', 'dismiss').html("<i class='fa fa-times-circle' style='font-size: 1.3em;'></i>")
    .on('click', function () { this.parentNode.parentNode.setAttribute('shown', false); });
};

Browser.prototype.showWarning = function showWarning(v) {
  this.panel_warningBox.attr('shown', true);
  this.DOM.warningText.html(v);
};

Browser.prototype.hideWarning = function hideWarning() {
  this.panel_warningBox.attr('shown', false);
};

Browser.prototype.getMeasurableSummaries = function getMeasurableSummaries() {
  return this.summaries.filter(function (summary) {
    return (summary.type === 'interval')
      && summary.scaleType !== 'time'
      // && summary.panel!==undefined
      && summary.intervalRange.total
      // && summary.intervalRange.total.min>=0
      && summary.summaryName !== this.records[0].idIndex
    ;
  }, this);
};

Browser.prototype.insertDOM_measureSelect = function insertDOM_measureSelect() {
  const me = this;
  if (this.DOM.measureSelectBox) return;
  this.DOM.measureSelectBox = this.DOM.measureSelectBox_Wrapper.append('div').attr('class', 'measureSelectBox')
    .styles({ left: '0px', top: '0px' });
  this.DOM.measureSelectBox.append('div').attr('class', 'measureSelectBox_Close fa fa-times-circle')
    .each(function (d) { this.tipsy = new Tipsy(this, { gravity: 'e', title: kshf.lang.cur.Close }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.closeMeasureSelectBox(); });
  this.DOM.measureSelectBox.append('div').attr('class', 'measureSelectBox_Header')
    .text(kshf.lang.cur.ChangeMeasureFunc)
    .on('mousedown', (d, i) => {
      me.DOM.root.attr('pointerEvents', false);

      const initPos = d3.mouse(d3.select('body').node());
      const DOM = me.DOM.measureSelectBox.node();
      const initX = parseInt(DOM.style.left);
      const initY = parseInt(DOM.style.top);
      const boxWidth = DOM.getBoundingClientRect().width;
      const boxHeight = DOM.getBoundingClientRect().height;
      const maxWidth = me.DOM.root.node().getBoundingClientRect().width - boxWidth;
      const maxHeight = me.DOM.root.node().getBoundingClientRect().height - boxHeight;
      me.DOM.root.attr('drag_cursor', 'grabbing');

      d3.select('body').on('mousemove', () => {
        let newPos = d3.mouse(d3.select('body').node());
        DOM.style.left = `${Math.min(maxWidth , Math.max(0, initX-initPos[0]+newPos[0] ))}px`;
        DOM.style.top = `${Math.min(maxHeight, Math.max(0, initY-initPos[1]+newPos[1] ))}px`;
      }).on('mouseup', () => {
        me.DOM.root.attr('pointerEvents', true).attr('drag_cursor', null);
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
    });

  const m = this.DOM.measureSelectBox.append('div').attr('class', 'measureSelectBox_Content');
  m.append('span').attr('class', 'measureSelectBox_Content_FuncType')
    .selectAll('.measureFunctionType').data([
      { v: 'Count', l: 'Number' },
      { v: 'Sum', l: 'Sum' },
      { v: 'Avg', l: 'Average' },
    ])
    .enter()
    .append('div')
    .attr('class', d => 'measureFunctionType measureFunction_'+d.v)
    .html(d => d.l)
    .on('click', function (d) {
      if (d.v === 'Count') {
        me.DOM.measureSelectBox.select('.sdsso23oadsa').attr('disabled', 'true');
        me.setMeasureMetric(); // no summary, will revert to count
        return;
      }
      this.setAttribute('selected', '');
      me.DOM.measureSelectBox.select('.sdsso23oadsa').attr('disabled', null);
      me.setMeasureMetric(d.v, me.DOM.sdsso23oadsa.node().selectedOptions[0].__data__);
    });

  this.DOM.sdsso23oadsa = m.append('div').attr('class', 'measureSelectBox_Content_Summaries')
    .append('select').attr('class', 'sdsso23oadsa')
    .attr('disabled', this.measureFunc === 'Count' ? 'true' : null)
    .on('change', function () {
      me.setMeasureMetric(me.measureFunc, this.selectedOptions[0].__data__);
    });

  this.DOM.sdsso23oadsa
    .selectAll('.measureSummary').data(this.getMeasurableSummaries()).enter()
    .append('option')
    .attr('class', (summary) => 'measureSummary measureSummary_'+summary.summaryID)
    .attr('value', (summary) => summary.summaryID)
    .attr('selected', summary => (summary===me.measureSummary?"true":null))
    .html(summary => summary.summaryName);

  m.append('span').attr('class', 'measureSelectBox_Content_RecordName').html(` of ${this.recordName}`);
};

Browser.prototype.closeMeasureSelectBox = function closeMeasureSelectBox() {
  this.DOM.measureSelectBox_Wrapper.attr('showMeasureBox', null); // Close box
  this.DOM.measureSelectBox = undefined;
  const d = this.DOM.measureSelectBox_Wrapper.node();
  while (d.hasChildNodes()) d.removeChild(d.lastChild);
};

Browser.prototype.refreshMeasureSelectAction = function refreshMeasureSelectAction() {
  this.DOM.measureFuncSelect.attr('changeMeasureBox', (this.getMeasurableSummaries().length !== 0) ? 'true' : null);
};

Browser.prototype.insertDOM_PanelBasic = function insertDOM_PanelBasic() {
  const me = this;

  this.DOM.panel_Basic = this.DOM.panel_Wrapper.append('div').attr('class', 'panel_Basic');

  this.DOM.measureSelectBox_Wrapper = this.DOM.panel_Basic.append('span').attr('class', 'measureSelectBox_Wrapper');

  this.DOM.measureFuncSelect = this.DOM.panel_Basic.append('span')
    .attr('class', 'measureFuncSelect fa fa-cubes')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'nw', title: kshf.lang.cur.ChangeMeasureFunc }); })
    .on('mouseenter', function () {
      if (me.authoringMode || me.getMeasurableSummaries().length === 0) return;
      this.tipsy.show();
    })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      if (me.DOM.measureSelectBox) {
        me.closeMeasureSelectBox();
        return;
      }
      me.insertDOM_measureSelect();
      me.DOM.measureSelectBox_Wrapper.attr('showMeasureBox', true);
    });

  this.DOM.recordInfo = this.DOM.panel_Basic.append('span')
    .attr('class', 'recordInfo')
    .attr('edittitle', false);

  this.DOM.activeRecordMeasure = this.DOM.recordInfo.append('span').attr('class', 'activeRecordMeasure');
  this.DOM.measureFuncType = this.DOM.recordInfo.append('span').attr('class', 'measureFuncType');

  this.DOM.recordName = this.DOM.recordInfo.append('span').attr('class', 'recordName editableText')
    .each(function () {
      this.tipsy = new Tipsy(this, {
        gravity: 'w',
        title () {
          const curState = this.parentNode.getAttribute('edittitle');
          return (curState === null || curState === 'false') ? kshf.lang.cur.EditTitle : 'OK';
        },
      });
    })
    .attr('contenteditable', false)
    .on('mousedown', () => { d3.event.stopPropagation(); })
    .on('mouseenter', function () {
      this.tipsy.show();
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('mousedown', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
    })
    .on('blur', function () {
      this.parentNode.setAttribute('edittitle', false);
      this.setAttribute('contenteditable', false);
      me.setRecordName(this.textContent);
    })
    .on('keyup', () => { d3.event.stopPropagation(); })
    .on('keypress', () => { d3.event.stopPropagation(); })
    .on('keydown', function () {
      if (event.keyCode === 13) { // ENTER
        this.parentNode.setAttribute('edittitle', false);
        this.setAttribute('contenteditable', false);
        me.setRecordName(this.textContent);
      }
      d3.event.stopPropagation();
    })
    .on('click', function () {
      this.tipsy.hide();
      const curState = this.parentNode.getAttribute('edittitle');
      if (curState === null || curState === 'false') {
        this.parentNode.setAttribute('edittitle', true);
        var parentDOM = d3.select(this.parentNode);
        var v = parentDOM.select('.recordName').node();
        v.setAttribute('contenteditable', true);
        v.focus();
      } else {
        this.parentNode.setAttribute('edittitle', false);
        var parentDOM = d3.select(this.parentNode);
        var v = parentDOM.select('.recordName').node();
        v.setAttribute('contenteditable', false);
        me.setRecordName(this.textContent);
      }
    });

  this.DOM.breadcrumbs = this.DOM.panel_Basic.append('span').attr('class', 'breadcrumbs');

  this.DOM.saveSelection = this.DOM.breadcrumbs.append('span').attr('class', 'saveSelection fa fa-floppy-o')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'n', title: kshf.lang.cur.SaveSelection }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.saveFilterSelection(); });

  this.initDOM_ClearAllFilters();

  const rightBoxes = this.DOM.panel_Basic.append('span').attr('class', 'rightBoxes');
  // Attribute panel
  if (typeof saveAs !== 'undefined') { // FileSaver.js is included
    rightBoxes.append('i').attr('class', 'saveBrowserConfig fa fa-download')
      .each(function (d) { this.tipsy = new Tipsy(this, { gravity: 'ne', title: 'Download Browser Configuration' }); })
      .on('mouseenter', function () { this.tipsy.show(); })
      .on('mouseleave', function () { this.tipsy.hide(); })
      .on('click', () => {
        const c = JSON.stringify(me.exportConfig(), null, '  ');
        const blob = new Blob([c]);// , {type: "text/plain;charset=utf-8"});
        saveAs(blob, 'kshf_config.json');
      });
  }
  rightBoxes.append('i').attr('class', 'configUser fa')
    .each(function (d) {
      this.tipsy = new Tipsy(this, { gravity: 'n',
        title() {
          return kshf.gistLogin ?
            (`Welcome, <i class='fa fa-github'></i> <b>${kshf.gistLogin}</b>.<br><br>` +
            'Click to logout.<br><br>'+`Shift-click to set gist ${kshf.gistPublic ? "secret":'public'}.`) :
            'Sign-in using github';
        },
      });
    })
    .attr('auth', false)
    .on('mouseover', function () { this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('click', function () {
      if (this.getAttribute('auth') === 'true') {
        if (d3.event.shiftKey) {
          kshf.gistPublic = !kshf.gistPublic; // invert public setting
          this.setAttribute('public', kshf.gistPublic);
          alert(`Future uploads will be ${kshf.gistPublic ? 'public':'secret' }.`);
          return;
        }
        // de-authorize
        kshf.githubToken = undefined;
        kshf.gistLogin = undefined;
        this.setAttribute('auth', false);
      } else {
        kshf.githubToken = window.prompt('Your Github token (only needs access to gist)', '');
        if (this.githubToken !== '') {
          kshf.getGistLogin();
          this.setAttribute('auth', true);
        }
      }
    });
  rightBoxes.append('i').attr('class', 'saveBrowserConfig fa fa-cloud-upload')
    .each(function (d) { this.tipsy = new Tipsy(this, { gravity: 'ne', title: 'Upload Browser Config to Cloud' }); })
    .on('mouseover', function () { this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('click', () => {
      if (!confirm(`The browser will be saved ${
        (kshf.gistLogin) ?
          'to your github as '+(kshf.gistPublic ? "public":'secret') + " gist.":
          'anonymously and public.'}`,
      )) {
        return;
      }
      const e = me.exportConfig();
      const c = JSON.stringify(e, null, '  ');

      // Add authentication data if authentication token is set
      const headers = {};
      if (kshf.gistLogin) headers.Authorization = `token ${kshf.githubToken}`;

      // Set description (from page title if it exists)
      let description = 'Keshif Browser Configuration';
      // In demo pages, demo_PageTitle gives more context - use it as description
      if (d3.select('#demo_PageTitle').node()) {
        description = d3.select('#demo_PageTitle').html();
      }

      const githubLoad = {
        description,
        public: kshf.gistPublic,
        files: { 'kshf_config.json': { content: c } },
      };
      // Add style file, if custom style exists
      const badiStyle = d3.select('#kshfStyle');
      if (badiStyle.node() !== null) {
        githubLoad.files['kshf_style.css'] = { content: badiStyle.text() };
      }

      function gist_createNew() {
        const xhr = d3.request('https://api.github.com/gists');
        if (kshf.gistLogin) xhr.header('Authorization', 'token ' + kshf.githubToken);
        xhr.post(JSON.stringify(githubLoad), // data
          (error, data) => {
            let response = JSON.parse(data.response);
            // Keep Gist Info (you may edit/fork it next)
            kshf.gistInfo = response;
            let gistURL = response.html_url;
            let gistID = gistURL.replace(/.*github.*\//g, '');
            let keshifGist = 'keshif.me/gist?'+gistID;
            me.showWarning(
              'The browser is saved to '+
              "<a href='" + gistURL + "' target='_blank'>" + gistURL.replace('https://', "") + "</a>.<br> " +
              "To load it again, visit <a href='http://" + keshifGist + "' target='_blank'>" + keshifGist + "</a>",
            );
          });
      }
      function gist_sendEdit() {
        const xhr = d3.request(`https://api.github.com/gists/${kshf.gistInfo.id}`);
        if (kshf.gistLogin) xhr.header('Authorization', 'token ' + kshf.githubToken);
        xhr.send('PATCH', JSON.stringify(githubLoad),
          (error, data) => {
            let response = JSON.parse(data.response);
            let gistURL = response.html_url;
            let gistID = gistURL.replace(/.*github.*\//g, '');
            let keshifGist = 'keshif.me/gist?'+gistID;
            me.showWarning(
              'The browser is edited in '+
              "<a href='" + gistURL + "' target='_blank'>" + gistURL.replace('https://', "") + "</a>.<br> " +
              "To load it again, visit <a href='http://" + keshifGist + "' target='_blank'>" + keshifGist + "</a>",
            );
          });
      }


      // UNAUTHORIZED / ANONYMOUS
      if (kshf.gistLogin === undefined) {
        // You cannot fork or edit a gist as anonymous user.
        gist_createNew();
        return;
      }

      // AUTHORIZED, NEW GIST
      if (kshf.gistInfo === undefined) {
        gist_createNew(); // New gist
        return;
      }

      // AUTHORIZED, EXISTING GIST, FROM ANOTHER USER
      if (kshf.gistInfo.owner === undefined || kshf.gistInfo.owner.login !== kshf.gistLogin) {
        // Fork it
        const xhr = d3.request(`https://api.github.com/gists${kshf.gistInfo.id}/forks`);
        if (kshf.gistLogin) xhr.header('Authorization', 'token ' + kshf.githubToken);
        xhr.post(JSON.stringify(githubLoad), // data
          (error, data) => {
            kshf.gistInfo = JSON.parse(data.response); // ok, now my gist
            gist_sendEdit();
          });
      } else {
        // AUTHORIZED, EXISTING GIST, MY GIST
        if (kshf.gistInfo.owner.login === kshf.gistLogin) {
          gist_sendEdit();
        }
      }
    });

  // Authoring
  this.DOM.authorButton = rightBoxes.append('span').attr('class', 'authorButton fa fa-cog')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'n', title: kshf.lang.cur.ModifyBrowser }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.enableAuthoring(); });
  // Datasource
  this.DOM.datasource = rightBoxes.append('a').attr('class', 'fa fa-table datasource')
    .attr('target', '_blank')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'n', title: kshf.lang.cur.OpenDataSource }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); });
  // Notification
  this.DOM.notifyButton = rightBoxes.append('span').attr('class', 'notifyButton fa fa-bell')
    .each(function () {
      this.tipsy = new Tipsy(this, { gravity: 'n', title: '' });
    })
    .on('mouseenter', function () {
      this.tipsy.options.title = `${'' +
        '<u>See Tip</u><br>'}${
        me.helpin.getTopicTitle(me.helpin.notifyAction.topic)}<br>` +
        '<div style=\'font-size: 0.9em; padding-top: 6px;\'>Shift+Click to dismiss</div>';
      this.tipsy.show();
    })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      if (me.helpin) {
        if (d3.event.shiftKey) {
          me.helpin.clearNotification();
        } else {
          me.helpin.showNotification();
        }
      }
    });
  // Help
  this.DOM.showHelpIn = rightBoxes.append('span').attr('class', 'showHelpIn fa fa-question-circle')
    .each(function (d) { this.tipsy = new Tipsy(this, { gravity: 'n', title: kshf.lang.cur.Help }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      if (me.helpin) {
        if (exp_basis) {
          me.helpin.showTopicListing();
        } else if (exp_helpin || exp_train) {
          me.helpin.showOverlayOnly();
        } else {
          me.helpin.showPointNLearn();
        }
      } else {
        alert('We are working on offering you the best help soon.');
      }
    });

  // Fullscreen
  this.DOM.viewFullscreen = rightBoxes.append('span').attr('class', 'fa fa-arrows-alt viewFullscreen')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'ne', title: kshf.lang.cur.ShowFullscreen }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.showFullscreen(); });
  // Info & Credits
  const x = rightBoxes.append('span').attr('class', 'logoHost')// .attr("class","fa fa-info-circle")
    .html(kshf.kshfLogo)
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'ne', title: kshf.lang.cur.ShowInfoCredits }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () {
      this.tipsy.hide();
      me.showCredits();
      me.panel_overlay.attr('show', 'infobox');
    });

  // Total glyph - row
  const adsdasda = this.DOM.panel_Basic.append('div').attr('class', 'totalGlyph aggrGlyph');
  this.DOM.totalGlyph = adsdasda.selectAll("[class*='measure_']")
    .data(['Total', 'Active', 'Highlight', 'Compare_A', 'Compare_B', 'Compare_C'])
    .enter()
    .append('span')
    .attr('class', d => 'measure_'+d);
};

Browser.prototype.refreshTotalViz = function refreshTotalViz() {
  const me = this;
  const totalScale = d3.scaleLinear()
    .domain([0, this.allRecordsAggr.measure(this.ratioModeActive ? 'Active' : 'Total')])
    .range([0, this.getWidth_Browser()])
    .clamp(true);

  let totalC = this.getActiveCompareSelCount();
  totalC++; // 1 more for highlight

  const VizHeight = 8;
  let curC = 0;
  const stp = VizHeight / totalC;

  this.DOM.totalGlyph.style('transform', (d) => {
    if (d === "Total" || d === "Highlight" || d === "Active") {
      return 'scale('+totalScale(me.allRecordsAggr.measure(d)) + "," + VizHeight + ")";
    }
      curC++;
      return 'translateY('+(stp * curC) + "px) scale(" + totalScale(me.allRecordsAggr.measure(d)) + "," + stp + ")";

  });
};

Browser.prototype.initDOM_ClearAllFilters = function initDOM_ClearAllFilters() {
  const me = this;

  this.DOM.filterClearAll = this.DOM.panel_Basic.append('span').attr('class', 'filterClearAll')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'n', title: kshf.lang.cur.RemoveAllFilters }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.clearFilters_All(); });
};

Browser.prototype.insertDOM_Infobox = function insertDOM_Infobox() {
  const me = this;

  this.panel_overlay = this.DOM.root.append('div').attr('class', 'panel_overlay');

  // BACKGROUND
  this.DOM.kshfBackground = this.panel_overlay.append('div').attr('class', 'kshfBackground')
    .on('click', function () {
      const activePanel = this.parentNode.getAttribute('show');
      if (activePanel === 'recordDetails' || activePanel === 'infobox' || activePanel === 'help-browse') {
        me.panel_overlay.attr('show', 'none');
      }
    });

  // LOADING BOX
  this.DOM.loadingBox = this.panel_overlay.append('div').attr('class', 'overlay_content overlay_loading');
  const ssdsd = this.DOM.loadingBox.append('span').attr('class', 'spinner')
    .selectAll('.spinner_x').data([1, 2, 3, 4, 5])
    .enter()
    .append('span')
    .attr('class', (d) => 'spinner_x spinner_'+d);
  const hmmm = this.DOM.loadingBox.append('div').attr('class', 'status_text');
  hmmm.append('span').attr('class', 'status_text_sub info').html(
    kshf.lang.cur.LoadingData);
  this.DOM.status_text_sub_dynamic = hmmm.append('span').attr('class', 'status_text_sub dynamic');
  // hmmm.append('button')
  //   .attr('id', 'kshf-Sheets-Auth-Button')
    // .styles({visibility: "hidden", display: 'block', margin: '0 auto'})
    // .text('Authorize');
  hmmm.style.visibility = 'hidden';
  hmmm.style.display = 'block';
  hmmm.style.margin = '0 auto';
  //
  //   .attr("id","kshf-Sheets-Auth-Button");
  // hmmm.attr('style', 'visibility: hidden; display: block; margin: 0 auto;');
  // hmmm.text('Authorize');

  // CREDITS
  this.DOM.overlay_infobox = this.panel_overlay.append('div').attr('class', 'overlay_content overlay_infobox');
  this.DOM.overlay_infobox.append('div').attr('class', 'overlay_Close fa fa-times fa-times-circle')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'ne', title: kshf.lang.cur.Close }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.panel_overlay.attr('show', 'none'); });

  this.insertSourceBox();

  // RECORD DETAILS
  this.DOM.overlay_recordDetails = this.panel_overlay.append('span').attr('class', 'overlay_content overlay_recordDetails');
  this.DOM.overlay_recordDetails.append('div').attr('class', 'overlay_Close fa fa-times-circle')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'ne', title: kshf.lang.cur.Close }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', () => { me.panel_overlay.attr('show', 'none'); });
  this.DOM.overlay_recordDetails_content = this.DOM.overlay_recordDetails.append('span').attr('class', 'content');

  // HELP
  this.panel_overlay.append('span').attr('class', 'overlay_content overlay_help');
};

Browser.prototype.showCredits = function showCredits() {
  if (this.creditsInserted) return;
  this.DOM.overlay_infobox.append('div').html(
    `<div class='infobox-header'>${
      kshf.kshfLogo
    }<a href='https://www.facebook.com/keshifme' target='_blank' class='fa fa-facebook socialMedia' style='color: #4c66a4;'></a>` +
    '<a href=\'https://www.twitter.com/keshifme\' target=\'_blank\' class=\'fa fa-twitter socialMedia\' style=\'color: #00aced;\'></a>' +
    '<a href=\'https://www.github.com/adilyalcin/keshif\' target=\'_blank\' class=\'fa fa-github socialMedia\' style=\'color: black;\'></a>' +

    '<a target=\'_blank\' href=\'http://www.keshif.me\' class=\'libName\'>' +
    ' Keshif</a><br><span style=\'font-weight:300; font-size: 0.9em;\'>Data Made Explorable</span>' +
    '</div>' +

    '<div class=\'boxinbox\' style=\'padding: 0px 15px\'>' +
    'Contact: <b> info <i class=\'fa fa-at\'></i> keshif.me </b> <br>' +
    ' <div style=\'font-weight: 300; font-size: 0.9em;\'>( Press, custom development and deployments, new features, training )</div>' +
    '</div>' +

    '<div class=\'boxinbox\' style=\'margin: 10px 25px\'>' +
    '<a href=\'https://groups.google.com/forum/#!forum/keshif\' target=\'_blank\'>Users Group Maillist</a>' +
    '</div>' +

    '<div style=\'font-weight: 300; font-size: 0.8em; margin: 5px;\'><b>License:</b> ' +
    '<a href=\'https://github.com/adilyalcin/Keshif/blob/master/LICENSE\' target=\'_blank\'>' +
    'BSD 3 clause (c) Uni. of Maryland</a></div>' +

    '<div class=\'boxinbox\' style=\'font-size: 0.8em; font-weight: 200\'>' +
    ' 3rd party libraries used: ' +
    ' <a style=\'color:black;\' href=\'http://d3js.org/\' target=\'_blank\'>D3</a>, ' +
    ' <a style=\'color:black;\' href=\'http://leafletjs.com/\' target=\'_blank\'>Leaflet</a>, ' +
    ' <a style=\'color:black;\' href=\'http://github.com/dbushell/Pikaday\' target=\'_blank\'>Pikaday</a> ' +
    // " <a style='color:black;' href='https://developers.google.com/chart/' target='_blank'>Google JS APIs</a>"+
    '</div>',
  );
  this.creditsInserted = true;
};

Browser.prototype.insertSourceBox = function insertSourceBox() {
  const me = this;
  let x,
    y,
    z;
  let source_type = 'GoogleSheet';
  let sourceURL = null,
    sourceSheet = '',
    localFile;

  const readyToLoad = function () {
    if (localFile) return true;
    return sourceURL !== null && sourceSheet !== '';
  };

  this.DOM.overlay_source = this.panel_overlay.append('div').attr('class', 'overlay_content overlay_source')
    .attr('selected_source_type', source_type);

  this.DOM.overlay_source.append('div').attr('class', 'sourceHeader').text('Import your data')
    .append('span')
    .attr('class', 'fa fa-info-circle')
    .each(function (summary) {
      this.tipsy = new Tipsy(this, {
        gravity: 's',
        title () {
          return '<b>Confidentiality</b>: This website does not track the data you import.<br> You can ' +
            'use the source code to host your data and the browser locally.';
        },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); });

  const source_wrapper = this.DOM.overlay_source.append('div').attr('class', 'source_wrapper');

  x = source_wrapper.append('div').attr('class', 'sourceOptions');

  x.append('span').attr('class', 'sourceOption').html(
    "<img src='https://lh3.ggpht.com/e3oZddUHSC6EcnxC80rl_6HbY94sM63dn6KrEXJ-C4GIUN-t1XM0uYA_WUwyhbIHmVMH=w300-rw' " +
    " style='height: 12px;'> Google Sheet").attr('source_type', 'GoogleSheet');
  x.append('span').attr('class', 'sourceOption').html(
    "<img src='https://developers.google.com/drive/images/drive_icon.png' style='height:12px; position: " +
    "relative; top: 2px'> Google Drive Folder")
    .attr('source_type', 'GoogleDrive');
  x.append('span').attr('class', 'sourceOption').html(
    "<i class='fa fa-dropbox'></i> Dropbox Folder").attr('source_type', 'Dropbox');
  x.append('span').attr('class', 'sourceOption')
    .html("<i class='fa fa-file'></i> Local File").attr('source_type', 'LocalFile');

  x.selectAll('.sourceOption').on('click', function () {
    source_type = this.getAttribute('source_type');
    me.DOM.overlay_source.attr('selected_source_type', source_type);
    let placeholder;
    switch (source_type) {
      case 'GoogleSheet': placeholder = 'https://docs.google.com/spreadsheets/d/**************'; break;
      case 'GoogleDrive': placeholder = 'https://******.googledrive.com/host/**************/'; break;
      case 'Dropbox': placeholder = 'https://dl.dropboxusercontent.com/u/**************/';
    }
    gdocLink.attr('placeholder', placeholder);
  });

  x = source_wrapper.append('div');
  var gdocLink = x.append('input')
    .attr('type', 'text')
    .attr('class', 'gdocLink')
    .attr('placeholder', 'https://docs.google.com/spreadsheets/d/**************')
    .on('keydown', () => { d3.event.stopPropagation(); })
    .on('keypress', () => { d3.event.stopPropagation(); })
    .on('keyup', function () {
      d3.event.stopPropagation();
      gdocLink_ready.style('opacity', this.value === '' ? '0' : '1');
      var input = this.value;
      if (source_type === 'GoogleSheet') {
        var firstIndex = input.indexOf('docs.google.com/spreadsheets/d/');
        if (firstIndex !== -1) {
          var input = input.substr(firstIndex + 31); // focus after the base url
          if (input.indexOf('/') !== -1) {
            input = input.substr(0, input.indexOf('/'));
          }
        }
        if (input.length === 44) {
          sourceURL = input;
          gdocLink_ready.attr('ready', true);
        } else {
          sourceURL = null;
          gdocLink_ready.attr('ready', null);
        }
      }
      if (source_type === 'GoogleDrive') {
        var firstIndex = input.indexOf('.googledrive.com/host/');
        if (firstIndex !== -1) {
          // Make sure last character is "/"
          if (input[input.length - 1] !== '/') input += '/';
          sourceURL = input;
          gdocLink_ready.attr('ready', true);
        } else {
          sourceURL = null;
          gdocLink_ready.attr('ready', null);
        }
      }
      if (source_type === 'Dropbox') {
        var firstIndex = input.indexOf('dl.dropboxusercontent.com/');
        if (firstIndex !== -1) {
          // Make sure last character is "/"
          if (input[input.length - 1] !== '/') input += '/';
          sourceURL = input;
          gdocLink_ready.attr('ready', true);
        } else {
          sourceURL = null;
          gdocLink_ready.attr('ready', null);
        }
      }
      actionButton.attr('disabled', !readyToLoad());
    });

  const fileLink = x.append('input')
    .attr('type', 'file')
    .attr('class', 'fileLink')
    .on('change', () => {
      gdocLink_ready.style('opacity', 0);
      const files = d3.event.target.files; // FileList object
      if (files.length > 1) {
        alert('Please select only one file.');
        return;
      }
      if (files.length === 0) {
        alert('Please select a file.');
        return;
      }
      localFile = files[0];
      const extension = localFile.name.split('.').pop();
      switch (extension) {
        case 'json': // json
          // case "application/json": // json
          localFile.fileType = 'json';
          localFile.name = localFile.name.replace('.json', '');
          break;

        case 'csv':
          //              case "text/csv": // csv
          //              case "text/comma-separated-values":
          //              case "application/csv":
          //              case "application/excel":
          //              case "application/vnd.ms-excel":
          //              case "application/vnd.msexcel":
          localFile.fileType = 'csv';
          localFile.name = localFile.name.replace('.csv', '');
          break;

        case 'tsv':
          //              case "text/tab-separated-values":  // tsv
          localFile.fileType = 'tsv';
          localFile.name = localFile.name.replace('.tsv', '');
          break;

        default:
          localFile = undefined;
          actionButton.attr('disabled', true);
          alert('The selected file type is not supported (csv, tsv, json)');
          return;
      }
      localFile.name = localFile.name.replace('_', ' ');
      gdocLink_ready.style('opacity', 1);
      gdocLink_ready.attr('ready', true);
      actionButton.attr('disabled', false);
    });

  x.append('span').attr('class', 'fa fa-info-circle')
    .each(function (summary) {
      this.tipsy = new Tipsy(this, {
        gravity: 's',
        title () {
          switch (source_type) {
            case 'GoogleSheet': return 'The link to your Google Sheet';
            case 'GoogleDrive': return 'The link to *hosted* Google Drive folder';
            case 'Dropbox': return 'The link to your *Public* Dropbox folder';
            case 'LocalFile': return 'Select your CSV/TSV/JSON file<br> or drag-and-drop here.';
          }
          return '(Unknown source type)';
        },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); });

  var gdocLink_ready = x.append('span').attr('class', 'gdocLink_ready fa').attr('ready', false);

  const sheetInfo = this.DOM.overlay_source.append('div').attr('class', 'sheetInfo');

  x = sheetInfo.append('div').attr('class', 'sheet_wrapper');
  x.append('div').attr('class', 'subheading tableHeader');

  x = sheetInfo.append('div').attr('class', 'sheet_wrapper sheetName_wrapper');
  x.append('span').attr('class', 'subheading').text('Name');
  x.append('span').attr('class', 'fa fa-info-circle')
    .each(function (summary) {
      this.tipsy = new Tipsy(this, {
        gravity: 's',
        title () {
          let v;
          if (source_type === 'GoogleSheet') { v = "The name of the data sheet in your Google Sheet."; }
          if (source_type === 'GoogleDrive') { v = "The file name in the folder."; }
          if (source_type === 'Dropbox') { v = "The file name in the folder."; }
          v += '<br>A noun that describes a data row.';
          return v;
        },
      });
    })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); });

  this.DOM.tableName = x.append('input').attr('type', 'text').attr('class', 'tableName')
    .on('keydown', () => { d3.event.stopPropagation(); })
    .on('keypress', () => { d3.event.stopPropagation(); })
    .on('keyup', function () {
      sourceSheet = this.value;
      actionButton.attr('disabled', !readyToLoad());
    });

  z = x.append('span').attr('class', 'fileType_wrapper');
  z.append('span').text('.');
  const DOMfileType = z.append('select').attr('class', 'fileType');
  DOMfileType.append('option').attr('value', 'csv').text('csv');
  DOMfileType.append('option').attr('value', 'tsv').text('tsv');
  DOMfileType.append('option').attr('value', 'json').text('json');

  var actionButton = this.DOM.overlay_source.append('div').attr('class', 'actionButton')
    .text('Explore it with Keshif')
    .attr('disabled', true)
    .on('click', () => {
      if (!readyToLoad()) {
        alert('Please input your data source link and sheet name.');
        return;
      }
      me.options.enableAuthoring = true; // Enable authoring on data load
      const sheetID = 'id';
      switch (source_type) {
        case 'GoogleSheet':
          me.loadSource({
            gdocId: sourceURL,
            tables: {
              name: sourceSheet,
              id: sheetID,
            },
          });
          break;
        case 'GoogleDrive':
          me.loadSource({
            dirPath: sourceURL,
            fileType: DOMfileType.node().value,
            tables: { name: sourceSheet, id: sheetID },
          });
          break;
        case 'Dropbox':
          me.loadSource({
            dirPath: sourceURL,
            fileType: DOMfileType.node().value,
            tables: { name: sourceSheet, id: sheetID },
          });
          break;
        case 'LocalFile':
          localFile.id = sheetID;
          me.loadSource({
            dirPath: '', // TODO: temporary
            tables: localFile,
          });
          break;
      }
    });

  this.DOM.overlay_source.append('div').attr('class', 'dataImportNotes').html(
    "<i class='fa fa-file-text'></i> <a href='https://github.com/adilyalcin/Keshif/wiki/Docs:-Loading-Data' target='_blank'>" +
    'Documentation for data sources and the programming interface</a><br>' +
    "<i class='fa fa-file-text'></i> <a href='https://github.com/adilyalcin/Keshif/wiki/Guidelines-for-Data-Preparation' target='_blank'>" +
    'Guidelines for Data Preparation</a>',
  );
};

Browser.prototype.insertDOM_AttributePanel = function insertDOM_AttributePanel() {
  const me = this;

  this.DOM.attributePanel = this.DOM.root.append('div').attr('class', 'attributePanel');

  const xx = this.DOM.attributePanel.append('div').attr('class', 'attributePanelHeader');
  xx.append('span').text('Available Summaries');
  xx.append('span').attr('class', 'hidePanel fa fa-times')
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'w', title: 'Close panel' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.enableAuthoring(); });

  const attributePanelControl = this.DOM.attributePanel.append('div').attr('class', 'attributePanelControl');

  attributePanelControl.append('span').attr('class', 'attribFilterIcon fa fa-filter');

  // *******************************************************
  // TEXT SEARCH
  // *******************************************************

  this.DOM.attribTextSearch = attributePanelControl.append('span').attr('class', 'textSearchBox attribTextSearch');
  this.DOM.attribTextSearchControl = this.DOM.attribTextSearch.append('span')
    .attr('class', 'textSearchControl fa')
    .on('click', () => {
      me.DOM.attribTextSearchControl.attr('showClear', false).node().value = '';
      me.summaries.forEach((summary) => {
        if (summary.DOM.nugget === undefined) return;
        summary.DOM.nugget.attr('filtered', false);
      });
    });
  this.DOM.attribTextSearch.append('input')
    .attr('class', 'summaryTextSearchInput')
    .attr('type', 'text')
    .attr('placeholder', kshf.lang.cur.Search)
    .on('keydown', () => { d3.event.stopPropagation(); })
    .on('keypress', () => { d3.event.stopPropagation(); })
    .on('keyup', () => { d3.event.stopPropagation(); })
    .on('input', function () {
      if (this.timer) clearTimeout(this.timer);
      const x = this;
      const qStr = x.value.toLowerCase();
      me.DOM.attribTextSearchControl.attr('showClear', (qStr !== ''));
      this.timer = setTimeout(() => {
        me.summaries.forEach((summary) => {
          if (summary.DOM.nugget === undefined) return;
          summary.DOM.nugget.attr('filtered', (summary.summaryName.toLowerCase().indexOf(qStr) === -1));
        });
      }, 750);
    });

  attributePanelControl.append('span').attr('class', 'addAllSummaries')
    .append('span').attr('class', 'fa fa-magic') // fa-caret-square-o-right
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'e', title: 'Add all to browser' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', function () { this.tipsy.hide(); me.autoCreateBrowser(); });

  this.DOM.attributeList = this.DOM.attributePanel.append('div').attr('class', 'attributeList');

  this.DOM.attributePanel.append('div').attr('class', 'newAttribute').html("<i class='fa fa-plus-square'></i>")
    .each(function () { this.tipsy = new Tipsy(this, { gravity: 'n', title: 'Add new attribute' }); })
    .on('mouseenter', function () { this.tipsy.show(); })
    .on('mouseleave', function () { this.tipsy.hide(); })
    .on('click', () => {
      const name = prompt('The attribute name');
      if (name === null) return; // cancel
      const func = prompt('The attribute function');
      if (func === null) return; // cancel
      const safeFunc = undefined;
      try {
        eval(`"use strict"; safeFunc = function(d){${func  }}`);
      } catch (e) {
        console.log(`Eval error:\n Message:${e.message  }\n line:column\n${  e.lineNumber  }:${  e.columnNumber}`);
      }
      if (typeof safeFunc !== 'function') {
        alert('You did not specify a function with correct format. Cannot specify new attribute.');
        return;
      }
      me.createSummary(name, safeFunc);
    });

  this.DOM.dropZone_AttribList = this.DOM.attributeList.append('div').attr('class', 'dropZone dropZone_AttribList')
    .attr('readyToDrop', false)
    .on('mouseenter', function (event) {
      this.setAttribute('readyToDrop', true);
    })
    .on('mouseleave', function (event) {
      this.setAttribute('readyToDrop', false);
    })
    .on('mouseup', (event) => {
      const movedSummary = me.movedSummary;
      movedSummary.removeFromPanel();
      movedSummary.clearDOM();
      movedSummary.browser.updateLayout();
      me.movedSummary = null;
    });
  this.DOM.dropZone_AttribList.append('span').attr('class', 'dropIcon fa fa-angle-double-down');
  this.DOM.dropZone_AttribList.append('div').attr('class', 'dropText').text('Remove summary');
};

Browser.prototype.updateRecordDetailPanel = function updateRecordDetailPanel(record) {
  let str = '';
  if (this.recordDisplay.config && this.recordDisplay.config.onDetail) {
    str = this.recordDisplay.config.onDetail.call(record.data, record);
  } else {
    for (const column in record.data) {
      const v = record.data[column];
      if (v === undefined || v === null) continue;
      const defaultStr = `<b>${column}:</b> ${ v.toString()}<br>`;
      const s = this.summaries_by_name[column];
      if (s) {
        if (s instanceof SummaryCategorical) {
          if (s.catLabel_table) {
            str += `<b>${column}:</b> ${s.catLabel_table[v]}<br>`;
          } else {
            str += defaultStr;
          }
        } else if (s instanceof kshf.SummaryInterval) {
          str += `<b>${column }:</b> ${s.printWithUnitName(v)}<br>`;
        }
      } else {
        str += defaultStr;
      }
    }
  }
  this.DOM.overlay_recordDetails_content.html(str);
  this.panel_overlay.attr('show', 'recordDetails');
};

Browser.prototype.enableAuthoring = function enableAuthoring(v) {
  if (v === undefined) v = !this.authoringMode; // if undefined, invert
  this.authoringMode = v;
  this.DOM.root.attr('authoringMode', this.authoringMode ? 'true' : null);

  this.updateLayout();

  let lastIndex = 0,
    me = this;
  var initAttib = function () {
    const start = Date.now();
    me.summaries[lastIndex++].initializeAggregates();
    const end = Date.now();
    if (lastIndex !== me.summaries.length) {
      setTimeout(initAttib, end - start);
    } else {
      me.reorderNuggetList();
    }
  };
  setTimeout(initAttib, 150);
};

Browser.prototype.showFullscreen = function showFullscreen() {
  this.isFullscreen = !this.isFullscreen;
  const elem = this.DOM.root.node();
  if (this.isFullscreen) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
};

Browser.prototype.loadSource = function loadSource(v) {
  this.source = v;
  this.panel_overlay.attr('show', 'loading');

  // Compability with older versions.. Used to specify "sheets" instead of "tables"
  if (this.source.sheets) {
    this.source.tables = this.source.sheets;
  }

  if (typeof this.source.callback === 'string') {
    eval(`"use strict"; this.source.callback = ${this.source.callback}`);
  }

  if (this.source.tables) {
    if (!Array.isArray(this.source.tables)) this.source.tables = [this.source.tables];

    this.source.tables.forEach(function (tableDescr, i) {
      if (typeof tableDescr === 'string') this.source.tables[i] = { name: tableDescr };
    }, this);

    // Reset loadedTableCount
    this.source.loadedTableCount = 0;

    this.DOM.status_text_sub_dynamic
      .text(`(${this.source.loadedTableCount }/${this.source.tables.length})`);

    this.primaryTableName = this.source.tables[0].name;
    if (this.source.gdocId) {
      this.source.url = this.source.url || (`https://docs.google.com/spreadsheets/d/${this.source.gdocId}`);
    }
    this.source.tables.forEach(function (tableDescr) {
      if (tableDescr.id === undefined) tableDescr.id = 'id';
      // if this table name has been loaded, skip this one
      if (kshf.dt[tableDescr.name] !== undefined) {
        this.incrementLoadedTableCount();
        return;
      }
      if (this.source.gdocId) {
        this.loadTable_Google(tableDescr);
      } else {
        switch (this.source.fileType || tableDescr.fileType) {
          case 'json': this.loadDataWithQuery(tableDescr, v.query); break;
          // case "json": this.loadTable_JSON(tableDescr); break;
          case 'csv' :
          case 'tsv' : this.loadTable_CSV(tableDescr); break;
        }
      }
    }, this);
  } else if (this.source.callback) this.source.callback.call(this, this);
};

Browser.prototype.loadTable_Google = function loadTable_Google(sheet) {
  const me = this;
  const headers = sheet.headers ? sheet.headers : 1;
  let qString = `https://docs.google.com/spreadsheets/d/${ this.source.gdocId}/gviz/tq?headers=${headers}`;
  if (sheet.sheetID) {
    qString += `&gid=${ sheet.sheetID}`;
  } else {
    qString += `&sheet=${ sheet.name}`;
  }
  if (sheet.range) {
    qString += `&range=${  sheet.range}`;
  }

  const sheetName = sheet.name;

  let googleQuery;

  const getWithAuth = function () {
    gapi.load('client', () => {
      gapi.auth.authorize(
        { client_id: googleClientID,
          scope: 'https://spreadsheets.google.com/feeds',
          immediate: true,
        },
        (authResult) => {
          let authorizeButton = document.getElementById('kshf-Sheets-Auth-Button');
          if (authResult && !authResult.error) {
            if (authorizeButton) authorizeButton.style.visibility = 'hidden';
            doQuery();
          } else if (authorizeButton) {
            alert('Please click the Authorize button');
            authorizeButton.style.visibility = '';
            authorizeButton.onclick = function (event) {
              gapi.auth.authorize(
                { client_id: googleClientID,
                  scope: 'https://spreadsheets.google.com/feeds',
                  immediate: false },
                (authResult) => {
                  if (authResult && !authResult.error) doQuery();
                });
              return false;
            };
          }
        },
      );
    });
  };

  // is accessed when there is a response from google sheets
  window.kshfHandleGoogleSheetResponse = function (response) {
    if (response.status === 'error') {
      if (response.errors[0].reason === 'access_denied') {
        // need to run it in authenticated mode
        getWithAuth();
      }
    } else {
      if (kshf.dt[sheetName]) {
        me.incrementLoadedTableCount();
        return;
      }

      if (response.isError()) {
        me.panel_overlay.select('div.status_text .info').text('Cannot load data');
        me.panel_overlay.select('span.spinner').selectAll('span').remove();
        me.panel_overlay.select('span.spinner').append('i').attr('class', 'fa fa-warning');
        google.visualization.errors.addErrorFromQueryResponse(
          me.panel_overlay.select('div.status_text .dynamic').node(),
          response,
        );
        return;
      }

      let j,
        r,
        i,
        arr = [],
        idIndex = -1,
        itemId = 0;
      const dataTable = response.getDataTable();
      const numCols = dataTable.getNumberOfColumns();

      // find the index with sheet.id (idIndex)
      for (i = 0; true; i++) {
        if (i === numCols || dataTable.getColumnLabel(i).trim() === sheet.id) {
          idIndex = i;
          break;
        }
      }

      const tmpTable = [];

      // create the column name tables
      for (j = 0; j < dataTable.getNumberOfColumns(); j++) {
        tmpTable.push(dataTable.getColumnLabel(j).trim());
      }

      // create the item array
      arr.length = dataTable.getNumberOfRows(); // pre-allocate for speed
      for (r = 0; r < dataTable.getNumberOfRows(); r++) {
        const c = {};
        for (i = 0; i < numCols; i++) {
          c[tmpTable[i]] = dataTable.getValue(r, i);
        }
        // push unique id as the last column if necessary
        if (c[sheet.id] === undefined) c[sheet.id] = itemId++;
        arr[r] = new Record(c, sheet.id);
      }

      me.finishDataLoad(sheet, arr);
    }
  };

  function doQuery() {
    let queryString = qString;
    if (sheet.auth) {
      queryString += `&access_token=${encodeURIComponent(gapi.auth.getToken().access_token)}`;
    }
    queryString += '&tqx=responseHandler:kshfHandleGoogleSheetResponse';

    googleQuery = new google.visualization.Query(queryString);
    if (sheet.query) googleQuery.setQuery(sheet.query);
    googleQuery.send(kshfHandleGoogleSheetResponse);
  }

  // is accessed when there is a response from google sheets
  window.kshfCheckSheetPrivacy = function (response) {
    if (response.status === 'error') {
      if (response.errors[0].reason === 'access_denied') {
        sheet.auth = true;
        // need to run it in authenticated mode
        getWithAuth();
      }
    } else {
      doQuery();
    }
  };

  if (sheet.auth) {
    getWithAuth();
  } else if (this.source.tables.length > 1) {
    doQuery();
  } else {
    // Do a simple access to see if the response would be an access error.
    let queryString = qString;
    queryString += '&tqx=responseHandler:kshfCheckSheetPrivacy&range=A1:A1';
    const scriptDOM = document.createElement('script');
    scriptDOM.type = 'text/javascript';
    scriptDOM.src = queryString;
    document.head.appendChild(scriptDOM);
  }
};

Browser.prototype.loadTable_CSV = function loadTable_CSV(tableDescr) {
  const me = this;

  if (kshf.dt[tableDescr.name]) {
    me.incrementLoadedTableCount();
    return;
  }

  const config = {};
  config.dynamicTyping = true;
  config.header = true; // header setting can be turned off
  if (tableDescr.header === false) config.header = false;
  if (tableDescr.preview !== undefined) config.preview = tableDescr.preview;
  if (tableDescr.fastMode !== undefined) config.fastMode = tableDescr.fastMode;
  if (tableDescr.dynamicTyping !== undefined) config.dynamicTyping = tableDescr.dynamicTyping;

  let _i = 0,
    arr = [],
    idColumn = tableDescr.id;
  config.chunk = function (_rows) {
    _rows.data.forEach((row) => {
      if (row[idColumn] === undefined) row[idColumn] = _i++;
      arr.push(new Record(row, idColumn));
    });
  };
  config.complete = function () {
    me.finishDataLoad(tableDescr, arr);
  };

  if (tableDescr instanceof File) {
    // Load using FileReader
    const reader = new FileReader();
    reader.onload = function (e) { Papa.parse(e.target.result, config); };
    reader.readAsText(tableDescr);
  } else if (tableDescr.stream) {
    // TODO: if there is a callback function, do it synchronously
    config.download = true;
    Papa.parse(
      `${this.source.dirPath + tableDescr.name  }.${  this.source.fileType}`,
      config);
  } else {
    if (me.source.callback) me.asyncDataWaitedCnt++;
    // TODO: If callback is defined, perform a SYNC request...
    d3.request(`${this.source.dirPath + tableDescr.name}.${this.source.fileType}`)
      .get((error, data) => {
        Papa.parse(data.response, config);
        if (me.source.callback) me.asyncDataLoaded();
      });
  }
};

Browser.prototype.loadTable_JSON = function loadTable_JSON(tableDescr) {
  const me = this;
  function processJSONText(data) {
    // File may describe keshif config. Load from config file here!
    if (data.domID) {
      me.options = data;
      me.loadSource(data.source);
      return;
    }
    // if data is already loaded, nothing else to do...
    if (kshf.dt[tableDescr.name] !== undefined) {
      me.incrementLoadedTableCount();
      return;
    }
    const arr = [];
    const idColumn = tableDescr.id;

    data.forEach((dataItem, i) => {
      if (dataItem[idColumn] === undefined) dataItem[idColumn] = i;
      arr.push(new Record(dataItem, idColumn));
    });

    me.finishDataLoad(tableDescr, arr);
  }

  if (tableDescr instanceof File) {
    // Load using FileReader
    const reader = new FileReader();
    reader.onload = function (e) { processJSONText(JSON.parse(e.target.result)); };
    reader.readAsText(tableDescr);
  } else {
    if (me.source.callback) me.asyncDataWaitedCnt++;
    d3.request(`${this.source.dirPath + tableDescr.name}.json?dl=0`)
      .get((error, data) => {
        try {
          processJSONText(JSON.parse(data.response));
          if (me.source.callback) me.asyncDataLoaded();
        } catch (e) { alert('JSON Data could not be loaded/parsed correctly.'); }
      });
  }
};

Browser.prototype.loadDataWithQuery = function loadDataWithQuery(tableDescr, query) {
  function getData() {
    const payload = {
      url: `${process.env.RAW_DATA_HOST_URL}/data/raw`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${localStorage.getItem('id_token')}`,
      },
      data: { text: query },
    };
    return axios(payload);
  }

  axios.all([getData()])
    .then(axios.spread((gD) => {
      processJSONText(gD.data.data);
    }))
    .catch((error) => {
      this.error = this.$error.allCatch(error);
      this.$error.showError(this.error);
    });


  const me = this;
  function processJSONText(data) {
    // File may describe keshif config. Load from config file here!
    if (data.domID) {
      me.options = data;
      me.loadSource(data.source);
      return;
    }
    // if data is already loaded, nothing else to do...
    if (kshf.dt[tableDescr.name] !== undefined) {
      me.incrementLoadedTableCount();
      return;
    }
    const arr = [];
    const idColumn = tableDescr.id;

    data.forEach((dataItem, i) => {
      if (dataItem[idColumn] === undefined) dataItem[idColumn] = i;
      arr.push(new Record(dataItem, idColumn));
    });

    me.finishDataLoad(tableDescr, arr);
  }

  if (this.source.callback) {
    this.asyncDataLoaded();
  }
};

Browser.prototype.finishDataLoad = function finishDataLoad(table, arr) {
  kshf.dt[table.name] = arr;
  const id_table = {};
  arr.forEach((record) => { id_table[record.id()] = record; });
  kshf.dt_id[table.name] = id_table;
  this.incrementLoadedTableCount();
};

Browser.prototype.incrementLoadedTableCount = function incrementLoadedTableCount() {
  const me = this;
  this.source.loadedTableCount++;
  this.panel_overlay.select('div.status_text .dynamic')
    .text(`(${this.source.loadedTableCount }/${ this.source.tables.length })`);

  if (this.source.loadedTableCount === this.source.tables.length) {
    if (this.source.callback) {
      this.source.callback.call(this, this);
    } else {
      this.loadCharts();
    }
  }
};

Browser.prototype.asyncDataLoaded = function asyncDataLoaded() {
  this.asyncDataLoadedCnt++;
  if (this.asyncDataWaitedCnt === this.asyncDataLoadedCnt) {
    this.loadCharts();
  }
};

Browser.prototype.loadCharts = function loadCharts() {
  if (this.primaryTableName === undefined) {
    alert('Cannot load keshif. Please define primaryTableName.');
    return;
  }
  this.records = kshf.dt[this.primaryTableName];

  if (this.recordName === '') {
    this.setRecordName(this.primaryTableName);
  }

  const me = this;
  this.panel_overlay.select('div.status_text .info').text(kshf.lang.cur.CreatingBrowser);
  this.panel_overlay.select('div.status_text .dynamic').text('');
  window.setTimeout(() => { me._loadCharts(); }, 50);
};

Browser.prototype._loadCharts = function _loadCharts() {
  if (this.chartsLoaded) return;
  this.chartsLoaded = true;
  const me = this;

  if (typeof Helpin !== 'undefined') {
    this.helpin = new Helpin(this);
  }

  if (this.onLoad) this.onLoad.call(this);

  this.records.forEach(function (r) { this.allRecordsAggr.addRecord(r); }, this);

  // Create a summary for each existing column in the data
  for (const column in this.records[0].data) {
    if (typeof (column) === 'string') this.createSummary(column);
  }

  // Should do this here, because bottom panel width calls for browser width, and this reads the browser width...
  this.updateWidth_Total();

  if (this.options.summaries) this.options.facets = this.options.summaries;
  this.options.facets = this.options.facets || [];

  this.options.facets.forEach(function (facetDescr) {
    // String -> resolve to name
    if (typeof facetDescr === 'string') {
      facetDescr = { name: facetDescr };
    }

    // **************************************************
    // API compability - process old keys
    if (facetDescr.title) {
      facetDescr.name = facetDescr.title;
    }
    if (facetDescr.sortingOpts) {
      facetDescr.catSortBy = facetDescr.sortingOpts;
    }
    if (facetDescr.layout) {
      facetDescr.panel = facetDescr.layout;
    }
    if (facetDescr.intervalScale) {
      facetDescr.scaleType = facetDescr.intervalScale;
    }

    if (typeof (facetDescr.value) === 'string') {
      // it may be a function definition if so, evaluate
      if (facetDescr.value.substr(0, 8) === 'function') {
        eval(`"use strict"; facetDescr.value = ${facetDescr.value}`);
      }
    }

    if (facetDescr.catLabel ||
      facetDescr.catTooltip ||
      facetDescr.catSplit ||
      facetDescr.catTableName ||
      facetDescr.catSortBy ||
      facetDescr.catMap ||
      facetDescr.catHeight) {
      facetDescr.type = 'categorical';
    } else
    if (facetDescr.scaleType ||
      facetDescr.showPercentile ||
      facetDescr.unitName ||
      facetDescr.skipZero ||
      facetDescr.timeFormat) {
      facetDescr.type = 'interval';
    }

    var summary = this.summaries_by_name[facetDescr.name];
    if (summary === undefined) {
      if (typeof (facetDescr.value) === 'string') {
        var summary = this.summaries_by_name[facetDescr.value];
        if (summary === undefined) {
          summary = this.createSummary(facetDescr.value);
        }
        summary = this.changeSummaryName(facetDescr.value, facetDescr.name);
      } else if (typeof (facetDescr.value) === 'function') {
        summary = this.createSummary(facetDescr.name, facetDescr.value, facetDescr.type);
      } else {
        return;
      }
    } else if (facetDescr.value) {
      summary.destroy();
      summary = this.createSummary(facetDescr.name, facetDescr.value, facetDescr.type);
    }

    if (facetDescr.type) {
      facetDescr.type = facetDescr.type.toLowerCase();
      if (facetDescr.type !== summary.type) {
        summary.destroy();
        if (facetDescr.value === undefined) {
          facetDescr.value = facetDescr.name;
        }
        if (typeof (facetDescr.value) === 'string') {
          summary = this.createSummary(facetDescr.value, null, facetDescr.type);
          if (facetDescr.value !== facetDescr.name) { this.changeSummaryName(facetDescr.value, facetDescr.name); }
        } else if (typeof (facetDescr.value) === 'function') {
          summary = this.createSummary(facetDescr.name, facetDescr.value, facetDescr.type);
        }
      }
    }
    // If summary object is not found/created, nothing else to do
    if (summary === undefined) return;

    summary.sourceDescr = facetDescr;

    if (facetDescr.catSplit) {
      summary.setCatSplit(facetDescr.catSplit);
    }
    if (facetDescr.timeFormat) {
      summary.setTimeFormat(facetDescr.timeFormat);
    }

    summary.initializeAggregates();

    // Common settings
    if (facetDescr.collapsed) {
      summary.setCollapsed(true);
    }
    if (facetDescr.description) {
      summary.setDescription(facetDescr.description);
    }

    // THESE AFFECT HOW CATEGORICAL VALUES ARE MAPPED
    if (summary.type === 'categorical') {
      if (facetDescr.catTableName) {
        summary.setCatTable(facetDescr.catTableName);
      }
      if (facetDescr.catLabel) {
        // if this is a function definition, evaluate it
        if (typeof facetDescr.catLabel === 'string' && facetDescr.catLabel.substr(0, 8) === 'function') {
          eval(`"use strict"; facetDescr.catLabel = ${facetDescr.catLabel}`);
        }
        summary.setCatLabel(facetDescr.catLabel);
      }
      if (facetDescr.catTooltip) {
        summary.setCatTooltip(facetDescr.catTooltip);
      }
      if (facetDescr.catMap) {
        summary.setCatGeo(facetDescr.catMap);
      }
      if (facetDescr.catHeight) {
        summary.setHeight_Category(facetDescr.catHeight);
      }
      if (facetDescr.minAggrValue) {
        summary.setMinAggrValue(facetDescr.minAggrValue);
      }
      if (facetDescr.catSortBy !== undefined) {
        summary.setSortingOptions(facetDescr.catSortBy);
      }

      if (facetDescr.panel !== 'none') {
        facetDescr.panel = facetDescr.panel || 'left';
        summary.addToPanel(this.panels[facetDescr.panel]);
      }

      if (facetDescr.viewAs) {
        summary.viewAs(facetDescr.viewAs);
      }
    }

    if (summary.type === 'interval') {
      if (typeof facetDescr.unitName === 'string') summary.setUnitName(facetDescr.unitName);
      if (facetDescr.showPercentile) {
        summary.showPercentileChart(facetDescr.showPercentile);
      }
      summary.optimumTickWidth = facetDescr.optimumTickWidth || summary.optimumTickWidth;

      // add to panel before you set scale type and other options: TODO: Fix
      if (facetDescr.panel !== 'none') {
        facetDescr.panel = facetDescr.panel || 'left';
        summary.addToPanel(this.panels[facetDescr.panel]);
      }

      if (facetDescr.scaleType) {
        summary.setScaleType(facetDescr.scaleType, true);
      }

      if (facetDescr.skipZero) {
        summary.setSkipZero();
      }
    }
  }, this);

  this.panels.left.updateWidth_MeasureLabel();
  this.panels.right.updateWidth_MeasureLabel();
  this.panels.middle.updateWidth_MeasureLabel();

  this.recordDisplay = new RecordDisplay(this, this.options.recordDisplay || {});

  if (this.options.measure) this.options.metric = this.options.measure;

  if (this.options.metric) {
    const metric = this.options.metric;
    if (typeof metric === 'string') {
      this.setMeasureMetric('Sum', this.summaries_by_name[metric]);
    } else {
      this.setMeasureMetric(metric.type, this.summaries_by_name[metric.summary]);
    }
  }

  this.DOM.recordName.html(this.recordName);

  if (this.source.url) {
    this.DOM.datasource.style('display', 'inline-block').attr('href', this.source.url);
  }

  this.checkBrowserZoomLevel();

  this.loaded = true;

  const x = function () {
    let totalWidth = this.divWidth;
    let colCount = 0;
    if (this.panels.left.summaries.length > 0) {
      totalWidth -= this.panels.left.width_catLabel + kshf.scrollWidth + this.panels.left.width_catMeasureLabel;
      colCount++;
    }
    if (this.panels.right.summaries.length > 0) {
      totalWidth -= this.panels.right.width_catLabel + kshf.scrollWidth + this.panels.right.width_catMeasureLabel;
      colCount++;
    }
    if (this.panels.middle.summaries.length > 0) {
      totalWidth -= this.panels.middle.width_catLabel + kshf.scrollWidth + this.panels.middle.width_catMeasureLabel;
      colCount++;
    }
    return Math.floor((totalWidth) / 8);
  };
  const defaultBarChartWidth = x.call(this);

  this.panels.left.setWidthCatBars(this.options.barChartWidth || defaultBarChartWidth);
  this.panels.right.setWidthCatBars(this.options.barChartWidth || defaultBarChartWidth);
  this.panels.middle.setWidthCatBars(this.options.barChartWidth || defaultBarChartWidth);
  this.panels.bottom.updateSummariesWidth();

  this.updateMiddlePanelWidth();

  this.refresh_filterClearAll();

  this.records.forEach((record) => { record.updateWanted(); });
  this.update_Records_Wanted_Count();

  this.updateAfterFilter();

  this.updateLayout_Height();

  // hide overlay
  this.panel_overlay.attr('show', 'none');

  this.reorderNuggetList();

  if (this.recordDisplay.viewRecAs === 'nodelink') {
    this.recordDisplay.nodelink_restart();
  }

  if (this.onReady) this.onReady();

  if (this.helpin) {
    this.DOM.showHelpIn.node().tipsy.show();
    setTimeout(() => { me.DOM.showHelpIn.node().tipsy.hide(); }, 5000);
  }

  this.finalized = true;

  setTimeout(() => {
    if (me.options.enableAuthoring) me.enableAuthoring(true);
    if (me.recordDisplay.viewRecAs === 'map') {
      setTimeout(() => { me.recordDisplay.recMap_zoomToActive(); }, 1000);
    }
    me.setNoAnim(false);
  }, 1000);
};

Browser.prototype.unregisterBodyCallbacks = function unregisterBodyCallbacks() {
  // TODO: Revert to previous handlers...
  d3.select('body')
    .on('mousemove', null)
    .on('mouseup', null)
    .on('keydown.layout', null);
};

Browser.prototype.prepareDropZones = function prepareDropZones(summary, source) {
  this.movedSummary = summary;
  this.showDropZones = true;
  this.DOM.root
    .attr('showdropzone', true)
    .attr('dropattrtype', summary.getDataType())
    .attr('dropSource', source);
  this.DOM.attribDragBox.style('display', 'block').html(summary.summaryName);
};

Browser.prototype.clearDropZones = function clearDropZones() {
  this.showDropZones = false;
  this.unregisterBodyCallbacks();
  this.DOM.root.attr('showdropzone', null);
  this.DOM.attribDragBox.style('display', 'none');
  this.movedSummary = undefined;
};

Browser.prototype.reorderNuggetList = function reorderNuggetList() {
  this.summaries = this.summaries.sort(this.thumbvizSortFunction);

  this.DOM.attributeList.selectAll('.nugget')
    .data(this.summaries, summary => summary.summaryID).order();
};

Browser.prototype.autoCreateBrowser = function autoCreateBrowser() {
  this.summaries.forEach(function (summary, i) {
    if (summary.uniqueCategories()) return;
    if (summary.type === 'categorical' && summary._aggrs.length > 1000) return;
    if (summary.panel) return;
    this.autoAddSummary(summary);
    this.updateLayout_Height();
  }, this);
  this.updateLayout();
};

Browser.prototype.autoAddSummary = function autoAddSummary(summary) {
  if (summary.uniqueCategories()) {
    this.recordDisplay.setRecordViewSummary(summary);
    if (this.recordDisplay.textSearchSummary === null) { this.recordDisplay.setTextSearchSummary(summary); }
    return;
  }
  let target_panel;
  if (summary.isTimeStamp()) {
    target_panel = 'bottom';
  } else if (summary.type === 'categorical') {
    target_panel = 'left';
    if (this.panels.left.summaries.length > Math.floor(this.panels.left.height / 150)) target_panel = 'middle';
  } else if (summary.type === 'interval') {
    target_panel = 'right';
    if (this.panels.right.summaries.length > Math.floor(this.panels.right.height / 150)) target_panel = 'middle';
  }
  summary.addToPanel(this.panels[target_panel]);
};

Browser.prototype.saveFilterSelection = function saveFilterSelection() {
  const sumName = "<i class='fa fa-floppy-o'></i> Saved Selections";
  let summary = this.summaries_by_name[sumName];
  if (summary === undefined) {
    summary = this.createSummary(sumName, null, 'categorical');
    summary.setCatLabel('name');
    summary.setCatTooltip('name');
    summary.addToPanel(this.panels.middle);
  }

  let longName = '';
  this.filters.forEach((filter) => {
    if (!filter.isFiltered) return;
    longName += filter.getRichText();
  });

  const catId = summary._aggrs.length;
  const aggr = new Aggregate_Category(summary, { id: catId, name: longName }, 'id');
  this.allAggregates.push(aggr);

  let multiValued_New = false;
  this.records.forEach((record) => {
    if (!record.isWanted) return;

    let record_valueCache = record._valueCache[summary.summaryID];

    if (record_valueCache === null) {
      record_valueCache = [];
      record._valueCache[summary.summaryID] = record_valueCache;
      summary.missingValueAggr.removeRecord(record);
    } else {
      // the record is listed under multiple aggregates (saved selections)
      multiValued_New = true;
    }

    record_valueCache.push(catId);
    aggr.addRecord(record);
  });

  if (!summary.isMultiValued && multiValued_New) {
    // now summary has multiple values
    summary.DOM.root.attr('isMultiValued', true);
    summary.isMultiValued = true;
  }
  if (summary.setSummary) {
    // TODO: Adjust set summary based on the new aggregate (category)
  }

  summary.catTable_id[aggr.id()] = aggr;
  summary._aggrs.push(aggr);

  if (summary._aggrs.length === 1) {
    summary.init_DOM_Cat();
  }

  summary.updateCats();
  summary.insertCategories();

  if (summary.catSortBy.length === 0) summary.setSortingOptions();
  summary.catSortBy_Active.no_resort = false;

  summary.updateCatSorting(0, true, true);
  summary.refreshLabelWidth();
  summary.refreshViz_Nugget();

  summary.panel.updateWidth_MeasureLabel();
  summary.panel.refreshAdjustWidth();

  this.updateLayout_Height();
};

Browser.prototype.clearFilters_All = function clearFilters_All(force) {
  const me = this;
  if (this.skipSortingFacet) {
    // you can now sort the last filtered summary, attention is no longer there.
    this.skipSortingFacet.dirtySort = false;
    this.skipSortingFacet.DOM.catSortButton.attr('resort', false);
  }
  // clear all registered filters
  this.filters.forEach((filter) => { filter.clearFilter(false); });
  if (force !== false) {
    this.records.forEach((record) => {
      if (!record.isWanted) record.updateWanted(); // Only update records which were not wanted before.
    });
    this.update_Records_Wanted_Count();
    this.refresh_filterClearAll();
    this.updateAfterFilter(); // more results
  }
  setTimeout(() => { me.updateLayout_Height(); }, 1000); // update layout after 1.75 seconds
};

Browser.prototype.getGlobalActiveMeasure = function getGlobalActiveMeasure() {
  if (this.allRecordsAggr.recCnt.Active === 0) return 'No';
  const numStr = this.allRecordsAggr.measure('Active').toLocaleString();
  if (this.measureSummary) return this.measureSummary.printWithUnitName(numStr);
  return numStr;
};

Browser.prototype.refresh_ActiveRecordCount = function refresh_ActiveRecordCount() {
  this.DOM.activeRecordMeasure.html(this.getGlobalActiveMeasure());
};

Browser.prototype.update_Records_Wanted_Count = function update_Records_Wanted_Count() {
  this.recordsWantedCount = 0;
  this.records.forEach(function (record) { if (record.isWanted) this.recordsWantedCount++; }, this);
  this.refreshTotalViz();
  this.refresh_ActiveRecordCount();
};

Browser.prototype.updateAfterFilter = function updateAfterFilter() {
  kshf.browser = this;
  this.clearSelect_Compare('A');
  this.clearSelect_Compare('B');
  this.clearSelect_Compare('C');
  this.summaries.forEach((summary) => { summary.updateAfterFilter(); });
  this.recordDisplay.updateAfterFilter();
  this.needToRefreshLayout = true;
};

Browser.prototype.isFiltered = function isFiltered() {
  return this.filters.filter(filter => filter.isFiltered).length > 0;
};

Browser.prototype.refresh_filterClearAll = function refresh_filterClearAll() {
  this.DOM.filterClearAll.attr('active', this.isFiltered());
  this.DOM.saveSelection.attr('active', this.isFiltered());
};

/** Ratio mode is when glyphs scale to their max */
Browser.prototype.setScaleMode = function setScaleMode(how) {
  this.ratioModeActive = how;
  this.DOM.root.attr('relativeMode', how || null);
  this.setPercentLabelMode(how);
  this.summaries.forEach((summary) => { summary.refreshViz_All(); });
  this.refreshMeasureLabels('Active');
  this.refreshTotalViz();
};

Browser.prototype.showScaleModeControls = function showScaleModeControls(how) {
  this.DOM.root.attr('showScaleModeControls', how || null);
};

Browser.prototype.refreshMeasureLabels = function refreshMeasureLabels(t) {
  this.measureLabelType = t;
  this.DOM.root.attr('measureLabelType', this.measureLabelType ? this.measureLabelType : null);
  this.summaries.forEach((summary) => { summary.refreshMeasureLabel(); });
};

Browser.prototype.setPercentLabelMode = function setPercentLabelMode(how) {
  this.percentModeActive = how;
  this.DOM.root.attr('percentLabelMode', how ? 'true' : null);
  this.summaries.forEach((summary) => {
    if (!summary.inBrowser()) return;
    summary.refreshMeasureLabel();
    if (summary.viewType === 'map') {
      summary.refreshMapColorScaleBounds();
    }
    summary.refreshViz_Axis();
  });
};

Browser.prototype.clearSelect_Compare = function clearSelect_Compare(cT) {
  const ccT = `Compare_${cT}`;
  this.DOM.root.attr(`select${ccT}`, null);
  this.vizActive[ccT] = false;
  if (this.selectedAggr[ccT]) {
    this.selectedAggr[ccT].clearCompare(cT);
    this.selectedAggr[ccT] = null;
  }
  this.allAggregates.forEach((aggr) => {
    aggr._measure[ccT] = 0;
    aggr.recCnt[ccT] = 0;
  });
  this.summaries.forEach((summary) => { summary.refreshViz_Compare_All(); });

  this[`crumb_${ccT}`].removeCrumb();

  this.recordDisplay.refreshViz_Compare_All();
};

Browser.prototype.setSelect_Compare = function setSelect_Compare(noReclick, _copy) {
  let selAggregate = this.selectedAggr.Highlight;

  if (selAggregate === undefined) return;

  if (selAggregate.compared) {
    const x = selAggregate.compared;
    this.clearSelect_Compare(selAggregate.compared);
    if (noReclick) {
      this[`crumb_Compare_${x}`].removeCrumb();
      return;
    }
  }

  let cT = 'A';
  if (this.vizActive.Compare_A) cT = this.vizActive.Compare_B ? 'C' : 'B';

  const compId = `Compare_${cT}`;

  if (_copy) {
    // Copy selected summary and records from highlight selection
    this[`flexAggr_${compId}`].records = this.selectedAggr.Highlight.records;
    this[`flexAggr_${compId}`].summary = this.selectedAggr.Highlight.summary;
    selAggregate = this[`flexAggr_${compId}`];
  }

  this.vizActive[compId] = true;
  this.DOM.root.attr(`select${compId}`, true);
  this.selectedAggr[compId] = selAggregate;
  this.selectedAggr[compId].selectCompare(cT);

  // Copy aggregate measures from highlight selection to compare selection
  if (!this.preview_not) {
    this.allAggregates.forEach((aggr) => {
      aggr._measure[compId] = aggr._measure.Highlight;
      aggr.recCnt[compId] = aggr.recCnt.Highlight;
    }, this);
  } else {
    this.allAggregates.forEach((aggr) => {
      aggr._measure[compId] = aggr._measure.Active - aggr._measure.Highlight;
      aggr.recCnt[compId] = aggr.recCnt.Active - aggr.recCnt.Highlight;
    }, this);
  }

  // Done
  this.summaries.forEach(function (summary) {
    if (this.measureFunc === 'Avg' && summary.updateChartScale_Measure) {
      // refreshes all visualizations automatically
      summary.updateChartScale_Measure();
    } else {
      summary.refreshViz_Compare_All();
    }
  }, this);

  this.refreshTotalViz();

  this.clearSelect_Highlight(true);

  this[`crumb_${compId}`].showCrumb(selAggregate.summary);

  if (this.helpin) {
    this.helpin.topicHistory.push(_material._topics.T_SelectCompare);
  }

  return cT;
};

Browser.prototype.clearSelect_Highlight = function clearSelect_Highlight(now) {
  const me = this;
  this.vizActive.Highlight = false;
  this.DOM.root.attr('selectHighlight', null);
  this.highlightSelectedSummary = null;
  if (this.selectedAggr.Highlight) {
    this.selectedAggr.Highlight.clearHighlight();
    this.selectedAggr.Highlight = undefined;
  }

  this.allAggregates.forEach((aggr) => {
    aggr._measure.Highlight = 0;
    aggr.recCnt.Highlight = 0;
  });
  this.summaries.forEach((summary) => { summary.refreshViz_Highlight(); });
  this.refreshTotalViz();

  // if the crumb is shown, start the hide timeout
  if (this.highlightCrumbTimeout_Hide) clearTimeout(this.highlightCrumbTimeout_Hide);
  if (now) {
    me.crumb_Highlight.removeCrumb(now);
  } else {
    this.highlightCrumbTimeout_Hide = setTimeout(function () {
      this.highlightCrumbTimeout_Hide = undefined;
      me.crumb_Highlight.removeCrumb();
    }, 1000);
  }

  this.refreshMeasureLabels('Active');
};

Browser.prototype.setSelect_Highlight = function setSelect_Highlight(selAggregate) {
  const me = this;
  if (selAggregate === undefined) {
    selAggregate = this.flexAggr_Highlight; // flexible aggregate
  }
  this.vizActive.Highlight = true;
  this.DOM.root.attr('selectHighlight', true);
  this.highlightSelectedSummary = selAggregate.summary;
  this.selectedAggr.Highlight = selAggregate;
  this.selectedAggr.Highlight.selectHighlight();

  this.summaries.forEach((summary) => { summary.refreshViz_Highlight(); });
  this.refreshTotalViz();

  clearTimeout(this.highlightCrumbTimeout_Hide);
  this.highlightCrumbTimeout_Hide = undefined;

  this.crumb_Highlight.showCrumb(selAggregate.summary);
  this.refreshMeasureLabels('Highlight');
};

Browser.prototype.getMeasureFuncTypeText = function getMeasureFuncTypeText() {
  switch (this.measureFunc) {
    case 'Count': return '';
    case 'Sum' : return `Total ${this.measureSummary.summaryName} of `;
    case 'Avg' : return `Average ${this.measureSummary.summaryName } of `;
  }
};

Browser.prototype.getMeasureFuncTypeText_Brief = function getMeasureFuncTypeText_Brief() {
  switch (this.measureFunc) {
    case 'Count': return this.recordName;
    case 'Sum' : return `Total ${this.measureSummary.summaryName}`;
    case 'Avg' : return `Average ${this.measureSummary.summaryName}`;
  }
};

/** metricType: "Sum" or "Avg" */
Browser.prototype.setMeasureMetric = function setMeasureMetric(metricType, summary) {
  if (summary === undefined || summary.type !== 'interval' || summary.scaleType === 'time') {
    // Clearing measure summary (defaulting to count)
    if (this.measureSummary === undefined) return; // No update
    this.measureSummary = undefined;
    this.records.forEach((record) => { record.measure_Self = 1; });
    this.measureFunc = 'Count';
  } else {
    if (this.measureSummary === summary && this.measureFunc === metricType) return; // No update
    this.measureSummary = summary;
    this.measureFunc = metricType;
    summary.initializeAggregates();
    this.records.forEach((record) => { record.measure_Self = summary.getRecordValue(record); });
  }

  this.DOM.measureFuncType.html(this.getMeasureFuncTypeText());

  this.DOM.root.attr('measureFunc', this.measureFunc);

  if (this.measureFunc === 'Avg') {
    // Remove ratio and percent modes
    if (this.ratioModeActive) { this.setScaleMode(false); }
    if (this.percentModeActive) { this.setPercentLabelMode(false); }
  }

  this.allAggregates.forEach((aggr) => { aggr.resetAggregateMeasures(); });
  this.summaries.forEach((summary) => { summary.updateAfterFilter(); });
  this.update_Records_Wanted_Count();

  // measure labels need to be updated in all cases, numbers might change, unit names may be added...
  this.panels.left.updateWidth_MeasureLabel();
  this.panels.right.updateWidth_MeasureLabel();
  this.panels.middle.updateWidth_MeasureLabel();
  this.panels.bottom.updateWidth_MeasureLabel();
};

Browser.prototype.checkBrowserZoomLevel = function checkBrowserZoomLevel() {
  // Using devicePixelRatio works in Chrome and Firefox, but not in Safari
  // I have not tested IE yet.
  if (window.devicePixelRatio !== undefined) {
    if (window.devicePixelRatio !== 1 && window.devicePixelRatio !== 2) {
      const me = this;
      setTimeout(() => {
        me.showWarning('Please reset your browser zoom level for the best experience.');
      }, 1000);
    } else {
      this.hideWarning();
    }
  } else {
    this.hideWarning();
  }
};

Browser.prototype.updateLayout = function updateLayout() {
  if (this.loaded !== true) return;
  this.updateWidth_Total();
  this.updateLayout_Height();
  this.updateMiddlePanelWidth();
  this.refreshTotalViz();
};

Browser.prototype.getHeight_PanelBasic = function getHeight_PanelBasic() {
  return Math.max(parseInt(this.DOM.panel_Basic.style('height')), 24) + 6;
};

Browser.prototype.updateLayout_Height = function updateLayout_Height() {
  const me = this;
  let divHeight_Total = parseInt(this.DOM.root.style('height'));

  divHeight_Total -= this.getHeight_PanelBasic();

  // initialize all summaries as not yet processed.
  this.summaries.forEach((summary) => { if (summary.inBrowser()) summary.heightProcessed = false; });

  let bottomPanelHeight = 0;
  // process bottom summary
  if (this.panels.bottom.summaries.length > 0) {
    let targetHeight = divHeight_Total / 3;
    // they all share the same target height
    this.panels.bottom.summaries.forEach((summary) => {
      targetHeight = Math.min(summary.getHeight_RangeMax(), targetHeight);
      summary.setHeight(targetHeight);
      summary.heightProcessed = true;
      bottomPanelHeight += summary.getHeight();
    });
  }

  const doLayout = function (sectionHeight, summaries) {
    sectionHeight -= 1;// just use 1-pixel gap
    let finalPass = false;
    let lastRound = false;

    let processedFacets = 0;
    summaries.forEach((summary) => { if (summary.heightProcessed) processedFacets++; });

    while (true) {
      var remainingFacetCount = summaries.length - processedFacets;
      if (remainingFacetCount === 0) break;
      const processedFacets_pre = processedFacets;
      function finishSummary(summary) {
        sectionHeight -= summary.getHeight();
        summary.heightProcessed = true;
        processedFacets++;
        remainingFacetCount--;
      }
      summaries.forEach((summary) => {
        if (summary.heightProcessed) return;
        // Empty or collapsed summaries: Fixed height, nothing to change;
        if (summary.isEmpty() || summary.collapsed) {
          finishSummary(summary);
          return;
        }
        // in last round, if summary can expand, expand it further
        if (lastRound === true && summary.heightProcessed && summary.getHeight_RangeMax() > summary.getHeight()) {
          sectionHeight += summary.getHeight();
          summary.setHeight(sectionHeight);
          sectionHeight -= summary.getHeight();
          return;
        }
        if (remainingFacetCount === 0) return;

        // Fairly distribute remaining size across all remaining summaries.
        const targetHeight = Math.floor(sectionHeight / remainingFacetCount);

        // auto-collapse summary if you do not have enough space
        if (finalPass && targetHeight < summary.getHeight_RangeMin()) {
          summary.setCollapsed(true);
          finishSummary(summary);
          return;
        }
        if (summary.getHeight_RangeMax() <= targetHeight) {
          summary.setHeight(summary.getHeight_RangeMax());
          finishSummary(summary);
        } else if (finalPass) {
          summary.setHeight(targetHeight);
          finishSummary(summary);
        }
      }, this);
      finalPass = processedFacets_pre === processedFacets;
      if (lastRound === true) break;
      if (remainingFacetCount === 0) lastRound = true;
    }
    return sectionHeight;
  };

  let topPanelsHeight = divHeight_Total;
  this.panels.bottom.DOM.root.style('height', `${bottomPanelHeight}px`);

  topPanelsHeight -= bottomPanelHeight;
  this.DOM.panelsTop.style('height', `${topPanelsHeight}px`);

  // Left Panel
  if (this.panels.left.summaries.length > 0) {
    this.panels.left.height = topPanelsHeight;
    doLayout.call(this, topPanelsHeight, this.panels.left.summaries);
  }
  // Right Panel
  if (this.panels.right.summaries.length > 0) {
    this.panels.right.height = topPanelsHeight;
    doLayout.call(this, topPanelsHeight, this.panels.right.summaries);
  }
  // Middle Panel
  let midPanelHeight = 0;
  if (this.panels.middle.summaries.length > 0) {
    let panelHeight = topPanelsHeight;
    if (this.recordDisplay.recordViewSummary) {
      if (this.recordDisplay.collapsed) {
        panelHeight -= this.recordDisplay.DOM.recordDisplayHeader.node().offsetHeight;
      } else {
        panelHeight -= 200; // give 200px for recordDisplay
      }
    } else {
      panelHeight -= this.recordDisplay.DOM.root.node().offsetHeight;
    }
    midPanelHeight = panelHeight - doLayout.call(this, panelHeight, this.panels.middle.summaries);
  }
  this.panels.middle.DOM.root.style('height', `${midPanelHeight }px`);

  // The part where summary DOM is updated
  this.summaries.forEach((summary) => { if (summary.inBrowser()) summary.refreshHeight(); });

  if (this.recordDisplay && !this.recordDisplay.collapsed) {
    // get height of header
    let listDisplayHeight = divHeight_Total
      - this.recordDisplay.DOM.recordDisplayHeader.node().offsetHeight
      - midPanelHeight
      - bottomPanelHeight;
    if (this.showDropZones && this.panels.middle.summaries.length === 0) listDisplayHeight *= 0.5;
    this.recordDisplay.setHeight(listDisplayHeight);
  }
};

Browser.prototype.updateMiddlePanelWidth = function updateMiddlePanelWidth() {
  // for some reason, on page load, this variable may be null. urgh.
  let widthMiddlePanel = this.getWidth_Browser();
  let marginLeft = 0;
  let marginRight = 0;
  if (this.panels.left.summaries.length > 0) {
    marginLeft = 2;
    widthMiddlePanel -= this.panels.left.getWidth_Total() + 2;
  }
  if (this.panels.right.summaries.length > 0) {
    marginRight = 2;
    widthMiddlePanel -= this.panels.right.getWidth_Total() + 2;
  }
  this.panels.left.DOM.root.style('margin-right', `${marginLeft}px`);
  this.panels.right.DOM.root.style('margin-left', `${marginRight }px`);
  this.panels.middle.setTotalWidth(widthMiddlePanel);
  this.panels.middle.updateSummariesWidth();
  this.panels.bottom.setTotalWidth(this.divWidth);
  this.panels.bottom.updateSummariesWidth();

  this.DOM.middleColumn.style('width', `${widthMiddlePanel}px`);

  if (this.recordDisplay) this.recordDisplay.setWidth(widthMiddlePanel);
};

Browser.prototype.getTickLabel = function getTickLabel(_val) {
  if ((this.measureFunc === 'Count') || (this.measureFunc === 'Sum' && !this.measureSummary.hasFloat)) {
    _val = Math.round(_val);
  }
  if (this.ratioModeActive || this.percentModeActive) {
    return `${_val.toFixed(0)}<span class='unitName'>%</span>`;
  } else if (this.measureSummary) {
    // Print with the measure summary unit
    return this.measureSummary.printWithUnitName(kshf.Util.formatForItemCount(_val));
  }
  return kshf.Util.formatForItemCount(_val);
};

Browser.prototype.getMeasureLabel = function getMeasureLabel(aggr, summary) {
  let _val;
  if (!(aggr instanceof Aggregate)) {
    _val = aggr;
  } else {
    _val = aggr.measure(this.measureLabelType);
    if (this.preview_not) {
      _val = this.ratioModeActive ? (aggr.measure('Active') - _val) : (aggr.measure('Total') - _val);
    }
    if (this.percentModeActive) {
      // Cannot be Avg-function
      if (aggr._measure.Active === 0) return '';
      if (this.ratioModeActive) {
        if (this.measureLabelType === "Active") return '';
        _val = 100 * _val / aggr._measure.Active;
      } else {
        _val = 100 * _val / this.allRecordsAggr._measure.Active;
      }
    }
  }

  if (this.measureFunc !== "Count") { // Avg or Sum
    _val = Math.round(_val);
  }

  if (this.percentModeActive) {
    if (aggr.DOM && aggr.DOM.aggrGlyph.nodeName === "g") {
      return `${_val.toFixed(0)}%`;
    }
    return `${_val.toFixed(0)}<span class='unitName'>%</span>`;
  } else if (this.measureSummary) {
    // Print with the measure summary unit
    return this.measureSummary.printWithUnitName(
      kshf.Util.formatForItemCount(_val),
      (aggr.DOM && aggr.DOM.aggrGlyph.nodeName === "g"),
    );
  }
  return kshf.Util.formatForItemCount(_val);
};

Browser.prototype.exportConfig = function exportConfig() {
  const config = {};
  config.domID = this.domID;
  config.recordName = this.recordName;
  config.source = this.source;
  delete config.source.loadedTableCount;
  config.summaries = [];
  config.leftPanelLabelWidth = this.panels.left.width_catLabel;
  config.rightPanelLabelWidth = this.panels.right.width_catLabel;
  config.middlePanelLabelWidth = this.panels.middle.width_catLabel;

  if (typeof this.onLoad === 'function') {
    config.onLoad = this.onLoad.toString();
  }

  if (typeof this.onReady === 'function') {
    config.onReady = this.onReady.toString();
  }

  ['left', 'right', 'middle', 'bottom'].forEach(function (p) {
    // Need to export summaries in-order of the panel appearance
    // TODO: Export summaries not within browser...
    this.panels[p].summaries.forEach((summary) => {
      config.summaries.push(summary.exportConfig());
    });
  }, this);
  if (this.recordDisplay.recordViewSummary) {
    config.recordDisplay = this.recordDisplay.exportConfig();
  }
  return config;
};

export default Browser;
