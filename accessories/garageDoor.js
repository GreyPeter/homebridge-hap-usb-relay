var HIDdev = require('../utils/hiddev').HIDdev;
var DoorState;

//HID Commands
const CLEAR_OUT = 0x08;
const CONFIGURE = 0x10;
const READ_ALL = 0x80;
//Vndor and Product IDs for th board
const VENDOR = 0x04d8;
const PRODUCT = 0x00df;

var relay_on = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x01,0x00,0,0,0];
var relay_off = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x00,0x01,0,0,0];
//var init = [CONFIGURE,0,0,0,0xf0,0,0,0,0,0x67,0,0,0,0,0,0];

var hasOpenSensor = false;
var hasClosedSensor = false;
var openDoorGPIO;
var openDoorGPIOValue;
var closedDoorGPIO;
var closedDoorGPIOValue;
var wasClosed = true;
var targetState = 1 //Closed
var currentState;
var doorSwitchPressTimeInMs;
var DoorState;
var operating = false;

module.exports = {
  garageDoor: garageDoor
}

function garageDoor(log, params) {

  log("Initalising GarageDoor");
  this.log = log;
  log("Door Parameters = ", params);
  DoorState = params.doorState;
  if (params.doorRelayNumber >0 && params.doorRelayNumber <5) {
    var doorRelayValue = 1 << params.doorRelayNumber -1;
    relay_on[11]=doorRelayValue;
    relay_off[12]=doorRelayValue;
  } else {
    console.error("ERROR incorrect doorRelayNumber");
  }
  //this.closedDoorGPIO = params.closedDoorGPIO;
  if (params.closedDoorGPIO != null) {
    closedDoorGPIO = params.closedDoorGPIO;
    hasClosedSensor = true;
    log('Has a closed sensor');
  } else {
    log('No closed sensor')
  }
  //this.openDoorGPIO = params.openDoorGPIO;
  if (params.openDoorGPIO != null) {
    openDoorGPIO = params.openDoorGPIO;
    hasOpenSensor = true;
    log("Has an open sensor");
  } else {
    log('No open sensor')
  }
  closedDoorGPIOValue = params.closedDoorGPIOValue;
  openDoorGPIOValue = params.openDoorGPIOValue;
  doorSwitchPressTimeInMs = params.doorSwitchPressTimeInMs;
  log("Door switch press time = ", doorSwitchPressTimeInMs);
  doorOpensInSeconds = params.doorOpensInSeconds;
}

garageDoor.prototype.getCurrentDoorState = function() {
  if (this.isClosed()) {
    currentState = DoorState.CLOSED;
  } else if (hasOpenSensor) {
      currentState = this.isOpen() ? DoorState.OPEN : DoorState.STOPPED;
    } else {
      currentState = DoorState.OPEN;
    }
    return currentState;
  }

garageDoor.prototype.getTargetDoorState = function() {
  this.log("Garage Door Target = ", targetState);
  return targetState; // OPEN=0, CLOSED=1
}

garageDoor.prototype.setTargetDoorState = function(target, callback) {
  targetState = target;
  var isClosed = this.isClosed();
  if ((target == DoorState.OPEN && isClosed) || (target == DoorState.CLOSED && !isClosed)) {
    this.log("Triggering Door Relay");
    operating = true;
    if (target == DoorState.OPEN) {
        currentState = DoorState.OPENING;
    } else {
        currentState = DoorState.CLOSING;
    }
    setTimeout(this.setFinalDoorState.bind(this), doorOpensInSeconds * 1000);
    this.switchOn();

  }

}

garageDoor.prototype.setFinalDoorState = function() {
  var isClosed = this.isClosed();
  var isOpen = this.isOpen();
  if ( (targetState == DoorState.CLOSED && !isClosed) || (targetState == DoorState.OPEN && !isOpen) ) {
    this.log("Was trying to " + (targetState == DoorState.CLOSED ? "CLOSE" : "OPEN") + " the door, but it is still " + (isClosed ? "CLOSED":"OPEN"));
    currentState = DoorState.STOPPED;
  } else {
    this.log("Set current state to " + (targetState == DoorState.CLOSED ? "CLOSED" : "OPEN"));
    wasClosed = targetState == DoorState.CLOSED;
    currentDoorState = targetState;
  }
  operating = false;
}

garageDoor.prototype.getObstructionDetected = function(callback) {
  this.log("Garage Door Obstruction Detected - NO")
   return 0; // 0=NO, 1=YES
}

garageDoor.prototype.readGPIO = function(pin) {
  var data = HIDdev.read();
  var result = data >> pin & 1;
  this.log("GPIO " + pin + " is: " + result);
  return result;
}

garageDoor.prototype.isClosed = function() {
  if (hasClosedSensor) {
      return this.readGPIO(closedDoorGPIO) == closedDoorGPIOValue;
  } else if (hasOpenSensor) {
      return !this.isOpen();
  } else {
      return wasClosed;
  }
}

garageDoor.prototype.isOpen = function() {
  if (hasOpenSensor) {
      return this.readGPIO(openDoorGPIO) == openDoorGPIOValue;
  } else if (hasClosedSensor) {
      return !this.isClosed();
  } else {
      return !wasClosed;
  }
}

garageDoor.prototype.switchOn = function() {
  var bytes = HIDdev.write(relay_on);
  this.log("Turning on GarageDoor Relay");
  setTimeout(this.switchOff.bind(this), this.doorSwitchPressTimeInMs);
}

garageDoor.prototype.switchOff = function() {
  var bytes = HIDdev.write(relay_off);
  this.log("Turning off GarageDoor Relay");
}
