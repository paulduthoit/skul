/*
* lib/skul/exceptions/query.js
*
* SKuL query exception
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var QueryDefaultExceptions = require('./defaults').QueryException;


/**
 * Query exception constructor
 *
 * @params {string} name
 *
 * @api public
 */
var QueryException = function(name) {

    // Check datas
    if(typeof(name) !== "string" || typeof(QueryDefaultExceptions[name]) !== "object")
        throw new Error("name have to be a string pointing to a defined exception");

    // Set default instance datas
    this.name = "QueryException";
    this.type = name;
    this.message = QueryDefaultExceptions[name].message || "";
    this.code = QueryDefaultExceptions[name].code;

    // Set custom instance datas
    if(name === "InvalidQueryData" && typeof(arguments[1]) === "object") {
        this.data = arguments[1];
    }

    // Capture stack trace
    Error.captureStackTrace(this);

};


// Inherit from Error
QueryException.prototype = Object.create(Error.prototype);



/**
 * To object
 * 
 * @return {Object}
 * @api public
 */
QueryException.prototype.toObject = function() {

    // Datas
    var error = {};
    error.message = this.message;
    error.type = this.name;
    error.name = this.type;
    error.code = this.code;

    // Add data
    if(this.data) {
        error.data = this.data;
    }

    // Return error object
    return {
        error: error
    };
    
};



// Exports
module.exports = QueryException;