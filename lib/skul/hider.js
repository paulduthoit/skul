/**
 * lib/skul/hider.js
 *
 * SKuL hider methods
 *
 * Author: Paul Duthoit, Nicolas Thouchkaieff
 * Copyright(c) 2018 Paul Duthoit
 */

// Dependencies
var Promise = require('promise');
var _ = require('underscore');
var objectPath = require('object-path');


/**
 * Hide fields
 *
 * @params {Array|Object} data
 * @params {Object} [params]
 *
 * @api public
 */
module.exports.hideFields = function(data, params) {

	// Check arguments length
    if(arguments.length === 1) {
        params = {};
    }

    // Transform arguments
    if(typeof params === 'undefined' || params === null) params = {};

	// Check arguments
	if(!(data instanceof Array || typeof data === 'object'))
		throw new Error('data have to be an array or an object');
	if(!(typeof params === 'object'))
		throw new Error('params have to be an object');

	// Set data
	var self = this;
	var dataToParse = data;
	var isArray = dataToParse instanceof Array;
	var displayableKeys = this.getDisplayableKeys(params, true);
	var structureColumns = this.getStructureColumns();
	var hasManyRelationshipsKeys = this.getRelationshipKeys(['hasMany', 'hasManyCustom', 'hasManyThrough']);
	var relationshipsKeys = this.getRelationshipKeys();
	var virtualsKeys = this.getVirtualKeys();
	var customsKeys = this.getCustomKeys();
	var asyncQueue = Promise.resolve();

	// Check if data to parse is an array
	if(!isArray) {
		dataToParse = [ dataToParse ];
	}

	// Only hide keys if displayableKeys != null
	if(displayableKeys) {

		  // Transform data
		  _.each(dataToParse, function(dataItem) {
			_.each(dataItem, function(dataValue, dataKey) {

				if (
					(_.contains(structureColumns, dataKey) && !_.contains(displayableKeys, dataKey))
					|| (_.contains(virtualsKeys, dataKey) && !_.contains(displayableKeys, dataKey))
					|| (_.contains(customsKeys, dataKey) && !_.contains(displayableKeys, dataKey))
				) {
					delete dataItem[dataKey];
				} else if (_.contains(hasManyRelationshipsKeys, dataKey) || _.contains(relationshipsKeys, dataKey)) {
					if (!_.contains(displayableKeys, dataKey)) delete dataItem[dataKey];
					else if (dataItem[dataKey] != null && typeof dataItem[dataKey] === 'object') {

						// Data
						var relModel = self.getRelationship(dataKey);
						var relData = dataItem[dataKey].data || dataItem[dataKey];

 						if (relModel && relModel.model) {
							if (relModel.model['$model'] && typeof relModel.model['$model'] === 'object') relModel = relModel.model['$model'];
							else relModel = relModel.model;

							// Add to queue
							asyncQueue = asyncQueue
								.then(relModel.hideFields.bind(relModel, relData, params))
								.then(function() {
									return Promise.resolve();
								});
								
						}
					}
				}
			})
	
	
		});
	}

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
 * Clean fields
 *
 * @params {Array|Object} data
 * @params {Object} {fields} [fields]
 *
 * @api public
 */
module.exports.cleanFields = function(data, fields) {

    // Transform arguments
	if(typeof fields === 'undefined' || fields === null || _.isEmpty(fields)) fields = { '$all': 1 };

	// Check arguments
	if(!(data instanceof Array || typeof data === 'object')) throw new Error('data have to be an array or an object');
	if(!(typeof fields === 'object')) throw new Error('fields have to be an object');

	// Set data
	var self = this;
	var dataToParse = data;
	var isArray = dataToParse instanceof Array;
	var allKeys = this.getStructureColumns();
	var asyncQueue = Promise.resolve();

	// Transform data
	if(!isArray) dataToParse = [ dataToParse ];

	// Transform data
	_.each(dataToParse, function(dataItem) {
		_.each(dataItem, function(dataValue, dataKey) {

			// Set data
			var relModel = self.getRelationship(dataKey);
				relModel = objectPath.get(relModel, ['model', '$model']) || objectPath.get(relModel, ['model']) || null;

			// Clean not requested fields
			if(!(fields[dataKey] || (fields['$all'] && _.contains(allKeys, dataKey)))) return delete dataItem[dataKey];

			// If relationship
			if(relModel) {

				// Data
				var relFields = {};
				var relData = objectPath.get(dataItem, [dataKey, 'data']) || objectPath.get(dataItem, [dataKey]);

				if(fields[dataKey] == 1) relFields = { '$all': 1 };
				else if(typeof fields[dataKey] === 'object' && fields[dataKey]['$fields']) relFields = fields[dataKey]['$fields'];

				// Add to queue
				asyncQueue = asyncQueue
					.then(relModel.cleanFields.bind(relModel, relData, relFields))
					.then(function() {
						return Promise.resolve();
					});

			}

		});
	});
		
    // Add to queue
    asyncQueue = asyncQueue
    	.then(function() {
		    if(isArray) return Promise.resolve(dataToParse);
		    else return Promise.resolve(dataToParse[0]);
    	});

    // Return async queue
    return asyncQueue;

};