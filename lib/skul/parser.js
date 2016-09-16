/*
* lib/skul/parser.js
*
* SKuL parser methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');
var objectPath = require('object-path');
var QueryException = require('./exceptions/query');


/*
 * Parse fields
 *
 * @params {Object} fields
 *
 * @return {Array}
 * @api public
 */
module.exports.parseFields = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fieldPath have to be an object");

	// Data
	var parsedFields = [];
    var invalidQueryData = {};
	var defaultKeys = this.getDefaultKeys();
	var availableKeys = this.getAvailableKeys();
	var customKeys = this.getCustomKeys();
	var virtuals = this.getVirtuals();
	var virtualKeys = this.getVirtualKeys();
	var allRelationshipKeys = this.getRelationshipKeys();
	var belongsToRelationshipKeys = this.getRelationshipKeys('belongsTo');
	var belongsToRelationships = this.getRelationships('belongsTo');

	// Check if fields is empty
	if(Object.keys(fields).length === 0) {
		fields = { '$default': 1 };
	}

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If $all
		if(key === '$all' && obj === 1) {
			parsedFields = parsedFields.concat(availableKeys);
		}

		// If $all
		else if(key === '$default' && obj === 1) {
			parsedFields = parsedFields.concat(defaultKeys);
		}

		// If requested field is a virtual field
		else if(obj !== 0 && _.contains(virtualKeys, key)) {
			parsedFields = parsedFields.concat(_.keys(virtuals[key].requiredKeys));
		}

		// If requested field is an available field
		else if(obj !== 0 && !_.contains(allRelationshipKeys, key) && !_.contains(customKeys, key) && _.contains(availableKeys, key)) {
			parsedFields.push(key);
		}

		// If requested field is a belongsTo relationship
		else if(obj !== 0 && _.contains(belongsToRelationshipKeys, key)) {
			parsedFields.push(belongsToRelationships[key].foreignKey);
		}

		// If requested field is an invalid field
		else if(obj !== 0 && !_.contains(allRelationshipKeys, key) && !_.contains(customKeys, key) && !_.contains(availableKeys, key)) {
			invalidQueryData[key] = 'The field doesn\'t exist';
		}

	});

	// Reject if has some invalid fields
	if(Object.keys(invalidQueryData).length > 0) {
        throw new QueryException('InvalidQueryData', invalidQueryData);
	}

	// Avoid duplicate fields
	parsedFields = _.uniq(parsedFields);

	// Check if primary key is present
	if(!_.contains(parsedFields, this.primaryKey) && this.primaryKey !== "") {
		parsedFields.unshift(this.primaryKey);
	}

	// Return parsed fields
	return parsedFields;

};



/*
 * Parse virtuals
 *
 * @params {Object} fields
 *
 * @return {Object}
 * @api public
 */
module.exports.parseVirtuals = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fields have to be an object");

	// Data
	var parsedFields = {};
	var defaultKeys = this.getDefaultKeys();
	var availableKeys = this.getAvailableKeys();
	var virtualKeys = this.getVirtualKeys();
	var belongsToRelationshipKeys = this.getRelationshipKeys('belongsTo');
	var belongsToRelationships = this.getRelationships('belongsTo');

	// Check if fields is empty
	if(Object.keys(fields).length === 0) {
		fields = { '$default': 1 };
	}

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If key is a virtual field
		if(!_.contains([ '$all, $default' ], key) && _.contains(virtualKeys, key) && obj !== 0) {
			parsedFields[key] = obj;
		}

		// If key is a relationship field
		else if(!_.contains([ '$all, $default' ], key) && _.contains(belongsToRelationshipKeys, key) && obj !== 0) {

			// Data
			var relModel = belongsToRelationships[key].model;
			var relVirtuals = relModel.parseVirtuals(obj['$fields'] || {});

			// Add to parsed fields
			parsedFields[key] = { '$fields': {}, '$model': relModel };

			// Loop over reltionship virtuals
			_.each(relVirtuals, function(virtualObj, virtualKey) {

				// Add to parsed fields
				parsedFields[key]['$fields'][virtualKey] = virtualObj;

			});

		}

		// If key is $default
		else if(key === '$default' && _.intersection(defaultKeys, virtualKeys).length > 0) {

			// Loop over each intersection between defaults and virtuals
			_.each(_.intersection(defaultKeys, virtualKeys), function(fieldKey) {
				parsedFields[fieldKey] = obj;
			});
			
		}

		// If key is $all
		else if(key === '$all' && _.intersection(availableKeys, virtualKeys).length > 0) {

			// Loop over each intersection between availables and virtuals
			_.each(_.intersection(availableKeys, virtualKeys), function(fieldKey) {
				parsedFields[fieldKey] = obj;
			});

		}

	});

	// Return parsed fields
	return parsedFields;

};



