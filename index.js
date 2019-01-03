var Service, Characteristic,DoorState,Obstructed;
var HIDdev = require('./utils/hiddev').HIDdev;
const GarageDoor = require('./accessories/garageDoor.js').garageDoor;
const GarageLight = require('./accessories/garageLight.js').garageLight;
var process = require('process');
var doorState = 0;

//HID Commands
const CONFIGURE = 0x10;
var init = [CONFIGURE,0,0,0,0xf0,0,0,0,0,0x67,0,0,0,0,0,0];

//Vndor and Product IDs for th board
const VENDOR = 0x04d8;
const PRODUCT = 0x00df;


module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  DoorState = homebridge.hap.Characteristic.CurrentDoorState;
  Obstructed = homebridge.hap.Characteristic.ObstructionDetected;
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
    this.door_parameters = {
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

    garageDoor = new GarageDoor(log, this.door_parameters);
    garageLight = new GarageLight(log, light_parameters);

    this.garageDoorOpener = new Service.GarageDoorOpener("Garage Door");
    this.garageDoorOpener
        .getCharacteristic(DoorState)
        .on('get', this.getCurrentDoorState.bind(this));
    this.garageDoorOpener
        .getCharacteristic(Characteristic.TargetDoorState)
        .on('get', this.getTargetDoorState.bind(this))
        .on('set', this.setTargetDoorState.bind(this));
    this.garageDoorOpener
        .getCharacteristic(Obstructed)

    this.infoService = new Service.AccessoryInformation();
    this.infoService
      .setCharacteristic(Characteristic.Manufacturer, "Opensource Community")
      .setCharacteristic(Characteristic.Model, this.name)
      .setCharacteristic(Characteristic.SerialNumber, this.version);

    this.switchService = new Service.Switch("Garage Light");
    this.switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
    log("Start Door State Monitor");
//    this.monitorDoorState.bind(this);
    setTimeout(this.monitorDoorState.bind(this), this.door_parameters.doorPollInMs);
}

usbRelay.prototype.monitorDoorState = function() {
      if (doorState != garageDoor.getCurrentDoorState()) {
        doorState = garageDoor.getCurrentDoorState();
        this.garageDoorOpener.setCharacteristic(Characteristic.CurrentDoorState, doorState);
        this.log("[monitorDoorState] Door State =", garageDoor.doorStateToString(doorState));
      }
      var obstructed = garageDoor.getObstructionDetected();
      if (obstructed) {
        this.garageDoorOpener.setCharacteristic(Characteristic.ObstructionDetected, obstructed);
        this.log("GARAGE DOOR IS OBSTRUCTED");
      }
      setTimeout(this.monitorDoorState.bind(this), this.door_parameters.doorPollInMs);
    }


usbRelay.prototype.getCurrentDoorState = function(callback) {
  this.log("Current Door State =",garageDoor.getCurrentDoorState());
  callback(null,garageDoor.getCurrentDoorState());
}

usbRelay.prototype.getTargetDoorState = function(callback) {
  this.log("Target Door State =",garageDoor.getTargetDoorState());
  callback(null, garageDoor.getTargetDoorState()); // OPEN=0, CLOSED=1
}

usbRelay.prototype.setTargetDoorState = function(targetState, callback) {
   callback(null, garageDoor.setTargetDoorState(targetState)); // OPEN=0, CLOSED=1
}

usbRelay.prototype.getObstructionDetected = function(callback) {
  this.log("Obstruction detected =",garageDoor.getObstructionDetected());
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
}
