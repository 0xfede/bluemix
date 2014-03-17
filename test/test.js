var bluemix = require('../index')

bluemix.on('ready', function() {
  console.log('ready');
  //process.exit(0);
});
bluemix.on('error', function(err) {
  console.log('error', err);
  //process.exit(1);
});
bluemix.init();