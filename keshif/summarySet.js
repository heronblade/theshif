import SummaryBase from './summaryBase';
import kshf from './kshf';
import * as d3 from 'd3';

function SummarySet() {}

// got rid of this so we do nto have cyclical dependencies
// SummarySet.prototype = Object.create(SummaryBase.prototype);

SummarySet.prototype.initialize = function initialize(browser, setListSummary, side) {
  SummaryBase.prototype.initialize.call(this, browser, `Relations in ${setListSummary.summaryName}`);
  const me = this;
  this.setListSummary = setListSummary;

  this.panel = this.setListSummary.panel; // so that inBrowser() would work correctly. Hmmm...

  this.popupSide = side || ((this.setListSummary.panel.name === 'left') ? 'right' : 'left');

  this.pausePanning = false;
  this.gridPan_x = 0;

  this.prepareSetMatrixSorting();

  this.setListSummary.onCatCull = function () {
    if (me.pausePanning) return;
    me.checkPan();
    me.refreshSVGViewBox();
  };
  this.setListSummary.onCatHeight = function () {
    me.updateWidthFromHeight();
    me.updateSetPairScale();

    me.DOM.chartRoot.attr('show_gridlines', (me.getRowHeight() > 15));

    me.DOM.setPairGroup.attr('animate_position', false);
    me.refreshRow();
    me.refreshSetPair_Background();
    me.refreshSetPair_Position();
    me.refreshViz_All();
    me.refreshWindowSize();
    me.refreshSetPair_Strength();
    setTimeout(() => {
      me.DOM.setPairGroup.attr('animate_position', true);
    }, 1000);
  };

  this._setPairs = [];
  this._setPairs_ID = {};
  this._sets = this.setListSummary._aggrs; // sorted already
  this._sets.forEach((set) => { set.setPairs = []; });

  this.createSetPairs();

  // Inserts the DOM root under the setListSummary so that the matrix view is attached...
  this.DOM.root = this.setListSummary.DOM.root.insert('div', ':first-child')
    .attr('class', 'kshfSummary setPairSummary')
    .attr('popupSide', this.popupSide);

  // Use keshif's standard header
  this.insertHeader();
  this.DOM.headerGroup.style('height', `${this.setListSummary.getHeight_Header()}px`);

  this.DOM.chartRoot = this.DOM.wrapper.append('span')
    .attr('class', 'SummarySet')
    .attr('noanim', false)
    .attr('show_gridlines', true);

  this.DOM.chartRoot.append('span').attr('class', 'setMatrixWidthAdjust')
    .attr('title', 'Drag to adjust width')
    .on('mousedown', (d, i) => {
      if (d3.event.which !== 1) return; // only respond to left-click
      browser.DOM.root.attr('adjustWidth', true).attr('pointerEvents', false);
      me.DOM.root.attr('noanim', true);
      me.DOM.setPairGroup.attr('animate_position', false);
      const mouseInit_x = d3.mouse(d3.select('body').node())[0];
      const initWidth = me.getWidth();
      const myHeight = me.getHeight();
      d3.select('body').on('mousemove', () => {
        const mouseDif = d3.mouse(d3.select('body').node())[0] - mouseInit_x;
        me.noanim = true;
        me.summaryWidth = (me.popupSide === 'left') ? initWidth - mouseDif : initWidth + mouseDif;
        me.checkWidth();
        me.refreshWindowSize();
        me.refreshRow_LineWidths();
        me.refreshSetPair_Position();
      }).on('mouseup', () => {
        browser.DOM.root.attr('adjustWidth', null).attr('pointerEvents', true);
        me.DOM.setPairGroup.attr('animate_position', true);
        me.DOM.root.attr('noanim', false);
        me.noanim = false;
        // unregister mouse-move callbacks
        d3.select('body').on('mousemove', null).on('mouseup', null);
      });
      d3.event.preventDefault();
    })
    .on('click', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
    });

  this.insertControls();

  this.DOM.setMatrixSVG = this.DOM.chartRoot.append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('class', 'setMatrix');

  /** BELOW THE MATRIX * */
  this.DOM.belowMatrix = this.DOM.chartRoot.append('div').attr('class', 'belowMatrix');

  this.DOM.pairCount = this.DOM.belowMatrix.append('span').attr('class', 'pairCount matrixInfo');
  this.DOM.pairCount_Text = this.DOM.pairCount.append('span').attr('class', 'pairCount_Text')
    .html(`<i class='fa fa-circle' style='color: #b1bdc5;'></i> ${
      this._setPairs.length} Pairs (${Math.round(100 * this._setPairs.length / this.getSetPairCount_Total())}%)`);

  this.DOM.subsetCount = this.DOM.belowMatrix.append('span').attr('class', 'subsetCount matrixInfo');
  this.DOM.subsetCount.append('span').attr('class', 'circleeee borrderr');
  this.DOM.subsetCount_Text = this.DOM.subsetCount.append('span').attr('class', 'subsetCount_Text');

  // invisible background - Used for panning
  this.DOM.setMatrixBackground = this.DOM.setMatrixSVG.append('rect')
    .attr('x', 0).attr('y', 0)
    .style('fill-opacity', '0')
    .on('mousedown', function () {
      const background_dom = this.parentNode.parentNode.parentNode.parentNode;

      background_dom.style.cursor = 'all-scroll';
      me.browser.DOM.pointerBlock.attr('active', '');
      me.browser.DOM.root.attr('pointerEvents', false);

      const mouseInitPos = d3.mouse(background_dom);
      const gridPan_x_init = me.gridPan_x;

      // scroll the setlist summary too...
      const scrollDom = me.setListSummary.DOM.aggrGroup.node();
      const initScrollPos = scrollDom.scrollTop;
      const w = me.getWidth();
      const h = me.getHeight();
      const initT = me.setListSummary.scrollTop_cache;
      const initR = Math.min(-initT - me.gridPan_x, 0);

      me.pausePanning = true;

      d3.select('body').on('mousemove', () => {
        const mouseMovePos = d3.mouse(background_dom);
        let difX = mouseMovePos[0] - mouseInitPos[0];
        const difY = mouseMovePos[1] - mouseInitPos[1];

        if (me.popupSide === 'right') {
          difX *= -1;
        }

        me.gridPan_x = Math.min(0, gridPan_x_init + difX + difY);
        me.checkPan();

        const maxHeight = me.setListSummary.heightCat * me.setListSummary._aggrs.length - h;

        let t = initT - difY;
        t = Math.min(maxHeight, Math.max(0, t));
        let r = initR - difX;
        r = Math.min(0, Math.max(r, -t));

        if (me.popupSide === 'right') r = -r;

        me.DOM.setMatrixSVG.attr('viewBox', `${r} ${t} ${w} ${h}`);

        scrollDom.scrollTop = Math.max(0, initScrollPos - difY);

        d3.event.preventDefault();
        d3.event.stopPropagation();
      }).on('mouseup', () => {
        me.pausePanning = false;
        background_dom.style.cursor = 'default';
        me.browser.DOM.root.attr('pointerEvents', true);
        d3.select('body').on('mousemove', null).on('mouseup', null);
        me.browser.DOM.pointerBlock.attr('active', null);
        me.refreshLabel_Vert_Show();
        d3.event.preventDefault();
        d3.event.stopPropagation();
      });
      d3.event.preventDefault();
      d3.event.stopPropagation();
    })
  ;

  this.DOM.setMatrixSVG.append('g').attr('class', 'rows');
  this.DOM.setPairGroup = this.DOM.setMatrixSVG.append('g').attr('class', 'aggrGroup setPairGroup').attr('animate_position', true);

  this.insertRows();
  this.insertSetPairs();

  this.updateWidthFromHeight();
  this.updateSetPairScale();

  this.refreshRow();

  this.refreshSetPair_Background();
  this.refreshSetPair_Position();
  this.refreshSetPair_Containment();

  this.refreshViz_Axis();
  this.refreshViz_Active();

  this.refreshWindowSize();
};

