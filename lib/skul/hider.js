// Dependencies
var Promise = require('promise');
var _ = require('underscore');


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