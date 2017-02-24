/*
* lib/controller/index.js
*
* Controller library
*
* Author: Paul Duthoit
* Copyright(c) 2016 OOCAR
*/

// Dependencies
var _ = require('underscore');
var moment = require('moment');


/**
 * Url constructor
 * @api public
 */
var Url = function() {};


// Constants
var URL_REGEX = new RegExp("(\\ *[a-z]+\\()" + "|" + 								// Logical Query Opener
						  "(\\.[a-z]+\\()" + "|" +									// Method Opener
						  "(\\)\\ *)" + "|" +										// Method Closer
						  "(\\ *,\\ *)" + "|" +										// Query/Argument Separator
						  "(\\ *[a-zA-Z0-9_\\.\\-]+)(?=\\.[a-z]+\\()" + "|" +		// Field followed by Method
						  "(\\ *[a-zA-Z0-9_\\.\\-\\$]+)(?=\\ *(,|\\)))" + "|" +		// Field alone
						  "(\\ *[a-zA-Z0-9_\\.\\-\\$]+)$" + "|" +					// Finished Field
						  "([^\\(\\),\\\\]+)(?:\\\\.[^\\(\\),\\\\]*)*", "g");		// Argument
var URL_ARRAY_OPENER = [
	'or(', 'and(', 'nand(', 'nor(', 'xor(',
	'.in(', '.nin(', 'in(', 'nin('
];
var URL_VALUE_OPENER = [
	'not(', '.not(',
	'.gt(', '.gte(', '.lt(', '.lte(', 'gt(', 'gte(', 'lt(', 'lte(',
	'.e(', '.ne(', 'e(', 'ne(', '.like(',
	'date('
];
var URL_FUNCTION_OPENER = [
	'.filter(', '.count(', '.sum(', '.avg(', '.as('
];
var URL_OPENER = URL_ARRAY_OPENER.concat(URL_VALUE_OPENER, URL_FUNCTION_OPENER);


/**
 * Parse query
 *
 * @params {String} stringToParse
 * @return {Object}
 * @api public
 */
