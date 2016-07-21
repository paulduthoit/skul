/*
* lib/skul/index.js
*
* SKuL library
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var Promise = require('promise');
var _ = require('underscore');
var knex = require('knex')({ client: 'mysql' });
var objectPath = require('object-path');


/*
 * Skul constructor
 *
 * @params {Object} dbConnection
 * @params {String} tableName
 * @params {Object} [schema]
 *
 * @api public
 */
var Skul = function(dbConnection, tableName, schema) {

	// Check arguments length
	if(arguments.length === 2) {
		schema = {};
	}

	// Transform arguments
	if(typeof schema === "undefined" || schema === null) schema = {};

	// Check arguments
	if(typeof dbConnection !== "object")
		throw new Error("dbConnection have to be an object");
	if(typeof tableName !== "string")
		throw new Error("tableName have to be a string");
	if(typeof schema !== "object")
		throw new Error("schema have to be an object");

	// Data
	var primaryKey = 'id';
	var orderby = {};
	var customFields = {};

	// Check if primary key is defined is the schema
	_.each(schema, function(obj, key) {
		if(obj.primaryKey) {
			primaryKey = key;
		} else if(obj.custom) {
			customFields[key] = obj;
		}
	});

	// Set instance data
	this.dbConnection = dbConnection;
	this.tableName = tableName;
	this.primaryKey = primaryKey;
	this.relationships = {};
	this.virtuals = {};
	this.schema = schema;
	this.customFields = customFields;
	this.defaultSearchFields = [];
	this.defaultListOptions = {
		skip: 0,
		limit: 20,
		orderby: null
	};
	this.filterAdder = null;
	this.permissionChecker = {};

};


// Instances data
Skul.prototype.dbConnection;
Skul.prototype.tableName;
Skul.prototype.primaryKey;
Skul.prototype.relationships;
Skul.prototype.virtuals;
Skul.prototype.schema;
Skul.prototype.customFields;
Skul.prototype.defaultSearchFields;
Skul.prototype.defaultListOptions;
Skul.prototype.filterAdder;
Skul.prototype.permissionChecker;



/*
 * Add relationship
 *
 * @params {String} type
 * @params {String} fieldPath
 * @params {Object} relationship
 *
 * @api public
 */
Skul.prototype.addRelationship = function(type, fieldPath, relationship) {

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'hasMany', 'hasOne', 'belongsTo' ], type)))
		throw new Error("type have to be a string defined as hasMany, hasOne or belongsTo");
	if(typeof fieldPath !== "string")
		throw new Error("fieldPath have to be a string");
	if(typeof relationship !== "object")
		throw new Error("relationship have to be an object");

	// If type is hasMany
	if(type === "hasMany") {

		// Check relationship argument
		if(!(relationship.model instanceof Skul))
			throw new Error("relationship.model have to be a Skul object");
		if(typeof relationship.foreignKey !== "string")
			throw new Error("relationship.foreignKey have to be a string");

	}

	// If type is hasOne
	else if(type === "hasOne") {

		// Check relationship argument
		if(!(relationship.model instanceof Skul))
			throw new Error("relationship.model have to be a Skul object");
		if(typeof relationship.foreignKey !== "string")
			throw new Error("relationship.foreignKey have to be a string");

	}

	// If type is belongsTo
	else if(type === "belongsTo") {

		// Check relationship argument
		if(!(relationship.model instanceof Skul))
			throw new Error("relationship.model have to be a Skul object");
		if(typeof relationship.foreignKey !== "string")
			throw new Error("relationship.foreignKey have to be a string");

	}

	// Set relationship
	this.relationships[fieldPath] = relationship;
	this.relationships[fieldPath].type = type;

};

/*
 * Add relationship (hasOne)
 *
 * @params {String} fieldPath
 * @params {Object} relationship
 *
 * @api public
 */
Skul.prototype.hasOne = function(fieldPath, relationship) {

	// Add relationship
	this.addRelationship('hasOne', fieldPath, relationship);

};

/*
 * Add relationship (hasMany)
 *
 * @params {String} fieldPath
 * @params {Object} relationship
 *
 * @api public
 */
Skul.prototype.hasMany = function(fieldPath, relationship) {

	// Add relationship
	this.addRelationship('hasMany', fieldPath, relationship);

};

/*
 * Add relationship (belongsTo)
 *
 * @params {String} fieldPath
 * @params {Object} relationship
 *
 * @api public
 */
Skul.prototype.belongsTo = function(fieldPath, relationship) {

	// Add relationship
	this.addRelationship('belongsTo', fieldPath, relationship);

};

/**
 * Get relationships
 *
 * @params {string} [type]
 *
 * @return {Object} relationships
 * @api public
 */
Skul.prototype.getRelationships = function(type) {

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'hasMany', 'hasOne', 'belongsTo' ], type) && typeof type !== "undefined"))
		throw new Error("type have to be a string defined as hasMany, hasOne or belongsTo");

	// If type is defined
	if(type) {

		// Data
		var requestedRelationships = {};

		// Loop over relationships
		_.each(this.relationships, function(obj, key) {

			// If requested type
			if(obj.type === type) {
				requestedRelationships[key] = obj;
			}

		});

		// Return relationships
		return requestedRelationships;

	}

	// If type is not defined
	else {

		// Return relationships
		return this.relationships;

	}

};

/**
 * Get a relationship
 *
 * @params {String} fieldPath
 *
 * @return {Object} relationship
 * @api public
 */
Skul.prototype.getRelationship = function(fieldPath) {

	// Check arguments
	if(typeof fieldPath !== "string")
		throw new Error("fieldPath have to be a string");

	// Return relationship
	return this.relationships[fieldPath];

};

/**
 * Remove a relationship
 *
 * @params {String} fieldPath
 *
 * @api public
 */
Skul.prototype.removeRelationship = function(fieldPath) {

	// Check arguments
	if(typeof fieldPath !== "string")
		throw new Error("fieldPath have to be a string");

	// Delete relationship if exists
	if(typeof this.relationships[fieldPath] !== "undefined") {
		delete this.relationships[fieldPath];
	}

};



/**
 * Add virtual field
 *
 * @params {String}  fieldPath
 * @params {Virtual} virtual
 * @api public
 */
Skul.prototype.addVirtual = function(fieldPath, requiredFields, transform) {

	// Check data
	if(typeof(fieldPath) !== "string")
		throw new Error("fieldPath have to be a string");
	if(typeof(requiredFields) !== "object")
		throw new Error("requiredFields have to be an object");
	if(typeof(transform) !== "function")
		throw new Error("transform have to be a function");

	// Set virtual
	this.virtuals[fieldPath] = {
		requiredFields: requiredFields,
		transform: transform
	};

};

/**
 * Get virtual fields
 *
 * @return {Object} virtuals
 * @api public
 */
Skul.prototype.getVirtuals = function() {
	return this.virtuals;
};

/**
 * Get a virtual field
 *
 * @params {String} fieldPath
 * @return {Object} virtuals
 * @api public
 */
Skul.prototype.getVirtual = function(fieldPath) {

	// Check data
	if(typeof(fieldPath) !== "string")
		throw new Error("fieldPath have to be a string");

	// Return virtual
	return this.virtuals[fieldPath];

};


/*
 * Set table name
 *
 * @params {String} name
 *
 * @api public
 */
Skul.prototype.setTableName = function(name) {

	// Check arguments
	if(typeof name !== "string")
		throw new Error("name have to be a string");

	// Set table name
	this.tableName = name;

};

/*
 * Get table name
 *
 * @return {String}
 * @api public
 */
Skul.prototype.getTableName = function() {
	return this.tableName;
};


/*
 * Set primary key
 *
 * @params {String} fieldPath
 *
 * @api public
 */
Skul.prototype.setPrimaryKey = function(fieldPath) {

	// Check arguments
	if(typeof fieldPath !== "string")
		throw new Error("fieldPath have to be a string");

	// Set primary key
	this.primaryKey = fieldPath;

};