SummarySet.prototype.prepareSetMatrixSorting = function prepareSetMatrixSorting() {
  const me = this;
  // Update sorting options of setListSummary (adding relatednesness metric...)
  this.setListSummary.catSortBy[0].name = `# ${this.browser.recordName}`;
  this.setListSummary.insertSortingOption({
    name: 'Relatedness',
    value(category) { return -category.MST.index; },
    prep() { me.updatePerceptualOrder(); },
  });
  this.setListSummary.refreshCatSortOptions();
  this.setListSummary.onCatSort = function () {
    me.refreshWindowSize();
    me.refreshRow();
    me.DOM.setPairGroup.attr('animate_position', false);
    me.refreshSetPair_Position();
    setTimeout(() => { me.DOM.setPairGroup.attr('animate_position', true); }, 1000);
  };
};

SummarySet.prototype.refreshHeight = function refreshHeight() {
  // TODO: Added just because the browser calls this automatically
};

SummarySet.prototype.isEmpty = function isEmpty() {
  return false; // TODO Temp?
};

SummarySet.prototype.getHeight = function getHeight() {
  return this.setListSummary.categoriesHeight;
};

SummarySet.prototype.getWidth = function getWidth() {
  return this.summaryWidth;
};

SummarySet.prototype.getRowHeight = function getRowHeight() {
  return this.setListSummary.heightCat;
};

SummarySet.prototype.getSetPairCount_Total = function getSetPairCount_Total() {
  return this._sets.length * (this._sets.length - 1) / 2;
};

SummarySet.prototype.getSetPairCount_Empty = function getSetPairCount_Empty() {
  return this.getSetPairCount_Total() - this._setPairs.length;
};

SummarySet.prototype.updateWidthFromHeight = function updateWidthFromHeight() {
  this.summaryWidth = this.getHeight() + 80;
  this.checkWidth();
};

SummarySet.prototype.updateSetPairScale = function updateSetPairScale() {
  this.setPairDiameter = this.setListSummary.heightCat;
  this.setPairRadius = this.setPairDiameter / 2;
};

SummarySet.prototype.updateMaxAggr_Active = function updateMaxAggr_Active() {
  this._maxSetPairAggr_Active = d3.max(this._setPairs, aggr => aggr.measure('Active'));
};

SummarySet.prototype.checkWidth = function checkWidth() {
  const minv = 160;
  const maxv = Math.max(minv, this.getHeight()) + 160;
  this.summaryWidth = Math.min(maxv, Math.max(minv, this.summaryWidth));
};

SummarySet.prototype.checkPan = function checkPan() {
  const maxV = 0;
  const minV = -this.setListSummary.scrollTop_cache;
  this.gridPan_x = Math.round(Math.min(maxV, Math.max(minV, this.gridPan_x)));
};

