/**
 * lib/skul/private.js
 *
 * SKuL private methods
 *
 * Author: Paul Duthoit
 * Copyright(c) 2016 Paul Duthoit
 */

// Dependencies
var _ = require('underscore');
var objectPath = require('object-path');
var QueryBuilder = require('./query-builder');
var QueryException = require('./exceptions/query');
var knex = require('knex')({ client: 'mysql' });
var moment = require('moment');
var deepEqual = require('deep-equal');


// Constants
var FILTER_KEYWORDS = [ '$and', '$or', '$nor', '$not', '$gt', '$gte', '$lt', '$lte', '$e', '$ne', '$like', '$nlike', '$raw', '$in', '$nin', '$key', '$value', '$filter', '$where' ];


/**
 * Parse fields
 *
 * @param {Model} model
 * @param {Object} fields
 * @param {String} parentAlias
 * @param {String} parentField
 *
 * @context {Number} aliasIncrement
 * @context {QueryBuilder} queryBuilder
 * @context {Object} queryBuilderColumns
 * @context {Array} requestedFields
 * @context {Object} queryBuildingTasks
 * @context {Object} hashAlias
 *
 * @private
 */
var _parseFields = function(model, fields, parentAlias, parentField) {

	// Set data
	var self = this;
	var invalidQueryData = {};
	var structureColumns = model.getStructureColumns();
	var oneToOneRelationshipKeys = _.union(model.getRelationshipKeys('belongsTo'), model.getRelationshipKeys('hasOne'));
	var oneToOneCustomRelationshipKeys = model.getRelationshipKeys('hasOneCustom');
	var oneToManyRelationshipKeys = model.getRelationshipKeys('hasMany');
	var oneToManyCustomRelationshipKeys = model.getRelationshipKeys('hasManyCustom');
	var customKeys = model.getCustomKeys();

	// If fields is empty
	if(_.keys(fields).length === 0) {
		_.each(structureColumns, function(columnItem) {
			self.queryBuilderColumns[parentAlias + '.' + columnItem] = parentAlias + '$' + columnItem;
			self.requestedFields.push(parentAlias + '$' + columnItem);
		});
	}

	// Loop over fields
	_.each(fields, function(fieldValue, fieldKey) {

		// If field is $all
		if(fieldKey === '$all') {
			_.each(structureColumns, function(columnItem) {
				self.queryBuilderColumns[parentAlias + '.' + columnItem] = parentAlias + '$' + columnItem;
				self.requestedFields.push(parentAlias + '$' + columnItem);
			});
		}

		// If field is structure column
		else if(_.contains(structureColumns, fieldKey)) {
			self.queryBuilderColumns[parentAlias + '.' + fieldKey] = parentAlias + '$' + fieldKey;
			self.requestedFields.push(parentAlias + '$' + fieldKey);
		}

		// If field is one2one relationship
		else if(_.contains(oneToOneRelationshipKeys, fieldKey)) {

			// Set data
			var fieldRelationship = model.getRelationship(fieldKey);
			var fieldModelStructureColumns = fieldRelationship.model.getStructureColumns();

			// Set alias
			var joinAliasKey = parentField ? (parentField + '.' + fieldKey) : fieldKey;
			var joinAliasItem = _.find(self.hashAlias, function(obj) { return obj.key === joinAliasKey; });

			// If join already exists
			if(typeof joinAliasItem !== 'undefined') {

				// Set join alias
				var joinAlias = joinAliasItem.alias;

			}

			// If join does not exists
			else {

				// Set join alias
				var joinAlias = parentAlias + '$' + 'T' + self.aliasIncrement;

				// Add alias to hash alias
				self.aliasIncrement++;
				self.hashAlias.push({ alias: joinAlias, key: joinAliasKey, model: fieldRelationship.model });

				// Add left join
				if(fieldRelationship.type === 'belongsTo') {
					self.queryBuildingTasks[0].push(function() {
						self.queryBuilder.addJoin('left', [
							fieldRelationship.model.getTableName() + ' AS ' + joinAlias,
							joinAlias + '.' + (fieldRelationship.key || fieldRelationship.model.getPrimaryKey()),
							parentAlias + '.' + fieldRelationship.foreignKey
						]);
					});
				} else if(fieldRelationship.type === 'hasOne') {
					self.queryBuildingTasks[0].push(function() {
						self.queryBuilder.addJoin('left', [
							fieldRelationship.model.getTableName() + ' AS ' + joinAlias,
							parentAlias + '.' + (fieldRelationship.key || model.getPrimaryKey()),
							joinAlias + '.' + fieldRelationship.foreignKey
						]);
					});
				}

			}

			// Check if value request more
			if(objectPath.get(fieldValue, '$fields')) {
				_parseFields.call(self, fieldRelationship.model, fieldValue['$fields'], joinAlias, joinAliasKey);
			} else {
				_parseFields.call(self, fieldRelationship.model, { '$all': 1 }, joinAlias, joinAliasKey);
			}

		}

		// If field is one2one custom relationship
		else if(_.contains(oneToOneCustomRelationshipKeys, fieldKey)) {

			// Set data
			var fieldRelationship = model.getRelationship(fieldKey);
			var fieldRelationshipModel = fieldRelationship.model['$model'];
			var fieldRelationshipAlias = fieldRelationship.model['$alias'];
			var fieldModelStructureColumns = fieldRelationshipModel.getStructureColumns();
			var joinAliasKey = parentField ? (parentField + '.' + fieldKey) : fieldKey;
			var joinAlias = parentAlias + '$' + 'T' + self.aliasIncrement;
			var aliasRefs = {};

			// Add alias to hash alias
			aliasRefs[fieldRelationshipAlias] = joinAlias;
			self.aliasIncrement++;
			self.hashAlias.push({ alias: joinAlias, key: joinAliasKey, model: fieldRelationshipModel });


			// Set data
			var joinRaw = '';

			// Loop over joinRaw
			_.each(fieldRelationship.joinRaw, function(joinItem) {

				// Add to ref
				if(!aliasRefs[joinItem['$alias']]) {
					aliasRefs[joinItem['$alias']] = joinAlias + '__' + joinItem['$alias'];
				}

				// If item is string
				if(typeof joinItem === 'string') {
					joinRaw += joinItem;
				}

				// If item is $string
				else if(typeof joinItem === 'object' && _.difference([ '$string' ], _.keys(joinItem)).length === 0) {
					joinRaw += String(joinItem['$string']);
				}

				// If item is $model/$alias object
				else if(typeof joinItem === 'object' && _.difference([ '$model', '$alias' ], _.keys(joinItem)).length === 0) {
					joinRaw += '`' + joinItem['$model'].getTableName() + '` AS `' + aliasRefs[joinItem['$alias']] + '`';
				}

				// If item is $key/$alias object
				else if(typeof joinItem === 'object' && _.difference([ '$key', '$alias' ], _.keys(joinItem)).length === 0) {
					joinRaw += '`' + aliasRefs[joinItem['$alias']] + '`.`' + joinItem['$key'] + '`';
				}

				// If item is $alias object
				else if(typeof joinItem === 'object' && _.difference([ '$alias' ], _.keys(joinItem)).length === 0) {
					joinRaw += '`' + aliasRefs[joinItem['$alias']] + '`';
				}

				// If item is $key object
				else if(typeof joinItem === 'object' && _.difference([ '$key' ], _.keys(joinItem)).length === 0) {

					// Set column raw
					joinRaw += '`' + parentAlias + '`.`' + joinItem['$key'] + '`';

					// Add query builder columns
					self.queryBuilderColumns[parentAlias + '.' + joinItem['$key']] = parentAlias + '$' + joinItem['$key'];

				}

			});

			// Add to subquery building tasks
			self.queryBuildingTasks[0].push(function() {
				self.queryBuilder.addJoin('raw', joinRaw);
				self.queryBuilder.addGroupByRaw('`' + parentAlias + '`.`' + model.getPrimaryKey() + '`');
			});

			// Check if value request more
			if(objectPath.get(fieldValue, '$fields')) {
				_parseFields.call(self, fieldRelationshipModel, fieldValue['$fields'], joinAlias, joinAliasKey);
			} else {
				_parseFields.call(self, fieldRelationshipModel, { '$all': 1 }, joinAlias, joinAliasKey);
			}

		}

		// If field is one2many relationship and is grouped
		else if(_.contains(oneToManyRelationshipKeys, fieldKey) && objectPath.get(fieldValue, '$as')) {

			// Set data
			var fieldRelationship = model.getRelationship(fieldKey);

			// Set alias
			var calculatedColumn = parentAlias + '$' + fieldValue['$as'];
			var joinAlias = parentAlias + '$' + 'T' + self.aliasIncrement;
			var joinAliasKey = parentField ? (parentField + '.' + fieldKey) : fieldKey;
			var relationKey = fieldRelationship.key || model.getPrimaryKey();

			// Add query builder columns
			self.queryBuilderColumns[parentAlias + '.' + relationKey] = parentAlias + '$' + relationKey;

			// Add alias to hash alias
			self.aliasIncrement++;
			self.hashAlias.push({ alias: joinAlias, key: joinAliasKey, model: fieldRelationship.model });

			// Push to query building tasks
			self.queryBuildingTasks[1].push(function() {

				// If already exists
				if(_.contains(self.requestedFields, calculatedColumn)) {
					return;
				}

				// Set data
				var subqueryBuilder = new QueryBuilder();

				// Set from
				subqueryBuilder.setFromRaw(self.queryBuilder);
				subqueryBuilder.setSource({ type: 'groupedOneToMany', field: fieldValue });

				// Add column
				subqueryBuilder.addColumn(knex.raw('`' + self.queryBuilder.getAlias() + '`.*'));

				// Create subjoin
				var subjoinFilter = fieldValue['$filter'] || {};
				var subjoinFields = {};
				var subjoinTableName = fieldRelationship.model.getTableName();
				var subjoinAlias = 'T1';

				// Add foreign key to subjoin fields
				subjoinFields[fieldRelationship.foreignKey] = 1;

				// Set subjoin fields
				if(objectPath.get(fieldValue, '$count')) {
					var subJoinOnField = fieldRelationship.foreignKey;
				} else if(objectPath.get(fieldValue, '$sum')) {
					var subJoinOnField = fieldValue['$sum'];
				} else if(objectPath.get(fieldValue, '$avg')) {
					var subJoinOnField = fieldValue['$avg'];
				}

				// Add on key to subjoin fields
				subjoinFields[subJoinOnField] = 1;

				// Add calculated column
				if(objectPath.get(fieldValue, '$count')) {
					subqueryBuilder.addColumn(knex.raw('COUNT(`' + subjoinAlias + '`.`' + subJoinOnField + '`) AS `' + calculatedColumn + '`'));
				} else if(objectPath.get(fieldValue, '$sum')) {
					subqueryBuilder.addColumn(knex.raw('SUM(`' + subjoinAlias + '`.`' + subJoinOnField + '`) AS `' + calculatedColumn + '`'));
				} else if(objectPath.get(fieldValue, '$avg')) {
					subqueryBuilder.addColumn(knex.raw('AVG(`' + subjoinAlias + '`.`' + subJoinOnField + '`) AS `' + calculatedColumn + '`'));
				}

				// Add join
				subqueryBuilder.addJoin('left', [
					subjoinTableName + ' AS ' + subjoinAlias,
					self.queryBuilder.getAlias() + '.' + parentAlias + '$' + relationKey,
					subjoinAlias + '.' + fieldRelationship.foreignKey
				]);

				// Add group by
				subqueryBuilder.addGroupByRaw('`' + self.queryBuilder.getAlias() + '`.`' + parentAlias + '$' + relationKey + '`');

				// Add required field
				self.requestedFields.push(calculatedColumn);

				// Set query builder
				self.queryBuilder = subqueryBuilder;

			});

		}

		// If field is custom
		else if(_.contains(customKeys, fieldKey)) {

			// Set data
			var fieldCustom = model.getCustom(fieldKey);
			var customAlias = parentAlias + '$' + fieldKey;
			var subqueryBuilder = new QueryBuilder();
				subqueryBuilder.setSource({ type: 'customKey', field: fieldKey });
			var subqueryBuildingTasks = [];

			// Set from
			subqueryBuildingTasks.push(function() {
				subqueryBuilder.setFromRaw(self.queryBuilder);
				subqueryBuilder.addColumn(knex.raw('`' + self.queryBuilder.getAlias() + '`.*'));
			});

			// Add required field
			subqueryBuildingTasks.push(function() {
				self.requestedFields.push(customAlias);
			});

			// If field is provided
			if(fieldCustom.data['$field'] instanceof Array) {

				// Set data
				var columnRaw = '';
	
				// Loop over field
				_.each(fieldCustom.data['$field'], function(fieldItem) {

					// If item is string
					if(typeof fieldItem === 'string') {
						columnRaw += fieldItem;
					}

					// If item is string
					else if(typeof fieldItem === 'object' && _.difference([ '$string' ], _.keys(fieldItem)).length === 0) {
						columnRaw += String(fieldItem['$string']);
					}

					// If item is object
					else if(typeof fieldItem === 'object' && _.difference([ '$key', '$alias' ], _.keys(fieldItem)).length === 0) {
						columnRaw += '`' + fieldItem['$alias'] + '`.`' + fieldItem['$key'] + '`';
					}

					// If item is string
					else if(typeof fieldItem === 'object' && _.difference([ '$key' ], _.keys(fieldItem)).length === 0) {

						// Set column raw
						columnRaw += '`' + '$QB$' + '`.`' + parentAlias + '$' + fieldItem['$key'] + '`';

						// Add query builder columns
						self.queryBuilderColumns[parentAlias + '.' + fieldItem['$key']] = parentAlias + '$' + fieldItem['$key'];

					}

				});

				// Add column
				subqueryBuildingTasks.push(function() {

					// Add query builder alias to column raw
					columnRaw = columnRaw.replace(/`\$QB\$`/g, self.queryBuilder.getAlias());

					// Add column
					subqueryBuilder.addColumn(knex.raw(columnRaw + ' AS `' + customAlias + '`'));
					
				});

			}

			// If join is provided
			if(fieldCustom.data['$join'] instanceof Array) {
			
				// Loop over join
				_.each(fieldCustom.data['$join'], function(joinItem) {

					// Set data
					var joinItemType = joinItem['$type'] || 'inner';
					var joinItemModel = joinItem['$model'];
					var joinItemAlias = joinItem['$alias'];
					var joinItemKey = joinItem['$key'];
					var joinItemOn = joinItem['$on'];
					var joinItemTable = joinItemModel.getTableName();

					// Add query builder columns
					self.queryBuilderColumns[parentAlias + '.' + joinItemOn] = parentAlias + '$' + joinItemOn;

					// Add join
					subqueryBuildingTasks.push(function() {
						subqueryBuilder.addJoin(joinItemType, [
							joinItemTable + ' AS ' + joinItemAlias,
							self.queryBuilder.getAlias() + '.' + parentAlias + '$' + joinItemOn,
							joinItemAlias + '.' + joinItemKey
						]);
					});

				});

			}

			// If joinRaw is provided
			else if(fieldCustom.data['$joinRaw'] instanceof Array) {

				// Set data
				var joinRaw = '';
	
				// Loop over joinRaw
				_.each(fieldCustom.data['$joinRaw'], function(joinItem) {

					// If item is string
					if(typeof joinItem === 'string') {
						joinRaw += joinItem;
					}

					// If item is $string
					else if(typeof joinItem === 'object' && _.difference([ '$string' ], _.keys(joinItem)).length === 0) {
						joinRaw += String(joinItem['$string']);
					}

					// If item is $model/$alias object
					else if(typeof joinItem === 'object' && _.difference([ '$model', '$alias' ], _.keys(joinItem)).length === 0) {
						joinRaw += '`' + joinItem['$model'].getTableName() + '` AS `' + joinItem['$alias'] + '`';
					}

					// If item is $key/$alias object
					else if(typeof joinItem === 'object' && _.difference([ '$key', '$alias' ], _.keys(joinItem)).length === 0) {
						joinRaw += '`' + joinItem['$alias'] + '`.`' + joinItem['$key'] + '`';
					}

					// If item is $key object
					else if(typeof joinItem === 'object' && _.difference([ '$key' ], _.keys(joinItem)).length === 0) {

						// Set column raw
						joinRaw += '`' + '$QB$' + '`.`' + parentAlias + '$' + joinItem['$key'] + '`';

						// Add query builder columns
						self.queryBuilderColumns[parentAlias + '.' + joinItem['$key']] = parentAlias + '$' + joinItem['$key'];

					}

				});

				// Add to subquery building tasks
				subqueryBuildingTasks.push(function() {

					// Add query builder alias to join raw
					joinRaw = joinRaw.replace(/`\$QB\$`/g, self.queryBuilder.getAlias());

					// Add join
					subqueryBuilder.addJoin('raw', joinRaw);
					
				});

			}

			// Add query builder columns
			self.queryBuilderColumns[self.mainAlias + '.' + self.mainModel.getPrimaryKey()] = self.mainAlias + '$' + self.mainModel.getPrimaryKey();
			self.queryBuilderColumns[parentAlias + '.' + model.getPrimaryKey()] = parentAlias + '$' + model.getPrimaryKey();

			// Add group by
			subqueryBuildingTasks.push(function() {
				subqueryBuilder.addGroupByRaw('`' + self.queryBuilder.getAlias() + '`.`' + self.mainAlias + '$' + self.mainModel.getPrimaryKey() + '`');
				subqueryBuilder.addGroupByRaw('`' + self.queryBuilder.getAlias() + '`.`' + parentAlias + '$' + model.getPrimaryKey() + '`');
			});

			// Push to query building tasks
			self.queryBuildingTasks[1].push(function() {

				// If already exists
				if(_.contains(self.requestedFields, customAlias)) {
					return;
				}

				// Run subquery building tasks
				_.each(subqueryBuildingTasks, function(fun) { return fun(); });

				// Set query builder
				self.queryBuilder = subqueryBuilder;

			});

		}

		// If field is one2many relationship
		else if(_.contains(oneToManyRelationshipKeys, fieldKey)) {

			// Set data
			var fieldRelationship = model.getRelationship(fieldKey);
			var relationKey = fieldRelationship.key || model.getPrimaryKey();

			// Add required field
			self.queryBuilderColumns[parentAlias + '.' + relationKey] = parentAlias + '$' + relationKey;
			self.requestedFields.push(parentAlias + '$' + relationKey);

		}

		// If field is one2many custom relationship
		else if(_.contains(oneToManyCustomRelationshipKeys, fieldKey)) {

			// Set data
			var fieldRelationship = model.getRelationship(fieldKey);
			var relationKey = fieldRelationship.key || model.getPrimaryKey();

			// Add required field
			self.queryBuilderColumns[parentAlias + '.' + relationKey] = parentAlias + '$' + relationKey;
			self.requestedFields.push(parentAlias + '$' + relationKey);

		}

		// If field is undefined
		else {
			invalidQueryData[fieldKey] = 'unknown';
		}

	});
	
	// Check if some error occured
	if(_.keys(invalidQueryData).length > 0) {
		throw new QueryException('InvalidQueryData', invalidQueryData);
	}

};


