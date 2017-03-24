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

	// Set data
    var self = this;
	var context = {
		aliasIncrement: 1,
		queryBuilder: new QueryBuilder(),
		queryBuilderColumns: {},
		requestedFields: [],
		queryBuildingTasks: { 0: [], 1: [] },
		hashAlias: hashAlias
	};

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

    /* ORDER BY */

    	// Check orderby
    	if(typeof options.orderby === 'undefined' && typeof this.defaultSelectOptions.orderby !== 'undefined' && this.defaultSelectOptions.orderby !== null) {
    		var orderbyItems = this.defaultSelectOptions.orderby;
    	} else if(typeof options.orderby !== 'undefined' && options.orderby instanceof Array) {
	    	 var orderbyItems = options.orderby;
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

    /* OFFSET / LIMIT */

	    // Set oofset
	    if(typeof options.skip === 'undefined' && typeof this.defaultSelectOptions.skip !== 'undefined' && this.defaultSelectOptions.skip !== null) {
	        context.queryBuilder.setOffset(this.defaultSelectOptions.skip);
	    } else if(typeof options.skip !== 'undefined' && !isNaN(options.skip)) {
	    	 context.queryBuilder.setOffset(options.skip);
	    }

	    // Set limit
	    if(typeof options.limit === 'undefined' && typeof this.defaultSelectOptions.limit !== 'undefined' && this.defaultSelectOptions.limit !== null) {
	        context.queryBuilder.setLimit(this.defaultSelectOptions.limit);
	    } else if(typeof options.limit !== 'undefined' && !isNaN(options.limit)) {
	    	 context.queryBuilder.setLimit(options.limit);
	    }

    /* /OFFSET / LIMIT */

	// Return query builder
	return context.queryBuilder;

	/*

    // Parse options
    var parsedOptions = self.parseSelectOptions(options);

    // Change options
    options.skip = parsedOptions.skip;
    options.limit = parsedOptions.limit;
    options.orderby = parsedOptions.orderby;

	// Add orderby clause
	if(parsedOptions.orderby !== null) {

		// Data
		_.each(parsedOptions.orderby, function(key) {

			// Data
			var splitedKey = key.replace(/^\-/, '').split('.');
			var fieldName = splitedKey.pop();
			var fieldBase = splitedKey.join('.');
			var isAsc = !key.match(/^\-/);

			// Check if key is a field path
			var orderByItem = _.find(hashAlias, function(obj) { return obj.key === fieldBase; }).alias + '$' + fieldName + ' ' + (isAsc ? 'ASC' : 'DESC');

			// Add to query builder
			subQueryBuilder.addOrderBy(orderByItem);
			mainQueryBuilder.addOrderBy(orderByItem);

		});

	}

	// Check if has at least one hasMany relationship
	_.each(_.pluck(hashAlias, 'key'), function(fieldKey) {

		// Data
		var relModel = self;

		// If field key is not empty
		if(fieldKey) {
			_.each(fieldKey.split('.'), function(relKey) {

				// Data
				var relationship = relModel.getRelationship(relKey);

				// If it is a hasOneThrough relationship
				if(relationship.type === 'hasOneThrough') {
					relModel = relationship.joins[relationship.joins.length-1].model;
				} else {
					relModel = relationship.model;
					hasHasManyRelationship |= relationship.type === 'hasMany';
					hasHasManyRelationship |= relationship.type === 'hasManyCustom';
				}

			});
		}

	});

	// If has at least one hasMany relationship
	if(hasHasManyRelationship) {
		subQueryBuilder.addGroupByRaw('`' + subQueryAlias + '`.`' + primaryKey + '`');
	}

	// Create main query
	mainQueryBuilder.setGroupByRaw(_.map(subQueryBuilder.getGroupByRaw(), function(item) { return item.replace(/\`\.\`/, '$'); }));
	subQueryBuilder.setGroupByRaw([ '`' + subQueryAlias + '`.`' + primaryKey + '`' ]); ////// CAN BE PROBLEMATIC WITH HAVING
	// subQueryBuilder.setGroupByRaw([]);
	mainQueryBuilder.setFromRaw(subQueryBuilder);

	// Add limit clause
	if(parsedOptions.limit !== null) {
		mainQueryBuilder.setLimit(parsedOptions.limit);	
	}

	// Add offset clause
	if(parsedOptions.skip !== null){
		mainQueryBuilder.setOffset(parsedOptions.skip);
	}

    // Return query builder
    return mainQueryBuilder;

    */

};

