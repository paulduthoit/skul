/**
 * lib/skul/populate.js
 *
 * SKuL populate methods
 *
 * Author: Paul Duthoit
 * Copyright(c) 2016 Paul Duthoit
 */

// Dependencies
var Promise = require('promise');
var _ = require('underscore');
var objectPath = require('object-path');
var knex = require('knex')({ client: 'mysql' });
var QueryBuilder = require('./query-builder');
var privateMethods = require('./private');


/**
 * Populate virtuals
 *
 * @params {Object} fields
 * @params {Array|Object} data
 *
 * @api public
 */
module.exports.populateVirtuals = function(fields, data, params) {

	// Data
	var dataToParse = data;
	var asyncQueue = Promise.resolve();
	var virtuals = this.getVirtuals();
	var isArray = dataToParse instanceof Array;

	// Check if data to parse is an array
	if(!isArray) {
		dataToParse = [ dataToParse ];
	}

    // Transform data
    _.each(dataToParse, function(dataItem) {

	    // Loop over requested virtual fields
	    _.each(fields, function(virtualFieldValue, virtualFieldKey) {

	    	// If virtual is a relationship field
	    	if(typeof virtualFieldValue === 'object' && typeof virtualFieldValue['$model'] === 'object') {

	    		// Data
	    		var relModel = virtualFieldValue['$model'];
	    		var relFields = virtualFieldValue['$fields'];
	    		var relData = [ dataItem[virtualFieldKey] ];

	    		// Stop if relation data is null
	    		if(!dataItem[virtualFieldKey]) {
	    			return;
	    		}

	    		// Stop if no fields
	    		if(_.keys(relFields).length === 0) {
	    			return;
	    		}

	    		// Populate relationship virtuals
	    		asyncQueue = asyncQueue
	    			.then(relModel.populateVirtuals.bind(relModel, relFields, relData, params))
	    			.then(function() {
	    				return Promise.resolve();
	    			});

	    	} else {

	    		// Data
	    		var transformResult = virtuals[virtualFieldKey].transform.call(null, dataItem, { fields: fields, params: params });

		    	// If transform is async
		    	if(transformResult instanceof Promise) {

		    		// Add to queue
		    		asyncQueue = asyncQueue
		    			.then(function() {

		    				// Return promise
		    				return transformResult
		    					.then(function(result) {

				    				// Set result transform
				    				dataItem[virtualFieldKey] = result;

				    				// Resolve
				    				return Promise.resolve();

		    					});

		    			});

		    	} else {

		    		// Set result transform
		    		dataItem[virtualFieldKey] = transformResult;

		    	}

	    	}

	    });

    });

    // Add to queue
    asyncQueue = asyncQueue
    	.then(function() {

		    // Return data
		    if(isArray) {
		    	return Promise.resolve(dataToParse);
		    } else {
		    	return Promise.resolve(dataToParse[0]);
		    }

    	});

    // Return async queue
    return asyncQueue;

};


/**
 * Populate relationships
 *
 * @params {Object} fields
 * @params {Object|Array} data
 * @params {Object} [params]
 *
 * @return {Promise}
 *
 * @api public
 */
module.exports.populateRelationships = function(fields, data, params) {

    // Check arguments length
    if(arguments.length === 2) {
        params = {};
    }

    // Transform arguments
    if(typeof params === "undefined" || params === null) params = {};

	// Check arguments
	if(!(typeof fields === "object"))
		throw new Error("fields have to be an object");
	if(!(data instanceof Array || typeof data === "object"))
		throw new Error("data have to be an array or an object");
	if(!(typeof params === "object"))
		throw new Error("params have to be an object");

	// Data
	var self = this;
	var asyncQueue = Promise.resolve();

	// Resolve if data is empty
	if(data.length === 0) {
		return Promise.resolve(data);
	}

	// Get relationships has many field keys
	var belongsToRelationshipKeys = self.getRelationshipKeys('belongsTo');
	var hasManyRelationshipKeys = self.getRelationshipKeys('hasMany');
	var hasOneRelationshipKeys = self.getRelationshipKeys('hasOne');
	var hasManyCustomRelationshipKeys = self.getRelationshipKeys('hasManyCustom');
	var hasOneCustomRelationshipKeys = self.getRelationshipKeys('hasOneCustom');
	
	// Populate each relationship fields
	_.each(fields, function(obj, key) {

		// Add to queue
		asyncQueue = asyncQueue
			.then(function() {

				// Populate hasMany relationship
				if(_.contains(hasManyRelationshipKeys, key)) {
					return _populateOneToManyRelationship.call(self, key, data, obj['$filter'], obj['$fields'], obj['$options'], params);
				}

				// Populate hasOne relationship
				else if(_.contains(hasOneRelationshipKeys, key) || _.contains(belongsToRelationshipKeys, key)) {
					return _populateOneToOneRelationship.call(self, key, data, obj['$filter'], obj['$fields'], obj['$options'], params);
				}

				// Populate hasMany relationship
				else if(_.contains(hasManyCustomRelationshipKeys, key)) {
					return _populateOneToManyCustomRelationship.call(self, key, data, obj['$filter'], obj['$fields'], obj['$options'], params);
				}

			});

	});

	// Add to queue
	asyncQueue = asyncQueue
		.then(function() {

			// Resolve
			return Promise.resolve(data);

		});

	// Return queue
	return asyncQueue;

};


