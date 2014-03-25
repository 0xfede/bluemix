# bluemix
Node.js helper module for IBM BlueMix. 

This module automates some common intialization tasks for Node.js applications running
on IBM BlueMix. The main features of the module are:

* parsing of common configuration enviroment variales (host, port, temporary directory)
* parsing of VCAP services
* search of VCAP services by name and pattern
* automatic initialization of common services


## How to Install
```bash
npm install bluemix
```


## Example
The following sample code initializes an Express.js application and connects it to mongodb:
```js
var bluemix = require('bluemix')
  , express = require('express')
  , app = express()

app.use(app.router);
app.use(express.errorHandler());

bluemix.on('ready', function() {
  app.listen(bluemix.config.port, bluemix.config.host);
  console.log('App started on port ' + bluemix.config.port + ' and connected to mongodb');
  
  bluemix.db.collection('test').find().toArray(function(err, data) {
    if (err) {
      // handle error
    } else {
      // work with data
    }
  });
});
bluemix.on('error', function(err) {
  console.error('App init failed', err);
});
bluemix.init(['mongodb']);
```


## Reference

### bluemix.config
The object `bluemix.config` is automatically initilized at startup and contains the following attributes:
- `host`, hostname/address of the application
- `port`, port of the application
- `tmpDir`, temporary directory of the application



### bluemix.getServices(name)
Returns a list of services matching `name`, which can be a string or a RegExp. Example:
```js
// get an array of available mongodb-2.2 services
var a1 = bluemix.getServices('mongodb-2.2');

// get an array of mysql services, regardless of the version
var a2 = bluemix.getServices(/mysql/);
```


### bluemix.getService(name)
Returns the first service matching `name`, which can be a string or a RegExp. Example:
```js
// get the first available mongodb-2.2 service
var s1 = bluemix.getService('mongodb-2.2');

// get the first mysql service, regardless of the version
var s2 = bluemix.getService(/mysql/);
```


### bluemix.init([dependencies])
Connects to all the available (and supported) services. 
The method emits a `ready` event upon successful connection all the services and if all the dependencies
(if any) are satisfied. It emits an `error` event otherwise.


## Supported services
The following table lists the supported services, which drivers (npm modules) are used to connect and how to access them:
Service | Service name | Driver | Connected client instance 
--- | --- | --- | ---
MongoDB | mongodb-2.2 | mongodb | bluemix.db, bluemix.mongodb
RabbitMQ | rabbitmq-2.8 | amqp | bluemix.mq, bluemix.rabbitmq
Mysql | mysql-5.5 | mysql | bluemix.db, bluemix.mysql
Redis | redis-2.6 | redis | bluemix.redis

If both MongoDB and Mysql are defined, `bluemix.db` will point to the first one that was encountered. The same applies if multiple MongoDB (or Mysql) services are defined.
Services can also be accessed as `bluemix[service type][service name]`:
```js
bluemix['mongodb-2-2']['mongo-abcde']
```
