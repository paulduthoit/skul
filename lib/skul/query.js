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
    var tableName = self.getTableName();

    // Get fields
    _parseFields.call(self, queryBuilder, fields, hashAlias, alias);

    // Set query builder
    queryBuilder.setFromRaw(tableName + ' AS ' + alias);

    // Add where clause
    queryBuilder.setWhereRaw(_parseFilter.call(self, queryBuilder, filter, hashAlias, alias));

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

    // Return query builder
    return queryBuilder.createKnexBuilder();

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
    var alias = 'A';
    var queryBuilder = knex.queryBuilder();
    var subQueryBuilder = new QueryBuilder();
    var tableName = self.getTableName();
    var primaryKey = self.getPrimaryKey();

    // Parse fields
    _parseFields.call(self, subQueryBuilder, fields, hashAlias, alias);

    // Add from and where clause
    subQueryBuilder.addColumn(alias + '.' + '*');
    subQueryBuilder.setFromRaw(tableName + ' AS ' + alias);
    subQueryBuilder.setWhereRaw(_parseFilter.call(self, subQueryBuilder, filter, hashAlias, alias));

    // Set query builder
    queryBuilder = queryBuilder.count('* as total').from(knex.raw('(' + subQueryBuilder.createKnexBuilder().toString() + ') AS ' + alias));

    // Return query builder
    return queryBuilder;

};



// Parse filter
var _parseFilter = function(queryBuilder, filter, hashAlias, alias) {

	// Constants
	var KEYWORDS = [ '$and', '$or', '$nor', '$not', '$gt', '$gte', '$lt', '$lte', '$e', '$ne', '$like', '$in', '$nin', '$key', '$value' ];

	// Data
	var self = this;
	var filterString = "";
	var filterAlreadyFullfill = false;

	// Parse filter if keys contains keywords
	if(_.intersection(KEYWORDS, Object.keys(filter)).length > 0) {
		filterString += _parseFilterItem.call(self, queryBuilder, filter, hashAlias, alias, filterAlreadyFullfill);
	} 

	else {

		// Parse item for each filter keys
		_.each(filter, function(filterItemValue, filterItemKey) {

			// If $elemMatch is present
			if(typeof filterItemValue === 'object' && filterItemValue !== null && _.intersection([ '$elemMatch' ], Object.keys(filterItemValue)).length > 0) {

				// Parse item for each filter keys
				_.each(filterItemValue[ '$elemMatch' ], function(filterItemValue2, filterItemKey2) {

					////////////// CHECK HASH ALIAS TO RETRIEVE FILTER ITEM KEY ////////////

					// Set filter item
					var filterItem = { '$key': hashAlias[filterItemKey] + '.' + filterItemKey2, '$value': filterItemValue2 };

					// Parse filter item
					filterString += _parseFilterItem.call(self, queryBuilder, filterItem, hashAlias, alias, filterAlreadyFullfill);

				});

			} else {

				// Set filter item
				var filterItem = { '$key': filterItemKey, '$value': filterItemValue };

				// Parse filter item
				filterString += _parseFilterItem.call(self, queryBuilder, filterItem, hashAlias, alias, filterAlreadyFullfill);

			}

		});

	}

	// Return parsed filter
	return filterString.trim();

};