/**
 * Populate one to many relationship
 *
 * @params {String} fieldPath
 * @params {Object|Array} data
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Object} [params]
 *
 * @return {Promise}
 * @api public
 */
var _populateOneToManyRelationship = function(key, data, filter, fields, options, params) {

    // Check arguments length
    if(arguments.length === 5) {
        params = {};
    } else if(arguments.length === 4) {
        params = {};
        options = {};
    } else if(arguments.length === 3) {
        params = {};
        options = {};
        fields = {};
    } else if(arguments.length === 2) {
        params = {};
        options = {};
        fields = {};
        filter = {};
    }

    // Transform arguments
    if(typeof filter === "undefined" || filter === null) filter = {};
    if(typeof fields === "undefined" || fields === null) fields = {};
    if(typeof options === "undefined" || options === null) options = {};
    if(typeof params === "undefined" || params === null) params = {};

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");
	if(!(data instanceof Array || typeof data === "object"))
		throw new Error("data have to be an array or an object");
	if(typeof filter !== "object")
		throw new Error("filter have to be an object");
	if(typeof fields !== "object")
		throw new Error("fields have to be an object");
	if(typeof options !== "object")
		throw new Error("options have to be an object");
	if(typeof params !== "object")
		throw new Error("params have to be an object");

	// Check key argument
	if(typeof this.relationships[key] === "undefined")
		throw new Error("key have to refer to a provided relationship");

	// Data
	var self = this;
	var dbConnection = self.dbConnection;
	var relationship = self.relationships[key];
	var relModel = relationship.model;
	var relTableName = relModel.getTableName();
	var relPrimaryKey = relModel.getPrimaryKey();
	var relForeignKey = relationship.foreignKey;
	var selfKey = typeof relationship.key !== "undefined" ? relationship.key : self.primaryKey;
	var dataToPopulate = data instanceof Array ? data : [ data ];
	var hashId = [];
	var hashData = {};
	var hashFields = [];
	var hashRelationships = {};

	// Transform options arguments
	if(String(options) === '[object Object]') {
		if(typeof options.limit === "undefined" || options.limit === null) options.limit = relModel.getDefaultSelectOption('limit');
		if(typeof options.skip === "undefined" || options.skip === null) options.skip = relModel.getDefaultSelectOption('skip');
		if(typeof options.orderby === "undefined" || options.orderby === null) options.orderby = relModel.getDefaultSelectOption('orderby');
		if(typeof options.orderby === "string") options.orderby = [ options.orderby ];
	}

	// Check option argument
	if(typeof options.limit !== "number")
		throw new Error("options.limit have to be a number");
	if(typeof options.skip !== "number")
		throw new Error("options.skip have to be a number");
	if(!(options.orderby instanceof Array || options.orderby === null))
		throw new Error("options.orderby have to be an array or a string");

	// Get hash ids
	var hashId = _.map(dataToPopulate, function(dataItem) {
		return dataItem[selfKey];
	});

	// Check arguments
	var checkArgumentsLoad = function() {

		// Add to filter
		newFilter = {};
		newFilter[relForeignKey] = { '$in': (hashId.length > 0 ? hashId : [ -1 ]) };

		// Add to filter
		if(Object.keys(filter).length === 0) {
			filter = newFilter;
		} else {
			filter = { '$and': [ newFilter, filter ] };
		}

		// Check filter
		return relModel.runBeforeSelectMiddleware({ filter: filter, fields: fields, params: params })
			.then(function() {

				// Parse fields
				hashFields = relModel.parseFields(fields);
				hashRelationships = relModel.parseRelationships(fields);
				hashVirtuals = relModel.parseVirtuals(fields);

				// Resolve
				return Promise.resolve();

			});

	};

	// Count hash
	var countHashLoad = function() {
	    return new Promise(function(resolve, reject) {

			// Set data
			var context = {
				mainModel: relModel,
				mainAlias: null,
				aliasIncrement: 1,
				queryBuilder: new QueryBuilder(),
				queryBuilderColumns: {},
				requestedFields: [],
				queryBuildingTasks: { 0: [], 1: [] },
				hashAlias: []
			};

		    /* FROM */

			    // Set alias
			    var tableName = context.mainModel.getTableName();
			    var tableAlias = 'T' + context.aliasIncrement;

			    // Set main alias
			    context.mainAlias = tableAlias;

			    // Increment alias
			    context.aliasIncrement++;

			    // Push alias
			    context.hashAlias.push({ alias: tableAlias, key: '', model: context.mainModel });

			    // Set from
				context.queryBuilder.setFromRaw('`' + tableName + '` AS `' + tableAlias + '`');

		    /* /FROM */

		    /* PARSE FIELDS/FILTER */

			    // Set fields to parse
			    var fieldsToParse = {};
			    	fieldsToParse[relForeignKey] = 1;

			    // Parse fields
				privateMethods._parseFields.call(context, context.mainModel, fieldsToParse, tableAlias, '');

			    // Parse filter
			    var whereClause = privateMethods._parseFilter.call(context, context.mainModel, filter, tableAlias, '');


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
				subqueryBuilder.addColumn(knex.raw('COUNT(*) AS `total`'));

				// Add group by
				subqueryBuilder.addGroupByRaw('`' + tableAlias + '$' + relForeignKey + '`');

				// Set query builder
				context.queryBuilder = subqueryBuilder;


		    /* /SUBQUERY */

		    /* WHERE */

				// Set where
				context.queryBuilder.setWhereRaw(whereClause);

		    /* /WHERE */

		    // Set query builder to string
    		context.queryBuilder = context.queryBuilder.toString();

			// Query
			return dbConnection.query(context.queryBuilder, function(err, queryResult) {

				// Reject if error
				if(err) return reject(err);

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Change total
					queryItem[tableAlias + '$total'] = queryItem.total;
					delete queryItem.total;

				});

				// Parse result
				queryResult = context.mainModel.parseSelectResult(queryResult, context.hashAlias);

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Add total to hash count
					hashData[queryItem[relForeignKey]] = {
						limit: options.limit,
						skip: options.skip,
						orderby: options.orderby instanceof Array && options.orderby.length === 1 ? options.orderby[0] : options.orderby,
						total: queryItem.total,
						data: []
					};

				});

				// Resolve
				return resolve();

			});

		});
	};

	// List hash
	var listHashLoad = function() {
	    return new Promise(function(resolve, reject) {
	
			// Set context
    		var orderbyString = null;
			var context = {
				mainModel: relModel,
				mainAlias: null,
				aliasIncrement: 1,
				queryBuilder: new QueryBuilder(),
				queryBuilderColumns: {},
				requestedFields: [],
				queryBuildingTasks: { 0: [], 1: [] },
				hashAlias: []
			};

		    /* FROM */

			    // Set alias
			    var tableName = context.mainModel.getTableName();
			    var tableAlias = 'T' + context.aliasIncrement;

			    // Set main alias
			    context.mainAlias = tableAlias;

			    // Increment alias
			    context.aliasIncrement++;

			    // Push alias
			    context.hashAlias.push({ alias: tableAlias, key: '', model: context.mainModel});

			    // Set from
				context.queryBuilder.setFromRaw('`' + tableName + '` AS `' + tableAlias + '`');

		    /* /FROM */

		    /* PARSE FIELDS/FILTER */

			    // Set fields to parse
			    var fieldsToParse = _.extend({}, fields);
			    	fieldsToParse[relForeignKey] = 1;

			    // Parse fields
			    privateMethods._parseFields.call(context, context.mainModel, fieldsToParse, tableAlias, '');

			    // Parse filter
			    var whereClause = privateMethods._parseFilter.call(context, context.mainModel, filter, tableAlias, '');


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
						privateMethods._parseFields.call(context, context.mainModel, fieldsToParse, tableAlias, '');

						// Get absolute hash alias item
						absoluteHashAliasItem = _.find(context.hashAlias, function(obj) { return obj.key === absoluteBaseFieldPath.join('.'); });

						// Set order by string
						orderbyString = '`' + absoluteHashAliasItem.alias + '$' + fieldName + '`' + (orderbyIsAsc ? ' ASC' : ' DESC');

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

		    /* ORDERBY */


		    	// Add rel foreign key order by
				context.queryBuilder.setOrderBy([ '`' + tableAlias + '$' + relForeignKey + '` ASC' ]);

				// Add order by
				if(orderbyString) {
					context.queryBuilder.addOrderBy(orderbyString);
				} 

		    /* /ORDERBY */

		    /* RELATIONSHIP */

				// Get some alias
				var queryBuilderAlias = context.queryBuilder.getAlias();
				var mainAliasItem = _.find(context.hashAlias, function(obj) { return obj.key === ''; });
				var relForeignKeyAlias = mainAliasItem.alias + '$' + relForeignKey;

		    	// Add variable increments
		    	context.queryBuilder.addColumn(knex.raw('@num := IF(@foreign = `' + relForeignKeyAlias + '`, @num + 1, 0) AS row_number'));
		    	context.queryBuilder.addColumn(knex.raw('@foreign := `' + relForeignKeyAlias + '` AS dummy'));

		    	// Get orderby
		    	var builderOrderby = context.queryBuilder.getOrderBy();

				// Create another query
				var subqueryBuilder = new QueryBuilder();

			    // Create sub query
			    subqueryBuilder.addColumn(knex.raw('*'));
			    subqueryBuilder.setFromRaw(context.queryBuilder);
				subqueryBuilder.setWhereRaw('row_number >= ' + options.skip + ' AND row_number < ' + (options.skip + options.limit));

		    	// Add orderby
		    	if(builderOrderby.length === 0) {
					subqueryBuilder.setOrderBy([ '`' + queryBuilderAlias + '`.`' + relForeignKeyAlias + '` ASC' ]);
		    	} else {
					subqueryBuilder.setOrderBy(builderOrderby);
		    	}

		    /* /RELATIONSHIP */
	    	
	    	// To string
	    	queryBuilder = subqueryBuilder.toString();

	    	// Add variable reset
	    	queryBuilder = 'SET @num := 0, @foreign := \'\'; ' + queryBuilder;

			// Query
			return dbConnection.query(queryBuilder, function(err, queryResult) {

				// Reject if error
				if(err) return reject(err);

				// Set data
				queryResult = queryResult[1];

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Remove row_number fields and dummy
					delete queryItem.row_number;
					delete queryItem.dummy;

				});

				// Parse result
				queryResult = context.mainModel.parseSelectResult(queryResult, context.hashAlias);

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Push to object
					hashData[queryItem[relForeignKey]].data.push(queryItem);

				});

				// Resolve
				return resolve();

			});

		});
	};

	// Populate relationships in hash
	var populateRelationshipsInHash = function() {

		// Data
		hashDataToPopulate = _.flatten(_.map(hashData, function(obj) { return obj.data; }), true);

		// Return if no fields
		if(_.keys(hashRelationships).length === 0) {
			return Promise.resolve();
		}

		// Populate hash
		return relModel.populateRelationships(hashRelationships, hashDataToPopulate, params);

	};

	// Populate virtuals in hash
	var populateVirtualsInHash = function() {

		// Data
		hashDataToPopulate = _.flatten(_.map(hashData, function(obj) { return obj.data; }), true);

		// Return if no fields
		if(_.keys(hashVirtuals).length === 0) {
			return Promise.resolve();
		}

		// Populate hash
		return relModel.populateVirtuals(hashVirtuals, hashDataToPopulate, params);

	};

	// Return promises
	return checkArgumentsLoad()
		.then(countHashLoad)
		.then(listHashLoad)
		.then(populateRelationshipsInHash)
		.then(populateVirtualsInHash)
		.then(function() {

			// Data
			var asyncQueue = Promise.resolve();

			// Loop over each data
			_.each(dataToPopulate, function(dataItem) {

				// If not empty
				if(typeof hashData[dataItem[selfKey]] !== "undefined") {

					// Add to data
					dataItem[key] = hashData[dataItem[selfKey]];

					// Add to async queue
					asyncQueue = asyncQueue
						.then(function() {

							// Run after select middleware
							return relModel.runAfterSelectMiddleware(dataItem[key], { filter: filter, fields: fields, params: params });

						});

				}

				// If empty
				else {

					dataItem[key] = {
						limit: options.limit,
						skip: options.skip,
						orderby: options.orderby instanceof Array && options.orderby.length === 1 ? options.orderby[0] : options.orderby,
						total: 0,
						data: []
					};

				}

			});

			// Return async queue
			return asyncQueue
				.then(function() {

					// Resolve
					Promise.resolve(data);

				});

		});

};


