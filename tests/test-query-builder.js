var knex = require('knex')({ client: 'mysql' });
var deepEqual = require('deep-equal');
var skul = require('../lib/skul');
var urlParser = require('./url');


// Set query builder A
var queryBuilderA = new skul.QueryBuilder();
	queryBuilderA.setFromRaw('User');
	queryBuilderA.getAliasIncrement();

// Set query builder B
var queryBuilderB = new skul.QueryBuilder();
	queryBuilderB.setFromRaw(queryBuilderA);
	queryBuilderB.addColumn(knex.raw('`' + queryBuilderB.getFromRaw().getAlias() + '`.*'));
	queryBuilderB.addColumn(knex.raw('COUNT(`' + queryBuilderB.getFromRaw().getAlias() + '`.`id`) AS `vehicle_count`'));
	queryBuilderB.addJoin('left', [ 'UserVehicle', 'UserVehicle.id_user', queryBuilderB.getFromRaw().getAlias() + '.id' ]);
	queryBuilderB.addGroupByRaw('`' + queryBuilderB.getFromRaw().getAlias() + '`.`id`');

// Set query builder C
var queryBuilderC = new skul.QueryBuilder();
	queryBuilderC.setFromRaw(queryBuilderB);
	queryBuilderC.addColumn(knex.raw('`' + queryBuilderC.getFromRaw().getAlias() + '`.*'));
	queryBuilderC.addColumn(knex.raw('COUNT(`' + queryBuilderC.getFromRaw().getAlias() + '`.`id`) AS `trip_count`'));
	queryBuilderC.addJoin('left', [ 'Trip', 'Trip.id_user', queryBuilderC.getFromRaw().getAlias() + '.id' ]);
	queryBuilderC.addGroupByRaw('`' + queryBuilderC.getFromRaw().getAlias() + '`.`id`');


// Expected result
var result = queryBuilderC.toString();
var expectedResult = 'select `SQ2`.*, COUNT(`SQ2`.`id`) AS `trip_count` from (select `SQ1`.*, COUNT(`SQ1`.`id`) AS `vehicle_count` from (select * from User) AS `SQ1` left join `UserVehicle` on `UserVehicle`.`id_user` = `SQ1`.`id` group by `SQ1`.`id`) AS `SQ2` left join `Trip` on `Trip`.`id_user` = `SQ2`.`id` group by `SQ2`.`id`';

// Log
console.log(result, '\n');
console.log('equal :', deepEqual(result, expectedResult), '\n');