/*
 * Get primary key
 *
 * @return {String}
 * @api public
 */
Skul.prototype.getPrimaryKey = function() {
	return this.primaryKey;
};


/*
 * Set schema
 *
 * @params {Object} schema
 *
 * @api public
 */
Skul.prototype.setSchema = function(schema) {

	// Check arguments
	if(typeof schema !== "object")
		throw new Error("schema have to be an object");

	// Data
	var primaryKey = this.primaryKey;
	var customFields = {};

	// Check if primary key is defined is the schema
	_.each(schema, function(obj, key) {
		if(obj.primaryKey) {
			primaryKey = key;
		} else if(obj.custom) {
			customFields[key] = obj;
		}
	});

	// Set instance data
	this.schema = schema;
	this.customFields = customFields;
	this.primaryKey = primaryKey;

};

/*
 * Add custom field
 *
 * @params {String} key
 * @params {Object} params
 *
 * @api public
 */
Skul.prototype.addCustomField = function(key, params, options) {

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");
	if(typeof params !== "object")
		throw new Error("params have to be an object");

	// Data
	var field = { custom: true, data: params };

	// Extend field
	field = _.extend(field, options);

	// Add field to custom fields
	this.customFields[key] = field;

};

/*
 * Get schema default fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.getSchemaDefaultFields = function() {

	// Data
	var defaultFields = [];

	// Check if primary key is defined is the schema
	_.each(this.schema, function(obj, key) {
		if(obj.default) {
			defaultFields.push(key);
		}
	});

	// Return default fields
	return defaultFields;

};

/*
 * Get schema available fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.getSchemaAvailableFields = function() {

	// Get available fields
	var availableFields = _.map(this.schema, function(obj, key) { return key; });

	// Return available fields
	return availableFields;

};

/*
 * Get schema virtuals fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.getSchemaVirtualFields = function() {

	// Data
	var nestedFields = _.map(this.virtuals, function(obj, key) { return key; });

	// Return nested fields
	return nestedFields;

};

/*
 * Get schema custom fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.getSchemaCustomFields = function() {

	// Data
	var customFields = _.map(this.customFields, function(obj, key) { return key; });

	// Return custom fields
	return customFields;

};

/*
 * Get schema nested fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.getSchemaNestedFields = function() {

	// Data
	var nestedFields = _.map(this.relationships, function(obj, key) { return key; });

	// Return nested fields
	return nestedFields;

};

/*
 * Get schema nested hasMany fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.getSchemaNestedHasManyFields = function() {

	// Data
	var nestedFields = _.map(this.relationships, function(obj, key) { return obj.type === "hasMany" ? key : null; });
		nestedFields = _.reject(nestedFields, function(obj) { return obj === null; });

	// Return nested fields
	return nestedFields;

};

/*
 * Get schema nested hasOne fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.getSchemaNestedHasOneFields = function() {

	// Data
	var nestedFields = _.map(this.relationships, function(obj, key) { return obj.type === "hasOne" ? key : null; });
		nestedFields = _.reject(nestedFields, function(obj) { return obj === null; });

	// Return nested fields
	return nestedFields;

};

/*
 * Get schema nested belongsTo fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.getSchemaNestedBelongsToFields = function() {

	// Data
	var nestedFields = _.map(this.relationships, function(obj, key) { return obj.type === "belongsTo" ? key : null; });
		nestedFields = _.reject(nestedFields, function(obj) { return obj === null; });

	// Return nested fields
	return nestedFields;

};

/*
 * Parse schema fields
 *
 * @params {Object} fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.parseSchemaFields = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fieldPath have to be an object");

	// Data
	var parsedFields = [];
    var invalidQueryData = {};
	var defaultFields = this.getSchemaDefaultFields();
	var availableFields = this.getSchemaAvailableFields();
	var nestedFields = this.getSchemaNestedFields();
	var customFields = this.getSchemaCustomFields();
	var virtuals = this.getVirtuals();
	var virtualFields = this.getSchemaVirtualFields();
	var belongsToRelationships = this.getRelationships('belongsTo');
	var belongsToRelationshipFields = _.map(belongsToRelationships, function(obj, key) { return key; });

	// Check if fields is empty
	if(Object.keys(fields).length === 0) {
		fields = { '$default': 1 };
	}

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If $all
		if(key === '$all' && obj === 1) {
			parsedFields = parsedFields.concat(availableFields);
		}

		// If $all
		else if(key === '$default' && obj === 1) {
			parsedFields = parsedFields.concat(defaultFields);
		}

		// If requested field is a virtual field
		else if(obj !== 0 && _.contains(virtualFields, key)) {
			parsedFields = parsedFields.concat(_.keys(virtuals[key].requiredFields));
		}

		// If requested field is an available field
		else if(obj !== 0 && !_.contains(nestedFields, key) && !_.contains(customFields, key) && _.contains(availableFields, key)) {
			parsedFields.push(key);
		}

		// If requested field is a belongsTo relationship
		else if(obj !== 0 && _.contains(belongsToRelationshipFields, key)) {
			parsedFields.push(belongsToRelationships[key].foreignKey);
		}

		// If requested field is an invalid field
		else if(obj !== 0 && !_.contains(nestedFields, key) && !_.contains(customFields, key) && !_.contains(availableFields, key)) {
			invalidQueryData[key] = 'The field doesn\'t exist';
		}

	});

	// Reject if has some invalid fields
	if(Object.keys(invalidQueryData).length > 0) {
        throw new __RequestException('InvalidQueryData', invalidQueryData);
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
 * Parse custom fields
 *
 * @params {Object} fields
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.parseCustomFields = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fields have to be an object");

	// Data
	var parsedFields = {};
	var customFields = this.customFields;
	var availableCustomFields = _.map(customFields, function(obj, key) { return key; });
	var defaultCustomFields = _.filter(_.map(customFields, function(obj, key) { return obj.default ? key : null; }), function(key) { return key !== null; });

	// Check if fields is empty
	if(Object.keys(fields).length === 0) {
		fields = { '$default': 1 };
	}

	// Loop over fields keys
	_.each(fields, function(fieldObj, fieldKey) {

		// If $all
		if(fieldKey === '$all' && fieldObj === 1) {
			_.each(availableCustomFields, function(key) {
				parsedFields[key] = customFields[key];
			});
		}

		// If $all
		else if(fieldKey === '$default' && fieldObj === 1) {
			_.each(defaultCustomFields, function(fieldKey) {
				parsedFields[key] = customFields[key];
			});
		}

		// If requested field is an available custom field
		else if(fieldObj !== 0 && _.contains(availableCustomFields, fieldKey)) {
			parsedFields[fieldKey] = customFields[fieldKey];
		}

	});

	// Return parsed fields
	return parsedFields;

};

/*
 * Parse virtual fields
 *
 * @params {Object} fields
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.parseVirtualFields = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fields have to be an object");

	// Data
	var parsedFields = {};
	var virtualFields = this.getSchemaVirtualFields();
	var nestedBelongsToFields = this.getSchemaNestedBelongsToFields();
	var availableFields = this.getSchemaAvailableFields();
	var defaultFields = this.getSchemaDefaultFields();
	var relationshipBelongsTo = this.getRelationships('belongsTo');

	// Check if fields is empty
	if(Object.keys(fields).length === 0) {
		fields = { '$default': 1 };
	}

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If key is a virtual field
		if(!_.contains([ '$all, $default' ], key) && _.contains(virtualFields, key) && obj !== 0) {
			parsedFields[key] = obj;
		}

		// If key is a nested field
		else if(!_.contains([ '$all, $default' ], key) && _.contains(nestedBelongsToFields, key) && obj !== 0) {

			// Data
			var relModel = relationshipBelongsTo[key].model;
			var relVirtualFields = relModel.parseVirtualFields(obj['$fields'] || {});

			// Add to parsed fields
			parsedFields[key] = { '$fields': {}, '$model': relModel };

			// Loop over reltionship virtuals
			_.each(relVirtualFields, function(virtualFieldObj, virtualFieldKey) {

				// Add to parsed fields
				parsedFields[key]['$fields'][virtualFieldKey] = virtualFieldObj;

			});

		}

		// If key is $default
		else if(key === '$default' && _.intersection(defaultFields, virtualFields).length > 0) {

			// Loop over each intersection between defaults and virtuals
			_.each(_.intersection(defaultFields, virtualFields), function(fieldKey) {
				parsedFields[fieldKey] = obj;
			});
			
		}

		// If key is $all
		else if(key === '$all' && _.intersection(availableFields, virtualFields).length > 0) {

			// Loop over each intersection between availables and virtuals
			_.each(_.intersection(availableFields, virtualFields), function(fieldKey) {
				parsedFields[fieldKey] = obj;
			});

		}

	});

	// Return parsed fields
	return parsedFields;

};

/*
 * Parse nested fields
 *
 * @params {Object} fields
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.parseNestedFields = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fieldPath have to be an object");

	// Data
	var parsedFields = {};
	var nestedFields = this.getSchemaNestedFields();

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If key is a nested field
		if(!_.contains([ '$all, $default' ], key) && _.contains(nestedFields, key) && obj !== 0) {
			parsedFields[key] = obj;
		}

	});

	// Return parsed fields
	return parsedFields;

};

/*
 * Parse nested hasMany fields
 *
 * @params {Object} fields
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.parseNestedHasManyFields = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fieldPath have to be an object");

	// Data
	var parsedFields = {};
	var nestedFields = this.getSchemaNestedHasManyFields();

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If key is a nested hasMany field
		if(!_.contains([ '$all, $default' ], key) && _.contains(nestedFields, key) && obj !== 0) {
			parsedFields[key] = obj;
		}

	});

	// Return parsed fields
	return parsedFields;

};

/*
 * Parse nested hasOne fields
 *
 * @params {Object} fields
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.parseNestedHasOneFields = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fieldPath have to be an object");

	// Data
	var parsedFields = {};
	var nestedFields = this.getSchemaNestedHasOneFields();

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If key is a nested hasOne field
		if(!_.contains([ '$all, $default' ], key) && _.contains(nestedFields, key) && obj !== 0) {
			parsedFields[key] = obj;
		}

	});

	// Return parsed fields
	return parsedFields;

};

/*
 * Parse nested belongsTo fields
 *
 * @params {Object} fields
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.parseNestedBelongsToFields = function(fields) {

	// Check arguments
	if(typeof fields !== "object")
		throw new Error("fieldPath have to be an object");

	// Data
	var parsedFields = {};
	var nestedFields = this.getSchemaNestedBelongsToFields();

	// Loop over fields keys
	_.each(fields, function(obj, key) {

		// If key is a nested belongsTo field
		if(!_.contains([ '$all, $default' ], key) && _.contains(nestedFields, key) && obj !== 0) {
			parsedFields[key] = obj;
		}

	});

	// Return parsed fields
	return parsedFields;

};


/*
 * Set default list options
 *
 * @params {Object} options
 *
 * @api public
 */