/**
 * Populate one to many custom relationship
 *
 * @params {String} fieldPath
 * @params {Object|Array} data
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Object} [params]
 *
 * @return {Promise}
 * @api public
 */
var _populateOneToManyCustomRelationship = function(key, data, filter, fields, options, params) {

    // Check arguments length
    if(arguments.length === 5) {
        params = {};
    } else if(arguments.length === 4) {
        params = {};
        options = {};
    } else if(arguments.length === 3) {
        params = {};
        options = {};
        fields = {};
    } else if(arguments.length === 2) {
        params = {};
        options = {};
        fields = {};
        filter = {};
    }

    // Transform arguments
    if(typeof filter === "undefined" || filter === null) filter = {};
    if(typeof fields === "undefined" || fields === null) fields = {};
    if(typeof options === "undefined" || options === null) options = {};
    if(typeof params === "undefined" || params === null) params = {};

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");
	if(!(data instanceof Array || typeof data === "object"))
		throw new Error("data have to be an array or an object");
	if(typeof filter !== "object")
		throw new Error("filter have to be an object");
	if(typeof fields !== "object")
		throw new Error("fields have to be an object");
	if(typeof options !== "object")
		throw new Error("options have to be an object");
	if(typeof params !== "object")
		throw new Error("params have to be an object");

	// Check key argument
	if(typeof this.relationships[key] === "undefined")
		throw new Error("key have to refer to a provided relationship");

	// Data
	var self = this;
	var dbConnection = self.dbConnection;
	var relationship = self.relationships[key];
	var relModel = relationship.model['$model'];
	var relTableName = relModel.getTableName();
	var relPrimaryKey = relModel.getPrimaryKey();
	var relForeignKey = relationship.foreignKey;
	var selfKey = typeof relationship.key !== "undefined" ? relationship.key : self.primaryKey;
	var dataToPopulate = data instanceof Array ? data : [ data ];
	var hashId = [];
	var hashData = {};
	var hashFields = [];
	var hashRelationships = {};

	// Transform options arguments
	if(String(options) === '[object Object]') {
		if(typeof options.limit === "undefined" || options.limit === null) options.limit = relModel.getDefaultSelectOption('limit');
		if(typeof options.skip === "undefined" || options.skip === null) options.skip = relModel.getDefaultSelectOption('skip');
		if(typeof options.orderby === "undefined" || options.orderby === null) options.orderby = relModel.getDefaultSelectOption('orderby');
		if(typeof options.orderby === "string") options.orderby = [ options.orderby ];
	}

	// Check option argument
	if(typeof options.limit !== "number")
		throw new Error("options.limit have to be a number");
	if(typeof options.skip !== "number")
		throw new Error("options.skip have to be a number");
	if(!(options.orderby instanceof Array || options.orderby === null))
		throw new Error("options.orderby have to be an array or a string");

	// Get hash ids
	var hashId = _.map(dataToPopulate, function(dataItem) {
		return dataItem[selfKey];
	});

	// Check arguments
	var checkArgumentsLoad = function() {

		/*

		// Add to filter
		newFilter = {};
		newFilter[relForeignKey] = { '$in': (hashId.length > 0 ? hashId : [ -1 ]) };

		// Add to filter
		if(Object.keys(filter).length === 0) {
			filter = newFilter;
		} else {
			filter = { '$and': [ newFilter, filter ] };
		}

		*/

		// Check filter
		return relModel.runBeforeSelectMiddleware({ filter: filter, fields: fields, params: params })
			.then(function() {

				// Parse fields
				hashFields = relModel.parseFields(fields);
				hashRelationships = relModel.parseRelationships(fields);
				hashVirtuals = relModel.parseVirtuals(fields);

				// Resolve
				return Promise.resolve();

			});

	};

	// Count hash
	var countHashLoad = function() {
	    return new Promise(function(resolve, reject) {

			// Set data
			var context = {
				mainModel: relModel,
				mainAlias: null,
				aliasIncrement: 1,
				queryBuilder: new QueryBuilder(),
				queryBuilderColumns: {},
				requestedFields: [],
				queryBuildingTasks: { 0: [], 1: [] },
				hashAlias: []
			};

		    /* FROM */

			    // Set alias
			    var tableName = context.mainModel.getTableName();
			    var tableAlias = 'T' + context.aliasIncrement;

			    // Set main alias
			    context.mainAlias = tableAlias;

			    // Increment alias
			    context.aliasIncrement++;

			    // Push alias
			    context.hashAlias.push({ alias: tableAlias, key: '', model: context.mainModel });

			    // Set from
				context.queryBuilder.setFromRaw('`' + tableName + '` AS `' + tableAlias + '`');

		    /* /FROM */

		    /* PARSE FIELDS/FILTER */

			    // Set fields to parse
			    var fieldsToParse = {};
			    	// fieldsToParse[relForeignKey] = 1;

			    // Parse fields
				privateMethods._parseFields.call(context, context.mainModel, fieldsToParse, tableAlias, '');

			    // Parse filter
			    var whereClause = privateMethods._parseFilter.call(context, context.mainModel, filter, tableAlias, '');


		    /* /PARSE FIELDS/FILTER */

		    /* CUSTOM JOIN */

				// Set data
				var customFieldAliasHash = {};
				var customAlias = tableAlias + '$' + '_rel_id';
				var subqueryBuilder = new QueryBuilder();
				var subqueryBuildingTasks = [];

				// Set from
				subqueryBuildingTasks.push(function() {
	    			subqueryBuilder.setFromRaw(context.queryBuilder);
	    			subqueryBuilder.addColumn(knex.raw('`' + context.queryBuilder.getAlias() + '`.*'));
	    			subqueryBuilder.addColumn(knex.raw('`' + relForeignKey['$alias'] + '`.`' + relForeignKey['$key'] + '` AS `' + customAlias + '`'));
				});

				// Add required field
	    		subqueryBuildingTasks.push(function() {
					context.requestedFields.push(customAlias);
				});

				// Set data
				var joinRaw = '';
	
				// Loop over joinRaw
				_.each(relationship.joinRaw, function(joinItem) {

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
						joinRaw += '`' + '$QB$' + '`.`' + tableAlias + '$' + joinItem['$key'] + '`';

					    // Add query builder columns
					    context.queryBuilderColumns[tableAlias + '.' + joinItem['$key']] = tableAlias + '$' + joinItem['$key'];

					}

				});

    			// Add to subquery building tasks
    			subqueryBuildingTasks.push(function() {

    				// Add query builder alias to join raw
    				joinRaw = joinRaw.replace(/`\$QB\$`/g, context.queryBuilder.getAlias());

    				// Add join
					subqueryBuilder.addJoin('raw', joinRaw);
					
				});

			    // Add query builder columns
			    context.queryBuilderColumns[tableAlias + '.' + selfKey] = tableAlias + '$' + selfKey;

				// Add group by
				subqueryBuildingTasks.push(function() {
					subqueryBuilder.addGroupByRaw('`' + context.queryBuilder.getAlias() + '`.`' + tableAlias + '$' + selfKey + '`');
					subqueryBuilder.addGroupByRaw('`' + relForeignKey['$alias'] + '`.`' + relForeignKey['$key'] + '`');
				});

			    // Push to query building tasks
				context.queryBuildingTasks[1].push(function() {

					// Run subquery building tasks
					_.each(subqueryBuildingTasks, function(fun) { return fun(); });

					// Set query builder
					context.queryBuilder = subqueryBuilder;

				});

		    /* /CUSTOM JOIN */

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
				subqueryBuilder.addColumn(knex.raw('COUNT(*) AS `total`'));

				// Add group by
				subqueryBuilder.addGroupByRaw(customAlias);

				// Set query builder
				context.queryBuilder = subqueryBuilder;


		    /* /SUBQUERY */

		    /* WHERE */

				// Set where
				context.queryBuilder.setWhereRaw(whereClause);

		    /* /WHERE */

		    // Set query builder to string
    		context.queryBuilder = context.queryBuilder.toString();

			// Query
			return dbConnection.query(context.queryBuilder, function(err, queryResult) {

				// Reject if error
				if(err) return reject(err);

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Change total
					queryItem[tableAlias + '$total'] = queryItem.total;
					delete queryItem.total;

				});

				// Parse result
				queryResult = context.mainModel.parseSelectResult(queryResult, context.hashAlias);

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Add total to hash count
					hashData[queryItem['_rel_id']] = {
						limit: options.limit,
						skip: options.skip,
						orderby: options.orderby instanceof Array && options.orderby.length === 1 ? options.orderby[0] : options.orderby,
						total: queryItem.total,
						data: []
					};

				});

				// Resolve
				return resolve();

			});

		});
	};

	// List hash
	var listHashLoad = function() {
	    return new Promise(function(resolve, reject) {
	
			// Set context
    		var orderbyString = null;
			var context = {
				mainModel: relModel,
				mainAlias: null,
				aliasIncrement: 1,
				queryBuilder: new QueryBuilder(),
				queryBuilderColumns: {},
				requestedFields: [],
				queryBuildingTasks: { 0: [], 1: [] },
				hashAlias: []
			};

		    /* FROM */

			    // Set alias
			    var tableName = context.mainModel.getTableName();
			    var tableAlias = 'T' + context.aliasIncrement;

			    // Set main alias
			    context.mainAlias = tableAlias;

			    // Increment alias
			    context.aliasIncrement++;

			    // Push alias
			    context.hashAlias.push({ alias: tableAlias, key: '', model: context.mainModel});

			    // Set from
				context.queryBuilder.setFromRaw('`' + tableName + '` AS `' + tableAlias + '`');

		    /* /FROM */

		    /* PARSE FIELDS/FILTER */

			    // Set fields to parse
			    var fieldsToParse = _.extend({}, fields);
			    	// fieldsToParse[relForeignKey] = 1;

			    // Parse fields
			    privateMethods._parseFields.call(context, context.mainModel, fieldsToParse, tableAlias, '');

			    // Parse filter
			    var whereClause = privateMethods._parseFilter.call(context, context.mainModel, filter, tableAlias, '');


		    /* /PARSE FIELDS/FILTER */

		    /* CUSTOM JOIN */

				// Set data
				var customFieldAliasHash = {};
				var customAlias = tableAlias + '$' + '_rel_id';
				var subqueryBuilder = new QueryBuilder();
				var subqueryBuildingTasks = [];

				// Set from
				subqueryBuildingTasks.push(function() {
	    			subqueryBuilder.setFromRaw(context.queryBuilder);
	    			subqueryBuilder.addColumn(knex.raw('`' + context.queryBuilder.getAlias() + '`.*'));
	    			subqueryBuilder.addColumn(knex.raw('`' + relForeignKey['$alias'] + '`.`' + relForeignKey['$key'] + '` AS `' + customAlias + '`'));
				});

				// Add required field
	    		subqueryBuildingTasks.push(function() {
					context.requestedFields.push(customAlias);
				});

				// Set data
				var joinRaw = '';
	
				// Loop over joinRaw
				_.each(relationship.joinRaw, function(joinItem) {

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
						joinRaw += '`' + '$QB$' + '`.`' + tableAlias + '$' + joinItem['$key'] + '`';

					    // Add query builder columns
					    context.queryBuilderColumns[tableAlias + '.' + joinItem['$key']] = tableAlias + '$' + joinItem['$key'];

					}

				});

    			// Add to subquery building tasks
    			subqueryBuildingTasks.push(function() {

    				// Add query builder alias to join raw
    				joinRaw = joinRaw.replace(/`\$QB\$`/g, context.queryBuilder.getAlias());

    				// Add join
					subqueryBuilder.addJoin('raw', joinRaw);
					
				});

			    // Add query builder columns
			    context.queryBuilderColumns[tableAlias + '.' + selfKey] = tableAlias + '$' + selfKey;

				// Add group by
				subqueryBuildingTasks.push(function() {
					subqueryBuilder.addGroupByRaw('`' + context.queryBuilder.getAlias() + '`.`' + tableAlias + '$' + selfKey + '`');
					subqueryBuilder.addGroupByRaw('`' + relForeignKey['$alias'] + '`.`' + relForeignKey['$key'] + '`');
				});

			    // Push to query building tasks
				context.queryBuildingTasks[1].push(function() {

					// Run subquery building tasks
					_.each(subqueryBuildingTasks, function(fun) { return fun(); });

					// Set query builder
					context.queryBuilder = subqueryBuilder;

				});

		    /* /CUSTOM JOIN */

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
						privateMethods._parseFields.call(context, context.mainModel, fieldsToParse, tableAlias, '');

						// Get absolute hash alias item
						absoluteHashAliasItem = _.find(context.hashAlias, function(obj) { return obj.key === absoluteBaseFieldPath.join('.'); });

						// Set order by string
						orderbyString = '`' + absoluteHashAliasItem.alias + '$' + fieldName + '`' + (orderbyIsAsc ? ' ASC' : ' DESC');

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
				if(whereClause) whereClause = '(' + whereClause + ') AND ';
				whereClause += '`' + tableAlias + '$' + '_rel_id' + '` IN (' + (hashId.length > 0 ? hashId.join(',') : '-1') + ')';

				// Set where
				context.queryBuilder.setWhereRaw(whereClause);

		    /* /WHERE */

		    /* ORDERBY */

		    	// Add rel foreign key order by
				context.queryBuilder.setOrderBy([ '`' + tableAlias + '$' + '_rel_id' + '` ASC' ]);

				// Add order by
				if(orderbyString) {
					context.queryBuilder.addOrderBy(orderbyString);
				} 

		    /* /ORDERBY */

		    /* RELATIONSHIP */

				// Get some alias
				var queryBuilderAlias = context.queryBuilder.getAlias();
				var mainAliasItem = _.find(context.hashAlias, function(obj) { return obj.key === ''; });
				var relForeignKeyAlias = mainAliasItem.alias + '$' + '_rel_id';

		    	// Add variable increments
		    	context.queryBuilder.addColumn(knex.raw('@num := IF(@foreign = `' + relForeignKeyAlias + '`, @num + 1, 0) AS row_number'));
		    	context.queryBuilder.addColumn(knex.raw('@foreign := `' + relForeignKeyAlias + '` AS dummy'));

		    	// Get orderby
		    	var builderOrderby = context.queryBuilder.getOrderBy();

				// Create another query
				var subqueryBuilder = new QueryBuilder();

			    // Create sub query
			    subqueryBuilder.addColumn(knex.raw('*'));
			    subqueryBuilder.setFromRaw(context.queryBuilder);
				subqueryBuilder.setWhereRaw('row_number >= ' + options.skip + ' AND row_number < ' + (options.skip + options.limit));

		    	// Add orderby
		    	if(builderOrderby.length === 0) {
					subqueryBuilder.setOrderBy([ '`' + queryBuilderAlias + '`.`' + relForeignKeyAlias + '` ASC' ]);
		    	} else {
					subqueryBuilder.setOrderBy(builderOrderby);
		    	}

		    /* /RELATIONSHIP */
	    	
	    	// To string
	    	queryBuilder = subqueryBuilder.toString();

	    	// Add variable reset
	    	queryBuilder = 'SET @num := 0, @foreign := \'\'; ' + queryBuilder;

			// Query
			return dbConnection.query(queryBuilder, function(err, queryResult) {

				// Reject if error
				if(err) return reject(err);

				// Set data
				queryResult = queryResult[1];

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Remove row_number fields and dummy
					delete queryItem.row_number;
					delete queryItem.dummy;

				});

				// Parse result
				queryResult = context.mainModel.parseSelectResult(queryResult, context.hashAlias);

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Push to object
					hashData[queryItem['_rel_id']].data.push(queryItem);

					// Remove _rel_id
					delete queryItem['_rel_id'];

				});

				// Resolve
				return resolve();

			});

		});
	};

	// Populate relationships in hash
	var populateRelationshipsInHash = function() {

		// Data
		hashDataToPopulate = _.flatten(_.map(hashData, function(obj) { return obj.data; }), true);

		// Return if no fields
		if(_.keys(hashRelationships).length === 0) {
			return Promise.resolve();
		}

		// Populate hash
		return relModel.populateRelationships(hashRelationships, hashDataToPopulate, params);

	};

	// Populate virtuals in hash
	var populateVirtualsInHash = function() {

		// Data
		hashDataToPopulate = _.flatten(_.map(hashData, function(obj) { return obj.data; }), true);

		// Return if no fields
		if(_.keys(hashVirtuals).length === 0) {
			return Promise.resolve();
		}

		// Populate hash
		return relModel.populateVirtuals(hashVirtuals, hashDataToPopulate, params);

	};

	// Return promises
	return checkArgumentsLoad()
		.then(countHashLoad)
		.then(listHashLoad)
		.then(populateRelationshipsInHash)
		.then(populateVirtualsInHash)
		.then(function() {

			// Data
			var asyncQueue = Promise.resolve();

			// Loop over each data
			_.each(dataToPopulate, function(dataItem) {

				// If not empty
				if(typeof hashData[dataItem[selfKey]] !== "undefined") {

					// Add to data
					dataItem[key] = hashData[dataItem[selfKey]];

					// Add to async queue
					asyncQueue = asyncQueue
						.then(function() {

							// Run after select middleware
							return relModel.runAfterSelectMiddleware(dataItem[key], { filter: filter, fields: fields, params: params });

						});

				}

				// If empty
				else {

					dataItem[key] = {
						limit: options.limit,
						skip: options.skip,
						orderby: options.orderby instanceof Array && options.orderby.length === 1 ? options.orderby[0] : options.orderby,
						total: 0,
						data: []
					};

				}

			});

			// Return async queue
			return asyncQueue
				.then(function() {

					// Resolve
					Promise.resolve(data);

				});

		});

};