/**
 * Parse filter
 *
 * @param {Model} model
 * @param {Object} filter
 * @param {String} parentAlias
 * @param {String} parentField
 *
 * @context {Number} aliasIncrement
 * @context {QueryBuilder} queryBuilder
 * @context {Object} queryBuilderColumns
 * @context {Array} requestedFields
 * @context {Object} queryBuildingTasks
 * @context {Object} hashAlias
 *
 * @private
 */
var _parseFilter = function(model, filter, parentAlias, parentField) {

	// Set data
	var self = this;
	var whereClause = '';
	var filterAlreadyFullfill = false;

	// If AND
	if(filter['$and'] instanceof Array) {
		_.each(filter['$and'], function(andItem, andIndex) {

			// Stop if AND item is empty
			if(_.keys(andItem).length === 0) {
				return;
			}

			// Add AND item
			whereClause += '( ' + _parseFilter.call(self, model, andItem, parentAlias, parentField) + ' ) ';

			// Add AND keyword
			if(andIndex < filter['$and'].length-1) {
				whereClause += 'AND ';
			}

		});
	}

	// If OR
	else if(filter['$or'] instanceof Array) {
		_.each(filter['$or'], function(orItem, orIndex) {

			// Stop if OR item is empty
			if(_.keys(orItem).length === 0) {
				return;
			}

			// Add OR item
			whereClause += '( ' + _parseFilter.call(self, model, orItem, parentAlias, parentField) + ' ) ';

			// Add OR keyword
			if(orIndex < filter['$or'].length-1) {
				whereClause += 'OR ';
			}

		});
	}

	// If $key is defined
	else if(typeof filter['$key'] !== 'undefined') {

		// Set data
		var filterKey = {
			'$before_key': filter['$before_key'] || '',
			'$after_key': filter['$after_key'] || '',
			'$key': filter['$key']
		};
		var filterValue = filter['$value'];

		// Parse filter
		whereClause += _parseFilterItem.call(self, model, filterKey, filterValue, parentAlias, parentField);

	}

	else {

		// Parse item for each filter keys
		var filterKeys = _.keys(filter);
		_.each(filterKeys, function(filterKey, filterKeyIndex) {

			// Set data
			var filterValue = filter[filterKey];

			// If $where is defined
			if(typeof objectPath.get(filterValue, '$where') !== 'undefined') {

				// Set data
				var fieldsToParse = {};
				var customField = _.clone(filterValue);

				// Delete where from custom field
				delete customField['$where'];

				// Get parent hash alias item
				var parentHashAliasItem = _.find(self.hashAlias, function(obj) { return obj.alias === parentAlias; });

				// Get some field path
				var absoluteFieldPath = _.reject([ parentHashAliasItem.key, filterKey ], function(obj) { return !obj; }).join('.');
				var fieldsToParsePath = absoluteFieldPath.split('.').join('.$fields.').split('.');

				// Set field to parse
				var fieldsToParse = {};

				// Set fields to parse
				objectPath.set(fieldsToParse, fieldsToParsePath, customField);

				// Parse fields
				_parseFields.call(self, model, fieldsToParse, parentAlias, parentField);

				// Add where
				whereClause += _parseFilterItem.call(self, model, filterValue['$as'], filterValue['$where'], parentAlias, parentField, true);

			} else {

				// Parse filter item
				whereClause += _parseFilterItem.call(self, model, filterKey, filterValue, parentAlias, parentField);

			}

			// Add OR keyword
			if(filterKeyIndex < filterKeys.length-1) {
				whereClause += 'AND ';
			}

		});

	}

	// Trim where clause
	whereClause = whereClause.trim();

	// Return where clause
	return whereClause;

};


