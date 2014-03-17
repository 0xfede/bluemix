var util = require('util')
  , events = require('events')
  , async = require('async')
  , mongodb = require('mongodb')
  , amqp = require('amqp')

function _isValidService(service) {
  return service && service.name && service.label && service.credentials;
}
function _initMongoDB(bluemix, service) {
  return function(cb) {
    if (!_isValidService(service) || !service.credentials.url) {
      cb('invalid_service');
    } else {
      mongodb.MongoClient.connect(service.credentials.url, function(err, db) {
        if (err) {
          cb(err);
        } else if (!db) {
          cb('no_db');
        } else {
          if (!bluemix.db) bluemix.db = db;
          if (!bluemix.mongodb) bluemix.mongodb = db;
          if (!bluemix[service.label]) bluemix[service.label] = {};
          bluemix[service.label][service.name] = db;
          cb();
        }
      });
    }
  }
}
function _initRabbitMQ(bluemix, service) {
  return function(cb) {
    if (!_isValidService(service) || !service.credentials.url) {
      cb('invalid_service');
    } else {
      var conn = amqp.createConnection({ url: service.credentials.url });
      conn.on('ready', function() {
        if (!bluemix.mq) bluemix.mq = conn;
        if (!bluemix.rabbitmq) bluemix.rabbitmq = conn;
        if (!bluemix[service.label]) bluemix[service.label] = {};
        bluemix[service.label][service.name] = conn;
        cb();
      });
      conn.on('error', function(err) {
        cb(err);
      });
    }
  }
}

function BlueMix()
{ 
  events.EventEmitter.call(this);
  this.config = {
    services: JSON.parse(process.env.VCAP_SERVICES || "{}"),
    appInfo: JSON.parse(process.env.VCAP_APPLICATION || "{}"),
    tmpDir: (process.env.TMPDIR || '/tmp'),
    host: (process.env.VCAP_APP_HOST || 'localhost'),
    port: (process.env.VCAP_APP_PORT || 3000)
  };
}
util.inherits(BlueMix, events.EventEmitter);
BlueMix.prototype.init = function() {
  var initTasks = [];
  var self = this;
  for (var i in self.config.services) {
    var s = self.config.services[i];
    switch(i) {
    case 'mongodb-2.2':
      for (var j = 0 ; j < s.length ; j++) {
        initTasks.push(_initMongoDB(self, s[j]));
      }
      break;
    case 'rabbitmq-2.8':
      for (var j = 0 ; j < s.length ; j++) {
        initTasks.push(_initRabbitMQ(self, s[j]));
      }
      break;
    default:
      console.warn('Unsupported service type: ' + i);
      break;
    }
  }
  if (initTasks.length) {
    async.parallel(initTasks, function(err) {
      if (err) {
        self.emit('error', err);
      } else {
        self.emit('ready');
      }
    });
  } else {
    self.emit('ready');
  }
}

module.exports = new BlueMix();
