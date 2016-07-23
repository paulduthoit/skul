/*
* lib/skul/relationship.js
*
* SKuL relationship methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');


/*
 * Add a relationship
 *
 * @params {String} type
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.addRelationship = function(type, key, relationship) {

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'hasMany', 'hasOne', 'belongsTo' ], type)))
		throw new Error("type have to be a string defined as hasMany, hasOne or belongsTo");
	if(typeof key !== "string")
		throw new Error("key have to be a string");
	if(typeof relationship !== "object")
		throw new Error("relationship have to be an object");

	// If type is hasMany
	if(type === "hasMany") {

		// Check relationship argument
		if(!(relationship.model instanceof this._self))
			throw new Error("relationship.model have to be a Skul.Model object");
		if(typeof relationship.foreignKey !== "string")
			throw new Error("relationship.foreignKey have to be a string");

	}

	// If type is hasOne
	else if(type === "hasOne") {

		// Check relationship argument
		if(!(relationship.model instanceof this._self))
			throw new Error("relationship.model have to be a Skul.Model object");
		if(typeof relationship.foreignKey !== "string")
			throw new Error("relationship.foreignKey have to be a string");

	}

	// If type is belongsTo
	else if(type === "belongsTo") {

		// Check relationship argument
		if(!(relationship.model instanceof this._self))
			throw new Error("relationship.model have to be a Skul.Model object");
		if(typeof relationship.foreignKey !== "string")
			throw new Error("relationship.foreignKey have to be a string");

	}

	// Set relationship
	this.relationships[key] = relationship;
	this.relationships[key].type = type;

};

/**
 * Remove a relationship
 *
 * @params {String} key
 *
 * @api public
 */
module.exports.removeRelationship = function(key) {

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");

	// Delete relationship if exists
	if(typeof this.relationships[key] !== "undefined") {
		delete this.relationships[key];
	}

};

/**
 * Get all relationships
 *
 * @params {string} [type]
 *
 * @return {Object}
 * @api public
 */
module.exports.getRelationships = function(type) {

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'hasMany', 'hasOne', 'belongsTo' ], type)) && typeof type !== "undefined")
		throw new Error("type have to be a string defined as hasMany, hasOne or belongsTo");

	// If type is defined
	if(type) {

		// Data
		var requestedRelationships = {};

		// Loop over relationships
		_.each(this.relationships, function(obj, key) {
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
 * @params {String} key
 *
 * @return {Object}
 * @api public
 */
module.exports.getRelationship = function(key) {

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");

	// Return relationship
	return this.relationships[key];

};



/*
 * Get relationship keys
 *
 * @return {Array}
 * @api public
 */
module.exports.getRelationshipKeys = function(type) {

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'hasMany', 'hasOne', 'belongsTo' ], type)) && typeof type !== "undefined")
		throw new Error("type have to be a string defined as hasMany, hasOne or belongsTo");

	// Return typped relationship keys
	if(type) {
		return _.filter(_.map(this.relationships, function(obj, key) { return obj.type === type ? key : null; }), function(obj) { return obj !== null; });
	}

	// Return all relationship keys
	else {
		return _.map(this.relationships, function(obj, key) { return key; });
	}

};



/*
 * Add hasOne relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.hasOne = function(key, relationship) {

	// Add relationship
	this.addRelationship('hasOne', key, relationship);

};

/*
 * Add hasMany relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.hasMany = function(key, relationship) {

	// Add relationship
	this.addRelationship('hasMany', key, relationship);

};

/*
 * Add belongsTo relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.belongsTo = function(key, relationship) {

	// Add relationship
	this.addRelationship('belongsTo', key, relationship);

};