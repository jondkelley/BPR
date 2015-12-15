var mongo = require('mongodb'),
	assert = require("assert");

var saveBPR = function(db, data, callback){
	var collection = db.collection('bp');

	collection.insertOne(data, function (err, result){
		assert.equal(err, null);
		callback(result);
	});
};

var loadBPR = function(db, options, callback){
	var collection = db.collection('bp'),
		max = options.tpe === "add" ? Math.min(10, options.max) : options.max;

	var loadChart = function(){
		collection
			.find({},{
				'_id':false, 
				'dia':true, 
				'sys':true, 
				'pulse':true,
				'dt': true})
			.sort({'dt':1})
			.toArray(function(err, docs) {
				assert.equal(null, err);
				callback(docs, 0);
			});
	};

	var loadNotes = function(){
		collection
			.find({note:{$exists: true, $ne: ""}},{
				'_id':false, 
				'note':true, 
				'dtNote': true})
			.sort({'dtNote':1})
			.toArray(function(err, docs) {
				assert.equal(null, err);
				callback(docs, 0);
			});
	};

	var loadAll = function(){
		var y = parseInt(options.month.year, 10),
			m = parseInt(options.month.month, 10),
			dtStart = new Date(y, m, 1),
			dtEnd = new Date(y, m, 1);
		dtEnd.setMonth(dtEnd.getMonth() + 1);

		collection
			.find({dt:{"$gte": dtStart, "$lt":dtEnd}},
			{
				'dia':true, 
				'sys':true, 
				'pulse':true,
				'note':true,
				'noteOnChart':true,
				'dt': true,
				'dtSubmit': true})
			.sort({'dt':-1})
			.toArray(function(err, docs) {
				assert.equal(null, err);
				collection.count(function(err, count) {
					assert.equal(null, err);
					callback(docs, count);
				});
			});
	};

	switch(options.tpe){
		case "chart": loadChart();break;
		case "notes": loadNotes();break;
		default: loadAll();
	}
};

var updateBPR = function(db, data, callback){
	var mongoId = new mongo.ObjectID(data._id);

	db.collection('bp').updateOne(
		{_id: mongoId}, 
		{$set: {
			dtUpdated: new Date(), 
			sys:data.sys,
			dia:data.dia,
			pulse:data.pulse,
			dt:new Date(data.dt)}
		}, 
		function(err, r){
			assert.equal(null, err);
			callback(r);
		}
	);

};

var updateNote = function(db, data, callback){
	var mongoId = new mongo.ObjectID(data._id);

	db.collection('bp').updateOne(
		{_id: mongoId}, 
		{$set: {
			note: data.note, 
			noteOnChart:data.onChart,
			dtNote: new Date()}
		}, 
		function(err, r){
			assert.equal(null, err);
			callback(r);
		}
	);

};

var deleteBPR = function(db, id, callback){
	var mongoId = new mongo.ObjectID(id);

	db.collection('bp').deleteOne({_id:mongoId}, function(err, r) {
      assert.equal(null, err);
  	});

	callback();
};

var getFirstYear = function(db, callback){
	db.collection('bp').find({}).limit(1).sort({dt:1}).toArray(function(err, docs) {
		assert.equal(null, err);
		callback(docs[0].dt);
	});
};

module.exports = {
	save: function(req, res){
		var newRecord = req.body;
		newRecord.dtSubmit = new Date();
		newRecord.dt = new Date();

		saveBPR(mongo.DB, newRecord, function(result){
			res.status(201).json(newRecord);
		});
	},
	load: function(req, res){
		var tpe = req.params.tpe,
			max = req.app.settings.maxRecordsPerPage,
			month = {year:req.query.y, month:req.query.m};
		if (tpe==="firstyear"){
			getFirstYear(mongo.DB, function(dt){
				res.status(200).send(dt);
			});
		} else {
			loadBPR(mongo.DB, {'tpe':tpe, 'max':max, 'month': month}, function(records, total){
				res.status(200).send({"records" : records, "total": total});
			});
		}
	},
	update: function(req, res){
		updateBPR(mongo.DB, req.body, function(r){
			res.status(200).send(r);
		});
	},
	updateNote: function(req, res){
		updateNote(mongo.DB, req.body, function(r){
			res.status(200).send(r);
		});
	},
	delete: function(req, res){
		if (req.query && req.query.id){
			deleteBPR(mongo.DB, req.query.id, function(){
				res.status(204);
			});
		} else {
			res.status(404);
		}
	}
};