/**
 * dbConnector('mongodb://localhost:27017/slackdb', function(worker){
            worker.insert(new Date(), { id: 1, description: 'test task'}, 'in progress', { id: 1, name: 'Test User' });
            var users = worker.findByDate(new Date(), 1);
            console.log(users);
            worker.updateStatus(1, 'done');
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            var newUsers = worker.findByDateRange(new Date(), tomorrow, 1)
        });
 */

var mongodb = require('mongodb');
var dbObj = null;

module.exports = function(connectionString, callback){
    mongodb.MongoClient.connect(connectionString, function (err, db) {
        if (err) {
            throw err;
        }
        console.log('Connection established to mongodb');
        callback(prepareWorker(db));
    });
}

var prepareWorker = function(db){
    var collection = db.collection('tasks');
    return {
        insert: function(date, task, status, user){
            collection.insert( {
                date: date.setHours(0,0,0,0),
                task: task,
                status: status,
                user: user
            }, function(err, res){
                if (err)
                    throw err;
                console.log('document is inserted');
            });
        },
        findByDate: function(date, userId, callback){
            collection.find({date: date.setHours(0,0,0,0), 'user.id': userId}).toArray(function(err, result) {
                if (err) throw err;
                console.log(result);
                callback(result);
              });
        },
        findByDateRange: function(startDate, endDate, userId){
            collection.find({
                        date: {$gte: startDate.setHours(0,0,0,0) }, 
                        date: {$lte: endDate.setHours(0,0,0,0)},
                        'user.id': userId})
                    .toArray(function(err, result) {
                if (err) throw err;
                console.log(result);
              });
        },
        updateStatus: function(taskId, newStatus){
            collection.update({ 'task.id': taskId}, {$set : { status: newStatus }}, function(err, res){
                if (err)
                    throw err;
                console.log('document is updated');
            });
        }
    };
}