SummarySet.prototype.insertControls = function insertControls() {
  const me = this;
  this.DOM.summaryControls = this.DOM.chartRoot.append('div').attr('class', 'summaryControls')
    .style('height', `${this.setListSummary.getHeight_Config()}px`); // TODO: remove

  this.DOM.strengthControl = this.DOM.summaryControls.append('span').attr('class', 'strengthControl')
    .each(function (d, i) {
      this.tipsy = new Tipsy(this, {
        gravity: 'n',
        title: "Color <i class='fa fa-circle'></i> by pair-wise strength",
      });
    })
    .on('mouseover', function () { if (this.dragging !== true) this.tipsy.show(); })
    .on('mouseout', function () { this.tipsy.hide(); })
    .on('click', () => { me.browser.setScaleMode(me.browser.ratioModeActive !== true); });

  // ******************* STRENGTH CONFIG
  this.DOM.strengthControl.append('span').attr('class', 'strengthLabel').text('Weak');
  this.DOM.strengthControl.append('span').attr('class', 'strengthText').text('Strength');
  this.DOM.strengthControl.append('span').attr('class', 'strengthLabel').text('Strong');

  this.DOM.scaleLegend_SVG = this.DOM.summaryControls
    .append('svg').attrs({ class: 'sizeLegend', xmlns: 'http://www.w3.org/2000/svg' });

  this.DOM.legendHeader = this.DOM.scaleLegend_SVG.append('text').attr('class', 'legendHeader').text('#');
  this.DOM.legend_Group = this.DOM.scaleLegend_SVG.append('g');
};

SummarySet.prototype.insertRows = function insertRows() {
  const me = this;

  const newRows = this.DOM.setMatrixSVG.select('g.rows').selectAll('g.row')
    .data(this._sets, _set => _set.id())
    .enter()
    .append('g')
    .attr('class', 'row')
    .each(function (_set) { _set.DOM.matrixRow = this; })
    .on('mouseenter', (_set) => { me.setListSummary.onAggrHighlight(_set); })
    .on('mouseleave', (_set) => { me.setListSummary.onAggrLeave(_set); });

  // tmp is used to parse html text. TODO: delete the temporary DOM
  const tmp = document.createElement('div');
  newRows.append('line').attr('class', 'line line_vert')
    .attr('x1', 0).attr('y1', 0)
    .attr('y1', 0)
    .attr('y2', 0);
  newRows.append('text').attr('class', 'label label_horz')
    .text((d) => {
      tmp.innerHTML = me.setListSummary.catLabel_Func.call(d.data);
      return tmp.textContent || tmp.innerText || '';
    });
  newRows.append('line').attr('class', 'line line_horz')
    .attr('x1', 0).attr('y1', 0)
    .attr('y2', 0);
  newRows.append('text').attr('class', 'label label_vert')
    .text((d) => {
      tmp.innerHTML = me.setListSummary.catLabel_Func.call(d.data);
      return tmp.textContent || tmp.innerText || '';
    })
    .attr('y', -4);

  this.DOM.setRows = this.DOM.setMatrixSVG.selectAll('g.rows > g.row');
  this.DOM.line_vert = this.DOM.setMatrixSVG.selectAll('g.rows > g.row > line.line_vert');
  this.DOM.line_horz = this.DOM.setMatrixSVG.selectAll('g.rows > g.row > line.line_horz');
  this.DOM.line_horz_label = this.DOM.setMatrixSVG.selectAll('g.rows > g.row > text.label_horz');
  this.DOM.line_vert_label = this.DOM.setMatrixSVG.selectAll('g.rows > g.row > text.label_vert');
};

SummarySet.prototype.onSetPairEnter = function onSetPairEnter(aggr) {
  aggr.set_1.DOM.matrixRow.setAttribute('selection', 'selected');
  aggr.set_2.DOM.matrixRow.setAttribute('selection', 'selected');
  aggr.set_1.DOM.aggrGlyph.setAttribute('catselect', 'and');
  aggr.set_2.DOM.aggrGlyph.setAttribute('catselect', 'and');
  this.browser.setSelect_Highlight(aggr);
};

SummarySet.prototype.onSetPairLeave = function onSetPairLeave(aggr) {
  aggr.set_1.DOM.matrixRow.removeAttribute('selection');
  aggr.set_2.DOM.matrixRow.removeAttribute('selection');
  aggr.set_1.DOM.aggrGlyph.removeAttribute('catselect');
  aggr.set_2.DOM.aggrGlyph.removeAttribute('catselect');
  this.browser.clearSelect_Highlight();
  this.browser.refreshMeasureLabels('Active');
};

SummarySet.prototype.insertSetPairs = function insertSetPairs() {
  const me = this;
  const newCliques = this.DOM.setMatrixSVG.select('g.setPairGroup').selectAll('g.setPairGlyph')
    .data(this._setPairs, (d, i) => i)
    .enter()
    .append('g')
    .attr('class', 'aggrGlyph setPairGlyph')
    .each(function (d) { d.DOM.aggrGlyph = this; })
    .on('mouseenter', function (aggr) {
      if (me.browser.mouseSpeed < 0.2) {
        me.onSetPairEnter(aggr);
        return;
      }
      this.highlightTimeout = window.setTimeout(() => { me.onSetPairEnter(aggr); }, me.browser.mouseSpeed * 500);
    })
    .on('mouseleave', function (aggr) {
      if (this.highlightTimeout) window.clearTimeout(this.highlightTimeout);
      me.onSetPairLeave(aggr);
    })
    .on('click', (aggr) => {
      if (d3.event.shiftKey) {
        me.browser.setSelect_Compare(false);
        return;
      }
      me.setListSummary.filterCategory(aggr.set_1, 'AND');
      me.setListSummary.filterCategory(aggr.set_2, 'AND');
    });

  newCliques.append('rect').attr('class', 'setPairBackground').attr('rx', 3).attr('ry', 3);
  newCliques.append('circle').attr('class', 'measure_Active').attr('cx', 0).attr('cy', 0)
    .attr('r', 0);
  newCliques.append('path').attr('class', 'measure_Highlight').each((aggr) => {
    aggr.currentPreviewAngle = -Math.PI / 2;
  });
  newCliques.append('path').attr('class', 'measure_Compare_A');
  newCliques.append('path').attr('class', 'measure_Compare_B');
  newCliques.append('path').attr('class', 'measure_Compare_C');

  this.DOM.aggrGlyphs = this.DOM.setPairGroup.selectAll('g.setPairGlyph');
  this.DOM.setPairBackground = this.DOM.aggrGlyphs.selectAll('.setPairBackground');
  this.DOM.measure_Active = this.DOM.aggrGlyphs.selectAll('.measure_Active');
  this.DOM.measure_Highlight = this.DOM.aggrGlyphs.selectAll('.measure_Highlight');
  this.DOM.measure_Compare_A = this.DOM.aggrGlyphs.selectAll('.measure_Compare_A');
  this.DOM.measure_Compare_B = this.DOM.aggrGlyphs.selectAll('.measure_Compare_B');
  this.DOM.measure_Compare_C = this.DOM.aggrGlyphs.selectAll('.measure_Compare_C');
};

