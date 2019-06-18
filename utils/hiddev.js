var HID = require('node-hid');
var dev;

var HIDdev = function () {
  console.log("Running HID function");
}
var myDevice;

HIDdev.open = function (device) {
  console.log("Running init function");
  return device;
}

HIDdev.getDevice = function (vendor,product) {

  dev = new HID.HID(vendor,product);
  return dev;
  }

HIDdev.read = function () {
  //console.log("Running read function");
  //First send READ_ALL command
try {
    var bytesSent = dev.write([0x80,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
  } catch(err) {
    console.log(err);
    return 0;
}
  //Now get response
  var data_read = dev.readTimeout(1000);
  return data_read[10];
}

HIDdev.write = function (data) {
  console.log("Running write function");
  var bytesSent = dev.write(data);
  console.log("sendData bytes sent",bytesSent);
  return bytesSent;
}
module.exports = {
  HIDdev: HIDdev
}