/**
 * Parse filter item
 *
 * @param {Model} model
 * @param {Mixed} itemKey
 * @param {Mixed} itemValue
 * @param {String} itemKey
 * @param {String} parentAlias
 * @param {String} parentField
 * @param {Boolean} [isAnAlias]
 *
 * @context {Number} aliasIncrement
 * @context {QueryBuilder} queryBuilder
 * @context {Object} queryBuilderColumns
 * @context {Array} requestedFields
 * @context {Object} queryBuildingTasks
 * @context {Object} hashAlias
 *
 * @private
 */
var _parseFilterItem = function(model, itemKey, itemValue, parentAlias, parentField, isAnAlias) {

	// Transform arguments
	if(typeof isAnAlias === 'undefined') isAnAlias = false;

	// Set data
	var self = this;

	// Parse filter item
	var parsedKey = _parseFilterKey.call(self, model, itemKey, parentAlias, parentField, isAnAlias);
	var parsedValue = _parseFilterValue.call(self, model, itemValue, parentAlias, parentField);

	// Check cast clauses
	if(!(new RegExp('CAST\\(.*? AS DATE\\)').exec(parsedKey)) && new RegExp('CAST\\(.*? AS DATE\\)').exec(parsedValue)) {
		return ' CAST(' + parsedKey + ' AS DATE)' + parsedValue;
	} else if(!(new RegExp('CAST\\(.*? AS DATETIME\\)').exec(parsedKey)) && new RegExp('CAST\\(.*? AS DATETIME\\)').exec(parsedValue)) {
		return ' CAST(' + parsedKey + ' AS DATETIME)' + parsedValue;
	} else if(new RegExp('LIKE').exec(parsedValue)) {
		return ' CAST(' + parsedKey + ' AS CHAR)' + parsedValue;
	} else {
		return parsedKey + parsedValue + ' ';
	}

};


