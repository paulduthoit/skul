/*
* lib/skul/private.js
*
* SKuL private methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');
var knex = require('knex')({ client: 'mysql' });
var moment = require('moment');


// Parse filter
var _parseFilter = function(queryBuilder, filter, hashAlias, alias) {

	// Constants
	var KEYWORDS = [ '$and', '$or', '$nor', '$not', '$gt', '$gte', '$lt', '$lte', '$e', '$ne', '$like', '$in', '$nin', '$key', '$value', '$filter' ];

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

					// Set filter item
					var filterItem = { '$key': filterItemKey + '.' + filterItemKey2, '$value': filterItemValue2 };

					// Parse filter item
					filterString += _parseFilterItem.call(self, queryBuilder, filterItem, hashAlias, alias, filterAlreadyFullfill);

					// Change filter fullfill state
					filterAlreadyFullfill = true;

				});

			} else {

				// Set filter item
				var filterItem = { '$key': filterItemKey, '$value': filterItemValue };

				// Parse filter item
				filterString += _parseFilterItem.call(self, queryBuilder, filterItem, hashAlias, alias, filterAlreadyFullfill);

				// Change filter fullfill state
				filterAlreadyFullfill = true;

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

	// If OR
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

		// Get parsed value
		var parsedValue = _parseValue(item['$e']);

		// Add = item
		if(parsedValue === null) {
			filterString += " IS NULL ";
		} else {
			filterString += " = ";
			filterString += _parseValue(item['$e']) + " ";
		}

	}

	// If <>
	else if(_.contains(_.keys(item), '$ne')) {

		// Get parsed value
		var parsedValue = _parseValue(item['$ne']);

		// Add <> item
		if(parsedValue === null) {
			filterString += " IS NOT NULL ";
		} else {
			filterString += " <> ";
			filterString += _parseValue(item['$ne']) + " ";
		}

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

		// If IN item is empty
		if(itemValue.length === 0) {

			// Add IN item
			filterString += "IN (-1) ";

		} else {

			// Add IN item
			filterString += "IN (";
			filterString += itemValue.join(',');
			filterString += ") ";

		}

	}

	// If NIN
	else if(_.contains(_.keys(item), '$nin') && item['$nin'] instanceof Array) {

		// Add quotes for strings
		itemValue = _.map(item['$nin'], function(val) {
			return _parseValue(val);
		});

		// If IN item is empty
		if(itemValue.length === 0) {

			// Add IN item
			filterString += "NOT IN (-1) ";

		} else {

			// Add IN item
			filterString += "NOT IN (";
			filterString += itemValue.join(',');
			filterString += ") ";

		}

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
		if(fieldBase) {
			_addRequiredJoins.call(self, queryBuilder, fieldBase, hashAlias, alias);
		}
		
		// Set real field base
		fieldBase = _.reject([ (_.find(hashAlias, function(obj) { return obj.alias === alias; }) || {}).key, fieldBase ], function(obj) { return !obj; }).join('.');

		// Get alias
		var fieldAlias = _.find(hashAlias, function(obj) { return obj.key === fieldBase; });

		// If field is a relationship field
		if(_.contains(_.keys(item['$value']), '$filter')) {
			
			// Get alias
			var currentAlias = _.find(hashAlias, function(obj) { return obj.alias === alias; });

			// If key is a relationship key
			if(_.contains(currentAlias.model.getRelationshipKeys(), item['$key'])) {

				// Set data
				var fieldRelationship = currentAlias.model.getRelationship(item['$key']);
				var subqueryHashAlias = [];
				var subqueryFields = {};

				// Set subquery fields
				subqueryFields[fieldRelationship.model.getPrimaryKey()] = 1;
				subqueryFields[fieldRelationship.foreignKey] = 1;

				// Add other subquery fields
				if(_.contains(_.keys(item['$value']), '$sum')) {
					subqueryFields[item['$value']['$sum']] = 1;
				} else if(_.contains(_.keys(item['$value']), '$avg')) {
					subqueryFields[item['$value']['$avg']] = 1;
				}


				// Create sub query
				var subquery = fieldRelationship.model.createSelectQuery(item['$value']['$filter'], subqueryFields, { limit: null }, subqueryHashAlias, (1000 + parseInt(alias)));
				
				// GEt sub query main alias
				var subqueryMainAlias = subqueryHashAlias[0];

				// Add join
				queryBuilder.addJoin('raw', [ 'LEFT JOIN (' + subquery + ') AS `DF` ON `DF`.`' + subqueryMainAlias.alias + '$' + fieldRelationship.foreignKey + '` = `' + alias + '`.id' ]);

				// If it's a count method
				if(_.contains(_.keys(item['$value']), '$count') && item['$value']['$count']) {

					// Add columns
					queryBuilder.addColumn(knex.raw('COUNT(`DF`.`' + subqueryMainAlias.alias + '$' + fieldRelationship.model.getPrimaryKey() + '`) AS `' + alias + '$counter`'));

					// Data
					var parsedFilter = _parseFilter.call(self, queryBuilder, item['$value']['$where'], hashAlias, alias);
					
					// Return filter
					return '`' + alias + '$counter` ' + parsedFilter + ' ';

				}

				// If it's a sum method
				else if(_.contains(_.keys(item['$value']), '$sum') && item['$value']['$sum']) {

					// Add columns
					queryBuilder.addColumn(knex.raw('SUM(`DF`.`' + subqueryMainAlias.alias + '$' + item['$value']['$sum'] + '`) AS `' + alias + '$sumer`'));

					// Data
					var parsedFilter = _parseFilter.call(self, queryBuilder, item['$value']['$where'], hashAlias, alias);
					
					// Return filter
					return '`' + alias + '$sumer` ' + parsedFilter + ' ';

				}

				// If it's a avg method
				else if(_.contains(_.keys(item['$value']), '$avg') && item['$value']['$avg']) {

					// Add columns
					queryBuilder.addColumn(knex.raw('AVG(`DF`.`' + subqueryMainAlias.alias + '$' + item['$value']['$avg'] + '`) AS `' + alias + '$avger`'));

					// Data
					var parsedFilter = _parseFilter.call(self, queryBuilder, item['$value']['$where'], hashAlias, alias);
					
					// Return filter
					return '`' + alias + '$avger` ' + parsedFilter + ' ';

				}
				
				// Return empty string
				return '';

			}

		}

		// If field is a custom field
		if(_.contains(fieldAlias.model.getCustomKeys(), fieldName)) {

			// Add required customs
			_addRequiredCustoms.call(fieldAlias.model, queryBuilder, fieldName, hashAlias, fieldAlias.alias);

			// Get filter field
			var filterField = itemKeyBefore + '`' + fieldAlias.alias + '$' + fieldName + '`' + itemKeyAfter;

		}

		// If field is a basic field
		else {
			
			// Get filter field
			var filterField = itemKeyBefore + '`' + fieldAlias.alias + '`.`' + fieldName + '`' + itemKeyAfter;

			// Add columns to query builder
			queryBuilder.addColumn(fieldAlias.alias + '.' + fieldName + ' AS ' + fieldAlias.alias + '$' + fieldName);

		}

		// If is null
		if(itemValue['$value'] === null) {
			filterString += filterField + " IS NULL ";
		}

		// If is not null
		else if(_.isObject(itemValue['$value']) && itemValue['$value']['$ne'] === null) {
			filterString += filterField + " IS NOT NULL ";
		}

		// If object
		else if(_.isObject(itemValue['$value']) && itemValue['$value'] !== null) {

			// Data
			var parsedFilter = _parseFilter.call(self, queryBuilder, itemValue['$value'], hashAlias, alias);

			if(!(new RegExp("TO_DAYS\\(").exec(filterField)) && new RegExp("TO_DAYS\\(").exec(parsedFilter)) {
				filterString += "TO_DAYS(" + filterField + ") " + parsedFilter + " ";
			} else if(!(new RegExp("TO_SECONDS\\(").exec(filterField)) && new RegExp("TO_SECONDS\\(").exec(parsedFilter)) {
				filterString += "TO_SECONDS(" + filterField + ") " + parsedFilter + " ";
			} else {
				filterString += filterField + " " + parsedFilter + " ";
			}

		}

		// If value
		else {
			filterString += filterField + " = " + _parseValue(itemValue) + " ";
		}

	}

	// Return filter string
	return filterString;

};

// Parse value
var _parseValue = function(value) {

	// Data
	var parsedValue = '';

	// If value is an object
	if(_.isObject(value) && typeof value['$date'] === 'string') {
		value = {
			'$before_value': 'TO_DAYS(',
			'$after_value': ')',
			'$value': value['$date']
		};
	} else if(_.isObject(value) && typeof value['$datetime'] === 'string') {
		value = {
			'$before_value': 'TO_SECONDS(',
			'$after_value': ')',
			'$value': value['$date']
		};
	} else if(_.isObject(value) && value instanceof Date) {
		value = {
			'$before_value': 'TO_SECONDS(',
			'$after_value': ')',
			'$value': moment(value).format('YYYY-MM-DD HH:mm:ss')
		};
	} else if(!_.isObject(value)) {
		value = {
			'$before_value': '',
			'$after_value': '',
			'$value': value
		};
	}

	// Check if value is null
	if(value['$value'] === null) {
		return null;
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
    if(typeof _.find(hashAlias, function(obj) { return obj.alias === alias; }) === "undefined") {
        hashAlias.push({ alias: alias, key: '', model: self });
    }

    // Set relationship alias
    var relationshipAlias = 1;

    // Get relationship and custom fields
    var relationshipFields = self.parseRelationships(fields);
    var customFields = self.parseCustoms(fields);

    // Loop over hasOne relationship fields
    _.each(relationshipFields, function(relFieldObj, relFieldKey) {

    	// Data
        var relationship = self.getRelationship(relFieldKey);
        var relType = relationship.type;
	    var relAlias = alias + '$' + relationshipAlias;

    	// If basic one2one relationship
    	if(_.contains([ 'hasOne', 'belongsTo' ], relType)) {

	        // Set relationship data
	        var relModel = relationship.model;
	        var relForeignKey = relationship.foreignKey;
	        var relKey = relationship.key;
	        var relTableName = relModel.getTableName();
	        var relPrimaryKey = relModel.getPrimaryKey();
	        var relFields = relFieldObj['$fields'];

	        // Check if relationship fields is defined
	        if(typeof relFields === "undefined") {
	        	relFields = {};
	        }

	        // Push alias
	        hashAlias.push({ alias: relAlias, key: _.reject([ (_.find(hashAlias, function(obj) { return obj.alias === alias; }) || {}).key, relFieldKey ], function(obj) { return !obj; }).join('.'), model: relModel });

	        // Push left join
	        if(relType === 'hasOne') {
	        	queryBuilder.addJoin('left', [ relTableName + ' AS ' + relAlias, relAlias + '.' + relForeignKey, alias + '.' + (typeof relKey !== "undefined" ? relKey : selfPrimaryKey) ]);
	        } else if(relType === 'belongsTo') {
	        	queryBuilder.addJoin('left', [ relTableName + ' AS ' + relAlias, relAlias + '.' + (typeof relKey !== "undefined" ? relKey : relPrimaryKey), alias + '.' + relForeignKey ]);
	        }

	        // Parse relationship fields
	        _parseFields.call(relModel, queryBuilder, relFields, hashAlias, relAlias);

	        // Increment alias
	        relationshipAlias++;

	    }

    	// If basic one2many relationship
    	else if(_.contains([ 'hasMany' ], relType) && typeof relationship.key !== 'undefined') {

    		// Set relationship data
	        var relKey = relationship.key;

	        // Add column to query builder
	        queryBuilder.addColumn(alias + '.' + relKey + ' AS ' + alias + '$' + relKey);

    	}

    	// If through relationship
	    else if(relType === 'hasOneThrough') {

	    	// Data
		    var relJoins = relationship.joins;
		    var relJoinLength = relJoins.length;
		    var parentAlias = alias;
		    var parentPrimaryKey = selfPrimaryKey;
		    var parentModel = self;
	        var relFields = relFieldObj['$fields'];

	        // Check if relationship fields is defined
	        if(typeof relFields === "undefined") {
	        	relFields = {};
	        }

		    // Loop over relationship joins
		    _.each(relJoins, function(relJoinItem, relJoinIndex) {

		    	// Data
			    var relJoinItemType = relJoinItem.type;
			    var relJoinItemModel = relJoinItem.model;
			    var relJoinItemForeignKey = relJoinItem.foreignKey;
			    var relJoinItemKey = relJoinItem.key;
			    var relJoinItemTableName = relJoinItemModel.getTableName();
			    var relJoinItemPrimaryKey = relJoinItemModel.getPrimaryKey();
			    var relJoinItemAlias = null;
			    var relJoinItemFields = {};

			    // Get rel join item alias
			    if(relJoinIndex === relJoinLength-1) {
			    	relJoinItemAlias = relAlias;
			    } else {
			    	relJoinItemAlias = relAlias + '-' + relJoinIndex;
			    }

			    // Push left join
			    if(relJoinItemType === 'hasOne' || relJoinItemType === 'hasMany') {
			    	queryBuilder.addJoin('left', [ relJoinItemTableName + ' AS ' + relJoinItemAlias, relJoinItemAlias + '.' + relJoinItemForeignKey, parentAlias + '.' + (typeof relJoinItemKey !== "undefined" ? relJoinItemKey : parentPrimaryKey) ]);
			    } else if(relJoinItemType === 'belongsTo') {
					queryBuilder.addJoin('left', [ relJoinItemTableName + ' AS ' + relJoinItemAlias, relJoinItemAlias + '.' + (typeof relJoinItemKey !== "undefined" ? relJoinItemKey : relJoinItemPrimaryKey), parentAlias + '.' + relJoinItemForeignKey ]);
			    }
			    
			    // Set previous rel join item alias
			    parentAlias = relJoinItemAlias;
			    parentPrimaryKey = relJoinItemPrimaryKey;
			    parentModel = relJoinItemModel;

		    });

		    // Push alias
	        hashAlias.push({ alias: relAlias, key: _.reject([ (_.find(hashAlias, function(obj) { return obj.alias === alias; }) || {}).key, relFieldKey ], function(obj) { return !obj; }).join('.'), model: parentModel });

	        // Parse relationship fields
	        _parseFields.call(parentModel, queryBuilder, relFields, hashAlias, relAlias);

	        // Increment alias
	        relationshipAlias++;

		}

    });

    // Loop over custom fields
    _.each(customFields, function(customFieldObj, customFieldKey) {

		// Add required customs
		_addRequiredCustoms.call(self, queryBuilder, customFieldKey, hashAlias, alias);

    });

};

// Add required joins
var _addRequiredJoins = function(queryBuilder, parentKeyPath, hashAlias, alias) {

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
	var aliasKey = _.find(hashAlias, function(obj) { return obj.alias === alias; }).key;

	// Get last relationship alias
	_.each(hashAlias, function(hashItem) {

		// Get relationship alias
		var relAlias = hashItem.alias.match(new RegExp('^' + alias.replace(/\$/g, '\\$') + '\\$(.*?)\\$|^' + alias.replace(/\$/g, '\\$') + '\\$(.*?)$'));
			relAlias = relAlias instanceof Array ? parseInt(relAlias[1] || relAlias[2]) : -1;

		// Set last relationship alias
		if(relationshipAlias <= relAlias) {
			relationshipAlias = relAlias + 1;
		}

	});

	// Check if present in hashAlias
	if(!_.contains(_.pluck(hashAlias, 'key'), aliasKey + fieldRoot)) {

	    // Set relationship data
	    var relAlias = alias + '$' + relationshipAlias;
	    var relationship = self.getRelationship(fieldRoot);
	    var relType = relationship.type;

	    // If basic relationship
	    if(_.contains([ 'belongsTo', 'hasMany', 'hasOne' ], relType)) {

	    	// Data
		    var relModel = relationship.model;
		    var relForeignKey = relationship.foreignKey;
		    var relKey = relationship.key;
		    var relTableName = relModel.getTableName();
		    var relPrimaryKey = relModel.getPrimaryKey();
		    var relFields = {};

		    // Push alias
	        hashAlias.push({ alias: relAlias, key: _.reject([ (_.find(hashAlias, function(obj) { return obj.alias === alias; }) || {}).key, fieldRoot ], function(obj) { return !obj; }).join('.'), model: relModel });

		    // Push left join
		    if(relType === 'hasOne' || relType === 'hasMany') {
		    	queryBuilder.addJoin('left', [ relTableName + ' AS ' + relAlias, relAlias + '.' + relForeignKey, alias + '.' + (typeof relKey !== "undefined" ? relKey : selfPrimaryKey) ]);
		    } else if(relType === 'belongsTo') {
				queryBuilder.addJoin('left', [ relTableName + ' AS ' + relAlias, relAlias + '.' + (typeof relKey !== "undefined" ? relKey : relPrimaryKey), alias + '.' + relForeignKey ]);
		    }

	    }

	    // If custom relationship
	    else if(_.contains([ 'hasManyCustom', 'hasOneCustom' ], relType)) {

		    // Push alias
	        hashAlias.push({ alias: relAlias, key: _.reject([ (_.find(hashAlias, function(obj) { return obj.alias === alias; }) || {}).key, fieldRoot ], function(obj) { return !obj; }).join('.'), model: relModel });

	    	// Data
		    var relModel = relationship.model;
		    var relJoin = relationship.join;
		    var funHashAlias = [ { model: self, alias: alias, refAlias: alias }, { model: relModel['$model'], alias: relAlias, refAlias: relModel['$alias'] } ];

		    // Add custom join
	    	_addCustomJoin.call(self, queryBuilder, relModel, relJoin, funHashAlias, alias);

	    }

	    // If through relationship
	    else if(_.contains([ 'hasManyThrough', 'hasOneThrough' ], relType)) {

	    	// Data
		    var relJoins = relationship.joins;
		    var relJoinLength = relJoins.length;
		    var parentAlias = alias;
		    var parentPrimaryKey = selfPrimaryKey;
		    var parentModel = self;

		    // Loop over relationship joins
		    _.each(relJoins, function(relJoinItem, relJoinIndex) {

		    	// Data
			    var relJoinItemType = relJoinItem.type;
			    var relJoinItemModel = relJoinItem.model;
			    var relJoinItemForeignKey = relJoinItem.foreignKey;
			    var relJoinItemKey = relJoinItem.key;
			    var relJoinItemTableName = relJoinItemModel.getTableName();
			    var relJoinItemPrimaryKey = relJoinItemModel.getPrimaryKey();
			    var relJoinItemAlias = null;
			    var relJoinItemFields = {};

			    // Get rel join item alias
			    if(relJoinIndex === relJoinLength-1) {
			    	relJoinItemAlias = relAlias;
			    } else {
			    	relJoinItemAlias = relAlias + '-' + relJoinIndex;
			    }

			    // Push left join
			    if(relJoinItemType === 'hasOne' || relJoinItemType === 'hasMany') {
			    	queryBuilder.addJoin('left', [ relJoinItemTableName + ' AS ' + relJoinItemAlias, relJoinItemAlias + '.' + relJoinItemForeignKey, parentAlias + '.' + (typeof relJoinItemKey !== "undefined" ? relJoinItemKey : parentPrimaryKey) ]);
			    } else if(relJoinItemType === 'belongsTo') {
					queryBuilder.addJoin('left', [ relJoinItemTableName + ' AS ' + relJoinItemAlias, relJoinItemAlias + '.' + (typeof relJoinItemKey !== "undefined" ? relJoinItemKey : relJoinItemPrimaryKey), parentAlias + '.' + relJoinItemForeignKey ]);
			    }
			    
			    // Set previous rel join item alias
			    parentAlias = relJoinItemAlias;
			    parentPrimaryKey = relJoinItemPrimaryKey;
			    parentModel = relJoinItemModel;

		    });

		    // Push alias
	        hashAlias.push({ alias: relAlias, key: _.reject([ (_.find(hashAlias, function(obj) { return obj.alias === alias; }) || {}).key, fieldRoot ], function(obj) { return !obj; }).join('.'), model: parentModel });

	    }

	}

	else {

		// Set relationship data
	    var relationship = self.getRelationship(fieldRoot);
	    var relModel = relationship.model;
	    var relAlias = (_.find(hashAlias, function(obj) { return obj.key === fieldRoot; }) || {}).alias;

	}

    // If has children
    if(fieldName !== "") {
    	_addRequiredJoins.call(relModel, queryBuilder, fieldName, hashAlias, relAlias);
    }

};

// Add required customs
var _addRequiredCustoms = function(queryBuilder, key, hashAlias, alias) {

	// Data
	var self = this;
	var customFieldObj = self.getCustom(key);
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
			    groupByItemToCheck = '`' + customFieldAliasHash[groupbyItem['$alias']] + '`.`' + groupbyItem['$key'] + '`';
			} else if(typeof groupbyItem['$alias'] !== "undefined") {
				groupByItemToCheck = '`' + groupbyItem['$alias'] + '`.`' + groupbyItem['$key'] + '`';
			} else {
				groupByItemToCheck = '`' + alias + '`.`' + groupbyItem['$key'] + '`';
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
					rawString += '`' + customFieldAliasHash[fieldItem['$alias']] + '`.`' + fieldItem['$key'] + '`';
				} else {
					rawString += '`' + fieldItem['$alias'] + '`.`' + fieldItem['$key'] + '`';
				}

			}

			// If item is string
			else if(typeof fieldItem === "object" && typeof fieldItem['$key'] !== "undefined") {
				rawString += '`' + alias + '`.`' + fieldItem['$key'] + '`';
			}

		});

    	// Add as clause
    	rawString += ' AS `' + alias + '$' + key + '`';

    	// Add to parsed fields
    	queryBuilder.addColumn(knex.raw(rawString));

	}

};

// Add custom join
var _addCustomJoin = function(queryBuilder, model, join, improvedHashAlias, alias) {

	// Data
	var joinRaw = '';

	// Loop over relationship join
	_.each(join, function(onItem) {

		// If item is string
		if(typeof onItem === "string") {
			joinRaw += onItem;
		}

		// If item is string
		else if(typeof onItem === "object" && typeof onItem['$string'] === "string") {
			joinRaw += onItem['$string'];
		}

		// If item is a model object
		else if(typeof onItem === "object" && typeof onItem['$model'] !== "undefined" && typeof onItem['$alias'] !== "undefined") {

			// Get alias
			var onItemAlias = _.findWhere(improvedHashAlias, { refAlias: onItem['$alias'] });

			// Create alias if doesn't exist
			if(typeof onItemAlias === "undefined") {
				onItemAlias = { alias: (_.max(_.pluck(improvedHashAlias, 'alias').concat(0)) + 1), refAlias: onItem['$alias'], model: onItem['$model'] };
				improvedHashAlias.push(onItemAlias);
			}

			// Add to join
			joinRaw += '`' + onItem['$model'].getTableName() + '` AS `' + onItemAlias.alias + '`';

		}

		// If item is field object
		else if(typeof onItem === "object" && typeof onItem['$key'] !== "undefined" && typeof onItem['$alias'] !== "undefined") {
			joinRaw += '`' + _.findWhere(improvedHashAlias, { refAlias: onItem['$alias'] }).alias + '`.`' + onItem['$key'] + '`';
		}

		// If item is string
		else if(typeof onItem === "object" && typeof onItem['$key'] !== "undefined") {
			joinRaw += '`' + alias + '`.`' + onItem['$key'] + '`';
		}

	});

	// Add join to sub query builder
	queryBuilder.addJoin('raw', [ joinRaw ]);

};


// Exports
module.exports = {
	_parseFilter: _parseFilter,
	_parseFilterItem: _parseFilterItem,
	_parseFields: _parseFields,
	_parseValue: _parseValue,
	_addRequiredJoins: _addRequiredJoins,
	_addCustomJoin: _addCustomJoin
};