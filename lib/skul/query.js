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
 * @params {Object} hashAlias
 *
 * @return {Object}
 * @api public
 */
module.exports.createSelectQuery = function(filter, fields, options, hashAlias) {

    // Data
    var self = this;
    var alias = 'A';
    var queryBuilder = new QueryBuilder();
    var primaryKey = self.getPrimaryKey();
    var tableName = self.getTableName();
    var hasHasManyRelationship = false;

    // Get fields
    privateMethods._parseFields.call(self, queryBuilder, fields, hashAlias, alias);

    // Set query builder
    queryBuilder.setFromRaw(tableName + ' AS ' + alias);

    // Add where clause
    queryBuilder.setWhereRaw(privateMethods._parseFilter.call(self, queryBuilder, filter, hashAlias, alias));

    // Parse options
    var parsedOptions = self.parseSelectOptions(options);

    // Change options
    options.skip = parsedOptions.skip;
    options.limit = parsedOptions.limit;
    options.orderby = parsedOptions.orderby;

	// Add limit clause
	if(parsedOptions.limit !== null) {
		queryBuilder.setLimit(parsedOptions.limit);	
	}

	// Add offset clause
	if(parsedOptions.skip !== null){
		queryBuilder.setOffset(parsedOptions.skip);
	}

	// Add orderby clause
	if(parsedOptions.orderby !== null) {

		// Data
		_.each(parsedOptions.orderby, function(key) {

			// Data
			var inversedHashAlias = _.invert(hashAlias);
			var splitedKey = key.split('.');
			var fieldName = splitedKey.pop().replace(/^\-/, '');
			var fieldBase = splitedKey.join('.');
			var isAsc = !key.match(/^\-/);

			// Check if key is a field path
			var orderByItem = inversedHashAlias[fieldBase] + '$' + fieldName + ' ' + (isAsc ? 'DESC' : 'ASC');
		
			// Add to query builder
			queryBuilder.addOrderBy(orderByItem);

		});

	}

	// Check if has at least one hasMany relationship
	_.each(_.values(hashAlias), function(fieldKey) {

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
		queryBuilder.addGroupBy(alias + '.' + primaryKey);
	}

    // Return query builder
    return queryBuilder;

};

/*
 * Create count query
 *
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Object} hashAlias
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
    subQueryBuilder.setFromRaw(tableName + ' AS `' + subQueryAlias + '`');
    subQueryBuilder.setWhereRaw(privateMethods._parseFilter.call(self, subQueryBuilder, filter, hashAlias, subQueryAlias));

    // Set main query builder
    mainQueryBuilder.addColumn(knex.raw('COUNT(*) as `total`'));
    mainQueryBuilder.setFromRaw('(' + subQueryBuilder.toString() + ') AS `' + mainQueryAlias + '`');

    console.log(mainQueryBuilder.toString());

    // Return query builder
    return mainQueryBuilder;

};