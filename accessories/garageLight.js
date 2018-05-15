var HIDdev = require('../utils/hiddev').HIDdev;

const CLEAR_OUT = 0x08;

var light_on = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x02,0x00,0,0,0];
var light_off = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x00,0x02,0,0,0];

//var lightOff = true;
module.exports = {
  garageLight: garageLight
}

function garageLight(log, params) {
  log("Initalising GarageLight");
  this.log = log;
//  log("params = ",params);
  this.lightOff = params.lightOff
  if (params.lightRelayNumber >0 && params.lightRelayNumber <5) {
    var lightRelayValue = 1 << params.lightRelayNumber -1;
    light_on[11]=lightRelayValue;
    light_off[12]=lightRelayValue;
  } else {
    log("ERROR incorrect lightRelayNumber");
  }

}

  garageLight.prototype.getPowerState = function () {
    this.log("Light State = ", this.lightOff);
    return this.lightOff;
  }

  garageLight.prototype.setPowerState = function(device) {
    if (this.lightOff) {
      var bytes = HIDdev.write(light_on);
      this.log("Light ON")
    } else {
      var bytes = HIDdev.write(light_off);
      this.log("Light OFF")
    }
    this.lightOff = !this.lightOff;
  }