/*
 * Parse customs
 *
 * @params {Object} fields
 *
 * @return {Array}
 * @api public
 */
module.exports.parseCustoms = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fields have to be an object");

	// Data
	var parsedFields = {};
	var customs = this.getCustoms();
	var customKeys = this.getCustomKeys();
	var defaultKeys = this.getDefaultKeys();
	var defaultCustomKeys = _.intersection(customKeys, defaultKeys);

	// Check if fields is empty
	if(Object.keys(fields).length === 0) {
		fields = { '$default': 1 };
	}

	// Loop over fields keys
	_.each(fields, function(fieldObj, fieldKey) {

		// If $all
		if(fieldKey === '$all' && fieldObj === 1) {
			_.each(customKeys, function(key) {
				parsedFields[key] = customs[key];
			});
		}

		// If $all
		else if(fieldKey === '$default' && fieldObj === 1) {
			_.each(defaultCustomKeys, function(fieldKey) {
				parsedFields[key] = customs[key];
			});
		}

		// If requested field is an available custom field
		else if(fieldObj !== 0 && _.contains(customKeys, fieldKey)) {
			parsedFields[fieldKey] = customs[fieldKey];
		}

	});

	// Return parsed fields
	return parsedFields;

};



/*
 * Parse relationships
 *
 * @params {Object} fields
 *
 * @return {Object}
 * @api public
 */
module.exports.parseRelationships = function(type, fields) {

	// Check arguments
	if(arguments.length === 1) {
		fields = type;
		type = undefined;
	}

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'hasMany', 'hasOne', 'belongsTo' ], type)) && typeof type !== "undefined")
		throw new Error("type have to be a string defined as hasMany, hasOne or belongsTo");
	if(typeof fields !== "object")
		throw new Error("fieldPath have to be an object");

	// Data
	var parsedFields = {};
	var relationshipKeys = this.getRelationshipKeys(type);

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If key is a relationship field
		if(!_.contains([ '$all, $default' ], key) && _.contains(relationshipKeys, key) && obj !== 0) {
			parsedFields[key] = obj;
		}

	});

	// Return parsed fields
	return parsedFields;

};



/*
 * Parse select options
 *
 * @params {Object} options
 *
 * @return {Object}
 * @api public
 */