SummarySet.prototype.printAggrSelection = function printAggrSelection(aggr) {
  return `${this.setListSummary.printAggrSelection(aggr.set_1)} and ${
    this.setListSummary.printAggrSelection(aggr.set_2)}`;
};

SummarySet.prototype.initializeAggregates = function initializeAggregates() {
  // aggregates are initialized when the set summary is initialized.
};

SummarySet.prototype.refreshLabel_Vert_Show = function refreshLabel_Vert_Show() {
  const me = this;
  const setListSummary = this.setListSummary;
  const totalWidth = this.getWidth();
  const totalHeight = this.getHeight();
  const w = this.getWidth();
  const h = this.getHeight();
  const t = this.setListSummary.scrollTop_cache;
  const r = (t) * -1;
  this.DOM.line_vert_label // points up/right
    .attr('show', d => !d.isVisible)
    .attr('transform', (d) => {
      const i = d.orderIndex;
      let x = totalWidth - ((i + 0.5) * me.setPairDiameter) - 2;
      if (me.popupSide === 'right') x = totalWidth - x - 4;
      let y = ((me.setListSummary.catCount_Visible - i - 1) * me.setPairDiameter);
      y -= setListSummary.getHeight_VisibleAttrib() - setListSummary.scrollTop_cache - totalHeight;
      return `translate(${x} ${y}) rotate(-90)`;// " rotate(45) ";
    });
};

/** --*/
SummarySet.prototype.updatePerceptualOrder = function updatePerceptualOrder() {
  const me = this;

  // Edges are set-pairs with at least one element inside (based on the filtering state)
  const edges = this._setPairs.filter(setPair => setPair._measure.Active > 0);
  // Nodes are the set-categories
  const nodes = this.setListSummary._aggrs;

  // Initialize per-node (per-set) data structures

  nodes.forEach((node) => {
    node.MST = {
      tree: new Object(), // Some unqiue identifier, to check if two nodes are in the same tree.
      childNodes: [],
      parentNode: null,
    };
  });

  // Compute the perceptual similarity metric (mst_distance)
  edges.forEach((edge) => {
    const set_1 = edge.set_1;
    const set_2 = edge.set_2;
    edge.mst_distance = 0;
    // For every intersection of set_1
    set_1.setPairs.forEach((setPair_1) => {
      if (setPair_1 === edge) return;
      const set_other = (setPair_1.set_1 === set_1) ? setPair_1.set_2 : setPair_1.set_1;
      // find the set-pair of set_2 and set_other;
      let setPair_2;
      if (set_2.id() > set_other.id()) {
        if (me._setPairs_ID[set_other.id()]) { setPair_2 = me._setPairs_ID[set_other.id()][set_2.id()]; }
      } else if (me._setPairs_ID[set_2.id()]) { setPair_2 = me._setPairs_ID[set_2.id()][set_other.id()]; }
      if (setPair_2 === undefined) { // the other intersection size is zero, there is no link
        edge.mst_distance += setPair_1._measure.Active;
        return;
      }
      edge.mst_distance += Math.abs(setPair_1._measure.Active - setPair_2._measure.Active);
    });
    // For every intersection of set_2
    set_2.setPairs.forEach((setPair_1) => {
      if (setPair_1 === edge) return;
      const set_other = (setPair_1.set_1 === set_2) ? setPair_1.set_2 : setPair_1.set_1;
      // find the set-pair of set_1 and set_other;
      let setPair_2;
      if (set_1.id() > set_other.id()) {
        if (me._setPairs_ID[set_other.id()]) { setPair_2 = me._setPairs_ID[set_other.id()][set_1.id()]; }
      } else if (me._setPairs_ID[set_1.id()]) { setPair_2 = me._setPairs_ID[set_1.id()][set_other.id()]; }
      if (setPair_2 === undefined) { // the other intersection size is zero, there is no link
        edge.mst_distance += setPair_1._measure.Active;
      }
      // If ther is setPair_2, it was already processed in the main loop above
    });
  });

  // Order the edges (setPairs) by their distance (lower score is better)
  edges.sort((e1, e2) => e1.mst_distance - e2.mst_distance);

  // Run Kruskal's algorithm...
  edges.forEach((setPair) => {
    const node_1 = setPair.set_1;
    const node_2 = setPair.set_2;
    // set_1 and set_2 are in the same tree
    if (node_1.MST.tree === node_2.MST.tree) return;
    // set_1 and set_2 are not in the same tree, connect set_2 under set_1
    let set_above,
      set_below;
    if (node_1.setPairs.length < node_2.setPairs.length) {
      set_above = node_1;
      set_below = node_2;
    } else {
      set_above = node_2;
      set_below = node_1;
    }
    set_below.MST.tree = set_above.MST.tree;
    set_below.MST.parentNode = set_above;
    set_above.MST.childNodes.push(set_below);
  });

  // Identify the root-nodes of resulting MSTs
  const treeRootNodes = nodes.filter(node => node.MST.parentNode === null);

  // We can have multiple trees (there can be sub-groups disconnected from each other)

  // Update tree size recursively by starting at the root nodes
  var updateTreeSize = function (node) {
    node.MST.treeSize = 1;
    node.MST.childNodes.forEach((childNode) => { node.MST.treeSize += updateTreeSize(childNode); });
    return node.MST.treeSize;
  };
  treeRootNodes.forEach((rootNode) => { updateTreeSize(rootNode); });

  // Sort the root nodes by largest tree first
  treeRootNodes.sort((node1, node2) => node1.MST.treeSize - node2.MST.treeSize);

  // For each MST, traverse the nodes and add the MST (perceptual) node index incrementally
  let mst_index = 0;
  var updateNodeIndex = function (node) {
    node.MST.childNodes.forEach((chileNode) => { chileNode.MST.index = mst_index++; });
    node.MST.childNodes.forEach((chileNode) => { updateNodeIndex(chileNode); });
  };
  treeRootNodes.forEach((node) => {
    node.MST.index = mst_index++;
    updateNodeIndex(node);
  });
};

