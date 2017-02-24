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

    // Data
    var self = this;
    var mainQueryBuilder = new QueryBuilder();
    var subQueryBuilder = new QueryBuilder();
    var primaryKey = self.getPrimaryKey();
    var tableName = self.getTableName();
    var hasHasManyRelationship = false;

    // Set default context
    if(typeof context.aliasIncrement === 'undefined') context.aliasIncrement = 1;
    if(typeof context.usedFields === 'undefined') context.usedFields = [];

    // Set alias
	var mainQueryAlias = String(context.aliasIncrement);
	context.aliasIncrement++;
	var subQueryAlias =  String(context.aliasIncrement);
	context.aliasIncrement++;

    // Parse fields
    privateMethods._parseFields.call(self, subQueryBuilder, fields, hashAlias, subQueryAlias, context);

    // Parse filter
    var parsedFilter = privateMethods._parseFilter.call(self, subQueryBuilder, filter, hashAlias, subQueryAlias, context);

    // Add from and where clause
    subQueryBuilder.setFromRaw('`' + tableName + '` AS `' + subQueryAlias + '`');
    subQueryBuilder.setHavingRaw(parsedFilter);

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
		subQueryBuilder.addGroupBy('`' + subQueryAlias + '`.`' + primaryKey + '`');
	}

	// Create main query
	mainQueryBuilder.setGroupBy(_.map(subQueryBuilder.getGroupBy(), function(item) { return item.replace(/\`\.\`/, '$'); }));
	subQueryBuilder.setGroupBy([ '`' + subQueryAlias + '`.`' + primaryKey + '`' ]); ////// CAN BE PROBLEMATIC WITH HAVING
	// subQueryBuilder.setGroupBy([]);
	mainQueryBuilder.setFromRaw({ queryBuilder: subQueryBuilder, alias: mainQueryAlias });

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
	var subQueryGroupBy = subQueryBuilder.getGroupBy();
	var subQueryJoins = subQueryBuilder.getJoins();

	// If sub query 2 needed
	if(!(subQueryGroupBy.length === 1 && subQueryGroupBy[0] === '`' + subQueryAlias + '`.`' + primaryKey + '`') && subQueryJoins.length > 0) {
    
		// Set query builder
    	var subQuery2Builder = new QueryBuilder();

    	// Set alias
		var subQuery2Alias = String(context.aliasIncrement);
		context.aliasIncrement++;

	    // Set sub query builder
	    subQuery2Builder.addColumn(knex.raw('*'));
	    subQuery2Builder.setFromRaw('(' + subQueryBuilder.toString() + ') AS `' + subQuery2Alias + '`');
		subQuery2Builder.addGroupBy('`' + subQuery2Alias + '`.`' + subQueryAlias + '$' + primaryKey + '`');

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