var Service, Characteristic,DoorState;
var HIDdev = require('./utils/hiddev').HIDdev;
const GarageDoor = require('./accessories/garageDoor.js').garageDoor;
const GarageLight = require('./accessories/garageLight.js').garageLight;
var process = require('process');

//HID Commands
/*
const CLEAR_OUT = 0x08;
const READ_ALL = 0x80;
*/
const CONFIGURE = 0x10;
var init = [CONFIGURE,0,0,0,0xf0,0,0,0,0,0x67,0,0,0,0,0,0];

//Vndor and Product IDs for th board
const VENDOR = 0x04d8;
const PRODUCT = 0x00df;
/*
var relay_on = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x01,0x00,0,0,0];
var relay_off = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x00,0x01,0,0,0];
var light_on = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x02,0x00,0,0,0];
var light_off = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x00,0x02,0,0,0];
*/

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  DoorState = homebridge.hap.Characteristic.CurrentDoorState;
  homebridge.registerAccessory("homebridge-hap-usb-relay", "HapUsbRelay", usbRelay);
};

function getVal(config, key, defaultVal) {
    var val = config[key];
    if (val === null) {
        return defaultVal;
    }
    return val;
}

function usbRelay(log, config) {

    this.log = log;
    this.config = config;
    this.name = config["name"];
    this.version = require('./package.json').version;
    log(this.name + " version " + this.version);
    if (process.geteuid() != 0) {
        log("WARNING! may not be able to control Relays because not running as root!");
      }

    //Get config.json values
    var door_parameters = {
      "doorRelayNumber": config["doorRelayNumber"],
      "doorSwitchValue": config["doorSwitchValue"],
      "doorSwitchPressTimeInMs": config["doorSwitchPressTimeInMs"],
      "closedDoorGPIO": config["closedDoorGPIO"],
      "openDoorGPIO": config["openDoorGPIO"],
      "doorPollInMs": config["doorPollInMs"],
      "doorOpensInSeconds": config["doorOpensInSeconds"],
      "closedDoorGPIOValue": config["closedDoorGPIOValue"],
      "openDoorGPIOValue": config["openDoorGPIOValue"],
      "doorState": DoorState
    }
//    log("Door Parameters = ", door_parameters);

    var light_parameters = {
      "lightOff": config["lightOff"],
      "lightRelayNumber": config["lightRelayNumber"]
    }
//    log("Light Parameters = ", light_parameters);

    //Connect to the relay device
    this.device = HIDdev.getDevice(VENDOR,PRODUCT);
    //Set up GPIO4 to GPIO7 as inputs
    HIDdev.write(init);
    log("Relay board initialised. GPIO4-7 are now Inputs");

    garageDoor = new GarageDoor(log, door_parameters);
    garageLight = new GarageLight(log, light_parameters);

    this.garageDoorOpener = new Service.GarageDoorOpener("Garage Door");
    this.garageDoorOpener
        .getCharacteristic(Characteristic.CurrentDoorState)
        .on('get', this.getCurrentDoorState.bind(this));
    this.garageDoorOpener
        .getCharacteristic(Characteristic.TargetDoorState)
        .on('get', this.getTargetDoorState.bind(this))
        .on('set', this.setTargetDoorState.bind(this));
    this.garageDoorOpener
        .getCharacteristic(Characteristic.ObstructionDetected)
        .on('get', this.getObstructionDetected.bind(this));

    this.infoService = new Service.AccessoryInformation();
    this.infoService
      .setCharacteristic(Characteristic.Manufacturer, "Opensource Community")
      .setCharacteristic(Characteristic.Model, "mcp2200relay")
      .setCharacteristic(Characteristic.SerialNumber, "Version 1.0.0");

    this.switchService = new Service.Switch("Garage Light");
    this.switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));

}

usbRelay.prototype.getCurrentDoorState = function(callback) {
//    var doorState = garageDoor.getCurrentDoorState()
    callback(null,garageDoor.getCurrentDoorState())
//    callback(null, 1); // OPEN=0, CLOSED=1, OPENING=2, CLOSING=3, STOPPED=4
}

usbRelay.prototype.getTargetDoorState = function(callback) {

   callback(null, garageDoor.getTargetDoorState()); // OPEN=0, CLOSED=1
}

usbRelay.prototype.setTargetDoorState = function(targetState, callback) {

   callback(null, garageDoor.setTargetDoorState(targetState)); // OPEN=0, CLOSED=1
}

usbRelay.prototype.getObstructionDetected = function(callback) {
   callback(null, garageDoor.getObstructionDetected()); // 0=NO, 1=YES
}

usbRelay.prototype.getPowerState = function (callback) {
  var LightStatus = garageLight.getPowerState();
  this.log("Light Off = ", LightStatus);
  callback(null, !LightStatus);
}

usbRelay.prototype.setPowerState = function(powerOn, callback) {
  garageLight.setPowerState(this.device);
  callback()
}

usbRelay.prototype.getServices = function() {
  return [this.infoService, this.garageDoorOpener, this.switchService];
//    return [this.infoService, this.garageDoorOpener, this.switchService];
}
