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
	console.log('hello')

	// Data
	var dataToParse = data;
	var asyncQueue = Promise.resolve();
	var isArray = dataToParse instanceof Array;

	var self = this;

	var structureColumns = this.getStructureColumns();
	var hasManyRelationshipsKeys = this.getRelationshipKeys(['hasMany', 'hasManyCustom', 'hasManyThrough']);
	var relationshipsKeys = this.getRelationshipKeys();
	var virtualsKeys = this.getVirtualKeys();
	var customsKeys = this.getCustomKeys();

	// Check if data to parse is an array
	if(!isArray) {
		dataToParse = [ dataToParse ];
	}

	// TODO: Recupperer cet array dans le model (en fonction de thirdparty ou non, si vide ou null ne pas filter ?)
	// TODO: Plusieurs listes displayedKeys declaré dans le model (juste 'thirdparty' pour l'instant) 
	var displayedKeys = ['name', 'email', 'vehicles'];

	// TODO: Faire la recursive pour les models en dessous etc..

    // Transform data
    _.each(dataToParse, function(dataItem) {

		console.log(dataItem)

		_.each(dataItem, function(dataValue, dataKey) {
			console.log(dataKey)

			if (
				(_.contains(structureColumns, dataKey) && !_.contains(displayedKeys, dataKey))
				|| (_.contains(virtualsKeys, dataKey) && !_.contains(displayedKeys, dataKey))
				|| (_.contains(customsKeys, dataKey) && !_.contains(displayedKeys, dataKey))
			) {
				delete dataItem[dataKey];
			} else if (_.contains(hasManyRelationshipsKeys, dataKey)) {
				if (!_.contains(displayedKeys, dataKey)) delete dataItem[dataKey];
				else dataItem[dataKey] = 'TODO: Recursive'
			} else if (_.contains(relationshipsKeys, dataKey) && !_.contains(displayedKeys, dataKey)) {
				if (!_.contains(displayedKeys, dataKey)) delete dataItem[dataKey]; 
				else dataItem[dataKey] = 'TODO: Recursive'
			}
		})


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