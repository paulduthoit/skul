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
module.exports.populateVirtuals = function(fields, data) {

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
	    	if(typeof virtualFieldValue === 'object' && typeof virtualFieldValue['$fields'] === 'object') {

	    		// Data
	    		var relModel = virtualFieldValue['$model'];
	    		var relFields = virtualFieldValue['$fields'];
	    		var relData = [ dataItem[virtualFieldKey] ];

	    		// Populate relationship virtuals
	    		asyncQueue = asyncQueue
	    			.then(relModel.populateVirtuals.bind(relModel, relFields, relData));

	    	} else {

	    		// Data
	    		var transformResult = virtuals[virtualFieldKey].transform.call(null, dataItem);

		    	// If transform is async
		    	if(transformResult instanceof Promise) {

		    		// Add to queue
		    		asyncQueue = asyncQueue
		    			.then(transformResult)
		    			.then(function(result) {

		    				// Set result transform
		    				dataItem[virtualFieldKey] = result;

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
	var primaryKey = self.primaryKey;
	var relationship = self.relationships[key];
	var relModel = relationship.model;
	var relTableName = relModel.getTableName();
	var relForeignKey = relationship.foreignKey;
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
		return dataItem[primaryKey];
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
		return relModel.checkFilter(filter, fields, params)
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

		// Return promise
	    return new Promise(function(resolve, reject) {

	    	// Data
		    var hashAlias = [];
	    	var queryBuilder = relModel.createCountQuery(filter, fields, options, hashAlias);
	    		queryBuilder.addColumn('A.' + relForeignKey + ' AS A$' + relForeignKey);
	    		queryBuilder.addGroupBy('`A$' + relForeignKey + '`');

			// Query
			dbConnection.query(queryBuilder.toString(), function(err, queryResult) {

				// Reject if error
				if(err) {
					reject(err);
					return;
				}

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Change total
					queryItem['A$total'] = queryItem.total;
					delete queryItem.total;

				});

				// Parse result
				queryResult = relModel.parseSelectResult(queryResult, hashAlias);

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
				resolve();
				return;

			});
			return;

		});

	};

	// Reset variables
	var resetVariablesLoad = function() {

		// Return promise
	    return new Promise(function(resolve, reject) {

	    	// Data
	    	var sqlQueryString = "SET @num := 0, @foreign := '';";

			// Query
			dbConnection.query(sqlQueryString, function(err) {

				// Reject if error
				if(err) {
					reject(err);
					return;
				}

				// Resolve
				resolve();
				return;

			});
			return;

		});

	};

	// List hash
	var listHashLoad = function() {

		// Return promise
	    return new Promise(function(resolve, reject) {

	    	// Data
		    var hashAlias = [];
		    var mainQuery = knex.queryBuilder();
		    var subQuery = null;

		    // Create sub query
	    	subQuery = relModel.createSelectQuery(filter, fields, options, hashAlias);

	    	// Add relationship foreign key if needed
	    	if(!_.contains(hashFields, relForeignKey)) {
	    		subQuery.addColumn('A.' + relForeignKey + ' AS A$' + relForeignKey);
	    	}

	    	// Add variable increments
	    	subQuery.addColumn(knex.raw('@num := IF(@foreign = `A`.`' + relForeignKey + '`, @num + 1, 0) AS row_number'));
	    	subQuery.addColumn(knex.raw('@foreign := `A`.`' + relForeignKey + '` AS dummy'));

		    // Remove all offset and limit statement
		    subQuery.setLimit(null);
		    subQuery.setOffset(null);

	    	// Add orderby
			subQuery = subQuery.addOrderBy('`A`.`' + relForeignKey + '` ASC');

		    // Move last query statement
		    // var lastQueryStatement = subQuery._statements.pop();   /////////// CAN BE A BUG /////////
		    // subQuery._statements.unshift(lastQueryStatement);

		    // Create main query
		    mainQuery = mainQuery.select();
		    mainQuery = mainQuery.from(knex.raw(subQuery.toString()).wrap('(', ') AS B'));
			mainQuery = mainQuery.whereRaw('row_number >= ' + options.skip + ' AND row_number < ' + (options.skip + options.limit));
	    	
	    	// To string
	    	mainQuery = mainQuery.toString();

			// Query
			dbConnection.query(mainQuery, function(err, queryResult) {

				// Reject if error
				if(err) {
					reject(err);
					return;
				}

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
				resolve();
				return;

			});
			return;

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
		return relModel.populateVirtuals(hashVirtuals, hashDataToPopulate);

	};

	// Return promises
	return checkArgumentsLoad()
		.then(countHashLoad)
		.then(resetVariablesLoad)
		.then(listHashLoad)
		.then(populateRelationshipsInHash)
		.then(populateVirtualsInHash)
		.then(function() {

			// Loop over each data
			_.each(dataToPopulate, function(dataItem) {

				// Add models
				if(typeof hashData[dataItem[primaryKey]] !== "undefined") {
					dataItem[key] = hashData[dataItem[primaryKey]];
				} else {
					dataItem[key] = {
						limit: options.limit,
						skip: options.skip,
						orderby: options.orderby instanceof Array && options.orderby.length === 1 ? options.orderby[0] : options.orderby,
						total: 0,
						data: []
					};
				}

			});

			// Resolve
			return Promise.resolve(data);

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

	// Reset variables
	var resetVariablesLoad = function() {

		// Return promise
	    return new Promise(function(resolve, reject) {

	    	// Data
	    	var sqlQueryString = "SET @num := 0, @foreign := '';";

			// Query
			dbConnection.query(sqlQueryString, function(err) {

				// Reject if error
				if(err) {
					reject(err);
					return;
				}

				// Resolve
				resolve();
				return;

			});
			return;

		});

	};

	// Get relationship ids
	var getRelationshipIdsLoad = function() {

		// Return promise
		return new Promise(function(resolve, reject) {

			// Data
			var selfAlias = 'A';
			var hashAlias = [ { alias: 'A', key: '', model: self }, { alias: 'A$1', key: key, model: relModel } ];
			var improvedHashAlias = [ { model: self, alias: selfAlias, refAlias: selfAlias }, { model: relModel, alias: 'A$1', refAlias: relAlias } ];
			var mainQueryBuilder = knex.queryBuilder();
			var subQueryBuilder = knex.queryBuilder();
			var subQueryBuilder2 = new QueryBuilder();

			// Set join raw
			privateMethods._addCustomJoin(subQueryBuilder2 ,relModel, relJoin, improvedHashAlias, selfAlias);

			// Set sub query builder
			subQueryBuilder2.addColumn(selfAlias + '.' + primaryKey + ' AS id');
			subQueryBuilder2.addColumn(_.findWhere(improvedHashAlias, { refAlias: relAlias }).alias + '.' + relPrimaryKey + ' AS rel_id');
    		subQueryBuilder2.setWhereRaw(privateMethods._parseFilter.call(relModel, subQueryBuilder2, filter, hashAlias, 'A$1'));
			subQueryBuilder2.setFromRaw('`' + tableName + '` AS `' + selfAlias + '`');

	    	// Add orderby
			subQueryBuilder2.addOrderBy('`' + selfAlias + '`.`' + primaryKey + '` ASC');

			// Add grouby clause
			subQueryBuilder2.addGroupBy('`' + selfAlias + '`.`' + primaryKey + '`');
			subQueryBuilder2.addGroupBy('`' + _.findWhere(improvedHashAlias, { refAlias: relAlias }).alias + '`.`' + relPrimaryKey + '`');

	    	// Create sub query
	    	subQueryBuilder = subQueryBuilder.select('B.id', 'B.rel_id');
	    	subQueryBuilder = subQueryBuilder.select(knex.raw('@num := IF(@foreign = `B`.`id`, @num + 1, 0) AS row_number'));
	    	subQueryBuilder = subQueryBuilder.select(knex.raw('@foreign := `B`.`id` AS dummy'));
		    subQueryBuilder = subQueryBuilder.from(knex.raw(subQueryBuilder2.toString()).wrap('(', ') AS B'));
			
			// Create main builder
		    mainQueryBuilder = mainQueryBuilder.select('C.id', 'C.rel_id');
		    mainQueryBuilder = mainQueryBuilder.from(knex.raw(subQueryBuilder.toString()).wrap('(', ') AS C'));
			mainQueryBuilder = mainQueryBuilder.whereRaw('`C`.`row_number` >= ' + options.skip + ' AND `C`.`row_number` < ' + (options.skip + options.limit));

			console.log(mainQueryBuilder.toString());

			// Query
			return dbConnection.query(mainQueryBuilder.toString(), function(err, queryResult) {

				// Reject if error
				if(err) return reject(err);

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
		return relModel.checkFilter(filter, fields, params)
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

		// Return promise
		return new Promise(function(resolve, reject) {

			// Data
			var selfAlias = 'A';
			var hashAlias = [ { alias: 'A', key: '', model: self }, { alias: 'A$1', key: key, model: relModel } ];
			var mainQueryBuilder = knex.queryBuilder();
			var subQueryBuilder = new QueryBuilder();
			var improvedHashAlias = [ { model: self, alias: selfAlias, refAlias: selfAlias }, { model: relModel, alias: 'A$1', refAlias: relAlias } ];

			// Set join raw
			privateMethods._addCustomJoin(subQueryBuilder ,relModel, relJoin, improvedHashAlias, selfAlias);

			// Set where clause to sub query builder
			subQueryBuilder.addColumn(selfAlias + '.' + primaryKey + ' AS id');
			subQueryBuilder.addColumn(_.findWhere(improvedHashAlias, { refAlias: relAlias }).alias + '.' + relPrimaryKey + ' AS rel_id');
    		subQueryBuilder.setWhereRaw(privateMethods._parseFilter.call(relModel, subQueryBuilder, filter, hashAlias, 'A$1'));
    		subQueryBuilder.setFromRaw('`' + tableName + '` AS `' + selfAlias + '`');

	    	// Add orderby
			subQueryBuilder.addOrderBy('`' + selfAlias + '`.`' + primaryKey + '` ASC');

			// Add grouby clause
			subQueryBuilder.addGroupBy('`' + selfAlias + '`.`' + primaryKey + '`');
			subQueryBuilder.addGroupBy('`' + _.findWhere(improvedHashAlias, { refAlias: relAlias }).alias + '`.`' + relPrimaryKey + '`');
			
			// Create main builder
		    mainQueryBuilder = mainQueryBuilder.select('B.id', knex.raw('COUNT(`B`.`rel_id`) AS total'));
		    mainQueryBuilder = mainQueryBuilder.from(knex.raw(subQueryBuilder.toString()).wrap('(', ') AS B'));
		    mainQueryBuilder = mainQueryBuilder.groupBy('B.id');

			console.log(mainQueryBuilder.toString());

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

		// Return promise
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

	return resetVariablesLoad()
		.then(getRelationshipIdsLoad)
		.then(checkArgumentsLoad)
		.then(countHashLoad)
		.then(listHashLoad)
		.then(function() {

			// Loop over each data
			_.each(dataToPopulate, function(dataItem) {

				// Add models
				if(typeof relHashData[dataItem[primaryKey]] !== "undefined") {
					dataItem[key] = relHashData[dataItem[primaryKey]];
				} else {
					dataItem[key] = {
						limit: options.limit,
						skip: options.skip,
						orderby: options.orderby instanceof Array && options.orderby.length === 1 ? options.orderby[0] : options.orderby,
						total: 0,
						data: []
					};
				}

			});

			// Resolve
			return Promise.resolve(data);

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

	// Get hash data to populate
	_.each(dataToPopulate, function(dataItem) {

		// Push data to hash if exists
		if(typeof dataItem[key] === "object") {
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
		return relModel.populateVirtuals(hashVirtuals, hashDataToPopulate);

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