// Parse filter item
var _parseFilterItem = function(queryBuilder, item, hashAlias, alias, alreadyFullfill) {

	// Data
	var self = this;
	var filterString = "";

	// If AND
	if(_.contains(_.keys(item), '$and') && item['$and'] instanceof Array) {

		// For each AND items
		_.each(item['$and'], function(andItem, andIndex) {

			// Check AND item
			if(Object.keys(andItem).length === 0) {
				return;
			}

			// Add AND item
			filterString += "(" + ' ';
			filterString += _parseFilter.call(self, queryBuilder, andItem, hashAlias, alias) + ' ';
			filterString += ")" + ' ';

			// Add AND keyword
			if(andIndex < item['$and'].length-1) {
				filterString += "AND" + ' ';
			}

		});

	}

	// If AND
	else if(_.contains(_.keys(item), '$or') && item['$or'] instanceof Array) {

		// For each AND items
		_.each(item['$or'], function(andItem, andIndex) {

			// Add OR item
			filterString += "(" + ' ';
			filterString += _parseFilter.call(self, queryBuilder, andItem, hashAlias, alias) + ' ';
			filterString += ")" + ' ';

			// Add OR keyword
			if(andIndex < item['$or'].length-1) {
				filterString += "OR" + ' ';
			}

		});

	}

	// If NOR
	else if(_.contains(_.keys(item), '$nor') && item['$nor'] instanceof Array) {

		// Add NOT keyword
		filterString += "NOT (";

		// For each AND items
		_.each(item['$nor'], function(andItem, andIndex) {

			// Add NOR item
			filterString += "(" + ' ';
			filterString += _parseFilter.call(self, queryBuilder, andItem, hashAlias, alias) + ' ';
			filterString += ")";

			// Add OR keyword
			if(andIndex < item['$nor'].length-1) {
				filterString += " OR ";
			}

		});

		// Close keyword
		filterString += ") ";

	}

	// If NOT
	else if(_.contains(_.keys(item), '$not')) {

		// Add NOT item
		filterString += "NOT ";
		filterString += _parseFilter.call(self, queryBuilder, item['$not'], hashAlias, alias) + " ";

	}

	// If >
	else if(_.contains(_.keys(item), '$gt')) {

		// Add > item
		filterString += " > ";
		filterString += _parseValue(item['$gt']) + " ";

	}

	// If >=
	else if(_.contains(_.keys(item), '$gte')) {

		// Add >= item
		filterString += " >= ";
		filterString += _parseValue(item['$gte']) + " ";

	}

	// If <
	else if(_.contains(_.keys(item), '$lt')) {

		// Add < item
		filterString += " < ";
		filterString += _parseValue(item['$lt']) + " ";

	}

	// If <=
	else if(_.contains(_.keys(item), '$lte')) {

		// Add <= item
		filterString += " <= ";
		filterString += _parseValue(item['$lte']) + " ";

	}

	// If =
	else if(_.contains(_.keys(item), '$e')) {

		// Add <= item
		filterString += " = ";
		filterString += _parseValue(item['$e']) + " ";

	}

	// If <>
	else if(_.contains(_.keys(item), '$ne')) {

		// Add <= item
		filterString += " <> ";
		filterString += _parseValue(item['$ne']) + " ";

	}

	// If like clause
	else if(_.contains(_.keys(item), '$like')) {

		// Add <= item
		filterString += " LIKE ";
		filterString += "'%" + item['$like'] + "%' ";

	}

	// If IN
	else if(_.contains(_.keys(item), '$in') && item['$in'] instanceof Array) {

		// Add quotes for strings
		var itemValue = _.map(item['$in'], function(val) {
			return _parseValue(val);
		});

		// Add IN item
		filterString += "IN (";
		filterString += itemValue.join(',');
		filterString += ") ";

	}

	// If NIN
	else if(_.contains(_.keys(item), '$nin') && item['$nin'] instanceof Array) {

		// Add quotes for strings
		itemValue = _.map(item['$nin'], function(val) {
			return _parseValue(val);
		});

		// Add IN item
		filterString += "NOT IN (";
		filterString += itemValue.join(',');
		filterString += ") ";

	}

	// Else
	else {

		// Add AND keyword
		if(alreadyFullfill) {
			filterString += "AND ";
		}

		// Data
		var itemKey = item['$key'];
		var itemKeyBefore = item['$before_key'] ? item['$before_key'] : '';
		var itemKeyAfter = item['$after_key'] ? item['$after_key'] : '';
		var itemValue = {
			'$value': item['$value'],
			'$before_value': item['$before_value'] ? item['$before_value'] : '',
			'$after_value': item['$after_value'] ? item['$after_value'] : ''
		};

		// Get filter field
		var splitedKey = itemKey.split('.');
		var fieldName = splitedKey.pop();
		var fieldBase = splitedKey.join('.');

		// Add required joins
		var _addRequiredJoins = function(parentKeyPath, alias) {

			// Data
			var self = this;
			var relationshipAlias = 1;
			var splitedKey = parentKeyPath.split('.');
			var fieldRoot = splitedKey.shift();
			var fieldName = splitedKey.join('.');
			var fieldToParse = {};
				fieldToParse[fieldRoot] = 1;
			var selfPrimaryKey = self.getPrimaryKey();
			var relationshipFields = self.parseRelationships(fieldToParse);

			// Get last relationship alias
			_.each(hashAlias, function(value, key) {

				// Get relationship alias
				var relAlias = key.match(new RegExp('^' + alias + '\\$(.*?)\\$|^' + alias + '\\$(.*?)$'));
					relAlias = relAlias instanceof Array ? parseInt(relAlias[1] || relAlias[2]) : -1;

				// Set last relationship alias
				if(relationshipAlias <= relAlias) {
					relationshipAlias = relAlias + 1;
				}

			});

		    // Loop over relationship fields
		    (function(relFieldObj, relFieldKey) {

		    	// Check if present in hashAlias
		    	if(_.contains(_.values(hashAlias), relFieldKey)) {
		    		return;
		    	}

		        // Set relationship data
		        var relAlias = alias + '$' + relationshipAlias;
		        var relationship = self.getRelationship(relFieldKey);
		        var relModel = relationship.model;
		        var relForeignKey = relationship.foreignKey;
		        var relType = relationship.type;
		        var relTableName = relModel.getTableName();
		        var relPrimaryKey = relModel.getPrimaryKey();
		        var relFields = {};

		        // Push alias
		        hashAlias[relAlias] = _.reject([ hashAlias[alias], relFieldKey ], function(obj) { return !obj; }).join('.');

		        // Push left join
		        if(relType === 'hasOne') {
		        	queryBuilder.addJoin('left', [ relTableName + ' AS ' + relAlias, relAlias + '.' + relForeignKey, alias + '.' + selfPrimaryKey]);
		        } else if(relType === 'belongsTo') {
       				queryBuilder.addJoin('left', [ relTableName + ' AS ' + relAlias, relAlias + '.' + relPrimaryKey, alias + '.' + relForeignKey ]);
		        }

		        // If has children
			    if(fieldName !== "") {
			    	_addRequiredJoins.call(relModel, fieldName, relAlias);
			    }

		    })(1, fieldRoot);

		};

		// Add required joins
		_addRequiredJoins.call(self, fieldBase, alias);

		console.log(hashAlias);

		// Get filter field
		var inversedHashAlias = _.invert(hashAlias);
		var filterField = itemKeyBefore + inversedHashAlias[fieldBase] + '.' + fieldName + itemKeyAfter;

		// If is null
		if(_.isObject(itemValue['$value']) && itemValue['$value'] === null) {
			filterString += filterField + " IS NULL ";
		}

		// If is not null
		if(_.isObject(itemValue['$value']) && itemValue['$value']['$ne'] === null) {
			filterString += filterField + " IS NOT NULL ";
		}

		// If object
		else if(_.isObject(itemValue['$value']) && itemValue['$value'] !== null) {
			filterString += filterField + " " + _parseFilter.call(self, queryBuilder, itemValue['$value'], hashAlias, alias) + " ";
		}

		// If value
		else {
			filterString += filterField + " = " + _parseValue(itemValue) + " ";
		}
		
		// Set boolean
		alreadyFullfill = true;

	}

	// Return filter string
	return filterString;

};

