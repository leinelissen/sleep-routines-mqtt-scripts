require('dotenv').config();
const nano = require('nano')(process.env.COUCHDB_URL);
const mqtt = require('mqtt');
const db = nano.db.use(process.env.COUCHDB_DB);

// Create MQTT client
var client = mqtt.connect(process.env.MQTT_HOST, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
});

// Create handlers
client.on('connect', function () {
    console.log('Connected to MQTT server.');

    // Subscribe to channel
    client.subscribe('/sleep-routines', function(err) {
        if (err) {
            process.exit(1);
        }
    })
});

client.on('message', function(topic, data) {
    const message = {
        ...JSON.parse(data),
        timestamp: new Date(),
    };
    db.insert(message);
});