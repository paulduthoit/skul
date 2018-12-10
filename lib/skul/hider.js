// Dependencies
var Promise = require('promise');
var _ = require('underscore');


/**
 * Hide fields
 *
 * @params {Object} fields
 * @params {Array|Object} data
 *
 * @api public
 */
module.exports.hideFields = function(fields, data, params) {

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
	var dataToParse = data;
	var asyncQueue = Promise.resolve();
	var isArray = dataToParse instanceof Array;

	var self = this;
	var displayedKeys = this.getDisplayedKeys(params.auth);
	var structureColumns = this.getStructureColumns();
	var hasManyRelationshipsKeys = this.getRelationshipKeys(['hasMany', 'hasManyCustom', 'hasManyThrough']);
	var relationshipsKeys = this.getRelationshipKeys();
	var virtualsKeys = this.getVirtualKeys();
	var customsKeys = this.getCustomKeys();

	// Check if data to parse is an array
	if(!isArray) {
		dataToParse = [ dataToParse ];
	}
	
	// Only hide keys if displayedKeys != null
	if (displayedKeys) {

		  // Transform data
		  _.each(dataToParse, function(dataItem) {
			_.each(dataItem, function(dataValue, dataKey) {

				if (
					(_.contains(structureColumns, dataKey) && !_.contains(displayedKeys, dataKey))
					|| (_.contains(virtualsKeys, dataKey) && !_.contains(displayedKeys, dataKey))
					|| (_.contains(customsKeys, dataKey) && !_.contains(displayedKeys, dataKey))
				) {
					delete dataItem[dataKey];
				} else if (_.contains(hasManyRelationshipsKeys, dataKey) || _.contains(relationshipsKeys, dataKey)) {
					if (!_.contains(displayedKeys, dataKey)) delete dataItem[dataKey];
					else if (typeof dataItem[dataKey] === 'object') {

						// Data
						var relModel = self.getRelationship(dataKey);
						var relData = dataItem[dataKey].data || dataItem[dataKey];

 						if (relModel && relModel.model) {
							relModel = relModel.model;

							asyncQueue = asyncQueue
								.then(relModel.hideFields.bind(relModel, fields, relData, params))
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