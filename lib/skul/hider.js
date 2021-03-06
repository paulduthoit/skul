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
	var relationshipsKeys = this.getRelationshipKeys();
	var asyncQueue = Promise.resolve();

	// Check if data to parse is an array
	if(!isArray) dataToParse = [ dataToParse ];

	// Transform data
	_.each(dataToParse, function(dataItem) {
		_.each(dataItem, function(dataValue, dataKey) {

			// Delete if not displayable
			if(displayableKeys && !_.contains(displayableKeys, dataKey)) {
				delete dataItem[dataKey];
			}

			// If relationship
			else if(_.contains(relationshipsKeys, dataKey) && dataItem[dataKey] !== null && typeof dataItem[dataKey] === 'object') {

				// Set data
				var relItem = self.getRelationship(dataKey);
				var relModel = objectPath.get(relItem, ['model', '$model']) || objectPath.get(relItem, ['model']) || null;
				var relTypeIsOneToMany = _.contains(['hasMany', 'hasManyCustom', 'hasManyThrough'], relItem.type);
				var relData = relTypeIsOneToMany ? objectPath.get(dataItem, [dataKey, 'data']) : objectPath.get(dataItem, [dataKey]);

				// Stop if no model
				if(!relModel) return;

				// Add to queue
				asyncQueue = asyncQueue
					.then(relModel.hideFields.bind(relModel, relData, params))
					.then(function() {
						return Promise.resolve();
					});

			}

		});
	});

    // Run queue
    return (
    	asyncQueue
    	.then(function() {
		    if(isArray) return Promise.resolve(dataToParse);
		    else return Promise.resolve(dataToParse[0]);
    	})
    );

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
			var relItem = self.getRelationship(dataKey);
			var relModel = objectPath.get(relItem, ['model', '$model']) || objectPath.get(relItem, ['model']) || null;

			// Clean not requested fields
			if(!(fields[dataKey] || (fields['$all'] && _.contains(allKeys, dataKey)))) return delete dataItem[dataKey];

			// If relationship
			if(relModel) {

				// Data
				var relFields = {};
				var relTypeIsOneToMany = _.contains(['hasMany', 'hasManyCustom', 'hasManyThrough'], relItem.type);
				var relData = relTypeIsOneToMany ? objectPath.get(dataItem, [dataKey, 'data']) : objectPath.get(dataItem, [dataKey]);

				// Stop if no data
				if(!relData) return;

				// Set fields
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