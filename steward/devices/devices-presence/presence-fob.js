// BLE: http://developer.bluetooth.org/gatt/services/Pages/ServiceViewer.aspx?u=org.bluetooth.service.immediate_alert.xml

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , presence    = require('./../device-presence')
  ;


var levels = { none: 0x00, mild: 0x01, high: 0x02 };

var logger = presence.logger;


var Fob = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'present';
  self.changed();
  self.peripheral = info.peripheral;
  self.info = { rssi: self.peripheral.rssi };

  self.peripheral.connect(function(err) {
    if (err) return logger.error('device/' + self.deviceID, { event: 'connect', diagnostic: err.message });

    self.peripheral.discoverSomeServicesAndCharacteristics([ '1802' ], [ '2a06' ], function(err, services, characteristics) {
      if (err) return logger.error('device/' + self.deviceID, { event: 'discover', diagnostic: err.message });

      self.alert = characteristics[0];
    });
  });

  self.peripheral.on('disconnect', function() {
    self.alert = undefined;
    self.status = 'recent';
    self.changed();

    logger.info('device/' + self.deviceID, { status: self.status });
// TBD: handle connection timeout...
    setTimeout(function() { self.status = 'absent'; self.changed(); self.peripheral.connect(); }, 120 * 1000);
  });
  self.peripheral.on('rssiUpdate', function(rssi) {
    self.status = 'present';
    self.info.rssi = rssi;
    self.changed();

    logger.info('device/' + self.deviceID, { status: self.status });
  });

  utility.broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(Fob, presence.Device);


Fob.prototype.perform = function(self, taskID, perform, parameter) {
  var level, params;

  try { params = JSON.parse(parameter); } catch(ex) { params = {}; }

  if (perform === 'set') {
    if (!!params.name) return self.setName(params.name);
    return false;
  }
  if (perform !== 'alert') return false;

  level = levels[params.level] || 0x00;

  try {
    self.alert.write(new Buffer([ level ]));
    setTimeout(function() { self.alert.write(new Buffer([ 0x00 ])); }, 2000);
    steward.performed(taskID);
  } catch(ex) { logger.error('device/' + self.deviceID, { event: 'perform', diagnostic: ex.message }); }

  return true;
};


var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] };

  if ((perform !== 'set') && (perform !== 'alert')) result.invalid.push('perform');
  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }
  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (perform === 'set') {
    if (!params.name) result.requires.push('name');
  } else if (perform === 'alert') {
    if (!params.level) result.requires.push('level');
    else if (!levels[params.level]) result.invalid.push('level');
  }

  return result;
};


exports.start = function() {
  var fob, register;

  register = require('./../../discovery/discovery-ble').register;

  steward.actors.device.presence.fob =
      { $info     : { type       : '/device/presence/fob'
                    , observe    : [ ]
                    , perform    : [ 'alert' ]
                    , properties : { name   : true
                                   , status : [ 'present', 'absent', 'recent' ]
                                   , rssi   : 's8'
                                   , level  : [ 'none', 'mild', 'high' ]
                                   }
                    }
      , $validate : { perform    : validate_perform }
      };
  fob = utility.clone(steward.actors.device.presence.fob);
  devices.makers['/device/presence/fob'] = Fob;

  steward.actors.device.presence.fob.inrange = utility.clone(fob);
  steward.actors.device.presence.fob.inrange.$info.type = '/device/presence/fob/inrange';
  devices.makers['/device/presence/fob/inrange'] = Fob;
  register('/device/presence/fob/inrange', 'Philips AEA1000', [ '1802', '1803' ]);

  steward.actors.device.presence.fob.hone = utility.clone(fob);
  steward.actors.device.presence.fob.hone.$info.type = '/device/presence/fob/hone';
  devices.makers['/device/presence/fob/hone'] = Fob;
  register('/device/presence/fob/hone', 'Hone', [ '1802' ]);
};