Skul.prototype.setDefaultListOptions = function(options) {

	// Check arguments
	if(!(typeof options === "object" && options !== null))
		throw new Error("options have to be an object");

	// Set skip
	if(!isNaN(options.skip)) {
		this.defaultListOptions.skip = options.skip;
	} else if(typeof options.skip !== "undefined") {
		throw new Error("options.skip have to be a number");
	}

	// Set limit
	if(!isNaN(options.limit)) {
		this.defaultListOptions.limit = options.limit;
	} else if(typeof options.limit !== "undefined") {
		throw new Error("options.limit have to be a number");
	}

	// Set orderby
	if(typeof options.orderby === "object") {
		this.defaultListOptions.orderby = options.orderby;
	} else if(typeof options.orderby !== "undefined") {
		throw new Error("options.orderby have to be an object");
	}

};

/*
 * Get default list options
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.getDefaultListOptions = function(key) {

	// Check arguments
	if(!(typeof key === "string" && _.contains([ 'skip', 'limit', 'orderby' ], key)) && typeof key !== "undefined")
		throw new Error("key have to be a string (skip, limit or orderby)");

	// If no key provided
	if(typeof key === "undefined") {
		return this.defaultListOptions;
	}

	// If key provided
	else {
		return this.defaultListOptions[key];
	}
	
};

/*
 * Parse list options
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.parseListOptions = function(options) {

    // Check arguments length
    if(arguments.length === 0) {
        options = {};
    }

    // Transform arguments
    if(options === null) options = {};

    // Check arguments
    if(!_.isObject(options))
        throw new Error('options have to be an object');

    // Data
    var self = this;

    // Get skip
    if(_.isUndefined(options.skip)) {
        if(!_.isUndefined(this.defaultListOptions.skip) && this.defaultListOptions.skip !== null) {
            options.skip = this.defaultListOptions.skip;
        } else {
            options.skip = null;
        }   
    }

    // Get limit
    if(_.isUndefined(options.limit)) {
        if(!_.isUndefined(this.defaultListOptions.limit) && this.defaultListOptions.limit !== null) {
            options.limit = this.defaultListOptions.limit;
        } else {
            options.limit = null;
        }
    }

    // Get orderby
    if(_.isUndefined(options.orderby)) {
        if(!_.isUndefined(this.defaultListOptions.orderby) && this.defaultListOptions.orderby !== null) {
            options.orderby = this.defaultListOptions.orderby;
        } else {
            options.orderby = null;
        }
    }

    // If orderby is not empty
    if(options.orderby !== null) {

    	// Data
    	_getAvailableFieldsLvl = 0;

    	// Get available fields
    	var _getAvailableFields = function(model) {

    		// Increment field lvl
    		_getAvailableFieldsLvl++;

    		// Data
    		var availableFields = [];

    		// Get main available fields
    		var mainAvailableFields = model.getSchemaAvailableFields();
    		var mainCustomFields = model.getSchemaCustomFields();

    		// Add main and custom fields
    		availableFields = availableFields.concat(mainAvailableFields, mainCustomFields);

    		// Check lvl
    		if(_getAvailableFieldsLvl > 6) {
    			return;
    		}

    		// Add nested belongsTo fields
    		var belongsToRelationships = model.getRelationships('belongsTo');

    		// Loop over relationships
    		_.each(belongsToRelationships, function(rel, key) {

    			// Get relationship available fields
    			var relAvailableFields = _getAvailableFields(rel.model);
    				relAvailableFields = _.map(relAvailableFields, function(obj) { return key + '.' + obj; });

    			// Add relationship available fields
    			availableFields = availableFields.concat(relAvailableFields);

    		});

    		// Add nested hasOne fields
    		var hasOneRelationships = model.getRelationships('hasOne');

    		// Loop over relationships
    		_.each(hasOneRelationships, function(rel, key) {

    			// Get relationship available fields
    			var relAvailableFields = _getAvailableFields(rel.model);
    				relAvailableFields = _.map(relAvailableFields, function(obj) { return key + '.' + obj; });

    			// Add relationship available fields
    			availableFields = availableFields.concat(relAvailableFields);

    		});

    		// Decrement field lvl
    		_getAvailableFieldsLvl--;

    		// Return available fields
    		return availableFields;

    	};

    	// Get available fields
    	var availableFields = _getAvailableFields(self);

        // Check orderby
        var orderByWrongFields = _.difference(_.map(options.orderby, function(value, key) { return key; }), availableFields);

        // If some wrong fields found
        if(orderByWrongFields.length > 0) {

            // Data
            var invalidQueryData = {};

            // For each wrong fields
            _.each(orderByWrongFields, function(key) {
                invalidQueryData[key] = 'The field doesn\'t exist';
            });

            // Reject
            throw new __RequestException('InvalidQueryData', invalidQueryData);

        }

    }

    // Return options
    return options;
	
};



/*
 * Set default search fields
 *
 * @params {Array} fields
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.setDefaultSearchFields = function(fields) {

	// Check arguments
	if(!(fields instanceof Array && fields.length > 0))
		throw new Error("fields have to be an array");
	
	// Set default search fields
	this.defaultSearchFields = fields;

};

/*
 * Get default search fields
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.getDefaultSearchFields = function() {
	return this.defaultSearchFields;
};



/*
 * Get available search fields
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.getAvailableSearchFields = function() {
	return _.filter(_.map(this.schema, function(obj, key) { return obj.searchable ? key : undefined }), function(obj) { return typeof obj !== "undefined" });
};



/*
 * Set filter adder
 *
 * @params {Function} adder
 *
 * @api public
 */
