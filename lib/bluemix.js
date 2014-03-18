var util = require('util')
  , events = require('events')
  , async = require('async')

function _isValidService(service) {
  return service && service.name && service.label && service.credentials;
}
function _initMongoDB(bluemix, service) {
  return function(cb) {
    if (!_isValidService(service) || !service.credentials.url) {
      cb('invalid_service');
    } else {
      try {
        var mongodb = require('mongodb');
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
      } catch(e) {
        cb(e);
      }
    }
  }
}
function _initRabbitMQ(bluemix, service) {
  return function(cb) {
    if (!_isValidService(service) || !service.credentials.url) {
      cb('invalid_service');
    } else {
      try {
        var amqp = require('amqp');
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
      } catch(e) {
        cb(e);
      }
    }
  }
}
function _initMysql(bluemix, service) {
  return function(cb) {
    if (!_isValidService(service) || !service.credentials.username || !service.credentials.password ||
        !service.credentials.host || !service.credentials.port) {
      cb('invalid_service');
    } else {
      try {
        var mysql = require('mysql');
        var conn = mysql.createConnection({
          host: service.credentials.host,
          port: service.credentials.port,
          user: service.credentials.username,
          password: service.credentials.password
        });
        conn.connect(function(err) {
          if (err) {
            cb(err);
          } else {
            if (!bluemix.db) bluemix.db = conn;
            if (!bluemix.mysql) bluemix.mysql = conn;
            if (!bluemix[service.label]) bluemix[service.label] = {};
            bluemix[service.label][service.name] = conn;
            cb();
          }
        });
      } catch(e) {
        cb(e);
      }
    }
  }
}
function _initRedis(bluemix, service) {
  return function(cb) {
    if (!_isValidService(service) || !service.credentials.host || !service.credentials.port || !service.credentials.password) {
      cb('invalid_service');
    } else {
      try {
        var redis = require('redis');
        var conn = redis.createClient(service.credentials.port, service.credentials.host, {
          auth_pass: service.credentials.password
        });
        conn.on('ready', function() {
          if (!bluemix.redis) bluemix.redis = conn;
          if (!bluemix[service.label]) bluemix[service.label] = {};
          bluemix[service.label][service.name] = conn;
          cb();
        });
        conn.on('error', function(err) {
          cb(err);
        });
      } catch(e) {
        cb(e);
      }
    }
  }
}

function BlueMix() { 
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
BlueMix.prototype.getServices = function(type) {
  if (util.isRegExp(type)) {
    for (var i in this.services) {
      if (type.exec(i)) {
        return this.services[i];
      }
    }
  } else if (this.services[type]) {
    return this.services[type];
  } else {
    return null;
  } 
}
BlueMix.prototype.getService = function(type) {
  var s = this.getServices(type);
  return s ? s[0] : null;
}
BlueMix.prototype.init = function(requiredServices) {
  function checkRequiredServices() {
    var ok = true;
    if (util.isArray(requiredServices)) {
      for (var i = 0 ; ok && i < requiredServices.length ; i++) {
        if (!self[requiredServices[i]]) {
          self.emit('error', 'missing service ' + requiredServices[i]);
          ok = false;
        }
      }
    }
    if (ok) self.emit('ready');
  }
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
    case 'mysql-5.5':
      for (var j = 0 ; j < s.length ; j++) {
        initTasks.push(_initMysql(self, s[j]));
      }
      break;
    case 'redis-2.6':
      for (var j = 0 ; j < s.length ; j++) {
        initTasks.push(_initRedis(self, s[j]));
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
        checkRequiredServices();
      }
    });
  } else {
    checkRequiredServices();
  }
}

module.exports = new BlueMix();
