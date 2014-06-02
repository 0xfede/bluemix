var util = require('util')
  , events = require('events')
  , async = require('async')

function Service() {
}
Service.isValid = function(service) {
  return service && service.name && service.label && service.credentials;
}
Service.prototype.match = function(service) {
  return false;
}
Service.prototype.init = function(bluemix, service) {
  throw new Error('unimplemented');
}

function MongoDB(version) {
  Service.call(this);
  this.version = version;
}
util.inherits(MongoDB, Service);
MongoDB.prototype.match = function(service) {
  return service && service.label === ('mongodb-' + this.version);
}
MongoDB.prototype.init = function(bluemix, service) {
  return function(cb) {
    if (!Service.isValid(service) || !service.credentials.url) {
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

function RabbitMQ(version) {
  Service.call(this);
  this.version = version;
}
util.inherits(RabbitMQ, Service);
RabbitMQ.prototype.match = function(service) {
  return service && service.label === ('rabbitmq-' + this.version);
}
RabbitMQ.prototype.init = function(bluemix, service) {
  return function(cb) {
    if (!Service.isValid(service) || !service.credentials.url) {
      cb('invalid_service');
    } else {
      try {
        var amqp = require('amqp');
        var conn = amqp.createConnection({ url: service.credentials.url });
        var called = false;
        conn.on('ready', function() {
          if (!bluemix.mq) bluemix.mq = conn;
          if (!bluemix.rabbitmq) bluemix.rabbitmq = conn;
          if (!bluemix[service.label]) bluemix[service.label] = {};
          bluemix[service.label][service.name] = conn;
          if (!called) {
            called = true;
            cb();
          }
        });
        conn.on('error', function(err) {
          console.error('bluemix.rabbitmq', err)
          if (!called) {
            called = true;
            cb(err);
          }
        });
      } catch(err) {
        console.error('bluemix.rabbitmq', err)
        if (!called) {
          called = true;
          cb(err);
        }
      }
    }
  }
}

function Mysql(version) {
  Service.call(this);
  this.version = version;
}
util.inherits(Mysql, Service);
Mysql.prototype.match = function(service) {
  return service && service.label === ('mysql-' + this.version);
}
Mysql.prototype.init = function(bluemix, service) {
  return function(cb) {
    if (!Service.isValid(service) || !service.credentials.username || !service.credentials.password ||
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

function Redis(version) {
  Service.call(this);
  this.version = version;
}
util.inherits(Mysql, Service);
Redis.prototype.match = function(service) {
  return service && service.label === ('redis-' + this.version);
}
Redis.prototype.init = function(bluemix, service) {
  return function(cb) {
    if (!Service.isValid(service) || !service.credentials.host || !service.credentials.port || !service.credentials.password) {
      cb('invalid_service');
    } else {
      try {
        var redis = require('redis');
        var conn = redis.createClient(service.credentials.port, service.credentials.host, {
          auth_pass: service.credentials.password
        });
        var called = false;
        conn.on('ready', function() {
          if (!bluemix.redis) bluemix.redis = conn;
          if (!bluemix[service.label]) bluemix[service.label] = {};
          bluemix[service.label][service.name] = conn;
          if (!called) {
            called = true;
            cb();
          }
        });
        conn.on('error', function(err) {
          if (!called) {
            called = true;
            cb(err);
          }
        });
      } catch(err) {
        if (!called) {
          called = true;
          cb(err);
        }
      }
    }
  }
}

function BlueMix() { 
  events.EventEmitter.call(this);
  this.Service = Service;
  this.serviceFactories = [
    new MongoDB('2.2'),
    new RabbitMQ('2.8'),
    new Mysql('5.5'),
    new Redis('2.6')
  ];
  this.config = {
    services: JSON.parse(process.env.VCAP_SERVICES || "{}"),
    appInfo: JSON.parse(process.env.VCAP_APPLICATION || "{}"),
    tmpDir: (process.env.TMPDIR || '/tmp'),
    host: (process.env.VCAP_APP_HOST || 'localhost'),
    port: (process.env.VCAP_APP_PORT || 3000)
  };
}
util.inherits(BlueMix, events.EventEmitter);
BlueMix.prototype.registerServiceFactory = function(factory) {
  this.serviceFactories.push(factory);
}
BlueMix.prototype.getServices = function(type) {
  for (var i in this.config.services) {
    if ((util.isRegExp(type) && (type.exec(i) || type.exec(this.config.services[i].name))) ||
        (type === i || this.config.services[i].name === type)) {
      return this.config.services[i];
    }
  }
  return null;
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
    for (var j = 0 ; j < self.config.services[i].length ; j++) {
      var s = self.config.services[i][j];
      for (var k = 0, found = false ; !found && k < self.serviceFactories.length ; k++) {
        if (self.serviceFactories[k].match(s)) {
          initTasks.push(self.serviceFactories[k].init(self, s));
          found = true;
        }
      }
      if (!found) {
        console.warn('Unsupported service ' + s.label + '/' + i);
      }
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
