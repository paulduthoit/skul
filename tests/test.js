var skul = require('../lib/skul');
var urlParser = require('./url');
var colors = require('colors');
var sqlFormatter = require('sql-formatter');



// Set data
// var query = '';
// var query = 'trips.id.e(10)';
// var query = 'trip.distance_m.gt(100),val.id.gt(2)';
// var query = 'trips.filter(distance_m.gt(100).lt(1000),status.e(o)).count().gt(10).lt(20)';
// var query = 'or(trips.filter(distance_m.gt(100).lt(1000),status.e(o)).count().in(0,4),val.id.e(1))';
// var query = 'trips.filter(time_start.gt(date(2017-01-01)),status.e(o)).count().gt(10),val.id.e(1)';
// var query = 'trips.filter(time_start.gt(date(2016-01-01)),status.e(o)).sum(distance_obd_m).gt(10)';
// var query = 'trips.filter(time_start.gt(date(2016-01-01)),status.e(o)).gt(10).count().as(lol)';

//var query = 'or(name.like(Paul),email.like(hotmail),trips.filter(id.ne(-1)).count().gte(2).as(lol))';
// var query = 'or(trips.count().gte(2).as(lol))';
var query = 'and(trips.count().as(trip_count).gte(2),organisation.workspace.name.like(OOCAR))';

//var query = 'or(trips.filter(time_start.gt(date(2017-01-01)),status.e(o)).sum(distance_obd_m).as(sum_distance_obd_m).gt(10),trips.filter(time_start.gt(date(2016-01-01)),time_start.lt(date(2017-01-01)),status.e(o)).sum(distance_obd_m).as(sum_distance_obd_m2).gt(10))';

// Parse query
var parsedQuery = urlParser.parseQuery(query);



// Set globals
global.__mysqlConnection = null;
global.__config = require('./config');
global.__context = {};

// Data
var databaseMethods = require('./database');
var models = require('./models');

// Return promises
return databaseMethods.connect()
	.then(function() {

		// Set data
		var hashAlias = [];

		// Set request params
		var requestFilter = parsedQuery;
		// var requestFilter = {};
		var requestFields = {
			name: 1,
			vehicles: 1
			/*organisation_name: 1,
			organisation: {
				'$fields': {
					workspace: 1
				}
			},
			vehicles: {
				'$count': 1,
				'$as': 'vehicle_count'
			},
			trips: {
				'$count': 1,
				'$as': 'trip_count'
			}*/
		};

    	// Get mysql query
    	// var queryBuilder = models.User.createSelectQuery(requestFilter, requestFields, { limit: 99, skip: 0, orderby: [ '-organisation_name' ] }, hashAlias);
    	var queryBuilder = models.User.createCountQuery(requestFilter, requestFields, {}, hashAlias);
    		queryBuilder = queryBuilder.toString();

    	// Log
    	console.log(colors.green(sqlFormatter.format(queryBuilder)));

	})
	.catch(function(err) {
		console.log('ERR', err);
	});