// Parse value
var _parseValue = function(value) {

	// Data
	var parsedValue = '';

	// If value is an object
	if(!_.isObject(value)) {
		value = {
			'$before_value': '',
			'$after_value': '',
			'$value': value
		};
	}

	// Add value
	if(isNaN(value['$value'])) {
		parsedValue += "'" + value['$value'] + "'";
	} else {
		parsedValue += value['$value'];
	}

	// Add before/after of value
	parsedValue = value['$before_value'] + parsedValue + value['$after_value'];

	// Return parsed value
	return parsedValue;

};

// Parse fields
var _parseFields = function(queryBuilder, fields, hashAlias, alias) {

    // Data
    var self = this;
    var selfPrimaryKey = self.getPrimaryKey();
    var selfKeys = self.parseFields(fields);
    
    // Loop over self keys to add column to query builder
    _.each(selfKeys, function(obj) {
    	queryBuilder.addColumn(alias + '.' + obj + ' AS ' + alias + '$' + obj);
    });

    // Push alias
    if(typeof hashAlias[alias] === "undefined") {
        hashAlias[alias] = '';
    }

    // Set relationship alias
    var relationshipAlias = 1;

    // Get relationship and custom fields
    var hasOneRelationshipFields = self.parseRelationships('hasOne', fields);
    var belongsToRelationshipFields = self.parseRelationships('belongsTo', fields);
    var customFields = self.parseCustoms(fields);

    // Loop over hasOne relationship fields
    _.each(hasOneRelationshipFields, function(relFieldObj, relFieldKey) {

        // Set relationship data
        var relAlias = alias + '$' + relationshipAlias;
        var relationship = self.getRelationship(relFieldKey);
        var relModel = relationship.model;
        var relForeignKey = relationship.foreignKey;
        var relTableName = relModel.getTableName();
        var relPrimaryKey = relModel.getPrimaryKey();
        var relFields = relFieldObj['$fields'];

        // Check if relationship fields is defined
        if(typeof relFields === "undefined") {
        	relFields = {};
        }

        // Push alias
        hashAlias[relAlias] = _.reject([ hashAlias[alias], relFieldKey ], function(obj) { return !obj; }).join('.');

        // Push left join
        queryBuilder.addJoin('left', [ relTableName + ' AS ' + relAlias, relAlias + '.' + relForeignKey, alias + '.' + selfPrimaryKey]);

        // Parse relationship fields
        _parseFields.call(relModel, queryBuilder, relFields, hashAlias, relAlias);

        // Increment alias
        relationshipAlias++;

    });

    // Loop over belongsTo relationship fields
    _.each(belongsToRelationshipFields, function(relFieldObj, relFieldKey) {

        // Set relationship data
        var relAlias = alias + '$' + relationshipAlias;
        var relationship = self.getRelationship(relFieldKey);
        var relModel = relationship.model;
        var relForeignKey = relationship.foreignKey;
        var relTableName = relModel.getTableName();
        var relPrimaryKey = relModel.getPrimaryKey();
        var relFields = relFieldObj['$fields'];

        // Check if relationship fields is defined
        if(typeof relFields === "undefined") {
        	relFields = {};
        }

        // Push alias
        hashAlias[relAlias] = _.reject([ hashAlias[alias], relFieldKey ], function(obj) { return !obj; }).join('.');

        // Push left join
        queryBuilder.addJoin('left', [ relTableName + ' AS ' + relAlias, relAlias + '.' + relPrimaryKey, alias + '.' + relForeignKey ]);

        // Parse relationship fields
        _parseFields.call(relModel, queryBuilder, relFields, hashAlias, relAlias);

        // Increment alias
        relationshipAlias++;

    });

    // Loop over custom fields
    _.each(customFields, function(customFieldObj, customFieldKey) {

    	// Data
    	var customFieldAliasHash = {};

    	// If join is not empty
    	if(typeof customFieldObj.data['$join'] === 'object' && customFieldObj.data['$join'] instanceof Array) {
    		
    		// Loop over join
    		_.each(customFieldObj.data['$join'], function(joinItem) {

    			// Data
    			var existingJoins = queryBuilder.getJoins();
    			var joinItemType = joinItem['$type'] || 'inner';
    			var joinItemModel = joinItem['$model'];
    			var joinItemAlias = joinItem['$alias'];
    			var joinItemKey = joinItem['$key'];
    			var joinItemOn = joinItem['$on'];
    			var joinItemTable = joinItemModel.getTableName();

    			// Check if already exist
    			var joinItemRef = _.findIndex(existingJoins, function(obj) {
    				return obj.type === joinItemType && JSON.stringify(obj.args) === JSON.stringify([ joinItemTable + ' AS ' + joinItemAlias, joinItemAlias + '.' + joinItemKey, alias + '.' + joinItemOn ]);
    			});

    			// If already exists
    			if(joinItemRef !== -1) {
    				customFieldAliasHash[joinItemAlias] = existingJoins[joinItemRef].args[0].split(' AS ')[1];
    				joinItemAlias = customFieldAliasHash[joinItemAlias];
    			}

    			// If doesn't exists
    			else {

    				// Push join
    				queryBuilder.addJoin(joinItemType, [ joinItemTable + ' AS ' + joinItemAlias, joinItemAlias + '.' + joinItemKey, alias + '.' + joinItemOn ]);

    			}

    		});

    	}

    	// If groupby is an array
    	if(typeof customFieldObj.data['$groupby'] === 'object' && customFieldObj.data['$groupby'] instanceof Array) {

    		/////////// CAN BE IMPROVE //////////
    		
    		// Loop over groupby
    		_.each(customFieldObj.data['$groupby'], function(groupbyItem) {

			    // Data
			    var existingGroupby = queryBuilder.getGroupBy();
			    var groupByItemToCheck = null;

				// Push groupby
    			if(typeof groupbyItem['$alias'] !== "undefined" && typeof customFieldAliasHash[groupbyItem['$alias']] !== "undefined") {
				    groupByItemToCheck = customFieldAliasHash[groupbyItem['$alias']] + '.' + groupbyItem['$key'];
				} else if(typeof groupbyItem['$alias'] !== "undefined") {
					groupByItemToCheck = groupbyItem['$alias'] + '.' + groupbyItem['$key'];
				} else {
					groupByItemToCheck = alias + '.' + groupbyItem['$key'];
				}

    			// Check if already exist
    			var groupbyItemRef = _.findIndex(existingGroupby, function(obj) {
    				return obj === groupByItemToCheck;
    			});

    			// If doesn't exists
    			if(groupbyItemRef === -1) {
					queryBuilder.addGroupBy(groupByItemToCheck);
    			}

    		});

    	}

    	// If field is an array
    	if(typeof customFieldObj.data['$field'] === 'object' && customFieldObj.data['$field'] instanceof Array) {

    		// Data
    		var rawString = '';
    		
    		// Loop over field
    		_.each(customFieldObj.data['$field'], function(fieldItem) {

    			// If item is string
    			if(typeof fieldItem === "string") {
    				rawString += fieldItem;
    			}

    			// If item is string
    			else if(typeof fieldItem === "object" && typeof fieldItem['$string'] === "string") {
    				rawString += fieldItem['$string'];
    			}

    			// If item is object
    			else if(typeof fieldItem === "object" && typeof fieldItem['$key'] !== "undefined" && typeof fieldItem['$alias'] !== "undefined") {

    				// Check if alias already exists
    				if(typeof customFieldAliasHash[fieldItem['$alias']] !== "undefined") {
    					rawString += customFieldAliasHash[fieldItem['$alias']] + '.' + fieldItem['$key'];
    				} else {
    					rawString += fieldItem['$alias'] + '.' + fieldItem['$key'];
    				}

    			}

    			// If item is string
    			else if(typeof fieldItem === "object" && typeof fieldItem['$key'] !== "undefined") {
    				rawString += alias + '.' + fieldItem['$key'];
    			}

    		});

        	// Add as clause
        	rawString += ' AS ' + alias + '$' + customFieldKey;

        	// Add to parsed fields
        	queryBuilder.addColumn(knex.raw(rawString));

    	}

    });

};