Url.parseQuery = function(stringToParse) {

	// Datas
	var query = {};
	var currentObj = query;
	var currentKey = null;
	var currentPosition = 0;

	// Check if string is empty
	if(!stringToParse) {
		return {};
	}

	// Check string to parse
	if(!new RegExp(URL_REGEX.source, "g").test(stringToParse))
		throw "Invalid query request";

	// Split string
	var splitedString = stringToParse.match(URL_REGEX);

	// Walk through the splited string
	_.each(splitedString, function(value) {

		// Trim value
		value = value.trim();

		// Is opener
		if(currentPosition === 0 && _.contains(URL_OPENER, value)) {

			// If current obj has already a function opener
			if((_.contains(URL_VALUE_OPENER, value) || _.contains(URL_ARRAY_OPENER, value)) && _.contains(_.keys(currentObj), '$filter')) {
				currentObj['$where'] = {};
				currentObj = currentObj['$where'];
			}

			// Set current key
			currentKey = value.substr(0, 1) === '.' ? '$' + value.substr(1, value.length-2) : '$' + value.substr(0, value.length-1);

			// Set current value if value is an array opener
			if(_.contains(URL_ARRAY_OPENER, value)) {
				currentObj[currentKey] = [ '' ];
			}

			// Set current position
			currentPosition++;

		}

		// Is already open
		else if(currentPosition > 0) {

			// If another argument
			if(currentPosition === 1 && value === ',' && currentObj[currentKey] instanceof Array) {

				// Parse previous value
				currentObj[currentKey][currentObj[currentKey].length-1] = Url.parseQuery(currentObj[currentKey][currentObj[currentKey].length-1]);

				// Push new value
				currentObj[currentKey].push('');

			}

			// If the current object is a closer
			else if(currentPosition === 1 && value === ')' && currentObj[currentKey] instanceof Array) {

				// Parse previous value
				currentObj[currentKey][currentObj[currentKey].length-1] = Url.parseQuery(currentObj[currentKey][currentObj[currentKey].length-1]);

			}

			// If the current object is a closer
			else if(currentPosition === 1 && value === ')') {

				// Parse previous value
				if(_.contains([ '$count' ], currentKey)) {
					currentObj[currentKey] = 1;
				} else if(_.contains([ '$sum', '$avg' ], currentKey)) {
					currentObj[currentKey] = currentObj[currentKey];
				} else {
					currentObj[currentKey] = Url.parseQuery(currentObj[currentKey]);
				}

			}

			// If not the current object closer
			else {

				// Set current value
				if(currentObj[currentKey] instanceof Array) {
					currentObj[currentKey][currentObj[currentKey].length-1] += value;
				} else if(_.isUndefined(currentObj[currentKey])){
					currentObj[currentKey] = value;
				} else {
					currentObj[currentKey] += value;
				}

			}

			// Set current position
			if(_.contains(URL_OPENER, value)) {
				currentPosition++;
			} else if(value === ')') {
				currentPosition--;
			}

		}

		// Is ,
		else if(currentPosition === 0 && splitedString.length > 1 && value === ',') {

			// Change query
			query = { '$and': [ _.clone(query), {} ] };
			currentObj = query['$and'][1];

		}

		// Is field
		else if(currentPosition === 0 && splitedString.length > 1) {

			currentObj[value] = {};
			currentObj = currentObj[value];

		}

		// Is value
		else if(currentPosition === 0 && splitedString.length === 1) {

			// Set query
			if(moment(value, [ 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss' ], true).isValid()) {
				query = value;
			} else if(isNaN(parseFloat(value))) {
				query = value;
			} else {
				query = parseFloat(value);
			}
		}

	});

	// Return query
	return query;

};

/**
 * Parse projection
 *
 * @params {String} stringToParse
 * @return {Object}
 * @api public
 */
Url.parseProjection = function(stringToParse) {

	// Check datas
	if(typeof(stringToParse) !== "string")
		throw "stringToParse have to be a string";

	// Datas
	var projection 			= {};
	var currentObj 			= projection;
	var currentObjKey	 	= false;
	var currentObjLevel	 	= 0;
	var parentObj 			= false;
	var parentObjKey 		= false;
	var onProjection	 	= false;
	var onProjectionLevel 	= 0;
	var onProjectionString 	= "";
	var onQuery	 			= false;
	var onQueryLevel 		= 0;
	var onQueryString 		= "";
	var onOrderBy	 		= false;
	var onOrderByLevel	 	= 0;
	var onOrderByString	 	= "";
	var onLimit	 			= false;
	var onSkip	 			= false;
	var onAfter	 			= false;
	var onBefore	 		= false;

	// Check string to parse
	if(!new RegExp(URL_REGEX.source, "g").test(stringToParse))
		throw "Invalid projection request";

	// Split string
	var splitedString = stringToParse.match(URL_REGEX);

	// Walk through the splited string
	splitedString.forEach(function(value) {

		// Trim value
		value = value.trim();

		// If value is )
		if(value === ")") {

			// On projection
			if(onProjection) {

				// Not finished
				if(onProjectionLevel > 1) {

					// Update projection datas
					onProjectionString += value;
					onProjectionLevel--;

				} 

				// Finished
				else {

					// Extend current obj
					_.extend(currentObj, Url.parseProjection(onProjectionString));

					// Reset projection datas
					onProjectionString = "";
					onProjectionLevel = 0;
					onProjection = false;

					// Close obj
					parentObj = currentObj.__parentObj;
					parentObjKey = currentObj.__parentObjKey;
					delete currentObj.__parentObj;
					delete currentObj.__parentObjKey;
					currentObj = parentObj;
					currentObjKey = parentObjKey;
					currentObjLevel--;

				}

			}

			// On query
			else if(onQuery) {

				// Not finished
				if(onQueryLevel > 1) {

					// Update query datas
					onQueryString += value;
					onQueryLevel--;

				}

				// Finished
				else {

					// Extend current obj
					_.extend(currentObj, Url.parseQuery(onQueryString));

					// Reset query datas
					onQueryString = "";
					onQueryLevel = 0;
					onQuery = false;

					// Close obj
					parentObj = currentObj.__parentObj;
					parentObjKey = currentObj.__parentObjKey;
					delete currentObj.__parentObj;
					delete currentObj.__parentObjKey;
					currentObj = parentObj;
					currentObjKey = parentObjKey;
					currentObjLevel--;

				}

			}

			// On orderby
			else if(onOrderBy) {

				// Not finished
				if(onOrderByLevel > 1) {

					// Update orderby datas
					onOrderByString += value;
					onOrderByLevel--;

				}

				// Finished
				else {

					// Set current obj options
					if(currentObj[currentObjKey] === 1) {
						currentObj[currentObjKey] = { "$options" : { orderby : Url.parseOrderBy(onOrderByString) } };
					} else if(typeof(currentObj[currentObjKey]["$options"]) === "object") {
						currentObj[currentObjKey]["$options"].orderby = Url.parseOrderBy(onOrderByString);
					} else {
						currentObj[currentObjKey]["$options"] = { orderby : Url.parseOrderBy(onOrderByString) };
					}

					// Reset orderby datas
					onOrderByString = "";
					onOrderByLevel = 0;
					onOrderBy = false;

				}

			}

			// On limit
			else if(onLimit) {

				// Close limit
				onLimit = false;

			} 

			// On skip
			else if(onSkip) {

				// Close skip
				onSkip = false;

			} 

			// On after
			else if(onAfter) {

				// Close after
				onAfter = false;

			} 

			// On before
			else if(onBefore) {

				// Close before
				onBefore = false;

			} 

			// Close current obj
			else {

				// Close obj
				parentObj = currentObj.__parentObj;
				parentObjKey = currentObj.__parentObjKey;
				delete currentObj.__parentObj;
				delete currentObj.__parentObjKey;
				currentObj = parentObj;
				currentObjKey = parentObjKey;
				currentObjLevel--;

			}

		}

		// If value is .limit(
		else if(value === ".limit(") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				onProjectionLevel++;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				onQueryLevel++;

			} 

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				onOrderByLevel++;

			} 

			// Open limit
			else {

				// Set current obj options
				if(currentObj[currentObjKey] === 1) {
					currentObj[currentObjKey] = { "$options" : { limit : 0 } };
				} else if(typeof(currentObj[currentObjKey]["$options"]) === "object") {
						currentObj[currentObjKey]["$options"].limit = 0;
				} else {
					currentObj[currentObjKey]["$options"] = { limit : 0 };
				}

				// Update state
				onLimit = true;

			}

		}

		// If value is .skip(
		else if(value === ".skip(") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				onProjectionLevel++;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				onQueryLevel++;

			} 

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				onOrderByLevel++;

			} 

			// Open skip
			else {

				// Set current obj options
				if(currentObj[currentObjKey] === 1) {
					currentObj[currentObjKey] = { "$options" : { skip : 0 } };
				} else if(typeof(currentObj[currentObjKey]["$options"]) === "object") {
						currentObj[currentObjKey]["$options"].skip = 0;
				} else {
					currentObj[currentObjKey]["$options"] = { skip : 0 };
				}

				// Update state
				onSkip = true;

			}

		}

		// If value is .after(
		else if(value === ".after(") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				onProjectionLevel++;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				onQueryLevel++;

			} 

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				onOrderByLevel++;

			} 

			// Open after
			else {

				// Set current obj options
				if(currentObj[currentObjKey] === 1) {
					currentObj[currentObjKey] = { "$options" : { after : "" } };
				} else if(typeof(currentObj[currentObjKey]["$options"]) === "object") {
						currentObj[currentObjKey]["$options"].after = "";
				} else {
					currentObj[currentObjKey]["$options"] = { after : "" };
				}

				// Update state
				onAfter = true;

			}

		}

		// If value is .before(
		else if(value === ".before(") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				onProjectionLevel++;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				onQueryLevel++;

			} 

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				onOrderByLevel++;

			} 

			// Open before
			else {

				// Set current obj options
				if(currentObj[currentObjKey] === 1) {
					currentObj[currentObjKey] = { "$options" : { before : "" } };
				} else if(typeof(currentObj[currentObjKey]["$options"]) === "object") {
					currentObj[currentObjKey]["$options"].before = "";
				} else {
					currentObj[currentObjKey]["$options"] = { before : "" };
				}

				// Update state
				onBefore = true;

			}

		}

		// If value is .orderby(
		else if(value === ".orderby(") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				onProjectionLevel++;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				onQueryLevel++;

			}

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				onOrderByLevel++;

			}

			// Open before
			else {

				// Update state
				onOrderByLevel++;
				onOrderBy = true;

			}

		}

		// If value is .fields(
		else if(value === ".fields(") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				onProjectionLevel++;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				onQueryLevel++;

			}

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				onOrderByLevel++;

			} 

			// Open projection
			else {

				// Set current obj fields
				if(currentObj[currentObjKey] === 1) {
					currentObj[currentObjKey] = { "$fields" : { __parentObj : currentObj, __parentObjKey : currentObjKey } };
				} else if(typeof(currentObj[currentObjKey]["$fields"]) === "object") {
					currentObj[currentObjKey]["$fields"].__parentObj = currentObj;
					currentObj[currentObjKey]["$fields"].__parentObjKey = currentObjKey;
				} else {
					currentObj[currentObjKey]["$fields"] = { __parentObj : currentObj, __parentObjKey : currentObjKey };
				}

				// Update obj datas
				currentObj = currentObj[currentObjKey]["$fields"];
				currentObjKey = false;
				currentObjLevel++;

				// Update projection datas 
				onProjectionLevel++;
				onProjection = true;

			}

		}

		// If value is .embedded(
		else if(value === ".embedded(") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				onProjectionLevel++;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				onQueryLevel++;

			}

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				onOrderByLevel++;

			} 

			// Open projection
			else {

				// Set current obj embedded
				if(currentObj[currentObjKey] === 1) {
					currentObj[currentObjKey] = { "$embedded" : { __parentObj : currentObj, __parentObjKey : currentObjKey } };
				} else if(typeof(currentObj[currentObjKey]["$embedded"]) === "object") {
					currentObj[currentObjKey]["$embedded"].__parentObj = currentObj;
					currentObj[currentObjKey]["$embedded"].__parentObjKey = currentObjKey;
				} else {
					currentObj[currentObjKey]["$embedded"] = { __parentObj : currentObj, __parentObjKey : currentObjKey };
				}

				// Update obj datas
				currentObj = currentObj[currentObjKey]["$embedded"];
				currentObjKey = false;
				currentObjLevel++;

				// Update projection datas 
				onProjectionLevel++;
				onProjection = true;

			}

		}

		// If value is .filter(
		else if(value === ".filter(") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				onProjectionLevel++;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				onQueryLevel++;

			}

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				onOrderByLevel++;

			} 

			// Open query
			else {

				// Set current obj query
				if(currentObj[currentObjKey] === 1) {
					currentObj[currentObjKey] = { "$filter" : { __parentObj : currentObj, __parentObjKey : currentObjKey } };
				} else if(typeof(currentObj[currentObjKey]["$filter"]) === "object") {
					currentObj[currentObjKey]["$filter"].__parentObj = currentObj;
					currentObj[currentObjKey]["$filter"].__parentObjKey = currentObjKey;
				} else {
					currentObj[currentObjKey]["$filter"] = { __parentObj : currentObj, __parentObjKey : currentObjKey };
				}

				// Update obj datas
				currentObj = currentObj[currentObjKey]["$filter"];
				currentObjKey = false;
				currentObjLevel++;

				// Update query datas
				onQueryLevel++;
				onQuery = true;

			}

		}

		// If value is .
		else if(value === ".") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;

			}

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;

			} 

			// Open field
			else {

				// Set current obj fields
				if(currentObj[currentObjKey] === 1) {
					currentObj[currentObjKey] = { "$fields": { __parentObj : currentObj, __parentObjKey : currentObjKey } };
				} else if(typeof(currentObj[currentObjKey]["$fields"]) === "object") {
					currentObj[currentObjKey]["$fields"].__parentObj = currentObj;
					currentObj[currentObjKey]["$fields"].__parentObjKey = currentObjKey;
				} else {
					currentObj[currentObjKey]["$fields"] = { __parentObj : currentObj, __parentObjKey : currentObjKey };
				}

				// Update obj datas
				currentObj = currentObj[currentObjKey]["$fields"];
				currentObjKey = false;
				currentObjLevel++;

			}

		}

		// If value is ,
		else if(value === ",") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;

			}

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;

			} 

			// Change obj
			else {

				// Close current obj
				while(currentObjLevel > 0) {
					parentObj = currentObj.__parentObj;
					parentObjKey = currentObj.__parentObjKey;
					delete currentObj.__parentObj;
					delete currentObj.__parentObjKey;
					currentObj = parentObj;
					currentObjKey = parentObjKey;
					currentObjLevel--;
				}

				// Update obj datas
				currentObjKey = false;

			}

		}

		// If value is other
		else if(value !== "") {

			// On projection
			if(onProjection) {

				// Update projection datas
				onProjectionString += value;
				if(value.indexOf("(") !== -1) {
					onProjectionLevel++;
				} 

			}

			// On query
			else if(onQuery) {

				// Update query datas
				onQueryString += value;
				if(value.indexOf("(") !== -1) {
					onQueryLevel++;
				} 

			}

			// On orderby
			else if(onOrderBy) {

				// Update orderby datas
				onOrderByString += value;
				if(value.indexOf("(") !== -1) {
					onOrderBy++;
				} 

			}

			// On limit
			else if(onLimit) {

				// Set current obj limit options
				currentObj[currentObjKey]["$options"].limit = parseInt(value);

			} 

			// On skip
			else if(onSkip) {

				// Set current obj skip options
				currentObj[currentObjKey]["$options"].skip = parseInt(value);

			} 

			// On after
			else if(onAfter) {

				// Set current obj after options
				currentObj[currentObjKey]["$options"].after = value;

			} 

			// On before
			else if(onBefore) {

				// Set current obj before options
				currentObj[currentObjKey]["$options"].before = value;

			}

			// Open field
			else {

				// Split value
				value.split(".").forEach(function(item, key) {

					if(key > 0) {

						// Set current obj fields
						if(currentObj[currentObjKey] === 1) {
							currentObj[currentObjKey] = { "$fields" : { __parentObj : currentObj, __parentObjKey : currentObjKey } };
						} else if(typeof(currentObj[currentObjKey]["$fields"]) === "object") {
							currentObj[currentObjKey]["$fields"].__parentObj = currentObj;
							currentObj[currentObjKey]["$fields"].__parentObjKey = currentObjKey;
						} else {
							currentObj[currentObjKey]["$fields"] = { __parentObj : currentObj, __parentObjKey : currentObjKey };
						}

						currentObj = currentObj[currentObjKey]["$fields"];
						currentObjKey = false;
						currentObjLevel++;
						
					}

					// Update obj datas
					currentObjKey = item;
					if(typeof(currentObj[item]) !== "object") {
						currentObj[item] = 1;
					}

				});

			}

		}

	});

	// Delete helpers
	while(currentObjLevel > 0) {
		parentObj = currentObj.__parentObj;
		parentObjKey = currentObj.__parentObjKey;
		delete currentObj.__parentObj;
		delete currentObj.__parentObjKey;
		currentObj = parentObj;
		currentObjKey = parentObjKey;
		currentObjLevel--;
	}

	// Return projection
	return projection;

};


/**
 * Parse orderBy
 *
 * @params {String} stringToParse
 * @return {Object}
 * @api public
 */
Url.parseOrderBy = function(stringToParse) {

	// Check datas
	if(typeof(stringToParse) !== "string")
		throw "stringToParse have to be a string";

	/*

	// Datas
	var orderBy = {};

	*/

	// Split string
	// var splitedString = stringToParse.split(/\ *,\ */);

	/*

	// Walk through splited string
	splitedString.forEach(function(value) {

		// Value is desc field
		if(value.slice(0, 1) === "-") {
			orderBy[value.slice(1)] = -1;
		}

		// Value is asc field
		else {
			orderBy[value] = 1;
		}

	});

	// Return orderby
	return orderBy;

	*/

	// Return orderby
	return stringToParse.split(/\ *,\ */);

};


// Exports
module.exports = Url;