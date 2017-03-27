/*
* lib/skul/query.js
*
* SKuL query methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');
var objectPath = require('object-path');
var knex = require('knex')({ client: 'mysql' });
var QueryBuilder = require('./query-builder');
var privateMethods = require('./private');


/*
 * Create select query
 *
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Array} hashAlias
 * @params {Object} [context]
 *
 * @return {Object}
 * @api public
 */
module.exports.createSelectQuery = function(filter, fields, options, hashAlias, context) {

	// Transform arguments
	if(typeof context === 'undefined') context = {};

	// Set data
    var self = this;
	
	// Set context
	context.aliasIncrement = 1;
	context.queryBuilder = new QueryBuilder();
	context.queryBuilderColumns = {};
	context.requestedFields = [];
	context.queryBuildingTasks = { 0: [], 1: [] };
	context.hashAlias = hashAlias;

    /* FROM */

	    // Set alias
	    var tableName = self.getTableName();
	    var tableAlias = 'T' + context.aliasIncrement;

	    // Increment alias
	    context.aliasIncrement++;

	    // Push alias
	    context.hashAlias.push({ alias: tableAlias, key: '', model: self });

	    // Set from
		context.queryBuilder.setFromRaw('`' + tableName + '` AS `' + tableAlias + '`');

    /* /FROM */

    /* PARSE FIELDS/FILTER */

	    // Parse fields
	    privateMethods._parseFields.call(context, self, fields, tableAlias, '');

	    // Parse filter
	    var whereClause = privateMethods._parseFilter.call(context, self, filter, tableAlias, '');


    /* /PARSE FIELDS/FILTER */

    /* ORDER BY */

    	// Set dat
    	var orderbyItems = null;

    	// Check orderby
    	if(typeof options.orderby === 'undefined' && typeof this.defaultSelectOptions.orderby !== 'undefined' && this.defaultSelectOptions.orderby !== null) {
    		options.orderby = this.defaultSelectOptions.orderby;
    	}

    	// Set orderby
    	if(typeof options.orderby !== 'undefined' && options.orderby instanceof Array) {
	    	orderbyItems = options.orderby;
	    }

    	// Loop over orderby if defined
    	if(orderbyItems) {
			_.each(orderbyItems, function(orderbyItem) {

				// Set order by data
				if(orderbyItem.match(/^-/)) {
					var orderbyIsAsc = false;
					var orderbyField = orderbyItem.replace(/^-/, '');
				} else {
					var orderbyIsAsc = true;
					var orderbyField = orderbyItem;
				}

				// Get some field path
				var fieldsToParsePath = orderbyField.split('.').join('.$fields.').split('.');
				var absoluteBaseFieldPath = orderbyField.split('.');
				var fieldName = absoluteBaseFieldPath.pop();

				// Set field to parse
				var fieldsToParse = {};

				// Set fields to parse
				objectPath.set(fieldsToParse, fieldsToParsePath, 1);

				// Parse fields
				privateMethods._parseFields.call(context, self, fieldsToParse, tableAlias, '');

				// Get absolute hash alias item
				absoluteHashAliasItem = _.find(context.hashAlias, function(obj) { return obj.key === absoluteBaseFieldPath.join('.'); });

				// Set order by string
				var orderbyString = '`' + absoluteHashAliasItem.alias + '$' + fieldName + '`' + (orderbyIsAsc ? ' ASC' : ' DESC');

				// Add order by
				context.queryBuilder.addOrderBy(orderbyString);

			});
    	}

    /* /ORDER BY */

    /* BUILD QUERY */

		// Set columns
		context.queryBuilder.setColumns(_.map(context.queryBuilderColumns, function(value, key) { return key + ' AS ' + value; }));

		// Run query building tasks
		_.each(context.queryBuildingTasks[0], function(fun) { return fun(); });
		_.each(context.queryBuildingTasks[1], function(fun) { return fun(); });


    /* /BUILD QUERY */

    /* SUBQUERY */

    	// Set subquery
    	var subqueryBuilder = new QueryBuilder();

    	// Set from
    	subqueryBuilder.setFromRaw(context.queryBuilder);

		// Add column
		subqueryBuilder.setColumns(context.requestedFields);

		// Set query builder
		context.queryBuilder = subqueryBuilder;


    /* /SUBQUERY */

    /* WHERE */

		// Set where
		context.queryBuilder.setWhereRaw(whereClause);

    /* /WHERE */

    /* OFFSET */

    	// Check offset
    	if(typeof options.skip === 'undefined' && typeof this.defaultSelectOptions.skip !== 'undefined' && this.defaultSelectOptions.skip !== null) {
    		options.skip = this.defaultSelectOptions.skip;
    	}

    	// Set offset
    	if(typeof options.skip !== 'undefined' && !isNaN(options.skip)) {
	    	context.queryBuilder.setOffset(options.skip);
	    }

    /* /OFFSET */

    /* LIMIT */

    	// Check limit
    	if(typeof options.limit === 'undefined' && typeof this.defaultSelectOptions.limit !== 'undefined' && this.defaultSelectOptions.limit !== null) {
    		options.limit = this.defaultSelectOptions.limit;
    	}

    	// Set limit
    	if(typeof options.limit !== 'undefined' && !isNaN(options.limit)) {
	    	context.queryBuilder.setLimit(options.limit);
	    }

    /* /LIMIT */

	// Return query builder
	return context.queryBuilder;

};

/*
 * Create count query
 *
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Array} hashAlias
 * @params {Object} [context]
 *
 * @return {Object}
 * @api public
 */
module.exports.createCountQuery = function(filter, fields, options, hashAlias, context) {

	// Transform arguments
	if(typeof context === 'undefined') context = {};

	// Set data
    var self = this;
	
	// Set context
	context.aliasIncrement = 1;
	context.queryBuilder = new QueryBuilder();
	context.queryBuilderColumns = {};
	context.requestedFields = [];
	context.queryBuildingTasks = { 0: [], 1: [] };
	context.hashAlias = hashAlias;

    /* FROM */

	    // Set alias
	    var tableName = self.getTableName();
	    var tableAlias = 'T' + context.aliasIncrement;

	    // Increment alias
	    context.aliasIncrement++;

	    // Push alias
	    context.hashAlias.push({ alias: tableAlias, key: '', model: self });

	    // Set from
		context.queryBuilder.setFromRaw('`' + tableName + '` AS `' + tableAlias + '`');

    /* /FROM */

    /* PARSE FIELDS/FILTER */

	    // Parse filter
	    var whereClause = privateMethods._parseFilter.call(context, self, filter, tableAlias, '');


    /* /PARSE FIELDS/FILTER */

    /* BUILD QUERY */

		// Set columns
		context.queryBuilder.setColumns(_.map(context.queryBuilderColumns, function(value, key) { return key + ' AS ' + value; }));

		// Run query building tasks
		_.each(context.queryBuildingTasks[0], function(fun) { return fun(); });
		_.each(context.queryBuildingTasks[1], function(fun) { return fun(); });


    /* /BUILD QUERY */

    /* SUBQUERY */

    	// Set subquery
    	var subqueryBuilder = new QueryBuilder();

    	// Set from
    	subqueryBuilder.setFromRaw(context.queryBuilder);

		// Add column
		subqueryBuilder.addColumn(knex.raw('COUNT(*) AS `total`'));

		// Set query builder
		context.queryBuilder = subqueryBuilder;


    /* /SUBQUERY */

    /* WHERE */

		// Set where
		context.queryBuilder.setWhereRaw(whereClause);

    /* /WHERE */

	// Return query builder
	return context.queryBuilder;

};