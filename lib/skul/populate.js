/*
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

	    		// Populate relationship virtuals
	    		asyncQueue = asyncQueue
	    			.then(relModel.populateVirtuals.bind(relModel, relFields, relData, params));

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
				aliasIncrement: 1,
				queryBuilder: new QueryBuilder(),
				queryBuilderColumns: {},
				requestedFields: [],
				queryBuildingTasks: { 0: [], 1: [] },
				hashAlias: []
			};

		    /* FROM */

			    // Set alias
			    var tableName = relModel.getTableName();
			    var tableAlias = 'T' + context.aliasIncrement;

			    // Increment alias
			    context.aliasIncrement++;

			    // Push alias
			    context.hashAlias.push({ alias: tableAlias, key: '', model: relModel });

			    // Set from
				context.queryBuilder.setFromRaw('`' + tableName + '` AS `' + tableAlias + '`');

		    /* /FROM */

		    /* PARSE FIELDS/FILTER */

			    // Set fields to parse
			    var fieldsToParse = {};
			    	fieldsToParse[relForeignKey] = 1;

			    // Parse fields
				privateMethods._parseFields.call(context, relModel, fieldsToParse, tableAlias, '');

			    // Parse filter
			    var whereClause = privateMethods._parseFilter.call(context, relModel, filter, tableAlias, '');


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
				queryResult = relModel.parseSelectResult(queryResult, context.hashAlias);

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

	    	// Set data
	    	var queryBuilder = null;
		    var hashAlias = [];
		    var context = {};
		    var builderFields = _.extend({}, fields);
		    var builderOptions = _.extend({}, options);

		    // Check if builder fields is empty
		    if(_.keys(builderFields).length === 0) {
		    	builderFields['$all'] = 1;
		    }

		    // Add some fields to builder fields
		    builderFields[relForeignKey] = 1;

		    // Clean options
		    builderOptions.skip = null;
		    builderOptions.limit = null;

		    // Create select query
	    	queryBuilder = relModel.createSelectQuery(filter, builderFields, builderOptions, hashAlias, context);

			// Get some alias
			var queryBuilderAlias = queryBuilder.getAlias();
			var mainAliasItem = _.find(hashAlias, function(obj) { return obj.key === ''; });
			var relForeignKeyAlias = mainAliasItem.alias + '$' + relForeignKey;

	    	// Add variable increments
	    	queryBuilder.addColumn(knex.raw('@num := IF(@foreign = `' + relForeignKeyAlias + '`, @num + 1, 0) AS row_number'));
	    	queryBuilder.addColumn(knex.raw('@foreign := `' + relForeignKeyAlias + '` AS dummy'));

	    	// Get orderby
	    	var builderOrderby = queryBuilder.getOrderBy();

	    	// Add orderby
			queryBuilder.setOrderBy([ '`' + relForeignKeyAlias + '` ASC' ]);
			_.each(builderOrderby, function(orderbyItem) {
    			queryBuilder.addOrderBy(orderbyItem);
    		});

			// Create another query
			var subqueryBuilder = new QueryBuilder();

		    // Create sub query
		    subqueryBuilder.addColumn(knex.raw('*'));
		    subqueryBuilder.setFromRaw(queryBuilder);
			subqueryBuilder.setWhereRaw('row_number >= ' + options.skip + ' AND row_number < ' + (options.skip + options.limit));

	    	// Add orderby
	    	if(builderOrderby.length === 0) {
				subqueryBuilder.setOrderBy([ '`' + queryBuilderAlias + '`.`' + relForeignKeyAlias + '` ASC' ]);
	    	} else {
				subqueryBuilder.setOrderBy(builderOrderby);
	    	}
	    	
	    	// To string
	    	queryBuilder = subqueryBuilder.toString();

	    	// Add variable reset
	    	queryBuilder = "SET @num := 0, @foreign := ''; " + queryBuilder;

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
				queryResult = relModel.parseSelectResult(queryResult, hashAlias);

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

		// Populate hash
		return relModel.populateRelationships(hashRelationships, hashDataToPopulate, params);

	};

	// Populate virtuals in hash
	var populateVirtualsInHash = function() {

		// Data
		hashDataToPopulate = _.flatten(_.map(hashData, function(obj) { return obj.data; }), true);

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
	var primaryKey = self.primaryKey;
	var tableName = self.getTableName();
	var relationship = self.relationships[key];
	var relModel = relationship.model['$model'];
	var relAlias = relationship.model['$alias'];
	var relTableName = relModel.getTableName();
	var relPrimaryKey = relModel.getPrimaryKey();
	var relJoin = relationship.join;
	var dataToPopulate = data instanceof Array ? data : [ data ];
	var hashId = [];
	var relHashId = {};
	var relHashData = {};
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
		return dataItem[primaryKey];
	});

	// Get relationship ids
	var getRelationshipIdsLoad = function() {
		return new Promise(function(resolve, reject) {

			// Data
			var selfAlias = '1';
			var hashAlias = [ { alias: selfAlias, key: '', model: self }, { alias: selfAlias + '$1', key: key, model: relModel } ];
			var improvedHashAlias = [ { model: self, alias: selfAlias, refAlias: selfAlias }, { model: relModel, alias: selfAlias + '$1', refAlias: relAlias } ];
			var mainQueryBuilder = knex.queryBuilder();
			var subQueryBuilder = knex.queryBuilder();
			var subQueryBuilder2 = new QueryBuilder();

			// Set query alias
			var subQueryAlias = '2';
			var mainQueryAlias = '3';

			// Set join raw
			privateMethods._addCustomJoin(subQueryBuilder2 ,relModel, relJoin, improvedHashAlias, selfAlias);

			// Set sub query builder
			subQueryBuilder2.addColumn(selfAlias + '.' + primaryKey + ' AS id');
			subQueryBuilder2.addColumn(_.findWhere(improvedHashAlias, { refAlias: relAlias }).alias + '.' + relPrimaryKey + ' AS rel_id');
    		subQueryBuilder2.setHavingRaw(privateMethods._parseFilter.call(relModel, subQueryBuilder2, filter, hashAlias, selfAlias + '$1'));
			subQueryBuilder2.setFromRaw('`' + tableName + '` AS `' + selfAlias + '`');

	    	// Add orderby
			subQueryBuilder2.addOrderBy('`' + selfAlias + '`.`' + primaryKey + '` ASC');

			// Add grouby clause
			subQueryBuilder2.addGroupByRaw('`' + selfAlias + '`.`' + primaryKey + '`');
			subQueryBuilder2.addGroupByRaw('`' + _.findWhere(improvedHashAlias, { refAlias: relAlias }).alias + '`.`' + relPrimaryKey + '`');

	    	// Create sub query
	    	subQueryBuilder = subQueryBuilder.select(subQueryAlias + '.id', subQueryAlias + '.rel_id');
	    	subQueryBuilder = subQueryBuilder.select(knex.raw('@num := IF(@foreign = `' + subQueryAlias + '`.`id`, @num + 1, 0) AS row_number'));
	    	subQueryBuilder = subQueryBuilder.select(knex.raw('@foreign := `' + subQueryAlias + '`.`id` AS dummy'));
		    subQueryBuilder = subQueryBuilder.from(knex.raw(subQueryBuilder2.toString()).wrap('(', ') AS `' + subQueryAlias + '`'));
			
			// Create main builder
		    mainQueryBuilder = mainQueryBuilder.select(mainQueryAlias + '.id', mainQueryAlias + '.rel_id');
		    mainQueryBuilder = mainQueryBuilder.from(knex.raw(subQueryBuilder.toString()).wrap('(', ') AS `' + mainQueryAlias + '`'));
			mainQueryBuilder = mainQueryBuilder.whereRaw('`' + mainQueryAlias + '`.`row_number` >= ' + options.skip + ' AND `' + mainQueryAlias + '`.`row_number` < ' + (options.skip + options.limit));

	    	// To string
	    	mainQueryBuilder = mainQueryBuilder.toString();

	    	// Add variable reset
	    	mainQueryBuilder = "SET @num := 0, @foreign := ''; " + mainQueryBuilder;

			// Query
			return dbConnection.query(mainQueryBuilder.toString(), function(err, queryResult) {

				// Reject if error
				if(err) return reject(err);

				// Set data
				queryResult = queryResult[1];

				// Set relHashId
				_.each(queryResult, function(resultItem) {

					// Check if exists
					if(typeof relHashId[resultItem.id] === "undefined") {
						relHashId[resultItem.id] = [];
					}

					// Add id
					if(resultItem.rel_id !== null) {
						relHashId[resultItem.id].push(resultItem.rel_id);
					}

				});

				// Resolve
				return resolve();

			});

		});
	};

	// Check arguments
	var checkArgumentsLoad = function() {

		// Add to filter
		hashKeys = _.uniq(_.flatten(_.values(relHashId)));
		newFilter = {};
		newFilter[relPrimaryKey] = { '$in': (hashKeys.length > 0 ? hashKeys : [ -1 ]) };

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

			// Data
			var selfAlias = '1';
			var hashAlias = [ { alias: selfAlias, key: '', model: self }, { alias: selfAlias + '$1', key: key, model: relModel } ];
			var mainQueryBuilder = knex.queryBuilder();
			var subQueryBuilder = new QueryBuilder();
			var improvedHashAlias = [ { model: self, alias: selfAlias, refAlias: selfAlias }, { model: relModel, alias: selfAlias + '$1', refAlias: relAlias } ];

			// Set query alias
			var subQueryAlias = '2';
			var mainQueryAlias = '3';

			// Set join raw
			privateMethods._addCustomJoin(subQueryBuilder ,relModel, relJoin, improvedHashAlias, selfAlias);

			// Set where clause to sub query builder
			subQueryBuilder.addColumn(selfAlias + '.' + primaryKey + ' AS id');
			subQueryBuilder.addColumn(_.findWhere(improvedHashAlias, { refAlias: relAlias }).alias + '.' + relPrimaryKey + ' AS rel_id');
    		subQueryBuilder.setHavingRaw(privateMethods._parseFilter.call(relModel, subQueryBuilder, filter, hashAlias, selfAlias + '$1'));
    		subQueryBuilder.setFromRaw('`' + tableName + '` AS `' + selfAlias + '`');

	    	// Add orderby
			subQueryBuilder.addOrderBy('`' + selfAlias + '`.`' + primaryKey + '` ASC');

			// Add grouby clause
			subQueryBuilder.addGroupByRaw('`' + selfAlias + '`.`' + primaryKey + '`');
			subQueryBuilder.addGroupByRaw('`' + _.findWhere(improvedHashAlias, { refAlias: relAlias }).alias + '`.`' + relPrimaryKey + '`');
			
			// Create main builder
		    mainQueryBuilder = mainQueryBuilder.select(subQueryAlias + '.id', knex.raw('COUNT(`' + subQueryAlias + '`.`rel_id`) AS total'));
		    mainQueryBuilder = mainQueryBuilder.from(knex.raw(subQueryBuilder.toString()).wrap('(', ') AS ' + subQueryAlias));
		    mainQueryBuilder = mainQueryBuilder.groupBy(subQueryAlias + '.id');

			// Query
			return dbConnection.query(mainQueryBuilder.toString(), function(err, queryResult) {

				// Reject if error
				if(err) return reject(err);

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Add total to hash count
					hashData[queryItem.id] = {
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

	    	// Data
		    var hashAlias = [];
		    var mainQueryBuilder = null;

		    // Create query
	    	mainQueryBuilder = relModel.createSelectQuery(filter, fields, options, hashAlias);
	    	mainQueryBuilder = mainQueryBuilder.toString();

			// Query
			dbConnection.query(mainQueryBuilder, function(err, queryResult) {

				// Reject if error
				if(err) {
					reject(err);
					return;
				}

				// Parse result
				queryResult = relModel.parseSelectResult(queryResult, hashAlias);

				// Set relHashData
				relHashData = _.clone(relHashId);

				// Loop over hash data
				_.each(relHashData, function(relHashDataValue, relHashDataKey) {
					relHashData[relHashDataKey] = _.map(relHashDataValue, function(item) {
						return _.find(queryResult, function(obj) { return obj[relPrimaryKey] === item; });
					});
				});

				// Resolve
				resolve();
				return;

			});
			return;

		});
	};

	return Promise.resolve()
		.then(getRelationshipIdsLoad)
		.then(checkArgumentsLoad)
		.then(countHashLoad)
		.then(listHashLoad)
		.then(function() {

			// Data
			var asyncQueue = Promise.resolve();

			// Loop over each data
			_.each(dataToPopulate, function(dataItem) {

				// If not empty
				if(typeof relHashData[dataItem[primaryKey]] !== "undefined") {

					// Add to data
					dataItem[key] = relHashData[dataItem[primaryKey]];

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

		// Populate hash
		return relModel.populateRelationships(hashRelationships, hashDataToPopulate, params);

	};

	// Populate virtuals in hash
	var populateVirtualsInHash = function() {

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