module.exports.parseSelectOptions = function(options) {

    // Check arguments length
    if(arguments.length === 0) {
        options = {};
    }

    // Transform arguments
    if(options === null || typeof options === "undefined") options = {};

    // Check arguments
    if(!_.isObject(options))
        throw new Error('options have to be an object');

    // Data
    var self = this;

    // Get skip
    if(_.isUndefined(options.skip)) {
        if(!_.isUndefined(this.defaultSelectOptions.skip) && this.defaultSelectOptions.skip !== null) {
            options.skip = this.defaultSelectOptions.skip;
        } else {
            options.skip = null;
        }   
    }

    // Get limit
    if(_.isUndefined(options.limit)) {
        if(!_.isUndefined(this.defaultSelectOptions.limit) && this.defaultSelectOptions.limit !== null) {
            options.limit = this.defaultSelectOptions.limit;
        } else {
            options.limit = null;
        }
    }

    // Get orderby
    if(_.isUndefined(options.orderby)) {
        if(!_.isUndefined(this.defaultSelectOptions.orderby) && this.defaultSelectOptions.orderby !== null) {
            options.orderby = this.defaultSelectOptions.orderby;
        } else {
            options.orderby = null;
        }
    }

    // If orderby is not empty
    if(options.orderby !== null) {

    	// If orderby is not an array
    	if(!(options.orderby instanceof Array)) {
    		options.orderby = [ options.orderby ];
    	}

    	// Data
    	var _getAvailableKeysLvl = 0;
    	var maxAvailableKeysLvl = _.max(_.map(options.orderby, function(value) { return value.split('.').length; }));

    	// Get available fields
    	var _getAvailableKeys = function(model) {

    		// Increment field lvl
    		_getAvailableKeysLvl++;

    		// Data
    		var availableKeys = [];

    		// Get main available fields
    		var mainAvailableKeys = model.getAvailableKeys();
    		var mainCustomKeys = model.getCustomKeys();

    		// Add main and custom fields
    		availableKeys = availableKeys.concat(mainAvailableKeys, mainCustomKeys);

    		// Check lvl
    		if(_getAvailableKeysLvl > maxAvailableKeysLvl) {
    			_getAvailableKeysLvl--;
    			return;
    		}

    		// Add relationship belongsTo fields
    		var belongsToRelationships = model.getRelationships('belongsTo');

    		// Loop over relationships
    		_.each(belongsToRelationships, function(rel, key) {

    			// Get relationship available fields
    			var relAvailableKeys = _getAvailableKeys(rel.model);
    				relAvailableKeys = _.map(relAvailableKeys, function(obj) { return key + '.' + obj; });

    			// Add relationship available fields
    			availableKeys = availableKeys.concat(relAvailableKeys);

    		});

    		// Add relationship hasOne fields
    		var hasOneRelationships = model.getRelationships('hasOne');

    		// Loop over relationships
    		_.each(hasOneRelationships, function(rel, key) {

    			// Get relationship available fields
    			var relAvailableKeys = _getAvailableKeys(rel.model);
    				relAvailableKeys = _.map(relAvailableKeys, function(obj) { return key + '.' + obj; });

    			// Add relationship available fields
    			availableKeys = availableKeys.concat(relAvailableKeys);

    		});

    		// Decrement field lvl
    		_getAvailableKeysLvl--;

    		// Return available fields
    		return availableKeys;

    	};

    	// Get available fields
    	var availableKeys = _getAvailableKeys(self);

        // Check orderby
        var orderByWrongKeys = _.difference(_.map(options.orderby, function(value) { return value.replace(/^\-/, ''); }), availableKeys);

        // If some wrong fields found
        if(orderByWrongKeys.length > 0) {

            // Data
            var invalidQueryData = {};

            // For each wrong fields
            _.each(orderByWrongKeys, function(key) {
                invalidQueryData[key] = 'The field doesn\'t exist';
            });

            // Reject
            throw new QueryException('InvalidQueryData', invalidQueryData);

        }

    }

    // Return options
    return options;
	
};



/*
 * Parse select result
 *
 * @params {Array} data
 * @params {Array} hashAlias
 * @params {Boolean} isFlatten
 *
 * @return {Array}
 * @api public
 */
module.exports.parseSelectResult = function(data, hashAlias, isFlatten) {

	// Data
	var dataToParse = data;
	var isArray = dataToParse instanceof Array;

	// Check if data to parse is an array
	if(!isArray) {
		dataToParse = [ dataToParse ];
	}

    // Transform data
    dataToParse = _.map(dataToParse, function(dataItem) {

        // Data
        var transformedDataItem = {};
        var nullNested = [];

        // Loop over data item fields
        _.each(dataItem, function(dataItemValue, dataItemKey) {

            // Data
            var splitedKey = dataItemKey.split('$');
            var fieldName = splitedKey.pop();
            var fieldAlias = (_.find(hashAlias, function(obj) { return obj.alias === splitedKey.join('$'); }) || {});
            var fieldBase = fieldAlias.key;
            var fieldModel = fieldAlias.model;
            var fieldModelPrimaryKey = fieldModel.getPrimaryKey();
            var fieldPath = _.reject([ fieldBase, fieldName ], function(obj) { return obj === ''; }).join('.');

            // Check if primary is empty
            if(fieldName === fieldModelPrimaryKey && dataItemValue === null && !_.contains(nullNested, fieldBase)) {
            	nullNested.push(fieldBase);
            }

            // Set transformed data
            if(isFlatten) {
            	transformedDataItem[fieldPath] = dataItemValue;
            } else {
            	objectPath.set(transformedDataItem, fieldPath, dataItemValue);
            }

        });

        // Loop over null nested
        _.each(nullNested, function(nestedItem) {
        	if(typeof objectPath.get(transformedDataItem, nestedItem) !== "undefined") {
        		objectPath.set(transformedDataItem, nestedItem, null);
        	}
        });

        // Return transformed data
        return transformedDataItem;

    });

    // Return data
    if(isArray) {
    	return dataToParse;
    } else {
    	return dataToParse[0];
    }

};