require('dotenv').config();
const mqtt = require('mqtt');
const schedule = require('node-schedule');
const { Expo } = require('expo-server-sdk')
const { isYesterday } = require('date-fns');

// User variables
var expoToken = null;
var isActorUpright = null;
var lastAction = null;

// Create MQTT client
var client = mqtt.connect(process.env.MQTT_HOST, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
});

// Create Expo client
const expo = new Expo();

// Create logger
const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

// Create handlers
client.on('connect', function () {
    log('Connected to MQTT server.');

    // Subscribe to channel
    client.subscribe('/sleep-routines', function(err) {
        if (err) {
            process.exit(1);
        }
    })
});

client.on('message', function(topic, data) {
    const message = JSON.parse(data);

    if (message.event === 'deviceTilted') {
        log('Device was tilted, new value: ', message.isUpright);
        isActorUpright = Boolean(message.isUpright);
    } else if (message.event === 'deviceConnected'
        && message.deviceType === 'app') {
        log('App connected to MQTT, saving push token: ', message.pushToken);
        expoToken = message.pushToken;
    } else if (message.event === 'deviceDetectedCoupling') {
        lastAction = new Date();
    }
});

schedule.scheduleJob("0 18 */1 * *", async function() {
    log('Executing scheduled function');

    if (isActorUpright === null && expoToken === null) {
        log('Missing data, exiting...')
        return;
    }

    if (isActorUpright) {
        log('Actor should be returned to dock, notifying...');
        await expo.sendPushNotificationsAsync([{
            to: expoToken,
            title: 'Sleep Routines',
            body: "Don't forget to charge the Hourglass ⚡️⏳",
        }]);
    } else {
        log('Actor is charging.')
    }
});

schedule.scheduleJob("0 11 */1 * *", async function() {
    log('Executing scheduled function');
    if (isYesterday(lastAction)) {
        log('User has run their routine yesterday. Sending notification...')
        await expo.sendPushNotificationsAsync([{
            to: expoToken,
            title: 'Sleep Routines',
            body: "You did great yesterday. Enjoy your day 🔋⚡️",
        }]);
    }
});

log('Started...');