Skul.prototype.setFilterAdder = function(adder) {

	// Check arguments
	if(!(typeof adder === "function" || adder === null))
		throw new Error("adder have to be a function");

	// Set filter adder
	this.filterAdder = adder;

};

/*
 * Check filter
 *
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} params
 *
 * @api public
 */
Skul.prototype.checkFilter = function(filter, fields, params) {

	// If filter parser is not set
	if(this.filterAdder === null) {
		return;
	}

	// If filter parser is set
	else {
		this.filterAdder.call(this, filter, fields, params);
	}

};



/*
 * Set permission checker
 *
 * @params {String} key
 * @params {Function} checker
 *
 * @api public
 */
Skul.prototype.setPermissionChecker = function(key, checker) {

	// Check arguments
	if(!(typeof key === "string"))
		throw new Error("key have to be a string");
	if(!(typeof checker === "function" || checker === null))
		throw new Error("checker have to be a function");

	// Set filter adder
	this.permissionChecker[key] = checker;

};



/*
 * Check permission
 *
 * @params {Function} key
 *
 * @api public
 */
Skul.prototype.checkPermission = function(key) {

	// Check arguments
	if(!(typeof key === "string" && typeof this.permissionChecker[key] === "function"))
		throw new Error("key have to be a defined permission checker");

	// Data
	var checkerArguments = Array.apply(null, arguments).splice(1);

	// Set filter adder
	this.permissionChecker[key].apply(this, checkerArguments);

};



/*
 * Create mysql query
 *
 * @params {Object} fields
 * @params {Object} hashAlias
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.createMysqlQuery = function(filter, fields, options, hashAlias) {

    // Data
    var self = this;
    var alias = 'A';
    var mysqlQuery = knex.queryBuilder();
    var tableName = self.getTableName();

    // Get fields
    queryFields = _parseFields(self, fields, hashAlias, alias, mysqlQuery);

    // Set mysql query
    mysqlQuery = mysqlQuery.select(queryFields);
    mysqlQuery = mysqlQuery.from(tableName + ' AS ' + alias);

    // Add where clause
    mysqlQuery = mysqlQuery.whereRaw(_parseFilter(filter, hashAlias));

    // Parse options
    var parsedOptions = self.parseListOptions(options);

    // Change options
    options.skip = parsedOptions.skip;
    options.limit = parsedOptions.limit;
    options.orderby = parsedOptions.orderby;

	// Add limit clause
	if(parsedOptions.limit !== null) {
		mysqlQuery = mysqlQuery.limit(parsedOptions.limit);	
	}

	// Add offset clause
	if(parsedOptions.skip !== null){
		mysqlQuery = mysqlQuery.offset(parsedOptions.skip);
	}

	// Add orderby clause
	if(parsedOptions.orderby !== null) {

		// Data
		var orderByString = _.map(parsedOptions.orderby, function(value, key) {

			// Data
			var inversedHashAlias = _.invert(hashAlias);
			var splitedKey = key.split('.');
			var fieldName = splitedKey.pop();
			var fieldBase = splitedKey.join('.');

			// Check if key is a field path
			return inversedHashAlias[fieldBase] + '$' + fieldName + ' ' + (value === -1 ? 'DESC' : 'ASC');

		}).join(', ');
		
		// Add to mysql query
		mysqlQuery = mysqlQuery.orderByRaw(orderByString);

	}

    // Return mysql query
    return mysqlQuery;

};

/*
 * Create count query
 *
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Object} hashAlias
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.createCountQuery = function(filter, fields, options, hashAlias) {

    // Data
    var self = this;
    var alias = 'A';
    var mysqlQuery = knex.queryBuilder();
    var subMysqlQuery = knex.queryBuilder();
    var tableName = self.getTableName();
    var primaryKey = self.getPrimaryKey();

    // Parse fields
    _parseFields(self, fields, hashAlias, alias, subMysqlQuery);

    // Add from and where clause
    subMysqlQuery = subMysqlQuery.select(alias + '.' + '*');
    subMysqlQuery = subMysqlQuery.from(tableName + ' AS ' + alias);
    subMysqlQuery = subMysqlQuery.whereRaw(_parseFilter(filter, hashAlias));

    // Set mysql query
    mysqlQuery = mysqlQuery.count('* as total').from(knex.raw('(' + subMysqlQuery.toString() + ') AS ' + alias));

    // Return mysql query
    return mysqlQuery;

};



/*
 * Search to filter
 *
 * @params {Object} filter
 * @params {String} searchString
 *
 * @return {Object}
 * @api public
 */
