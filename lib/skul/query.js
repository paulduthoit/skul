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
 *
 * @return {Object}
 * @api public
 */
module.exports.createSelectQuery = function(filter, fields, options, hashAlias) {

    // Data
    var self = this;
    var alias = 'A';
    var mainQueryBuilder = new QueryBuilder();
    var subQueryBuilder = new QueryBuilder();
    var primaryKey = self.getPrimaryKey();
    var tableName = self.getTableName();
    var hasHasManyRelationship = false;

    // Get fields
    privateMethods._parseFields.call(self, subQueryBuilder, fields, hashAlias, alias);

    // Set query builder
    subQueryBuilder.setFromRaw('`' + tableName + '` AS `' + alias + '`');

    // Add where clause
    subQueryBuilder.setHavingRaw(privateMethods._parseFilter.call(self, subQueryBuilder, filter, hashAlias, alias));

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
			var splitedKey = key.split('.');
			var fieldName = splitedKey.pop().replace(/^\-/, '');
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

				// Set data
				relModel = relationship.model;
				hasHasManyRelationship |= relationship.type === 'hasMany';
				hasHasManyRelationship |= relationship.type === 'hasManyCustom';

			});
		}

	});

	// If has at least one hasMany relationship
	if(hasHasManyRelationship) {
		subQueryBuilder.addGroupBy('`' + alias + '`.`' + primaryKey + '`');
	}

	// Create main query
	mainQueryBuilder.setGroupBy(_.map(subQueryBuilder.getGroupBy(), function(item) { return item.replace(/\`\.\`/, '$'); }));
	subQueryBuilder.setGroupBy([ '`' + alias + '`.`' + primaryKey + '`' ]);
	mainQueryBuilder.setFromRaw({ queryBuilder: subQueryBuilder, alias: 'B' });

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
module.exports.createCountQuery = function(filter, fields, options, hashAlias) {

    // Data
    var self = this;
    var mainQueryBuilder = new QueryBuilder();
    var subQueryBuilder = new QueryBuilder();
    var mainQueryAlias = 'B';
    var subQueryAlias = 'A';
    var tableName = self.getTableName();
    var primaryKey = self.getPrimaryKey();

    // Parse fields
    privateMethods._parseFields.call(self, subQueryBuilder, fields, hashAlias, subQueryAlias);

    // Add from and where clause
    subQueryBuilder.addColumn(subQueryAlias + '.' + '*');
    subQueryBuilder.setFromRaw('`' + tableName + '` AS `' + subQueryAlias + '`');
    subQueryBuilder.setHavingRaw(privateMethods._parseFilter.call(self, subQueryBuilder, filter, hashAlias, subQueryAlias));

    // Set main query builder
    mainQueryBuilder.addColumn(knex.raw('COUNT(*) as `total`'));
    mainQueryBuilder.setFromRaw('(' + subQueryBuilder.toString() + ') AS `' + mainQueryAlias + '`');

    // Return query builder
    return mainQueryBuilder;

};