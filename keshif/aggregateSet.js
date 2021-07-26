import Aggregate from './aggregate';

function AggregateSet(summary, set_1, set_2) {
  Aggregate.call(this, summary);
  this.set_1 = set_1;
  this.set_2 = set_2;
}

AggregateSet.prototype = Object.create(Aggregate.prototype);

export default AggregateSet;