SummarySet.prototype.refreshViz_Axis = function refreshViz_Axis() {
  const me = this;

  this.refreshSetPair_Strength();

  if (this.browser.ratioModeActive) {
    this.DOM.scaleLegend_SVG.style('display', 'none');
    return;
  }
  this.DOM.scaleLegend_SVG.style('display', 'block');

  this.DOM.scaleLegend_SVG
    .attr('width', this.setPairDiameter + 50)
    .attr('height', this.setPairDiameter + 10)
    .attr('viewBox', `0 0 ${this.setPairDiameter + 35} ${this.setPairDiameter + 10}`);

  this.DOM.legend_Group.attr('transform', `translate(${this.setPairRadius},${this.setPairRadius + 18})`);
  this.DOM.legendHeader.attr('transform', `translate(${2 * this.setPairRadius + 3},6)`);

  const maxVal = this._maxSetPairAggr_Active;

  tickValues = [maxVal];
  if (this.setPairRadius > 8) tickValues.push(Math.round(maxVal / 4));

  this.DOM.legend_Group.selectAll('g.legendMark').remove();

  const tickDoms = this.DOM.legend_Group.selectAll('g.legendMark').data(tickValues, i => i);

  this.DOM.legendCircleMarks = tickDoms.enter().append('g').attr('class', 'legendMark');

  this.DOM.legendCircleMarks.append('circle').attr('class', 'legendCircle')
    .attr('cx', 0).attr('cy', 0)
    .attr('r', (d, i) => me.setPairRadius * Math.sqrt(d / maxVal));
  this.DOM.legendCircleMarks.append('line').attr('class', 'legendLine')
    .each(function (d, i) {
      const rx = me.setPairRadius + 3;
      const ry = me.setPairRadius * Math.sqrt(d / maxVal);
      let x2,
        y1;
      switch (i % 4) {
        case 0:
          x2 = rx;
          y1 = -ry;
          break;
        case 1:
          x2 = rx; // -rx;
          y1 = ry; // -ry;
          break;
        case 2:
          x2 = rx;
          y1 = ry;
          break;
        case 3:
          x2 = -rx;
          y1 = ry;
          break;
      }
      this.setAttribute('x1', 0);
      this.setAttribute('x2', x2);
      this.setAttribute('y1', y1);
      this.setAttribute('y2', y1);
    });
  this.DOM.legendText = this.DOM.legendCircleMarks
    .append('text').attr('class', 'legendLabel');

  this.DOM.legendText.each(function (d, i) {
    const rx = me.setPairRadius + 3;
    const ry = me.setPairRadius * Math.sqrt(d / maxVal);
    let x2,
      y1;
    switch (i % 4) {
      case 0:
        x2 = rx;
        y1 = -ry;
        break;
      case 1:
        x2 = rx; // -rx;
        y1 = ry; // -ry;
        break;
      case 2:
        x2 = rx;
        y1 = ry;
        break;
      case 3:
        x2 = -rx;
        y1 = ry;
        break;
    }
    this.setAttribute('transform', `translate(${x2},${y1})`);
    this.style.textAnchor = (i % 2 === 0 || true) ? 'start' : 'end';
  });

  this.DOM.legendText.text(d => d3.format('s')(d));
};

SummarySet.prototype.refreshWindowSize = function refreshWindowSize() {
  const w = this.getWidth();
  const h = this.getHeight();
  this.DOM.wrapper.style('height', `${this.setListSummary.getHeight() - this.setListSummary.getHeight_Header()}px`);
  this.DOM.setMatrixBackground
    .attr('x', -w * 24)
    .attr('y', -h * 24)
    .attr('width', w * 50)
    .attr('height', h * 50);
  this.DOM.root
    .style(this.popupSide, `${-w}px`)
    .style('width', `${w}px`)
    .style(this.popupSide === 'left' ? 'right' : 'left', 'initial');
  if (!this.pausePanning) this.refreshSVGViewBox();
};

SummarySet.prototype.setPopupSide = function setPopupSide(p) {
  if (p === this.popupSide) return;
  this.popupSide = p;
  this.DOM.root.attr('popupSide', this.popupSide);
  this.refreshWindowSize();
  this.refreshRow_LineWidths();
  this.refreshSetPair_Position();
};