/**
 * Parse filter key
 *
 * @param {Model} model
 * @param {Mixed} itemKey
 * @param {String} parentAlias
 * @param {String} parentField
 * @param {Boolean} [isAnAlias]
 *
 * @context {Number} aliasIncrement
 * @context {QueryBuilder} queryBuilder
 * @context {Object} queryBuilderColumns
 * @context {Array} requestedFields
 * @context {Object} queryBuildingTasks
 * @context {Object} hashAlias
 *
 * @private
 */
var _parseFilterKey = function(model, itemKey, parentAlias, parentField, isAnAlias) {

	// Transform arguments
	if(typeof isAnAlias === 'undefined') isAnAlias = false;

	// Set data
	var self = this;
	var itemKeyBefore = '';
	var itemKeyAfter = '';

	// Set item key before/after
	if(typeof itemKey !== 'string') {
		itemKeyBefore = objectPath.get(itemKey, '$before_key') || '';
		itemKeyAfter = objectPath.get(itemKey, '$after_key') || '';
		itemKey = objectPath.get(itemKey, '$key');
	}

	// Get parent hash alias item
	var parentHashAliasItem = _.find(self.hashAlias, function(obj) { return obj.alias === parentAlias; });

	// Get absolute field path
	var fieldPath = itemKey.split('.');
	var fieldName = fieldPath.pop();
	var baseFieldPath = fieldPath.join('.');
	var absoluteBaseFieldPath = _.reject([ parentHashAliasItem.key, baseFieldPath ], function(obj) { return !obj; }).join('.');

	// Get absolute hash alias item
	var absoluteHashAliasItem = _.find(self.hashAlias, function(obj) { return obj.key === absoluteBaseFieldPath; });

	// Find absolute hash alias item if undefined
	if(typeof absoluteHashAliasItem === 'undefined') {

		// Set data
		var absoluteFieldPath = absoluteBaseFieldPath + '.' + fieldName;
		var fieldsToParsePath = absoluteFieldPath.split('.').join('.$fields.').split('.');
		var fieldsToParse = {};

		// Set fields to parse
		objectPath.set(fieldsToParse, fieldsToParsePath, 1);

		// Parse fields
		_parseFields.call(self, model, fieldsToParse, parentAlias, parentField);

		// Get absolute hash alias item
		absoluteHashAliasItem = _.find(self.hashAlias, function(obj) { return obj.key === absoluteBaseFieldPath; });

	}

	// Check if field is a relationship
	var fieldRelationship = absoluteHashAliasItem.model.getRelationship(fieldName);
	var isFieldRelationship = !!(fieldRelationship && _.contains([ 'belongsTo', 'hasOne', 'hasOneCustom', 'hasOneThrough' ], fieldRelationship.type));

	// If absolute hash alias item is already defined
	if(!isAnAlias || isFieldRelationship) {

		// Set real absolute value
		if(isFieldRelationship) {
			absoluteBaseFieldPath = _.reject([ absoluteBaseFieldPath, fieldName ], function(obj) { return !obj; }).join('.');
			fieldName = fieldRelationship.model.getPrimaryKey();
		}

		// Set data
		var absoluteFieldPath = _.reject([ absoluteBaseFieldPath, fieldName ], function(obj) { return !obj; }).join('.');
		var fieldsToParsePath = absoluteFieldPath.split('.').join('.$fields.').split('.');
		var fieldsToParse = {};

		// Set fields to parse
		objectPath.set(fieldsToParse, fieldsToParsePath, 1);

		// Parse fields
		_parseFields.call(self, model, fieldsToParse, parentAlias, parentField);

		// Get absolute hash alias item
		if(isFieldRelationship) {
			absoluteHashAliasItem = _.find(self.hashAlias, function(obj) { return obj.key === absoluteBaseFieldPath; });
		}

	}

	// Return key
	return itemKeyBefore + '`' + absoluteHashAliasItem.alias + '$' + fieldName + '`' + itemKeyAfter;



};


