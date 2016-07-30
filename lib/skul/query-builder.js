/*
* lib/skul/query-builder.js
*
* SKuL query builder methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');
var knex = require('knex')({ client: 'mysql' });


/*
 * QueryBuilder contructor
 *
 * @api public
 */
var QueryBuilder = function() {

	// Set instance data
	this.columns = [];
	this.from = null;
	this.whereRaw = null;
	this.joins = [];
	this.groupBy = [];
	this.limit = null;
	this.offset = null;
	this.orderBy = [];

};


QueryBuilder.prototype.columns;
QueryBuilder.prototype.fromRaw;
QueryBuilder.prototype.whereRaw;
QueryBuilder.prototype.joins;
QueryBuilder.prototype.groupBy;
QueryBuilder.prototype.limit;
QueryBuilder.prototype.offset;
QueryBuilder.prototype.orderBy;




QueryBuilder.prototype.setColumns = function(columns) {
	this.columns = columns;
};

QueryBuilder.prototype.addColumns = function(columns) {
	this.columns.concat(columns);
};

QueryBuilder.prototype.addColumn = function(column) {
	this.columns.push(column);
};

QueryBuilder.prototype.getColumns = function() {
	return this.columns;
};

QueryBuilder.prototype.parseColumns = function(queryBuilder, force) {

	// Set columns if defined
	if(this.columns.length > 0 || force) {
		queryBuilder = queryBuilder.columns(this.columns);
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.setFromRaw = function(value) {
	this.fromRaw = value;
};

QueryBuilder.prototype.getFromRaw = function() {
	return this.fromRaw;
};

QueryBuilder.prototype.parseFromRaw = function(queryBuilder) {

	// Set fromRaw if defined
	if(this.fromRaw !== null) {
		queryBuilder = queryBuilder.from(knex.raw(this.fromRaw));
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.setWhereRaw = function(value) {
	this.whereRaw = value;
};

QueryBuilder.prototype.getWhereRaw = function() {
	return this.whereRaw;
};

QueryBuilder.prototype.parseWhereRaw = function(queryBuilder) {

	// Set whereRaw if defined
	if(this.whereRaw !== null) {
		queryBuilder = queryBuilder.whereRaw(this.whereRaw);
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.addJoin = function(type, args) {

	// Check if already exist
	var joinItemRef = _.findIndex(this.joins, function(obj) {
		return obj.type === type && JSON.stringify(obj.args) === JSON.stringify(args);
	});

	// Push if not exists
	if(joinItemRef === -1) {
		this.joins.push({ type: type, args: args });
	}

};

QueryBuilder.prototype.removeJoin = function(type, args) {
	this.joins = _.reject(this.joins, function(obj) { return obj.type === type && JSON.stringify(obj.args) === JSON.stringify(args); });
};

QueryBuilder.prototype.getJoins = function() {
	return this.joins;
};

QueryBuilder.prototype.parseJoins = function(queryBuilder) {

	// Add joins items if not empty
	if(this.joins.length > 0) {
		_.each(this.joins, function(joinItem) {
			if(joinItem.type === 'raw') {
				queryBuilder = queryBuilder.joinRaw.apply(queryBuilder, joinItem.args);
			} else {
				queryBuilder = queryBuilder[joinItem.type + 'Join'].apply(queryBuilder, joinItem.args);
			}
		});
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.addGroupBy = function(value) {
	this.groupBy.push(value);
};

QueryBuilder.prototype.removeGroupBy = function(value) {
	this.groupBy = _.reject(this.groupBy, function(obj) { return obj === value; });
};

QueryBuilder.prototype.getGroupBy = function() {
	return this.groupBy;
};

QueryBuilder.prototype.parseGroupBy = function() {
	return this.orderBy.join(', ');
};

QueryBuilder.prototype.parseGroupBy = function(queryBuilder) {

	// Add groupBy items if not empty
	if(this.groupBy.length > 0) {
		_.each(this.groupBy, function(groupByItem) {
			queryBuilder = queryBuilder.groupByRaw(groupByItem);
		});
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.setLimit = function(value) {
	this.limit = value;
};

QueryBuilder.prototype.getLimit = function() {
	return this.limit;
};

QueryBuilder.prototype.parseLimit = function(queryBuilder) {

	// Set limit if defined
	if(this.limit !== null) {
		queryBuilder = queryBuilder.limit(this.limit);
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.setOffset = function(value) {
	this.offset = value;
};

QueryBuilder.prototype.getOffset = function() {
	return this.offset;
};

QueryBuilder.prototype.parseOffset = function(queryBuilder) {

	// Set offset if defined
	if(this.offset !== null) {
		queryBuilder = queryBuilder.offset(this.offset);
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.addOrderBy = function(value) {
	this.orderBy.push(value);
};

QueryBuilder.prototype.removeOrderBy = function(value) {
	this.orderBy = _.reject(this.orderBy, function(obj) { return obj === value; });
};

QueryBuilder.prototype.getOrderBy = function() {
	return this.orderBy;
};

QueryBuilder.prototype.parseOrderBy = function(queryBuilder) {

	// Add orderBy items if not empty
	if(this.orderBy.length > 0) {
		_.each(this.orderBy, function(orderByItem) {
			queryBuilder = queryBuilder.orderByRaw(orderByItem);
		});
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.toKnexBuilder = function(queryBuilder) {

	// Parse all instance data
	queryBuilder = this.parseColumns(queryBuilder);
	queryBuilder = this.parseFromRaw(queryBuilder);
	queryBuilder = this.parseWhereRaw(queryBuilder);
	queryBuilder = this.parseJoins(queryBuilder);
	queryBuilder = this.parseGroupBy(queryBuilder);
	queryBuilder = this.parseLimit(queryBuilder);
	queryBuilder = this.parseOffset(queryBuilder);
	queryBuilder = this.parseOrderBy(queryBuilder);

	// Return
	return queryBuilder;

};

QueryBuilder.prototype.createKnexBuilder = function() {

	// Data
	var knexQueryBuilder = knex.queryBuilder();

	// Parse all instance data
	knexQueryBuilder = this.parseColumns(knexQueryBuilder);
	knexQueryBuilder = this.parseFromRaw(knexQueryBuilder);
	knexQueryBuilder = this.parseWhereRaw(knexQueryBuilder);
	knexQueryBuilder = this.parseJoins(knexQueryBuilder);
	knexQueryBuilder = this.parseGroupBy(knexQueryBuilder);
	knexQueryBuilder = this.parseLimit(knexQueryBuilder);
	knexQueryBuilder = this.parseOffset(knexQueryBuilder);
	knexQueryBuilder = this.parseOrderBy(knexQueryBuilder);

	// Return
	return knexQueryBuilder;

};

QueryBuilder.prototype.toString = function() {
	return this.createKnexBuilder().toString();
};



// Exports
module.exports = QueryBuilder;