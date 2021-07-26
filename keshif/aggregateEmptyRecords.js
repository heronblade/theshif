import AggregateCategory from './aggregateCategory';

function AggregateEmptyRecords(summary) {
  AggregateCategory.call(this, summary, { id: null }, 'id');
  this.isVisible = true;
  this.emptyRecordsAggregate = true;
}

AggregateEmptyRecords.prototype = Object.create(AggregateCategory.prototype);

export default AggregateEmptyRecords;