/**
 * Parse filter value
 *
 * @param {Model} model
 * @param {Mixed} itemValue
 * @param {String} parentAlias
 * @param {String} parentField
 *
 * @context {Number} aliasIncrement
 * @context {QueryBuilder} queryBuilder
 * @context {Object} queryBuilderColumns
 * @context {Array} requestedFields
 * @context {Object} queryBuildingTasks
 * @context {Object} hashAlias
 *
 * @private
 */
var _parseFilterValue = function(model, itemValue, parentAlias, parentField) {

	// Data
	var self = this;
	var whereClause = '';

	// If NOT
	if(_.contains(_.keys(itemValue), '$not')) {
		whereClause += ' NOT ' + _parseFilter.call(self, model, itemValue['$not'], parentAlias, parentField) + ' ';
	}

	// If >
	else if(_.contains(_.keys(itemValue), '$gt')) {
		whereClause += ' > ' + _parseValue(itemValue['$gt']) + ' ';
	}

	// If >=
	else if(_.contains(_.keys(itemValue), '$gte')) {
		whereClause += ' >= ' + _parseValue(itemValue['$gte']) + ' ';
	}

	// If <
	else if(_.contains(_.keys(itemValue), '$lt')) {
		whereClause += ' < ' + _parseValue(itemValue['$lt']) + ' ';
	}

	// If <=
	else if(_.contains(_.keys(itemValue), '$lte')) {
		whereClause += ' <= ' + _parseValue(itemValue['$lte']) + ' ';
	}

	// If =
	else if(_.contains(_.keys(itemValue), '$e')) {

		// Get parsed value
		var parsedValue = _parseValue(itemValue['$e']);

		// Add = itemValue
		if(parsedValue === null) {
			whereClause += ' IS NULL ';
		} else {
			whereClause += ' = ' + parsedValue + ' ';
		}

	}

	// If <>
	else if(_.contains(_.keys(itemValue), '$ne')) {

		// Get parsed value
		var parsedValue = _parseValue(itemValue['$ne']);

		// Add <> itemValue
		if(parsedValue === null) {
			whereClause += ' IS NOT NULL ';
		} else {
			whereClause += ' != ' + parsedValue + ' ';
		}

	}

	// If LIKE
	else if(_.contains(_.keys(itemValue), '$like')) {
		if(String(itemValue['$like']).match(/^\%|\%$/)) whereClause += ' LIKE ' + knex.raw('?', [ String(itemValue['$like']) ]) + ' ';
		else whereClause += ' LIKE ' + knex.raw('?', [ '%' + String(itemValue['$like']) + '%' ]) + ' ';
	}

	// If NOT LIKE
	else if(_.contains(_.keys(itemValue), '$nlike')) {
		if(String(itemValue['$nlike']).match(/^\%|\%$/)) whereClause += ' NOT LIKE ' + knex.raw('?', [ String(itemValue['$nlike']) ]) + ' ';
		else whereClause += ' NOT LIKE ' + knex.raw('?', [ '%' + String(itemValue['$nlike']) + '%' ]) + ' ';
	}

	// If RAW
	else if(_.contains(_.keys(itemValue), '$raw')) {
		whereClause += ' ' + knex.raw(itemValue['$raw']) + ' ';
	}

	// If IN
	else if(_.contains(_.keys(itemValue), '$in') && itemValue['$in'] instanceof Array) {

		// Add quotes for strings
		var inItems = _.map(itemValue['$in'], function(val) {
			return _parseValue(val);
		});

		// If IN item is empty
		if(inItems.length === 0) {
			whereClause += ' IN (-1) ';
		} else {
			whereClause += ' IN (' + inItems.join(',') + ') ';
		}

	}

	// If NIN
	else if(_.contains(_.keys(itemValue), '$nin') && itemValue['$nin'] instanceof Array) {

		// Add quotes for strings
		ninItems = _.map(itemValue['$nin'], function(val) {
			return _parseValue(val);
		});

		// If IN item is empty
		if(ninItems.length === 0) {
			whereClause += ' NOT IN (-1) ';
		} else {
			whereClause += ' NOT IN (' + ninItems.join(',') + ') ';
		}

	}

	// If CURRENT WEEK / MONTH / YEAR
	else if(_.contains(_.keys(itemValue), '$currentweek')) {
		whereClause += ' >= CAST(\'' + moment.utc().startOf('isoweek').format('YYYY-MM-DD') + '\' AS DATE) ';
	} else if(_.contains(_.keys(itemValue), '$currentmonth')) {
		whereClause += ' >= CAST(\'' + moment.utc().startOf('month').format('YYYY-MM-DD') + '\' AS DATE) ';
	} else if(_.contains(_.keys(itemValue), '$currentyear')) {
		whereClause += ' >= CAST(\'' + moment.utc().startOf('year').format('YYYY-MM-DD') + '\' AS DATE) ';
	}

	// If LAST WEEK / MONTH / YEAR
	else if(_.contains(_.keys(itemValue), '$lastweek')) {
		whereClause += ' BETWEEN CAST(\'' + moment.utc().startOf('isoweek').subtract(1, 'week').format('YYYY-MM-DD') + '\' AS DATE) AND CAST(\'' + moment.utc().endOf('isoweek').subtract(1, 'week').format('YYYY-MM-DD') + '\' AS DATE) ';
	} else if(_.contains(_.keys(itemValue), '$lastmonth')) {
		whereClause += ' BETWEEN CAST(\'' + moment.utc().startOf('month').subtract(1, 'month').format('YYYY-MM-DD') + '\' AS DATE) AND CAST(\'' + moment.utc().endOf('month').subtract(1, 'month').format('YYYY-MM-DD') + '\' AS DATE) ';
	} else if(_.contains(_.keys(itemValue), '$lastyear')) {
		whereClause += ' BETWEEN CAST(\'' + moment.utc().startOf('year').subtract(1, 'year').format('YYYY-MM-DD') + '\' AS DATE) AND CAST(\'' + moment.utc().endOf('year').subtract(1, 'year').format('YYYY-MM-DD') + '\' AS DATE) ';
	}

	// If NULL
	else if(itemValue === null) {
		whereClause += ' IS NULL ';
	}

	// If value
	else {
		whereClause += ' = ' + _parseValue(itemValue) + ' ';
	}

	/*

	// Else
	else {

		// If object
		else if(_.isObject(itemValue['$value']) && itemValue['$value'] !== null) {

			// Data
			var parsedFilter = _parseFilter.call(self, model, itemValue['$value'], parentAlias, parentField);

			if(!(new RegExp('CAST\\(.*? AS DATE\\)').exec(filterField)) && new RegExp('CAST\\(.*? AS DATE\\)').exec(parsedFilter)) {
				whereClause += 'CAST(' + filterField + ' AS DATE) ' + parsedFilter + ' ';
			} else if(!(new RegExp('CAST\\(.*? AS DATETIME\\)').exec(filterField)) && new RegExp('CAST\\(.*? AS DATETIME\\)').exec(parsedFilter)) {
				whereClause += 'CAST(' + filterField + ' AS DATETIME) ' + parsedFilter + ' ';
			} else {
				whereClause += filterField + ' ' + parsedFilter + ' ';
			}

		}

	}

	*/

	// Return filter string
	return whereClause;

};