SummarySet.prototype.refreshSVGViewBox = function refreshSVGViewBox() {
  const w = this.getWidth();
  const h = this.getHeight();
  const t = this.setListSummary.scrollTop_cache;
  let r;
  if (this.popupSide === 'left') {
    r = Math.min(-t - this.gridPan_x, 0); // r cannot be positive
  }
  if (this.popupSide === 'right') {
    r = Math.max(t + this.gridPan_x, 0);
  }
  this.DOM.setMatrixSVG.attr('width', w).attr('height', h).attr('viewBox', `${r} ${t} ${w} ${h}`);
  this.refreshLabel_Vert_Show();
};

SummarySet.prototype.refreshSetPair_Background = function refreshSetPair_Background() {
  this.DOM.setPairBackground
    .attr('x', -this.setPairRadius)
    .attr('y', -this.setPairRadius)
    .attr('width', this.setPairDiameter)
    .attr('height', this.setPairDiameter);
};

/**
 - Call when measure.Active is updated
 - Does not work with Average aggregate
 */
SummarySet.prototype.updateSetPairSimilarity = function updateSetPairSimilarity() {
  this._setPairs.forEach((setPair) => {
    const size_A = setPair.set_1._measure.Active;
    const size_B = setPair.set_2._measure.Active;
    const size_and = setPair._measure.Active;
    setPair.Similarity = (size_and === 0 || (size_A === 0 && size_B === 0)) ? 0 : size_and / Math.min(size_A, size_B);
  });
  this._maxSimilarity = d3.max(this._setPairs, d => d.Similarity);
};

/** For each element in the given list, checks the set membership and adds setPairs */
SummarySet.prototype.createSetPairs = function createSetPairs() {
  const me = this;

  const insertToClique = function (set_1, set_2, record) {
    // avoid self reference and adding the same data item twice (insert only A-B, not B-A or A-A/B-B)
    if (set_2.id() <= set_1.id()) return;

    if (me._setPairs_ID[set_1.id()] === undefined) me._setPairs_ID[set_1.id()] = {};

    let targetClique = me._setPairs_ID[set_1.id()][set_2.id()];
    if (targetClique === undefined) {
      targetClique = new kshf.AggregateSet(me.setListSummary, set_1, set_2);

      me.browser.allAggregates.push(targetClique);
      set_1.setPairs.push(targetClique);
      set_2.setPairs.push(targetClique);
      me._setPairs.push(targetClique);
      me._setPairs_ID[set_1.id()][set_2.id()] = targetClique;
    }
    targetClique.addRecord(record);
  };

  // AND
  const filterID = this.setListSummary.summaryID;
  function getAggr(v) { return me.setListSummary.catTable_id[v]; }
  this.setListSummary.records.forEach((record) => {
    const values = record._valueCache[filterID];
    if (values === null) return; // maps to no value
    values.forEach((v_1) => {
      set_1 = getAggr(v_1);
      // make sure set_1 has an attrib on c display
      if (set_1.setPairs === undefined) return;
      values.forEach((v_2) => {
        set_2 = getAggr(v_2);
        if (set_2.setPairs === undefined) return;
        insertToClique(set_1, set_2, record);
      });
    });
  });

  this.updateMaxAggr_Active();
  this.updateSetPairSimilarity();
};

SummarySet.prototype.refreshRow_LineWidths = function refreshRow_LineWidths() {
  const me = this;
  const setPairDiameter = this.setPairDiameter;
  const totalWidth = this.getWidth();
  const totalHeight = this.getHeight();
  // vertical
  this.DOM.line_vert.each(function (d) {
    const i = d.orderIndex;
    const height = ((me.setListSummary.catCount_Visible - i - 1) * setPairDiameter);
    const right = ((i + 0.5) * setPairDiameter);
    let m = totalWidth - right;
    if (me.popupSide === 'right') m = right;
    this.setAttribute('x1', m);
    this.setAttribute('x2', m);
    this.setAttribute('y2', height);
  });
  // horizontal
  this.DOM.line_horz
    .attr('x2', (this.popupSide === 'left') ? totalWidth : 0)
    .attr('x1', (d) => {
      const m = ((d.orderIndex + 0.5) * setPairDiameter);
      return (me.popupSide === 'left') ? (totalWidth - m) : m;
    });
  this.DOM.line_horz_label.attr('transform', (d) => {
    let m = ((d.orderIndex + 0.5) * setPairDiameter) + 2;
    if (me.popupSide === 'left') m = totalWidth - m;
    return `translate(${m} 0)`;
  });
};

SummarySet.prototype.refreshRow_Position = function refreshRow_Position() {
  const rowHeight = this.setPairDiameter;
  this.DOM.setRows.attr('transform', set => `translate(0,${(set.orderIndex + 0.5) * rowHeight})`);
};

SummarySet.prototype.refreshRow = function refreshRow() {
  this.refreshRow_Position();
  this.refreshRow_LineWidths();
};

SummarySet.prototype.refreshSetPair_Position = function refreshSetPair_Position() {
  const me = this;
  const w = this.getWidth();
  this.DOM.aggrGlyphs.style('transform', (setPair) => {
    const i1 = setPair.set_1.orderIndex;
    const i2 = setPair.set_2.orderIndex;
    let left = (Math.min(i1, i2) + 0.5) * me.setPairDiameter;
    if (me.popupSide === 'left') left = w - left;
    const top = (Math.max(i1, i2) + 0.5) * me.setPairDiameter;
    return `translate(${left}px,${top}px)`;
  });
};

SummarySet.prototype.getCliqueSizeRatio = function getCliqueSizeRatio(setPair) {
  return Math.sqrt(setPair.measure('Active') / this._maxSetPairAggr_Active);
};

/** Given a setPair, return the angle for preview
 Does not work with "Avg" measure
 * */
