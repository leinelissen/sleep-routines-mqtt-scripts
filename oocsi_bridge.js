require('dotenv').config();
const mqtt = require('mqtt');
const OOCSI = require('./lib/oocsi');

/**====================================================
 * MQTT
 =====================================================*/

// Create MQTT client
var client = mqtt.connect(process.env.MQTT_HOST, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
});

// Create connection handler
client.on('connect', function () {
    console.log('Connected to MQTT server.');

    // Subscribe to channel
    client.subscribe('/sleep-routines', function(err) {
        if (err) {
            process.exit(1);
        }
    })
});

// Create incoming MQTT message handler
client.on('message', function(topic, data) {
    // Parse JSON data
    const message = JSON.parse(data);

    // Check if this is a redirected message
    if (message.redirected) {
        // If it is, exit the function
        return;
    }

    // If not, add the redirect paramter
    const data = {
        ...message,
        redirected: true,
    }

    // And move it over to OOCSI
    OOCSI.send('eveningroutineChannel', data);

    // Also move this data to a side-effects function so that we can trigger
    // other stuff (such as LEDs) consistently from both ends.
    causeSideEffects(data);
});

/**====================================================
 * OOCSI
 =====================================================*/

// Init OOCSI client
OOCSI.connect(process.env.OOCSI_SERVER);

OOCSI.subscribe('eveningroutineChannel', function(message) {
    // Check if this is a redirected message
    if (message.redirected) {
        // If it is, exit the function
        return;
    }

    // If not, add the redirect paramter
    const data = {
        ...message,
        redirected: true,
    }

    // And move it over to MQTT
    client.publish('eveningroutineChannel', JSON.stringify(data));

    // Also move this data to a side-effects function so that we can trigger
    // other stuff (such as LEDs) consistently from both ends.
    causeSideEffects(data);
});

/**====================================================
 * SIDE EFFECTS
 =====================================================*/

 // A function for handling any side effects from the sleep routines channels on
 // both MQTT and OOCSI
function causeSideEffects(message) {
    //
}

// Also subscribe to relevant OOCSI channels, so that we can invoke side effects
// from those as well
OOCSI.subscribe('MODEL-HOUSE', function(message) {
    // Deal with all the incoming messages from the DIGSIM Model House
});

OOCSI.subscribe('project-x', function(message) {
    // Deal with input from any other channels...
});