/**
 * Parse value
 *
 * @param {Mixed} value
 *
 * @private
 */
var _parseValue = function(value) {

	// Set data
	var parsedValue = '';

	// If value is a date
	if(_.isObject(value) && typeof value['$date'] === 'string') {
		value = {
			'$before_value': 'CAST(',
			'$after_value': ' AS DATE)',
			'$value': value['$date']
		};
	}

	// If value is a datetime
	else if(_.isObject(value) && typeof value['$datetime'] === 'string') {
		value = {
			'$before_value': 'CAST(',
			'$after_value': ' AS DATETIME)',
			'$value': value['$date']
		};
	}

	// If value is a Date
	else if(_.isObject(value) && value instanceof Date) {
		value = {
			'$before_value': 'CAST(',
			'$after_value': ' AS DATETIME)',
			'$value': moment.utc(value).format('YYYY-MM-DD HH:mm:ss')
		};
	}

	// If value is standard
	else if(!_.isObject(value)) {
		value = {
			'$before_value': '',
			'$after_value': '',
			'$value': value
		};
	}

	// Check if value is null
	if(value['$value'] === null) {
		return null;
	} else if(value['$value'] === '$null') {
		return null;
	}

	// Add value
	if(typeof value['$value'] === 'number') parsedValue += knex.raw('?', [ value['$value'] ]);
	else parsedValue += knex.raw('?', [ String(value['$value']) ]);

	// Add before/after of value
	parsedValue = value['$before_value'] + parsedValue + value['$after_value'];

	// Return parsed value
	return parsedValue;

};


// Exports
module.exports = {
	_parseFields: _parseFields,
	_parseFilter: _parseFilter,
	_parseFilterValue: _parseFilterValue,
	_parseValue: _parseValue
};
