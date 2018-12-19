/*
* lib/skul/checker.js
*
* SKuL checker methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');
var Promise = require('promise');

var QueryException = require('./exceptions/query');


/*
 * Set permission checker
 *
 * @params {String} key
 * @params {Function} checker
 *
 * @api public
 */
module.exports.setPermissionChecker = function(key, checker) {

	// Check arguments
	if(!(typeof key === "string"))
		throw new Error("key have to be a string");
	if(!(typeof checker === "function" || checker === null))
		throw new Error("checker have to be a function");

	// Set permission checker
	this.permissionChecker[key] = checker;

};

/*
 * Get all permission checkers
 *
 * @return {Function}
 * @api public
 */
module.exports.getPermissionCheckers = function() {
	return this.permissionChecker;
};

/*
 * Get a permission checker
 *
 * @return {Function}
 * @api public
 */
module.exports.getPermissionChecker = function(key) {

	// Check arguments
	if(!(typeof key === "string" && typeof this.permissionChecker[key] === "function"))
		throw new Error("key have to be a defined permission checker");

	// Return permission checker
	return this.permissionChecker[key];

};



/*
 * Check permission
 *
 * @params {String} key
 *
 * @return {Promise}
 * @api public
 */
module.exports.checkPermission = function(key) {

	// Check arguments
	if(!(typeof key === "string" && typeof this.permissionChecker[key] === "function"))
		throw new Error("key have to be a defined permission checker");

	// Data
	var checkerArguments = Array.apply(null, arguments).splice(1);

	// Check permission
	return this.permissionChecker[key].apply(this, checkerArguments);

};



/**
 * Check displayable keys
 * 
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} options
 * @params {Object} options.orderby
 * @params {Object} params
 *
 * @api public
 */
module.exports.checkDisplayableKeys = function(filter, fields, options, params) {

	// Get displayable keys
	var orderby = options.orderby;

	var invalidQueryData = {};
	var keyPaths = [];

	var self = this;
	var displayableKeys = self.getDisplayableKeys(params, true);

	var pathGen = function(start, end) {
		return start == '' ? end : start + '.' + end;
	}

	var getFilterPaths = function(filterObject, pathStart) {

		// Default path if not set
		pathStart = pathStart || '';

		if (filterObject instanceof Array) {
			_.each(filterObject, function(filterObj) {
				getFilterPaths(filterObj, pathStart);
			});
		} else if (filterObject != null && typeof filterObject == 'object') {
			_.each(filterObject, function(filterValue, filterKey) {
				if (filterKey.charAt(0) != '$') keyPaths.push(pathGen(pathStart, filterKey));
				if (filterValue != null && typeof filterValue == 'object') getFilterPaths(filterValue, pathStart);
			});
		}
	};

	var getOrderbyPaths = function(orderbyObject, pathStart) {

		// Default path if not set
		pathStart = pathStart || '';

		_.each(orderbyObject, function(orderbyValue) {
			if (orderbyValue.charAt(0) === '-') orderbyValue = orderbyValue.substr(1);
			keyPaths.push(pathGen(pathStart, orderbyValue));
		})
	}

	var getFieldsPaths = function(model, fieldsObject, pathStart) {

		// Default path if not set
		pathStart = pathStart || '';

		_.each(fieldsObject, function(fieldsValue, fieldsKey) {
			if (fieldsValue != null && typeof fieldsValue == 'object') {
				var relModel = model.getRelationship(fieldsKey);

				if (relModel && relModel.model) {
					if (relModel.model['$model'] && typeof relModel.model['$model'] === 'object') relModel = relModel.model['$model'];
					else relModel = relModel.model;
	
					if (fieldsValue['$fields']) getFieldsPaths(relModel, fieldsValue['$fields'], pathGen(pathStart, fieldsKey));
					else if (fieldsValue['$options'] && fieldsValue['$options'].orderby) getOrderbyPaths(fieldsValue['$options'].orderby, pathGen(pathStart, fieldsKey));
					else if (fieldsValue['$filter']) getFilterPaths(fieldsValue['$filter'], pathGen(pathStart, fieldsKey));
				} else invalidQueryData[fieldsKey] = 'unknown';
			} else if (_.contains(['$all', '$default'], fieldsKey) && pathStart != '') keyPaths.push(pathStart);
			else if (!_.contains(['$all', '$default'], fieldsKey) && fieldsValue == 1) keyPaths.push(pathGen(pathStart, fieldsKey));
		});
	}

	var checkKeys = function (parentModel, pathArray, params) {
		var modelDisplayableKeys = parentModel.getDisplayableKeys(params, true);
		var model = parentModel;

		_.each(pathArray, function(key, index) {
			if (!modelDisplayableKeys || _.contains(modelDisplayableKeys, key)) {

				// If not last key
				if (index + 1 < pathArray.length) {
					// Get model
					var tmpModel = model.getRelationship(key);
					if (tmpModel && tmpModel.model) {
						if (tmpModel.model['$model'] && typeof tmpModel.model['$model'] === 'object') model = tmpModel.model['$model'];
						else model = tmpModel.model;

						// Get displayabke keys for the model
						modelDisplayableKeys = model.getDisplayableKeys(params, true);
					}
				}

			} else return invalidQueryData[pathArray.join('.')] = 'unknown';
		})
	}

	if (displayableKeys) {

		// Check if fields is empty
		if (Object.keys(fields).length === 0) {
			fields = { '$default': 1 };
		}

		// Get orderby paths
		if (orderby) getOrderbyPaths(orderby);

		// Get filter paths
		if (filter) getFilterPaths(filter);

		// Get fields paths 
		if (fields) getFieldsPaths(self, fields);

		// Remove duplicate paths
		keyPaths = _.compact(_.uniq(keyPaths));

		// Loop over all paths
		_.each(keyPaths, function(path) {
			var pathArray = path.split('.');

			if (pathArray.length > 0) checkKeys(self, pathArray, params);
		});

		// Reject if has some invalid fields
		if (Object.keys(invalidQueryData).length > 0) {
			throw new QueryException('InvalidQueryData', invalidQueryData);
		}
	}

	return Promise.resolve();
}