/*
 * Create count query
 *
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Array} hashAlias
 *
 * @return {Object}
 * @api public
 */
module.exports.createCountQuery = function(filter, fields, options, hashAlias, context) {

	// Transform arguments
	if(typeof context === 'undefined') context = {};

    // Data
    var self = this;
    var mainQueryBuilder = new QueryBuilder();
    var subQueryBuilder = new QueryBuilder();
    var tableName = self.getTableName();
    var primaryKey = self.getPrimaryKey();
    var hasHasManyRelationship = false;

    // Set default context
    if(typeof context.aliasIncrement === 'undefined') context.aliasIncrement = 1;
    if(typeof context.usedFields === 'undefined') context.usedFields = [];

    // Set alias
	var mainQueryAlias = String(context.aliasIncrement);
	context.aliasIncrement++;
	var subQueryAlias = String(context.aliasIncrement);
	context.aliasIncrement++;

    // Parse fields
    privateMethods._parseFields.call(self, subQueryBuilder, fields, hashAlias, subQueryAlias, context);

    // Add from and where clause
    // subQueryBuilder.addColumn(subQueryAlias + '.' + '*');
    subQueryBuilder.setFromRaw('`' + tableName + '` AS `' + subQueryAlias + '`');
    subQueryBuilder.setHavingRaw(privateMethods._parseFilter.call(self, subQueryBuilder, filter, hashAlias, subQueryAlias, context));

	// Check if has at least one hasMany relationship
	_.each(_.pluck(hashAlias, 'key'), function(fieldKey) {

		// Data
		var relModel = self;

		// If field key is not empty
		if(fieldKey) {
			_.each(fieldKey.split('.'), function(relKey) {

				// Data
				var relationship = relModel.getRelationship(relKey);

				// If it is a hasOneThrough relationship
				if(relationship.type === 'hasOneThrough') {
					relModel = relationship.joins[relationship.joins.length-1].model;
				} else {
					relModel = relationship.model;
					hasHasManyRelationship |= relationship.type === 'hasMany';
					hasHasManyRelationship |= relationship.type === 'hasManyCustom';
				}

			});
		}

	});

	// Get group by of sub query
	var subQueryGroupByRaw = subQueryBuilder.getGroupByRaw();
	var subQueryJoins = subQueryBuilder.getJoins();

	// If sub query 2 needed
	if(!(subQueryGroupByRaw.length === 1 && subQueryGroupByRaw[0] === '`' + subQueryAlias + '`.`' + primaryKey + '`') && subQueryJoins.length > 0) {
    
		// Set query builder
    	var subQuery2Builder = new QueryBuilder();

    	// Set alias
		var subQuery2Alias = String(context.aliasIncrement);
		context.aliasIncrement++;

	    // Set sub query builder
	    subQuery2Builder.addColumn(knex.raw('*'));
	    subQuery2Builder.setFromRaw('(' + subQueryBuilder.toString() + ') AS `' + subQuery2Alias + '`');
		subQuery2Builder.addGroupByRaw('`' + subQuery2Alias + '`.`' + subQueryAlias + '$' + primaryKey + '`');

	    // Set main query builder
	    mainQueryBuilder.addColumn(knex.raw('COUNT(*) as `total`'));
	    mainQueryBuilder.setFromRaw('(' + subQuery2Builder.toString() + ') AS `' + mainQueryAlias + '`');

	}

	// If no sub query 2 needed
	else {

	    // Set main query builder
	    mainQueryBuilder.addColumn(knex.raw('COUNT(*) as `total`'));
	    mainQueryBuilder.setFromRaw('(' + subQueryBuilder.toString() + ') AS `' + mainQueryAlias + '`');

	}

    // Return query builder
    return mainQueryBuilder;

};