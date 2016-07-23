/*
* lib/skul/search.js
*
* SKuL search methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');


/*
 * Search to filter
 *
 * @params {Object} filter
 * @params {String} searchString
 * @params {Object} fields
 *
 * @return {Object}
 * @api public
 */
module.exports.searchToFilter = function(filter, searchString, fields) {

	// Data
	var parsedFields = this.parseFields(fields);
	var searchableKeys = this.getSearchableKeys();
	var searchFields = null;

	// Return filter if search string is empty
	if(typeof searchString !== 'string' || !searchString) {
		return filter;
	}

	// Populate default and available search fields
	var _populateSearchFields = function(model, fields, parentKey) {

		// Data
		var hasOneRelationships = model.getRelationships('hasOne');
		var belongsToRelationships = model.getRelationships('belongsTo');
		var hasOneRelationshipFields = model.parseRelationships('hasOne', fields);
		var belongsToRelationshipFields = model.parseRelationships('belongsTo', fields);

		// Loop over relationship hasOne fields
		_.each(hasOneRelationshipFields, function(relObj, relKey) {

			// Data
			var relModel = hasOneRelationships[relKey].model;
			var relSearchableKeys = relModel.getSearchableKeys();
			var relDefaultSearchKeys = relModel.getDefaultSearchKeys();
			var relFields = relObj['$fields'];
			var relParsedFields = relModel.parseFields(relObj['$fields']);

			// Loop over relationship available search fields
			_.each(relSearchableKeys, function(key) {
				searchableKeys.push(parentKey ? parentKey + '.' + relKey + '.' + key : relKey + '.' + key);
			});

			// If relationship fields is empty or set has $default
			if(typeof relFields !== "object" || relFields === null || Object.keys(relFields).length === 0 || relFields['$default'] === 1) {

				// Loop over relationship default search fields
				_.each(relDefaultSearchKeys, function(key) {
					parsedFields.push(parentKey ? parentKey + '.' + relKey + '.' + key : relKey + '.' + key);
				});

			}

			// If relationship fields is set has $all
			else if(relFields['$all'] === 1) {

				// Loop over relationship default search fields
				_.each(relSearchableKeys, function(key) {
					parsedFields.push(parentKey ? parentKey + '.' + relKey + '.' + key : relKey + '.' + key);
				});

			}

			// If relationship fields is not empty
			else {

				// Loop over relationship schema fields
				_.each(relParsedFields, function(key) {
					parsedFields.push(parentKey ? parentKey + '.' + relKey + '.' + key : relKey + '.' + key);
				});

			}

			// Populate relationship fields
			if(typeof relFields === "object" && relFields !== null && Object.keys(relFields).length > 0) {
				_populateSearchFields(relModel, relFields, parentKey ? parentKey + '.' + relKey : relKey);
			}

		});

		// Loop over relationship belongsTo fields
		_.each(belongsToRelationshipFields, function(relObj, relKey) {

			// Data
			var relModel = belongsToRelationships[relKey].model;
			var relSearchableKeys = relModel.getSearchableKeys();
			var relDefaultSearchKeys = relModel.getDefaultSearchKeys();
			var relFields = relObj['$fields'];
			var relParsedFields = relModel.parseFields(relObj['$fields']);

			// Loop over relationship available search fields
			_.each(relSearchableKeys, function(key) {
				searchableKeys.push(parentKey ? parentKey + '.' + relKey + '.' + key : relKey + '.' + key);
			});

			// If relationship fields is empty or set has $default
			if(typeof relFields !== "object" || relFields === null || Object.keys(relFields).length === 0 || relFields['$default'] === 1) {

				// Loop over relationship default search fields
				_.each(relDefaultSearchKeys, function(key) {
					parsedFields.push(parentKey ? parentKey + '.' + relKey + '.' + key : relKey + '.' + key);
				});

			}

			// If relationship fields is set has $all
			else if(relFields['$all'] === 1) {

				// Loop over relationship default search fields
				_.each(relSearchableKeys, function(key) {
					parsedFields.push(parentKey ? parentKey + '.' + relKey + '.' + key : relKey + '.' + key);
				});

			}

			// If relationship fields is not empty
			else {

				// Loop over relationship schema fields
				_.each(relParsedFields, function(key) {
					parsedFields.push(parentKey ? parentKey + '.' + relKey + '.' + key : relKey + '.' + key);
				});

			}

			// Populate relationship fields
			if(typeof relFields === "object" && relFields !== null && Object.keys(relFields).length > 0) {
				_populateSearchFields(relModel, relFields, parentKey ? parentKey + '.' + relKey : relKey);
			}

		});

	};

	// Populate search fields
	_populateSearchFields(this, fields);

	// Check if we search on specific fields
	var searchStringMatch = searchString.match(/^\$([a-z0-9_,.]+)\$:(.+)$/);

	// If search on specific fields
	if(searchStringMatch !== null) {

		// Set search data
		searchFields = searchStringMatch[1].split(',');
		searchString = searchStringMatch[2];

		// Check search data
		searchFieldsDiff = _.difference(searchFields, searchableKeys);

        // If some wrong fields found
        if(searchFieldsDiff.length > 0) {

            // Data
            var invalidQueryData = {};

            // For each wrong fields
            _.each(searchFieldsDiff, function(key) {
                invalidQueryData[key] = 'The field is invalid';
            });

            // Reject
            throw new __RequestException('InvalidQueryData', invalidQueryData);

        }

	}

	// If search on default fields
	else {

		// Set search data
		searchFields = parsedFields.length > 0 ? parsedFields : searchableKeys;
		searchString = searchString;

	}

	// Create new filter
	var searchFilter = { '$or': [] };

	// Loop over string
	_.each(searchFields, function(fieldItem) {

		// Data
		var whereClause = {};

		// Add to where clause
		whereClause[fieldItem] = { '$like': searchString };

		// Add to search filter
		searchFilter['$or'].push(whereClause)

	});

	// Add to filter
	if(Object.keys(filter).length === 0) {
		filter = searchFilter;
	} else {
		filter = { '$and': [ searchFilter, filter ] };
	}

	// Return
	return filter;

};