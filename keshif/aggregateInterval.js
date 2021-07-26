import Aggregate from './aggregate';

function AggregateInterval(summary, minV, maxV) {
  Aggregate.call(this, summary);
  this.minV = minV;
  this.maxV = maxV;
}

AggregateInterval.prototype = Object.create(Aggregate.prototype);

export default AggregateInterval;
