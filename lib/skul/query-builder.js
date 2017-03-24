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
	this.aliasIncrement = 2;
	this.alias = 'SQ1';
	this.columns = [];
	this.fromRaw = null;
	this.whereRaw = null;
	this.havingRaw = null;
	this.joins = [];
	this.groupByRaw = [];
	this.limit = null;
	this.offset = null;
	this.orderBy = [];

};


QueryBuilder.prototype.alias;
QueryBuilder.prototype.aliasIncrement;
QueryBuilder.prototype.columns;
QueryBuilder.prototype.fromRaw;
QueryBuilder.prototype.whereRaw;
QueryBuilder.prototype.havingRaw;
QueryBuilder.prototype.joins;
QueryBuilder.prototype.groupByRaw;
QueryBuilder.prototype.limit;
QueryBuilder.prototype.offset;
QueryBuilder.prototype.orderBy;




QueryBuilder.prototype.getAliasIncrement = function() {
	return this.aliasIncrement;
};

QueryBuilder.prototype.setAlias = function(alias) {
	this.alias = alias;
};

QueryBuilder.prototype.getAlias = function() {
	return this.alias;
};



QueryBuilder.prototype.setColumns = function(columns) {
	this.columns = columns;
};

QueryBuilder.prototype.addColumns = function(columns) {
	this.columns = this.columns.concat(columns);
};

QueryBuilder.prototype.addColumn = function(column) {

	// Data
	isExisting = false;

	// Loop over existing columns
	_.each(this.columns, function(columnItem) {

		// Check if already exists
		if(typeof columnItem === 'string' && typeof column === 'string' && columnItem === column) {
			isExisting |= true;
		} else if(_isKnexRawObject(columnItem) && typeof column === 'string' && columnItem.sql === column) {
			isExisting |= true;
		} else if(typeof columnItem === 'string' && _isKnexRawObject(column) && columnItem === column.sql) {
			isExisting |= true;
		} else if(_isKnexRawObject(columnItem) && _isKnexRawObject(column) && columnItem.sql === column.sql) {
			isExisting |= true;
		}

	});

	// Add if doesn't exist
	if(!isExisting) {
		this.columns.push(column);
	}

	// Return if already exist
	return !isExisting;
	
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

	// If from raw is a query builder
	if(value instanceof QueryBuilder) {
		this.alias = 'SQ' + value.getAliasIncrement();
		this.aliasIncrement = value.getAliasIncrement() + 1;
	}

	// Set from raw
	this.fromRaw = value;

};

QueryBuilder.prototype.getFromRaw = function() {
	return this.fromRaw;
};

QueryBuilder.prototype.parseFromRaw = function(queryBuilder) {

	// Set fromRaw if defined
	if(this.fromRaw !== null) {

		// If from raw is a query builder
		if(this.fromRaw instanceof QueryBuilder) {
			queryBuilder = queryBuilder.from(knex.raw('(' + this.fromRaw.toString() + ') AS `' + this.fromRaw.getAlias() + '`'));
		}

		// If from raw is a string
		else {
			queryBuilder = queryBuilder.from(knex.raw(this.fromRaw));
		}

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
	if(this.whereRaw) {
		queryBuilder = queryBuilder.whereRaw(this.whereRaw);
	}

	// Return
	return queryBuilder;

};



QueryBuilder.prototype.setHavingRaw = function(value) {
	this.havingRaw = value;
};

QueryBuilder.prototype.getHavingRaw = function() {
	return this.havingRaw;
};

QueryBuilder.prototype.parseHavingRaw = function(queryBuilder) {

	// Set havingRaw if defined
	if(this.havingRaw) {
		queryBuilder = queryBuilder.havingRaw(this.havingRaw);
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



QueryBuilder.prototype.addGroupByRaw = function(value) {

	// Check if already exist
	var groupByItemRef = _.findIndex(this.groupByRaw, function(obj) {
		return obj === value;
	});

	// Push if not exists
	if(groupByItemRef === -1) {
		this.groupByRaw.push(value);
	}

};

QueryBuilder.prototype.removeGroupByRaw = function(value) {
	this.groupByRaw = _.reject(this.groupByRaw, function(obj) { return obj === value; });
};

QueryBuilder.prototype.setGroupByRaw = function(value) {
	this.groupByRaw = value;
};

QueryBuilder.prototype.getGroupByRaw = function() {
	return this.groupByRaw;
};

QueryBuilder.prototype.parseGroupByRaw = function(queryBuilder) {

	// Add groupBy items if not empty
	if(this.groupByRaw.length > 0) {
		_.each(this.groupByRaw, function(groupByItem) {
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

	// Check if already exist
	var orderByItemRef = _.findIndex(this.orderBy, function(obj) {
		return obj === value;
	});

	// Push if not exists
	if(orderByItemRef === -1) {
		this.orderBy.push(value);
	}
	
};

QueryBuilder.prototype.removeOrderBy = function(value) {
	this.orderBy = _.reject(this.orderBy, function(obj) { return obj === value; });
};

QueryBuilder.prototype.setOrderBy = function(value) {
	this.orderBy = value;
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
	queryBuilder = this.parseHavingRaw(queryBuilder);
	queryBuilder = this.parseJoins(queryBuilder);
	queryBuilder = this.parseGroupByRaw(queryBuilder);
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
	knexQueryBuilder = this.parseHavingRaw(knexQueryBuilder);
	knexQueryBuilder = this.parseJoins(knexQueryBuilder);
	knexQueryBuilder = this.parseGroupByRaw(knexQueryBuilder);
	knexQueryBuilder = this.parseLimit(knexQueryBuilder);
	knexQueryBuilder = this.parseOffset(knexQueryBuilder);
	knexQueryBuilder = this.parseOrderBy(knexQueryBuilder);

	// Return
	return knexQueryBuilder;

};

QueryBuilder.prototype.toString = function() {
	return this.createKnexBuilder().toString();
};



// Is Knex Raw object
var _isKnexRawObject = function(obj) {
	return typeof obj === 'object' && obj !== null && typeof obj.sql === 'string';
};



// Exports
module.exports = QueryBuilder;