SummarySet.prototype.getAngleToActive_rad = function getAngleToActive_rad(setPair, m) {
  if (setPair._measure.Active === 0) return 0;
  let ratio = setPair._measure[m] / setPair._measure.Active;
  if (this.browser.preview_not) ratio = 1 - ratio;
  if (ratio === 1) ratio = 0.999;
  return ((360 * ratio - 90) * Math.PI) / 180;
};

// http://stackoverflow.com/questions/5737975/circle-drawing-with-svgs-arc-path
// http://stackoverflow.com/questions/15591614/svg-radial-wipe-animation-using-css3-js
// http://jsfiddle.net/Matt_Coughlin/j3Bhz/5/
SummarySet.prototype.getPiePath = function getPiePath(endAngleRad, sub, ratio) {
  const r = ratio * this.setPairRadius - sub;
  const endX = Math.cos(endAngleRad) * r;
  const endY = Math.sin(endAngleRad) * r;
  const largeArcFlag = (endAngleRad > Math.PI / 2) ? 1 : 0;
  return `M 0,${-r} A ${r},${r} ${largeArcFlag} ${largeArcFlag} 1 ${endX},${endY} L0,0`;
};

/** setPairGlyph do not have a total component */
SummarySet.prototype.refreshViz_Total = function refreshViz_Total() {
};

SummarySet.prototype.refreshViz_Active = function refreshViz_Active() {
  const me = this;
  this.DOM.aggrGlyphs.attr('activesize', aggr => aggr.measure('Active'));
  this.DOM.measure_Active.transition().duration(this.noanim ? 0 : 700)
    .attr('r', this.browser.ratioModeActive ?
      setPair => ((setPair.subset !== '') ? me.setPairRadius - 1 : me.setPairRadius) :
      setPair => me.getCliqueSizeRatio(setPair) * me.setPairRadius,
    );
};

SummarySet.prototype.refreshViz_Highlight = function refreshViz_Highlight() {
  const me = this;
  this.DOM.measure_Highlight
    .transition().duration(500).attrTween('d', (aggr) => {
      const angleInterp = d3.interpolate(aggr.currentPreviewAngle, me.getAngleToActive_rad(aggr, 'Highlight'));
      const sizeRatio = (me.browser.ratioModeActive) ? 1 : me.getCliqueSizeRatio(aggr);
      return function (t) {
        const newAngle = angleInterp(t);
        aggr.currentPreviewAngle = newAngle;
        return me.getPiePath(newAngle, (aggr.subset !== '' && me.browser.ratioModeActive) ? 2 : 0, sizeRatio);
      };
    });
};

SummarySet.prototype.refreshViz_Compare = function refreshViz_Compare(cT, curGroup, totalGroups) {
  const me = this;
  let strokeWidth = 1;
  if (this.browser.ratioModeActive) {
    strokeWidth = Math.ceil(this.getRowHeight() / 18);
  }
  this.DOM[`measure_Compare_${cT}`].attr('d', function (aggr) {
    const sizeRatio = (me.browser.ratioModeActive) ? 1 : me.getCliqueSizeRatio(aggr);
    this.style.display = aggr.measure(`Compare_${cT}`) === 0 ? 'none' : 'block';
    this.style.strokeWidth = strokeWidth;
    return me.getPiePath(me.getAngleToActive_rad(aggr, `Compare_${cT}`), curGroup * strokeWidth, sizeRatio);
  });
};

/** Does not work with Avg pair */
SummarySet.prototype.refreshSetPair_Containment = function refreshSetPair_Containment() {
  const me = this;
  let numOfSubsets = 0;
  this.DOM.measure_Active
    .each((setPair) => {
      const setPair_itemCount = setPair._measure.Active;
      const set_1_itemCount = setPair.set_1._measure.Active;
      const set_2_itemCount = setPair.set_2._measure.Active;
      if (setPair_itemCount === set_1_itemCount || setPair_itemCount === set_2_itemCount) {
        numOfSubsets++;
        setPair.subset = (set_1_itemCount === set_2_itemCount) ? 'equal' : 'proper';
      } else {
        setPair.subset = '';
      }
    })
    .attr('subset', setPair => ((setPair.subset !== '') ? true : null));

  this.DOM.subsetCount.style('display', (numOfSubsets === 0) ? 'none' : null);
  this.DOM.subsetCount_Text.text(numOfSubsets);

  this.refreshSetPair_Strength();
};

SummarySet.prototype.refreshSetPair_Strength = function refreshSetPair_Strength() {
  const me = this;

  const strengthColor = d3.interpolateHsl(d3.rgb(230, 230, 247), d3.rgb(159, 159, 223));
  this.DOM.measure_Active.style('fill', (setPair) => {
    if (!me.browser.ratioModeActive) return null;
    return strengthColor(setPair.Similarity / me._maxSimilarity);
  });

  if (this.browser.ratioModeActive) {
    this.DOM.measure_Active.each(function (setPair) {
      // border
      if (setPair.subset === '') return;
      if (setPair.subset === 'equal') {
        this.style.strokeDasharray = '';
        this.style.strokeDashoffset = '';
        return;
      }
      let halfCircle = (me.setPairRadius - 1) * Math.PI;
      this.style.strokeDasharray = `${halfCircle}px`;
      // rotate halfway
      const i1 = setPair.set_1.orderIndex;
      const i2 = setPair.set_2.orderIndex;
      const c1 = setPair.set_1._measure.Active;
      const c2 = setPair.set_2._measure.Active;
      if ((i1 < i2 && c1 < c2) || (i1 > i2 && c1 > c2)) halfCircle /= 2;
      this.style.strokeDashoffset = `${halfCircle}px`;
    });
  }
};

