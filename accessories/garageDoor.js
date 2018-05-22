const TEST = false;

var HIDdev = require('../utils/hiddev').HIDdev;

//HID Commands
const CLEAR_OUT = 0x08;
var relay_on = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x01,0x00,0,0,0];
var relay_off = [CLEAR_OUT,0,0,0,0,0,0,0,0,0,0,0x00,0x01,0,0,0];

var hasOpenSensor = false;
var hasClosedSensor = false;
var openDoorGPIO;
var openDoorGPIOValue;
var closedDoorGPIO;
var closedDoorGPIOValue;
var wasClosed = true;
var targetState = 1; //Closed
var currentState = 1;
var doorSwitchPressTimeInMs;
var DoorState;
var operating = false;
var obstructionDetected = false;
var testState;

module.exports = {
  garageDoor: garageDoor
}

function garageDoor(log, params) {

  log("Initalising GarageDoor");
  this.log = log;
  //log("Door Parameters = ", params);
  DoorState = params.doorState;
  log("Initial Door State = ", DoorState);
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
  testState = 0;
}

garageDoor.prototype.getCurrentDoorState = function() {
  if (!TEST) {
   if (this.isClosed()) {
    currentState = DoorState.CLOSED;
    } else if (hasOpenSensor) {
        currentState = this.isOpen() ? DoorState.OPEN : DoorState.STOPPED;
      } else {
        currentState = DoorState.OPEN;
      }
      if (currentState == DoorState.STOPPED) {
        obstructionDetected = true;
      }
    }
    this.log("Current Door State =", this.doorStateToString(currentState));
    return currentState;
  }

garageDoor.prototype.getTargetDoorState = function() {
  this.log("Garage Door Target =", this.doorStateToString(targetState));
  return targetState; // OPEN=0, CLOSED=1
}

garageDoor.prototype.setTargetDoorState = function(target) {
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
    this.log("Garage Door State =", this.doorStateToString(currentState));
    setTimeout(this.setFinalDoorState.bind(this), doorOpensInSeconds * 1000);
    this.switchOn();
    return targetState;
  }

}

garageDoor.prototype.setFinalDoorState = function() {
  if (TEST) {
    switch (testState) {
      case 0:
        currentState = DoorState.OPEN;
        obstructionDetected = false;
        wasClosed = false;
        testState++;
        this.log("[TEST] Door has opened")
        break;
      case 1:
        currentState = DoorState.CLOSED;
        obstructionDetected = false;
        wasClosed = true;
        testState++;
        this.log("[TEST] Door has closed")
        break;
      case 2:
        currentState = DoorState.STOPPED;
        obstructionDetected = true;
        wasClosed = false;
        testState++;
        this.log("[TEST] Door is stuck. Door State is ", this.doorStateToString(currentState));
        break;
      default:
        currentState = DoorState.CLOSED;
        obstructionDetected = false;
        wasClosed = false;
        testState++;
        this.log("[TEST] Dropped through to default")
      }
    } else {
      var isClosed = this.isClosed();
      var isOpen = this.isOpen();
      // Check if door has moved
      if ( (targetState == DoorState.CLOSED && !isClosed) || (targetState == DoorState.OPEN && !isOpen) ) {
        this.log("Was trying to " + (targetState == DoorState.CLOSED ? "CLOSE" : "OPEN") + " the door, but it is still " + (isClosed ? "CLOSED":"OPEN"));
        obstructionDetected = false;
        currentState = DoorState.STOPPED;
      } else if ((targetState == DoorState.CLOSED && isClosed) || (targetState == DoorState.OPEN && isOpen) ) {
        // Door has opened/closed correctly
        this.log("Set current state to " + (targetState == DoorState.CLOSED ? "CLOSED" : "OPEN"));
        wasClosed = targetState == DoorState.CLOSED;
        currentDoorState = targetState;
        obstructionDetected = false;
      } else {
        // Door is obstructed
        currentState = DoorState.STOPPED;
        obstructionDetected = true;
      }
      this.log("Obstruction detected =",(obstructionDetected ? "TRUE":"FALSE"))
      operating = false;
    }
}

garageDoor.prototype.getObstructionDetected = function() {
  this.log("Garage Door Obstruction Detected = ",(obstructionDetected ? "TRUE":"FALSE"))
   return obstructionDetected; // 0=NO, 1=YES
}

garageDoor.prototype.readGPIO = function(pin) {
  var data = HIDdev.read();
  var result = data >> pin & 1;
  this.log("GPIO " + pin + " is: " + result);
  return result;
}

garageDoor.prototype.isClosed = function() {
  if (!TEST) {
    if (hasClosedSensor) {
      return this.readGPIO(closedDoorGPIO) == closedDoorGPIOValue;
    } else if (hasOpenSensor) {
      return !this.isOpen();
    } else {
      return wasClosed;
    }
  }
  return currentState == DoorState.CLOSED;
}

garageDoor.prototype.isOpen = function() {
  if (!TEST) {
    if (hasOpenSensor) {
      return this.readGPIO(openDoorGPIO) == openDoorGPIOValue;
    } else if (hasClosedSensor) {
      return !this.isClosed();
    } else {
      return !wasClosed;
    }
  }
  return currentState == DoorState.OPEN;
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

garageDoor.prototype.doorStateToString = function(state) {
  switch (state) {
    case DoorState.OPEN:
      return "OPEN";
    case DoorState.CLOSED:
      return "CLOSED";
    case DoorState.STOPPED:
      return "STOPPED";
    case DoorState.OPENING:
      return "OPENING";
    case DoorState.CLOSING:
      return "CLOSING";
    default:
      return "UNKNOWN";
    }
  }
