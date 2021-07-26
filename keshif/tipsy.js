// tipsy : Modified & simplified version for internal Keshif use
// (c) 2008-2010 jason frame [jason@onehackoranother.com]
// released under the MIT license

import * as d3 from 'd3';
import kshf from './kshf';

function Tipsy(element, options) {
  this.jq_element = element;
  this.options = options;
  if (this.options.className === undefined) {
    this.options.className = null;
  }
  if (this.options.gravity === undefined) {
    this.options.gravity = 'n';
  }
}

Tipsy.prototype.show = function show() {
  const maybeCall = function (thing, ctx) {
    return (typeof thing === 'function') ? (thing.call(ctx)) : thing;
  };

  if (kshf.activeTipsy) {
    kshf.activeTipsy.hide();
  }

  kshf.activeTipsy = this;

  const title = this.getTitle();
  if (!title) return;
  this.tip();

  this.jq_tipsy_inner.html(title);
  this.jq_tip.attr('class', 'tipsy'); // reset classname in case of dynamic gravity
  this.jq_tip
    .style('top', 0)
    .style('left', 0)
    .style('visibility', 'hidden')
    .style('display', 'block');
  kshf.browser.DOM.root.node().appendChild(this.jq_tip.node());

  if (this.options.className) {
    this.jq_tip.attr('class', `tipsy ${maybeCall(this.options.className, this.jq_element)}`);
  }

  const pos = this.jq_element.getBoundingClientRect();

  const actualWidth = this.jq_tip.node().offsetWidth;
  const actualHeight = this.jq_tip.node().offsetHeight;
  const gravity = maybeCall(this.options.gravity, this.jq_element);

  this.tipWidth = actualWidth;
  this.tipHeight = actualHeight;

  let tp = {};
  switch (gravity.charAt(0)) {
    case 'n':
      tp = { top: pos.top + pos.height, left: pos.left + pos.width / 2 - actualWidth / 2 };
      break;
    case 's':
      tp = { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2 };
      break;
    case 'e':
      tp = { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth };
      break;
    case 'w':
      tp = { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width };
      break;
    default:
      break;
  }

  if (gravity.length === 2) {
    if (gravity.charAt(1) === 'w') {
      tp.left = pos.left + pos.width / 2 - 15;
    } else {
      tp.left = pos.left + pos.width / 2 - actualWidth + 15;
    }
  }

  const browserPos = kshf.browser.DOM.root.node().getBoundingClientRect();
  tp.left -= browserPos.left;
  tp.top -= browserPos.top;

  this.jq_tip
    .style('left', `${tp.left}px`)
    .style('top', `${tp.top}px`)
    .attr('class', `${this.jq_tip.attr('class')} tipsy-${gravity}`);
  this.jq_tipsy_arrow.attr('class', `tipsy-arrow tipsy-arrow-${gravity.charAt(0)}`);

  // this.jq_tip.styles({ opacity: 0, visibility: 'visible' }).transition().duration(200).style('opacity', 1);
  this.jq_tip
    .style('opacity', 0)
    .style('visibility', 'visible')
    .transition()
    .duration(200)
    .style('opacity', 1);
};

Tipsy.prototype.hide = function hide() {
  kshf.activeTipsy = undefined;
  if (this.jq_tip) this.jq_tip.transition().duration(200).style('opacity', 0).remove();
};

Tipsy.prototype.getTitle = function getTitle() {
  let title = '';
  const o = this.options;
  if (typeof o.title === 'string') {
    title = o.title;
  } else if (typeof o.title === 'function') {
    title = o.title.call(this.jq_element);
  }
  return (`${title}`).replace(/(^\s*|\s*$)/, '');
};

Tipsy.prototype.tip = function tip() {
  if (this.jq_tip) return this.jq_tip;
  this.jq_tip = d3.select(document.createElement('div')).attr('class', 'tipsy');
  this.jq_tipsy_arrow = this.jq_tip.append('div').attr('class', 'tipsy-arrow');
  this.jq_tipsy_inner = this.jq_tip.append('div').attr('class', 'tipsy-inner');
  return this.jq_tip;
};

export default Tipsy;