SummarySet.prototype.isFiltered = function isFiltered() {
  return this.setListSummary.isFiltered();
};

SummarySet.prototype.updateAfterFilter = function updateAfterFilter() {
  if (this.isEmpty() || this.collapsed || !this.inBrowser()) return;
  this.updateMaxAggr_Active();
  this.refreshViz_All();
  this.refreshViz_EmptyRecords();

  this.DOM.setRows.style('opacity', setRow => ((setRow._measure.Active > 0) ? 1 : 0.3));
  this.updateSetPairSimilarity();
  this.refreshSetPair_Containment();
};

// After this point these are brought over from SummaryBase to avoid cyclical dependency
SummarySet.prototype.setSummaryName = function setSummaryName(name) {
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

SummarySet.prototype.getDataType = function getDataType() {
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

SummarySet.prototype.inBrowser = function inBrowser() {
  return this.panel !== undefined;
};

SummarySet.prototype.isTimeStamp = function isTimeStamp() {
  return false; // False by default
};

SummarySet.prototype.clearDOM = function clearDOM() {
  const dom = this.DOM.root.node();
  dom.parentNode.removeChild(dom);
};

SummarySet.prototype.getHeight_Header = function getHeight_Header() {
  if (!this.DOM.inited) return 0;
  if (this._height_header == undefined) {
    this._height_header = this.DOM.headerGroup.node().offsetHeight;
  }
  return this._height_header;
};

SummarySet.prototype.uniqueCategories = function uniqueCategories() {
  if (this.browser && this.browser.records[0].idIndex === this.summaryName) return true;
  return false;
};

SummarySet.prototype.getFuncString = function getFuncString() {
  const str = this.summaryFunc.toString();
  // replace the beginning, and the end
  return str.replace(/function\s*\(\w*\)\s*{\s*/, '').replace(/}$/, '');
};

/** returns the maximum active aggregate value per row in chart data */
SummarySet.prototype.getMaxAggr = function getMaxAggr(sType) {
  if (this._aggrs === undefined || this.isEmpty()) return 0;
  return d3.max(this._aggrs, (aggr) => { if (aggr.usedAggr) return aggr.measure(sType); }) || 1;
};

/** returns the maximum active aggregate value per row in chart data */
SummarySet.prototype.getMinAggr = function getMinAggr(sType) {
  if (this._aggrs === undefined || this.isEmpty()) return 0;
  return d3.min(this._aggrs, (aggr) => { if (aggr.usedAggr) return aggr.measure(sType); });
};

SummarySet.prototype.getMaxAggr_All = function getMaxAggr_All() {
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

SummarySet.prototype.getMinAggr_All = function getMinAggr_All() {
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

SummarySet.prototype.addToPanel = function addToPanel(panel, index) {
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

SummarySet.prototype.removeFromPanel = function removeFromPanel() {
  if (this.panel === undefined) return;
  this.panel.removeSummary(this);
  this.refreshThumbDisplay();
};

SummarySet.prototype.destroy = function destroy() {
  this.browser.destroySummary(this);
  if (this.DOM.root) {
    this.DOM.root.node().parentNode.removeChild(this.DOM.root.node());
  }
  if (this.DOM.nugget) {
    this.DOM.nugget.node().parentNode.removeChild(this.DOM.nugget.node());
  }
};

SummarySet.prototype.insertNugget = function insertNugget() {
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

SummarySet.prototype.createSetPairSummary = function createSetPairSummary() {
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

SummarySet.prototype.refreshThumbDisplay = function refreshThumbDisplay() {
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

SummarySet.prototype.insertRoot = function insertRoot(beforeDOM) {
  const me = this;
  this.DOM.root = this.panel.DOM.root.insert('div', () => beforeDOM);
  this.DOM.root
    .attr('class', 'kshfSummary')
    .attr('summary_id', this.summaryID) // can be used to customize a specific summary using CSS
    .each(function () { this.__data__ = me; });
};

SummarySet.prototype.insertHeader = function insertHeader() {
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

SummarySet.prototype.setDescription = function setDescription(description) {
  this.description = description;
  if (this.DOM.summaryDescription === undefined) return;
  this.DOM.summaryDescription.style('display', this.description === undefined ? null : 'inline-block');
};
/** -- Shared - Summary Base -- */
SummarySet.prototype.insertChartAxis_Measure = function insertChartAxis_Measure(dom, pos1, pos2) {
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

SummarySet.prototype.setCollapsedAndLayout = function setCollapsedAndLayout(collapsed) {
  this.setCollapsed(collapsed);
  this.browser.updateLayout_Height();
};

SummarySet.prototype.setCollapsed = function setCollapsed(collapsed) {
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

SummarySet.prototype.refreshViz_All = function refreshViz_All() {
  if (this.isEmpty() || this.collapsed || !this.inBrowser()) return;
  this.refreshViz_Total();
  this.refreshViz_Active();
  this.refreshViz_Highlight();
  this.refreshViz_Compare_All();
  this.refreshViz_Axis();
};

SummarySet.prototype.insertDOM_EmptyAggr = function insertDOM_EmptyAggr() {
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

SummarySet.prototype.refreshViz_EmptyRecords = function refreshViz_EmptyRecords() {
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

SummarySet.prototype.refreshViz_Compare_All = function refreshViz_Compare_All() {
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

SummarySet.prototype.exportConfig = function exportConfig() {
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

SummarySet.prototype.refreshMeasureLabel = function refreshMeasureLabel() {
  if (this.isEmpty() || this.collapsed || !this.inBrowser() || this.DOM.measureLabel === undefined) return;
  const me = this;
  this.DOM.measureLabel.html(aggr => me.browser.getMeasureLabel(aggr, me));
};

export default SummarySet;