/**
 * Populate one to one relationship
 *
 * @params {String} fieldPath
 * @params {Object|Array} data
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Object} [params]
 *
 * @return {Promise}
 * @api public
 */
var _populateOneToOneRelationship = function(key, data, filter, fields, options, params) {

    // Check arguments length
    if(arguments.length === 5) {
        params = {};
    } else if(arguments.length === 4) {
        params = {};
        options = {};
    } else if(arguments.length === 3) {
        params = {};
        options = {};
        fields = {};
    } else if(arguments.length === 2) {
        params = {};
        options = {};
        fields = {};
        filter = {};
    }

    // Transform arguments
    if(typeof filter === "undefined" || filter === null) filter = {};
    if(typeof fields === "undefined" || fields === null) fields = {};
    if(typeof options === "undefined" || options === null) options = {};
    if(typeof params === "undefined" || params === null) params = {};

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");
	if(!(data instanceof Array || typeof data === "object"))
		throw new Error("data have to be an array or an object");
	if(typeof filter !== "object")
		throw new Error("filter have to be an object");
	if(typeof fields !== "object")
		throw new Error("fields have to be an object");
	if(typeof options !== "object")
		throw new Error("options have to be an object");
	if(typeof params !== "object")
		throw new Error("params have to be an object");

	// Check key argument
	if(typeof this.relationships[key] === "undefined")
		throw new Error("key have to refer to a provided relationship");

	// Data
	var self = this;
	var dbConnection = self.dbConnection;
	var primaryKey = self.primaryKey;
	var relationship = self.relationships[key];
	var relModel = relationship.model;
	var relTableName = relModel.getTableName();
	var relForeignKey = relationship.foreignKey;
	var dataToPopulate = data instanceof Array ? data : [ data ];
	var hashDataToPopulate = [];
	var hashRelationships = null;
	var hashVirtuals = null;

	// Get hash data to populate
	_.each(dataToPopulate, function(dataItem) {

		// Push data to hash if exists
		if(typeof dataItem[key] === "object" && dataItem[key] !== null) {
			hashDataToPopulate.push(dataItem[key]);
		}

	});

	// Check arguments
	var checkArgumentsLoad = function() {

		// Parse fields
		hashRelationships = relModel.parseRelationships(fields);
		hashVirtuals = relModel.parseVirtuals(fields);

		// Resolve
		return Promise.resolve();

	};

	// Populate relationships in hash
	var populateRelationshipsInHash = function() {

		// Return if no fields
		if(_.keys(hashRelationships).length === 0) {
			return Promise.resolve();
		}

		// Populate hash
		return relModel.populateRelationships(hashRelationships, hashDataToPopulate, params);

	};

	// Populate virtuals in hash
	var populateVirtualsInHash = function() {

		// Return if no fields
		if(_.keys(hashVirtuals).length === 0) {
			return Promise.resolve();
		}

		// Populate hash
		return relModel.populateVirtuals(hashVirtuals, hashDataToPopulate, params);

	};

	// Return promises
	return checkArgumentsLoad()
		.then(populateRelationshipsInHash)
		.then(populateVirtualsInHash)
		.then(function() {

			// Resolve
			return Promise.resolve(data);

		});

};