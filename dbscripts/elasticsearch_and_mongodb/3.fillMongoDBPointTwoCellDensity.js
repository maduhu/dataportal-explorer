/**
 * Module dependencies.
 */
var fs = require("fs");
var mongodb = require('mongodb')
  , MongoClient = require('mongodb').MongoClient;

var Client = require('mariasql');

toBoundingBoxCell = function(cellId) {
	var longitude = (cellId % 360) - 180;
	var latitude = -90;
	if (cellId > 0) {
		latitude = Math.floor(cellId / 360) - 90;
	}
	var locationCellId = {lat: latitude, lon: longitude};
	return locationCellId;
};

toBoundingBoxPointTwoCell = function(cellId, pointTwoCellId) {
	var longitudeX10 = 10 * ((cellId % 360) - 180);
	var latitudeX10 = -900;
	if (cellId > 0) {
		latitudeX10 = 10 * (Math.floor(cellId / 360) - 90);
	}

	var longOffset = (pointTwoCellId % 10);
	var latOffset = 0;
	if (pointTwoCellId > 0) {
		latOffset = (pointTwoCellId / 10);
	}

	var minLatitude = (latitudeX10 + latOffset) / 10;
	minLatitude = Math.floor(minLatitude * 10 ) / 10;
	var minLongitude = (longitudeX10 + longOffset) / 10;
	minLongitude = Math.floor(minLongitude * 10 ) / 10;
	var locationPointTwoCellId = {lat: minLatitude, lon: minLongitude};
	return locationPointTwoCellId;
};

var c = new Client();
c.connect({
	host: '127.0.0.1',
	user: 'valentina',
	password: 'password',
	db: 'dataportal'
});

c.on('connect', function() {
	console.log('Client connected');
})
.on('error', function(err) {
	console.log('Client error: ' + err);
})
.on('close', function(hadError) {
	console.log('Client closed');
});

fs.openSync("output.txt", 'w+');
var counter = 0;
c.query('SELECT * FROM pointtwo_cell_density order by type')
	.on('result', function(result) {
		result.on('row', function(row) {
			counter++;
			var locationCellId = toBoundingBoxCell(row.cell_id);
			var locationPointTwoCellId = toBoundingBoxPointTwoCell(row.cell_id, row.pointtwo_cell_id);
			var document = {type: row.type, entity_id: row.entity_id, cell_id: row.cell_id, pointtwo_cell_id: row.pointtwo_cell_id, location_cell: locationCellId, location_pointtwo_cell: locationPointTwoCellId, count: row.count};
			fs.appendFileSync("output.txt", JSON.stringify(document) + "\n");
      if(counter%500 == 0) {
				console.log("Total pointtwo_cell records extracted from MySQL database: "+counter);
			}
		})
		.on('error', function(err) {
			console.log('Result error: ' + err);
		})
		.on('end', function(info) {
			console.log('Result finished successfully');
		});
	})
	.on('end', function() {
		console.log('Done with all results');
		c.end();

    var counter = 0;
    readline = require('readline');
    MongoClient.connect('mongodb://localhost/sibexplorer_dev', function(error, db) {
      if (error) console.info(error);
      var rd = readline.createInterface({
        input: fs.createReadStream('output.txt'),
        output: process.stdout,
        terminal: false
      });

      rd.on('line', function(line) {
        db.collection('pointtwo_cell_density').insert(JSON.parse(line), {safe: false});
        if(counter%500 == 0) {
          console.log("Total records saved in mongoDB pointtwo_cell_density collection: "+counter);
        }
        counter++;
      });

      rd.on('close', function() {
        db.close();
        fs.unlinkSync('output.txt');
        console.log("Centi cell records data transfered from MySQL to MongoDB.")
      });

    });
	});
