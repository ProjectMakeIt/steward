// koubachi - personal weather station: http://www.koubachi.com

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


// var logger = climate.logger;


var Sensor = exports.Device = function(deviceID, deviceUID, info) {
  var param, self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.info = {};
  for (param in info.params) {
    if ((info.params.hasOwnProperty(param)) && (!!info.params[param])) self.info[param] = info.params[param];
  }
  sensor.update(self.deviceID, info.params);

  self.status = 'present';
  self.changed();

  utility.broker.subscribe('actors', function(request, taskIDID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Sensor, climate.Device);


Sensor.prototype.update = function(self, params) {
  var param, updateP;

  updateP = false;
  for (param in params) {
    if ((!params.hasOwnProperty(param)) || (!params[param]) || (self.info[param] === params[param])) continue;

    self.info[param] = params[param];
    updateP = true;
  }
  if (updateP) {
    self.changed();
    sensor.update(self.deviceID, params);
  }
};

exports.start = function() {
  steward.actors.device.climate.koubachi = steward.actors.device.climate.koubachi ||
      { $info     : { type: '/device/climate/koubachi' } };

  steward.actors.device.climate.koubachi.sensor =
      { $info     : { type       : '/device/climate/koubachi/sensor'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name        : true
                                   , status      : [ 'present' ]
                                   , placement   : true
                                   , lastSample  : 'timestamp'
                                   , nextSample  : 'timestamp'
                                   , moisture    : 'millibars'
                                   , temperature : 'celsius'
                                   , light       : 'lux'
                                   }
                    }
      };
  devices.makers['/device/climate/koubachi/sensor'] = Sensor;
};