Skul.prototype.searchToFilter = function(filter, searchString, fields) {

	// Data
	var schemaFields = this.parseSchemaFields(fields);
	var defaultSearchFields = _.clone(this.getDefaultSearchFields());
	var availableSearchFields = this.getAvailableSearchFields();
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
		var nestedHasOneFields = model.parseNestedHasOneFields(fields);
		var nestedBelongsToFields = model.parseNestedBelongsToFields(fields);

		// Loop over nested hasOne fields
		_.each(nestedHasOneFields, function(nestedObj, nestedKey) {

			// Data
			var relModel = hasOneRelationships[nestedKey].model;
			var relAvailableSearchFields = relModel.getAvailableSearchFields();
			var relDefaultSearchFields = relModel.getDefaultSearchFields();
			var relFields = nestedObj['$fields'];
			var relSchemaFields = relModel.parseSchemaFields(nestedObj['$fields']);

			// Loop over relationship available search fields
			_.each(relAvailableSearchFields, function(key) {
				availableSearchFields.push(parentKey ? parentKey + '.' + nestedKey + '.' + key : nestedKey + '.' + key);
			});

			// If relationship fields is empty or set has $default
			if(typeof relFields !== "object" || relFields === null || Object.keys(relFields).length === 0 || relFields['$default'] === 1) {

				// Loop over relationship default search fields
				_.each(relDefaultSearchFields, function(key) {
					schemaFields.push(parentKey ? parentKey + '.' + nestedKey + '.' + key : nestedKey + '.' + key);
				});

			}

			// If relationship fields is set has $all
			else if(relFields['$all'] === 1) {

				// Loop over relationship default search fields
				_.each(relAvailableSearchFields, function(key) {
					schemaFields.push(parentKey ? parentKey + '.' + nestedKey + '.' + key : nestedKey + '.' + key);
				});

			}

			// If relationship fields is not empty
			else {

				// Loop over relationship schema fields
				_.each(relSchemaFields, function(key) {
					schemaFields.push(parentKey ? parentKey + '.' + nestedKey + '.' + key : nestedKey + '.' + key);
				});

			}

			// Populate nested fields
			if(typeof relFields === "object" && relFields !== null && Object.keys(relFields).length > 0) {
				_populateSearchFields(relModel, relFields, parentKey ? parentKey + '.' + nestedKey : nestedKey);
			}

		});

		// Loop over nested belongsTo fields
		_.each(nestedBelongsToFields, function(nestedObj, nestedKey) {

			// Data
			var relModel = belongsToRelationships[nestedKey].model;
			var relAvailableSearchFields = relModel.getAvailableSearchFields();
			var relDefaultSearchFields = relModel.getDefaultSearchFields();
			var relFields = nestedObj['$fields'];
			var relSchemaFields = relModel.parseSchemaFields(nestedObj['$fields']);

			// Loop over relationship available search fields
			_.each(relAvailableSearchFields, function(key) {
				availableSearchFields.push(parentKey ? parentKey + '.' + nestedKey + '.' + key : nestedKey + '.' + key);
			});

			// If relationship fields is empty or set has $default
			if(typeof relFields !== "object" || relFields === null || Object.keys(relFields).length === 0 || relFields['$default'] === 1) {

				// Loop over relationship default search fields
				_.each(relDefaultSearchFields, function(key) {
					schemaFields.push(parentKey ? parentKey + '.' + nestedKey + '.' + key : nestedKey + '.' + key);
				});

			}

			// If relationship fields is set has $all
			else if(relFields['$all'] === 1) {

				// Loop over relationship default search fields
				_.each(relAvailableSearchFields, function(key) {
					schemaFields.push(parentKey ? parentKey + '.' + nestedKey + '.' + key : nestedKey + '.' + key);
				});

			}

			// If relationship fields is not empty
			else {

				// Loop over relationship schema fields
				_.each(relSchemaFields, function(key) {
					schemaFields.push(parentKey ? parentKey + '.' + nestedKey + '.' + key : nestedKey + '.' + key);
				});

			}

			// Populate nested fields
			if(typeof relFields === "object" && relFields !== null && Object.keys(relFields).length > 0) {
				_populateSearchFields(relModel, relFields, parentKey ? parentKey + '.' + nestedKey : nestedKey);
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
		searchFieldsDiff = _.difference(searchFields, availableSearchFields);

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
		searchFields = schemaFields.length > 0 ? schemaFields : availableSearchFields;
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



/*
 * Parse mysql select result
 *
 * @params {Array} data
 * @params {Object} hashAlias
 *
 * @return {Array}
 * @api public
 */
Skul.prototype.parseMysqlSelectResult = function(data, hashAlias, flatten) {

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

        // Loop over data item fields
        _.each(dataItem, function(dataItemValue, dataItemKey) {

            // Data
            var splitedKey = dataItemKey.split('$');
            var fieldName = splitedKey.pop();
            var fieldBase = hashAlias[splitedKey.join('$')];
            var fieldPath = _.reject([ fieldBase, fieldName ], function(obj) { return obj === ''; }).join('.');

            // Set transformed data
            if(flatten) {
            	transformedDataItem[fieldPath] = dataItemValue;
            } else {
            	objectPath.set(transformedDataItem, fieldPath, dataItemValue);
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


/**
 * Populate virtuals
 *
 * @api public
 */
Skul.prototype.populateVirtuals = function(fields, data) {

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

	    	// If virtual is a nested field
	    	if(typeof virtualFieldValue === 'object' && typeof virtualFieldValue['$fields'] === 'object') {

	    		// Data
	    		var relModel = virtualFieldValue['$model'];
	    		var relFields = virtualFieldValue['$fields'];
	    		var relData = [ dataItem[virtualFieldKey] ];

	    		// Populate relationship virtuals
	    		asyncQueue = asyncQueue
	    			.then(relModel.populateVirtuals.bind(relModel, relFields, relData));

	    	} else {

		    	// Transform
		    	dataItem[virtualFieldKey] = virtuals[virtualFieldKey].transform.call(null, dataItem);

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
 * Populate
 *
 * @params {Object} fields
 * @params {Object|Array} data
 * @params {Object} [params]
 *
 * @return {Promise}
 *
 * @api public
 */
Skul.prototype.populate = function(fields, data, params) {

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

	// Get relationships type
	var hasManyRelationships = _.filter(_.map(self.relationships, function(obj, key) { return obj.type === "hasMany" ? key : null }), function(item) { return item !== null; });
	
	// Populate each nested fields
	_.each(fields, function(obj, key) {

		// Add to queue
		asyncQueue = asyncQueue
			.then(function() {

				// Populate hasMany relationship
				if(_.contains(hasManyRelationships, key)) {
					return self.populateHasMany(key, data, obj['$filter'], obj['$fields'], obj['$options'], params);
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
 * Populate hasMany
 *
 * @params {String} fieldPath
 * @params {Object|Array} data
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Object} [params]
 *
 * @return {Object|Array}
 * @api public
 */
Skul.prototype.populateHasMany = function(fieldPath, data, filter, fields, options, params) {

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
	if(typeof fieldPath !== "string")
		throw new Error("fieldPath have to be a string");
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

	// Check fieldPath argument
	if(typeof this.relationships[fieldPath] === "undefined")
		throw new Error("fieldPath have to refer to a provided relationship");

	// Data
	var self = this;
	var dbConnection = self.dbConnection;
	var primaryKey = self.primaryKey;
	var relationship = self.relationships[fieldPath];
	var relModel = relationship.model;
	var relTableName = relModel.getTableName();
	var relForeignKey = relationship.foreignKey;
	var dataToPopulate = data instanceof Array ? data : [ data ];
	var hashId = [];
	var hashData = {};
	var hashFields = [];
	var hashNested = {};

	// Transform options arguments
	if(String(options) === '[object Object]') {
		if(typeof options.limit === "undefined" || options.limit === null) options.limit = relModel.getDefaultListOptions('limit');
		if(typeof options.skip === "undefined" || options.skip === null) options.skip = relModel.getDefaultListOptions('skip');
		if(typeof options.orderby === "undefined" || options.orderby === null) options.orderby = relModel.getDefaultListOptions('orderby');
	}

	// Check option argument
	if(typeof options.limit !== "number")
		throw new Error("options.limit have to be a number");
	if(typeof options.skip !== "number")
		throw new Error("options.skip have to be a number");
	if(typeof options.orderby !== "object")
		throw new Error("options.orderby have to be an object");

	// Get hash ids
	var hashId = _.map(dataToPopulate, function(dataItem) {
		return dataItem[primaryKey];
	});

	// Check arguments
	var checkArgumentsLoad = function() {

		// Add to filter
		newFilter = {};
		newFilter[relForeignKey] = { '$in': hashId };

		// Add to filter
		if(Object.keys(filter).length === 0) {
			filter = newFilter;
		} else {
			filter = { '$and': [ newFilter, filter ] };
		}

		// Check filter
		relModel.checkFilter(filter, fields, params);

		// Parse fields
		hashFields = relModel.parseSchemaFields(fields);
		hashNested = relModel.parseNestedFields(fields);
		hashVirtuals = relModel.parseVirtualFields(fields);

		// Resolve
		return Promise.resolve();

	};

	// Count hash
	var countHashLoad = function() {

		// Return promise
	    return new Promise(function(resolve, reject) {

	    	// Data
		    var hashAlias = {};
	    	var mysqlQuery = relModel.createCountQuery(filter, fields, options, hashAlias);
	    		mysqlQuery = mysqlQuery.select(knex.raw('A.' + relForeignKey + ' AS A$' + relForeignKey));
	    		mysqlQuery = mysqlQuery.groupBy('A$' + relForeignKey);
	    		mysqlQuery = mysqlQuery.toString();

			// Mysql request
			dbConnection.query(mysqlQuery, function(err, queryResult) {

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
				queryResult = relModel.parseMysqlSelectResult(queryResult, hashAlias);

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Add total to hash count
					hashData[queryItem[relForeignKey]] = {
						limit: options.limit,
						skip: options.skip,
						orderby: options.orderby,
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

			// Mysql request
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
		    var hashAlias = {};
		    var mainQuery = knex.queryBuilder();
		    var subQuery = knex.queryBuilder();

		    // Create sub query
	    	subQuery = relModel.createMysqlQuery(filter, fields, options, hashAlias);

	    	// Add relationship foreign key if needed
	    	if(!_.contains(hashFields, relForeignKey)) {
	    		subQuery = subQuery.select(knex.raw('A.' + relForeignKey + ' AS A$' + relForeignKey));
	    	}

	    	// Add variable increments
	    	subQuery = subQuery.select(knex.raw('@num := IF(@foreign = A.' + relForeignKey + ', @num + 1, 0) AS row_number'));
	    	subQuery = subQuery.select(knex.raw('@foreign := A.' + relForeignKey + ' AS dummy'));

		    // Remove all offset and limit statement
		    delete subQuery._single.limit;
		    delete subQuery._single.offset;

	    	// Add orderby
			subQuery = subQuery.orderBy('A.'+relForeignKey, 'ASC');

		    // Move last query statement
		    var lastQueryStatement = subQuery._statements.pop();
		    subQuery._statements.unshift(lastQueryStatement);

		    // Create main query
		    mainQuery = mainQuery.select();
		    mainQuery = mainQuery.from(knex.raw(subQuery.toString()).wrap('(', ') AS B'));
			mainQuery = mainQuery.whereRaw('row_number >= ' + options.skip + ' AND row_number < ' + (options.skip + options.limit));
	    	
	    	// To string
	    	mainQuery = mainQuery.toString();

			// Mysql request
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
				queryResult = relModel.parseMysqlSelectResult(queryResult, hashAlias);

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

	// Populate hash
	var populateHash = function() {

		// Data
		hashDataToPopulate = _.flatten(_.map(hashData, function(obj) { return obj.data; }), true);

		// Populate hash
		return relModel.populate(hashNested, hashDataToPopulate, params);

	};

	// Populate virtual in hash
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
		.then(populateHash)
		.then(populateVirtualsInHash)
		.then(function() {

			// Loop over each data
			_.each(dataToPopulate, function(dataItem) {

				// Add models
				if(typeof hashData[dataItem[primaryKey]] !== "undefined") {
					dataItem[fieldPath] = hashData[dataItem[primaryKey]];
				} else {
					dataItem[fieldPath] = {
						limit: options.limit,
						skip: options.skip,
						orderby: options.orderby,
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
 * Populate hasOne
 *
 * @params {String} fieldPath
 * @params {Object|Array} data
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 *
 * @return {Object|Array}
 * @api public
 */
/* Skul.prototype.populateHasOne = function(fieldPath, data, filter, fields, options) {

    // Check arguments length
    if(arguments.length === 4) {
        options = {};
    } else if(arguments.length === 3) {
        options = {};
        fields = {};
    } else if(arguments.length === 2) {
        options = {};
        fields = {};
        filter = {};
    }

    // Transform arguments
    if(typeof filter === "undefined" || filter === null) filter = {};
    if(typeof fields === "undefined" || fields === null) fields = {};
    if(typeof options === "undefined" || options === null) options = {};

	// Check arguments
	if(typeof fieldPath !== "string")
		throw new Error("fieldPath have to be a string");
	if(!(data instanceof Array || typeof data === "object"))
		throw new Error("data have to be an array or an object");
	if(typeof filter !== "object")
		throw new Error("filter have to be an object");
	if(typeof fields !== "object")
		throw new Error("fields have to be an object");
	if(typeof options !== "object")
		throw new Error("options have to be an object");

	// Check fieldPath argument
	if(typeof this.relationships[fieldPath] === "undefined")
		throw new Error("fieldPath have to refer to a provided relationship");

	// Data
	var self = this;
	var dbConnection = self.dbConnection;
	var primaryKey = self.primaryKey;
	var relationship = self.relationships[fieldPath];
	var relModel = relationship.model;
	var relTableName = relModel.getTableName();
	var relPrimaryKey = relModel.getPrimaryKey();
	var relForeignKey = relationship.foreignKey;
	var dataToPopulateIsObject = !(data instanceof Array);
	var dataToPopulate = !dataToPopulateIsObject ? data : [ data ];
	var hashId = [];
	var hashData = {};
	var hashFields = [];
	var hashNested = {};

	// Transform options arguments
	if(String(options) === '[object Object]') {
		if(typeof options.limit === "undefined" || options.limit === null) options.limit = relModel.getDefaultListOptions('limit');
		if(typeof options.skip === "undefined" || options.skip === null) options.skip = relModel.getDefaultListOptions('skip');
		if(typeof options.orderby === "undefined" || options.orderby === null) options.orderby = relModel.getDefaultListOptions('orderby');
	}

	// Check option argument
	if(typeof options.limit !== "number")
		throw new Error("options.limit have to be a number");
	if(typeof options.skip !== "number")
		throw new Error("options.skip have to be a number");
	if(typeof options.orderby !== "object")
		throw new Error("options.orderby have to be an object");

	// Get hash ids
	var hashId = _.map(dataToPopulate, function(dataItem) {
		return dataItem[relForeignKey];
	});

	// Check arguments
	var checkArgumentsLoad = function() {

		// Add to filter
		newFilter = {};
		newFilter[relPrimaryKey] = { '$in': hashId };

		// Add to filter
		if(Object.keys(filter).length === 0) {
			filter = newFilter;
		} else {
			filter = { '$and': [ newFilter, filter ] };
		}

		// Parse fields
		hashFields = relModel.parseSchemaFields(fields);
		hashNested = relModel.parseNestedFields(fields);

		// Resolve
		return Promise.resolve();

	};

	// List hash
	var listHashLoad = function() {

		// Return promise
	    return new Promise(function(resolve, reject) {

	    	// Parse filter and fields
    		var filterString = sqlQuery.parseFilter(filter);
    		var fieldsArray = hashFields;

    		// Check fields
    		if(!_.contains(fieldsArray, relPrimaryKey)) {
    			fieldsArray.unshift(relPrimaryKey);
    		}

	    	// Set sql query
	    	var sqlQueryString = knex.select.apply(knex, fieldsArray)
				.from(relTableName)
				.whereRaw(filterString)
				.toString();

			// Mysql request
			dbConnection.query(sqlQueryString, function(err, queryResult) {

				// Reject if error
				if(err) {
					reject(err);
					return;
				}

				// Loop over query result
				_.each(queryResult, function(queryItem) {

					// Push to object
					hashData[queryItem[relPrimaryKey]] = queryItem;

				});

				// Resolve
				resolve();
				return;

			});
			return;

		});

	};

	// Populate hash
	var populateHash = function() {

		// Data
		hashDataToPopulate = _.flatten(_.map(hashData, function(obj) { return obj; }), true);

		// Populate hash
		return relModel.populate(hashNested, hashDataToPopulate);

	};

	// Return promises
	return checkArgumentsLoad()
		.then(listHashLoad)
		.then(populateHash)
		.then(function() {

			// Loop over each data
			_.each(dataToPopulate, function(dataItem) {

				// Add models
				if(typeof hashData[dataItem[relForeignKey]] !== "undefined") {
					dataItem[fieldPath] = hashData[dataItem[relForeignKey]];
				} else {
					dataItem[fieldPath] = null;
				}

			});

			// Remove if not present and filter not empty
			if(Object.keys(filter).length > 0) {
				dataToPopulate = _.reject(dataToPopulate, function(obj) { return obj[fieldPath] === null; });
			}

			// Resolve
			if(dataToPopulateIsObject) {
				return Promise.resolve(dataToPopulate[0]);
			} else {
				return Promise.resolve(dataToPopulate);
			}

		});

}; */


// Parse value
var _parseValue = function(value) {

	// Data
	var parsedValue = '';

	// If value is an object
	if(!_.isObject(value)) {
		value = {
			'$before_value': '',
			'$after_value': '',
			'$value': value
		};
	}

	// Add value
	if(isNaN(value['$value'])) {
		parsedValue += "'" + value['$value'] + "'";
	} else {
		parsedValue += value['$value'];
	}

	// Add before/after of value
	parsedValue = value['$before_value'] + parsedValue + value['$after_value'];

	// Return parsed value
	return parsedValue;

};

// Parse filter item
var _parseFilterItem = function(filterItem, hashAlias, filterAlreadyFullfill) {

	// Data
	var filterString = "";

	// If AND
	if(_.contains(_.keys(filterItem), '$and') && filterItem['$and'] instanceof Array) {

		// For each AND items
		_.each(filterItem['$and'], function(andItem, andIndex) {

			// Check AND item
			if(Object.keys(andItem).length === 0) {
				return;
			}

			// Add AND item
			filterString += "(" + ' ';
			filterString += _parseFilter(andItem, hashAlias) + ' ';
			filterString += ")" + ' ';

			// Add AND keyword
			if(andIndex < filterItem['$and'].length-1) {
				filterString += "AND" + ' ';
			}

		});

	}

	// If AND
	else if(_.contains(_.keys(filterItem), '$or') && filterItem['$or'] instanceof Array) {

		// For each AND items
		_.each(filterItem['$or'], function(andItem, andIndex) {

			// Add OR item
			filterString += "(" + ' ';
			filterString += _parseFilter(andItem, hashAlias) + ' ';
			filterString += ")" + ' ';

			// Add OR keyword
			if(andIndex < filterItem['$or'].length-1) {
				filterString += "OR" + ' ';
			}

		});

	}

	// If NOR
	else if(_.contains(_.keys(filterItem), '$nor') && filterItem['$nor'] instanceof Array) {

		// Add NOT keyword
		filterString += "NOT (";

		// For each AND items
		_.each(filterItem['$nor'], function(andItem, andIndex) {

			// Add NOR item
			filterString += "(" + ' ';
			filterString += _parseFilter(andItem, hashAlias) + ' ';
			filterString += ")";

			// Add OR keyword
			if(andIndex < filterItem['$nor'].length-1) {
				filterString += " OR ";
			}

		});

		// Close keyword
		filterString += ") ";

	}

	// If NOT
	else if(_.contains(_.keys(filterItem), '$not')) {

		// Add NOT item
		filterString += "NOT ";
		filterString += _parseFilter(filterItem['$not'], hashAlias) + " ";

	}

	// If >
	else if(_.contains(_.keys(filterItem), '$gt')) {

		// Add > item
		filterString += " > ";
		filterString += _parseValue(filterItem['$gt']) + " ";

	}

	// If >=
	else if(_.contains(_.keys(filterItem), '$gte')) {

		// Add >= item
		filterString += " >= ";
		filterString += _parseValue(filterItem['$gte']) + " ";

	}

	// If <
	else if(_.contains(_.keys(filterItem), '$lt')) {

		// Add < item
		filterString += " < ";
		filterString += _parseValue(filterItem['$lt']) + " ";

	}

	// If <=
	else if(_.contains(_.keys(filterItem), '$lte')) {

		// Add <= item
		filterString += " <= ";
		filterString += _parseValue(filterItem['$lte']) + " ";

	}

	// If =
	else if(_.contains(_.keys(filterItem), '$e')) {

		// Add <= item
		filterString += " = ";
		filterString += _parseValue(filterItem['$e']) + " ";

	}

	// If <>
	else if(_.contains(_.keys(filterItem), '$ne')) {

		// Add <= item
		filterString += " <> ";
		filterString += _parseValue(filterItem['$ne']) + " ";

	}

	// If like clause
	else if(_.contains(_.keys(filterItem), '$like')) {

		// Add <= item
		filterString += " LIKE ";
		filterString += "'%" + filterItem['$like'] + "%' ";

	}

	// If IN
	else if(_.contains(_.keys(filterItem), '$in') && filterItem['$in'] instanceof Array) {

		// Add quotes for strings
		var filterItemValue = _.map(filterItem['$in'], function(val) {
			return _parseValue(val);
		});

		// Add IN item
		filterString += "IN (";
		filterString += filterItemValue.join(',');
		filterString += ") ";

	}

	// If NIN
	else if(_.contains(_.keys(filterItem), '$nin') && filterItem['$nin'] instanceof Array) {

		// Add quotes for strings
		filterItemValue = _.map(filterItem['$nin'], function(val) {
			return _parseValue(val);
		});

		// Add IN item
		filterString += "NOT IN (";
		filterString += filterItemValue.join(',');
		filterString += ") ";

	}

	// Else
	else {

		// Add AND keyword
		if(filterAlreadyFullfill) {
			filterString += "AND ";
		}

		// Data
		var filterItemKey = filterItem['$key'];
		var filterItemKeyBefore = filterItem['$before_key'] ? filterItem['$before_key'] : '';
		var filterItemKeyAfter = filterItem['$after_key'] ? filterItem['$after_key'] : '';
		var filterItemValue = {
			'$value': filterItem['$value'],
			'$before_value': filterItem['$before_value'] ? filterItem['$before_value'] : '',
			'$after_value': filterItem['$after_value'] ? filterItem['$after_value'] : ''
		};

		// Get filter field
		var inversedHashAlias = _.invert(hashAlias);
		var splitedKey = filterItemKey.split('.');
		var fieldName = splitedKey.pop();
		var fieldBase = splitedKey.join('.');
		var filterField = filterItemKeyBefore + inversedHashAlias[fieldBase] + '.' + fieldName + filterItemKeyAfter;

		// If is null
		if(_.isObject(filterItemValue['$value']) && filterItemValue['$value'] === null) {
			filterString += filterField + " IS NULL ";
		}

		// If is not null
		if(_.isObject(filterItemValue['$value']) && filterItemValue['$value']['$ne'] === null) {
			filterString += filterField + " IS NOT NULL ";
		}

		// If object
		else if(_.isObject(filterItemValue['$value']) && filterItemValue['$value'] !== null) {
			filterString += filterField + " " + _parseFilter(filterItemValue['$value'], hashAlias) + " ";
		}

		// If value
		else {
			filterString += filterField + " = " + _parseValue(filterItemValue) + " ";
		}
		
		// Set boolean
		filterAlreadyFullfill = true;

	}

	// Return filter string
	return filterString;

};


// Parse filter
var _parseFilter = function(filter, hashAlias) {

	// Data
	var filterString = "";
	var filterAlreadyFullfill = false;
	var keywords = [ '$and', '$or', '$nor', '$not', '$gt', '$gte', '$lt', '$lte', '$e', '$ne', '$like', '$in', '$nin', '$key', '$value' ];

	// Check if filter keys are keywords
	if(_.intersection(keywords, Object.keys(filter)).length > 0) {

		// Parse filter
		filterString += _parseFilterItem(filter, hashAlias, filterAlreadyFullfill);

	} else {

		// Parse item for each filter keys
		_.each(filter, function(filterItemValue, filterItemKey) {

			// Data
			var filterItem = { '$key': filterItemKey, '$value': filterItemValue };

			// Parse filter item
			filterString += _parseFilterItem(filterItem, hashAlias, filterAlreadyFullfill);

		});

	}

	// Return parsed filter
	return filterString.trim();

};

// Parse fields
var _parseFields = function(model, fields, hashAlias, alias, mysqlQuery) {

    // Check arguments length
    if(arguments.length === 2) {
        alias = 1;
    }

    // Data
    var parsedFields = [];
    var mainPrimaryKey = model.getPrimaryKey();

    // Set main fields
    var mainFields = model.parseSchemaFields(fields);
        mainFields = _.map(mainFields, function(obj) { return alias + '.' + obj + ' AS ' + alias + '$' + obj; });

    // Push main fields
    parsedFields = parsedFields.concat(mainFields);

    // Push alias
    if(typeof hashAlias[alias] === "undefined") {
        hashAlias[alias] = '';
    }

    // Set nested alias
    var nestedAlias = 1;
    var nestedHasOneFields = model.parseNestedHasOneFields(fields);
    var nestedBelongsToFields = model.parseNestedBelongsToFields(fields);

    // Loop over nested fields
    _.each(nestedHasOneFields, function(nestedFieldValue, nestedFieldKey) {

        // Set relationship data
        var relAlias = alias + '$' + nestedAlias;
        var relationship = model.getRelationship(nestedFieldKey);
        var relModel = relationship.model;
        var relTableName = relModel.tableName;
        var relPrimaryKey = relModel.primaryKey;
        var relForeignKey = relationship.foreignKey;
        var relFields = nestedFieldValue['$fields'];

        // Check if relationship fields is defined
        if(typeof relFields === "undefined") {
        	relFields = {};
        }

        // Push alias
        hashAlias[relAlias] = _.reject([ hashAlias[alias], nestedFieldKey ], function(obj) { return !obj; }).join('.');

        // Push left join
        mysqlQuery = mysqlQuery.leftJoin(relTableName + ' AS ' + relAlias, relAlias + '.' + relForeignKey, alias + '.' + mainPrimaryKey);

        // Parse fields
        relFields = _parseFields(relModel, relFields, hashAlias, relAlias, mysqlQuery);

        // Push relationship fields
        parsedFields = parsedFields.concat(relFields);

        // Increment alias
        nestedAlias++;

    });

    // Loop over nested fields
    _.each(nestedBelongsToFields, function(nestedFieldValue, nestedFieldKey) {

        // Set relationship data
        var relAlias = alias + '$' + nestedAlias;
        var relationship = model.getRelationship(nestedFieldKey);
        var relModel = relationship.model;
        var relTableName = relModel.tableName;
        var relPrimaryKey = relModel.primaryKey;
        var relForeignKey = relationship.foreignKey;
        var relFields = nestedFieldValue['$fields'];

        // Check if relationship fields is defined
        if(typeof relFields === "undefined") {
        	relFields = {};
        }

        // Push alias
        hashAlias[relAlias] = _.reject([ hashAlias[alias], nestedFieldKey ], function(obj) { return !obj; }).join('.');

        // Push left join
        mysqlQuery = mysqlQuery.leftJoin(relTableName + ' AS ' + relAlias, relAlias + '.' + relPrimaryKey, alias + '.' + relForeignKey);

        // Parse fields
        relFields = _parseFields(relModel, relFields, hashAlias, relAlias, mysqlQuery);

        // Push relationship fields
        parsedFields = parsedFields.concat(relFields);

        // Increment alias
        nestedAlias++;

    });

    // Get existing joins
    var existingJoins = [];
    var existingGroupby = [];

    // Loop over statements
    _.each(mysqlQuery._statements, function(obj) {

    	// If statement is a join
    	if(typeof obj.joinType !== "undefined") {

	    	// Data
	    	var statementSpittedTable = obj.table.split(' AS ');
	    	var statementTable = statementSpittedTable[0];
	    	var statementAlias = statementSpittedTable[1];
	    	var statementJoinType = obj.joinType;
	    	var statementClauses = obj.clauses;

	    	// Push to existing joins
	    	existingJoins.push({ table: statementTable, alias: statementAlias, joinType: statementJoinType, clauses: statementClauses });

    	}

    	// If statement is a groupby
    	else if(typeof obj.grouping !== "undefined" && obj.grouping === 'group') {

    		// Push to existing groupby
    		existingGroupby.push({ type: obj.type, value: obj.value });

    	}

    });

    // Set custom fields
    var customFields = model.parseCustomFields(fields);
        customFields = _.map(customFields, function(customFieldObj, customFieldKey) {

        	// Data
        	var customFieldAliasHash = {};

        	// If join is not empty
        	if(typeof customFieldObj.data['$join'] === 'object' && customFieldObj.data['$join'] instanceof Array) {
        		
        		// Loop over join
        		_.each(customFieldObj.data['$join'], function(joinItem) {

        			// Data
        			var joinItemType = joinItem['$type'] || 'inner';
        			var joinItemModel = joinItem['$model'];
        			var joinItemAlias = joinItem['$alias'];
        			var joinItemKey = joinItem['$key'];
        			var joinItemOn = joinItem['$on'];
        			var joinItemTable = joinItemModel.getTableName();

        			// Check if already exist
        			var joinItemRef = _.findIndex(existingJoins, function(obj) {
        				if(obj.table !== joinItemTable) return false;
        				else if(obj.joinType !== joinItemType) return false;
        				else if(String(obj.clauses) !== String([ [ 'and', 'on', obj.alias + '.' + joinItemKey, '=', alias + '.' + joinItemOn ] ]) && String(obj.clauses) !== String([ [ 'and', 'on', alias + '.' + joinItemOn, '=', obj.alias + '.' + joinItemKey ] ])) return false;
        				return true;
        			});

        			// If already exists
        			if(joinItemRef !== -1) {
        				customFieldAliasHash[joinItemAlias] = existingJoins[joinItemRef].alias;
        				joinItemAlias = existingJoins[joinItemRef].alias;
        			}

        			// If doesn't exists
        			else {

        				// Push join
        				mysqlQuery = mysqlQuery[joinItemType + 'Join'].call(mysqlQuery, joinItemTable + ' AS ' + joinItemAlias, joinItemAlias + '.' + joinItemKey, alias + '.' + joinItemOn);
	    				
        				// Push to existing joins
	    				existingJoins.push({ table: joinItemTable, alias: joinItemAlias, joinType: joinItemType, clauses: mysqlQuery._statements[mysqlQuery._statements.length-1].clauses });

				        // Push alias
				        // hashAlias[joinItemAlias] = _.reject([ hashAlias[alias], customFieldKey ], function(obj) { return !obj; }).join('.');

        			}

        		});

        	}

        	// If groupby is an array
        	if(typeof customFieldObj.data['$groupby'] === 'object' && customFieldObj.data['$groupby'] instanceof Array) {

        		/////////// CAN BE IMPROVE //////////
        		
        		// Loop over groupby
        		_.each(customFieldObj.data['$groupby'], function(groupbyItem) {

    				// Push groupby
        			if(typeof groupbyItem['$alias'] !== "undefined" && typeof customFieldAliasHash[groupbyItem['$alias']] !== "undefined") {

	        			// Check if already exist
	        			var groupbyItemRef = _.findIndex(existingGroupby, function(obj) {
	        				if(obj.type === 'groupByRaw' && obj.value.sql === customFieldAliasHash[groupbyItem['$alias']] + '.' + groupbyItem['$key']) return true;
	        				else if(obj.type === 'groupByBasic' && _.contains(obj.value, customFieldAliasHash[groupbyItem['$alias']] + '.' + groupbyItem['$key'])) return true;
	        				else return false;
	        			});

	        			// If doesn't exists
	        			if(groupbyItemRef === -1) {
    						mysqlQuery = mysqlQuery.groupByRaw(customFieldAliasHash[groupbyItem['$alias']] + '.' + groupbyItem['$key'])
	        			}

    				}

    				else if(typeof groupbyItem['$alias'] !== "undefined") {
    					mysqlQuery = mysqlQuery.groupByRaw(groupbyItem['$alias'] + '.' + groupbyItem['$key']);
    				}

    				else {
    					mysqlQuery = mysqlQuery.groupByRaw(alias + '.' + groupbyItem['$key']);
    				}

        		});

        	}

        	// If field is an array
        	if(typeof customFieldObj.data['$field'] === 'object' && customFieldObj.data['$field'] instanceof Array) {

        		// Data
        		var rawString = '';
        		
        		// Loop over field
        		_.each(customFieldObj.data['$field'], function(fieldItem) {

        			// If item is string
        			if(typeof fieldItem === "string") {
        				rawString += fieldItem;
        			}

        			// If item is string
        			else if(typeof fieldItem === "object" && typeof fieldItem['$string'] === "string") {
        				rawString += fieldItem['$string'];
        			}

        			// If item is object
        			else if(typeof fieldItem === "object" && typeof fieldItem['$key'] !== "undefined" && typeof fieldItem['$alias'] !== "undefined") {

        				// Check if alias already exists
        				if(typeof customFieldAliasHash[fieldItem['$alias']] !== "undefined") {
        					rawString += customFieldAliasHash[fieldItem['$alias']] + '.' + fieldItem['$key'];
        				} else {
        					rawString += fieldItem['$alias'] + '.' + fieldItem['$key'];
        				}

        			}

        			// If item is string
        			else if(typeof fieldItem === "object" && typeof fieldItem['$key'] !== "undefined") {
        				rawString += alias + '.' + fieldItem['$key'];
        			}

        		});

	        	// Add as clause
	        	rawString += ' AS ' + alias + '$' + customFieldKey;

	        	// Add to parsed fields
	        	parsedFields.push(knex.raw(rawString));

        	}

        });

    // Return parsed fields
    return parsedFields;

};


// Module exports
module.exports = Skul;