require('dotenv').config();
const mqtt = require('mqtt');
const OOCSI = require('./lib/oocsi');

const INPUT = {
    PRESENCE: {
        BOARD: 0,
        BERNIE: 'A0',
        SIDE_KITCHEN: 'A1',
        KITCHEN: 'A2',
        LIVING_ROOM: 'A3',
        DINING_ROOM: 'A4',
        HALLWAY: 'A5',
        BATHROOM: 'A6',
        MASTER_BEDROOM: 'A7',
        MIMI_BEDROOM: 'B0',
        GREG_BEDROOM: 'B1',
        GARDEN: 'B2',
    },
    BUTTON: {
        BOARD: 1,
        DOORBELL: 'A0',
        HALLWAY: 'A1',
    },
    ACTIVITY: {
        BOARD: 2,
        BERNIE_BED: 'A0',
        SIDEKITCHEN_WASHER: 'A1',
        SIDEKITCHEN_DRYER: 'A2',
        KITCHEN_COOKING: 'A3',
        KITCHEN_DISHWASHER: 'A4',
        KITCHEN_OVEN: 'B0',
        LIVING_ROOM_COUCH: 'B1',
        LIVING_ROOM_DESK: 'B2',
        LIVING_ROOM_BOM: 'B3',
        BATHROOM_SINK: 'B4',
        MASTER_BEDROOM_BED: 'B5',
        MIMI_BED: 'B6',
        GREG_BED: 'B7',
    }
};

const OUTPUT = {
    RGB: {
        LIVING_ROOM_DHUB: { Board: 1, Index: 0 },
        MASTER_BEDROOM_DLAMP: { Board: 1, Index: 4 },
        MIMI_BEDROOM_DLAMP: { Board: 1, Index: 8 },
        GREG_BEDROOM_DLAMP: { Board: 1, Index: 12 },
        GARDEN_EILIS1: { Board: 2, Index: 0 },
        GRADEN_EILIS2: { Board: 2, Index: 4 },
    },
    ACTIVITY: {
        MUDROOM: { Board: 3, Index: 0 },
        BERNIE_DESK: { Board: 3, Index: 1 },
        BERNIE_NIGHTSTAND: { Board: 3, Index: 2 },
        KITCHEN: { Board: 3, Index: 3 },
        SIDE_KITCHEN: { Board: 3, Index: 4 },
        KITCHEN_NERU: { Board: 3, Index: 5 },
        KITCHEN_EASTON: { Board: 3, Index: 6 },
        LIVING_ROOM_BOM: { Board: 3, Index: 7 },
        LIVING_ROOM_GHOST: { Board: 3, Index: 8 },
        LIVING_ROOM_DESK1: { Board: 3, Index: 9 },
        LIVING_ROOM_DESK2: { Board: 3, Index: 10 },
        LIVING_ROOM_NERU_CHARGER: { Board: 3, Index: 11 },
        LIVING_ROOM_OTIS: { Board: 3, Index: 12 },
        BATHROOM_NERU: { Board: 3, Index: 13 },
        MASTER_BEDROOM_NERU: { Board: 3, Index: 14 },
        MIMI_BEDROOM_NERU: { Board: 3, Index: 15 },
        GREG_BEDROOM_NERU: { Board: 4, Index: 0 },
    },
    LIGHTING: {
        MUD_ROOM: { Index: 0 },
        BERNIE_BEDROOM: { Index: 1 },
        SIDE_KITCHEN: { Index: 2 },
        KITCHEN: { Index: 3 },
        LIVING_ROOM_1: { Index: 4 },
        LIVING_ROOM_2: { Index: 5 },
        MASTER_BEDROOM: { Index: 6 },
        BATHROOM: { Index: 7 },
        HALLWAY: { Index: 8 },
        MIMI_BEDROOM: { Index: 9 },
        GREG_BEDROOM: { Index: 10 },
        ENTRANCE: { Index: 11 },
        TOILET: { Index: 12 },
        OUTSIDE: { Index: 13 },
    }
};

//list boolean values to indicate room presence
var presence = {
    Bernieroom : false,
    Sidekitchen: false,
    Kitchen: false,
    Livingroom: false,
    Diningroom: false,
    Hallway: false,
    Bathroom: false,
    Masterbedroom: false,
    Mimibedroom: false,
    Gregorybedroom: false,
    Garden: false
};

//list boolean values to indicate activities
var activity ={
    BernieBed: false,
    KitchenWasher: false,
    KitchenDryer: false,
    KitchenCooking: false,
    KitchenOven: false,
    LivingRoomCouch: false,
    LivingRoomDesk: false,
    LivingRoomBom: false,
    BathroomSink: false,
    MasterBedroomBed: false,
    MimiBed: false,
    GregBed: false
};

var buttons = {
    Doorbell: false,
    Hallway: false,
};

var lastDockedSombrero = 0;

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
    console.log('Incoming MQTT message', data.toString());

    // Parse JSON data
    const message = JSON.parse(data.toString());
    
    // Check if this is a redirected message
    if (message.redirected) {
        // If it is, exit the function
        return;
    }
    
    // If not, add the redirect paramter
    const output = {
        ...message,
        redirected: true,
    };
    
    // And move it over to OOCSI
    OOCSI.send('eveningroutineChannel', output);
    
    // Also move this data to a side-effects function so that we can trigger
    // other stuff (such as LEDs) consistently from both ends.
    causeSideEffects(output);
});

/**====================================================
* OOCSI
=====================================================*/

// Init OOCSI client
OOCSI.logger(console.log);
OOCSI.connect(process.env.OOCSI_SERVER);

OOCSI.subscribe('eveningroutineChannel', function(message) {
    console.log('Incoming OOCSI message', message.data);

    // Check if this is a redirected message
    if (message.redirected) {
        // If it is, exit the function
        return;
    }
    
    // If not, add the redirect paramter
    const data = {
        ...message.data,
        redirected: true,
    };
    
    // And move it over to MQTT
    client.publish('/sleep-routines', JSON.stringify(data));
    
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
    
    /**====================================================
    * ZANDLOPER DOCKING & SWITCHING LIGHTS ACCORDINGLY*/
    
    if (message.event === 'deviceDetectedCoupling') {
        lastDockedSombrero = message.sombreroId;
        
        if (message.sombreroId === 0) { //Zandloper dockt in Gregory's bedroom
            TurnOn(OUTPUT.ACTIVITY.GREG_BEDROOM_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 11, Red: 255, Green: 100, Blue: 100 });
            OOCSI.send('MODEL-HOUSE', { Type: 'byeGhost', Index: 10 });
        } 
        
        else if (message.sombreroId === 1) { //Zandloper dockt in Master Bedroom
            TurnOn(OUTPUT.ACTIVITY.MASTER_BEDROOM_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 7, Red: 255, Green: 100, Blue: 100 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'byeGhost', Index: 16 });
        } 
    
        else if (message.sombreroId === 2) { //Zandloper dockt in Bathroom
            TurnOn(OUTPUT.ACTIVITY.BATHROOM_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 8, Red: 255, Green: 100, Blue: 100 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'byeGhost', Index: 7 });
        } 
    
        else if (message.sombreroId === 3) { //Zandloper dockt in Mimi's bedroom
            TurnOn(OUTPUT.ACTIVITY.MIMI_BEDROOM_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 10, Red: 255, Green: 100, Blue: 100 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'byeGhost', Index: 9 });
        } 

        else if (message.sombreroId === 4) { //Zandloper dockt in Kitchen
            TurnOn(OUTPUT.ACTIVITY.KITCHEN_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 4, Red: 255, Green: 100, Blue: 100 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'byeGhost', Index: 3 });
        } 


    } else if (message.event === 'deviceDetectedDecoupling') {
        if (lastDockedSombrero === 0) { //Zandloper dockt in Gregory's bedroom
            TurnOff(OUTPUT.ACTIVITY.GREG_BEDROOM_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 11, Red: 0, Green: 0, Blue: 0 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'heyGhost', Index: 10 });

        } else if (lastDockedSombrero === 1) { //Zandloper dockt in Master Bedroom
            TurnOff(OUTPUT.ACTIVITY.MASTER_BEDROOM_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 7, Red: 0, Green: 0, Blue: 0 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'heyGhost', Index: 16 });

        } else if (lastDockedSombrero === 2) { //Zandloper dockt in Bathroom
            TurnOff(OUTPUT.ACTIVITY.BATHROOM_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 8, Red: 0, Green: 0, Blue: 0 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'heyGhost', Index: 7 });

        } else if (lastDockedSombrero === 3) { //Zandloper dockt in Mimi's bedroom
            TurnOff(OUTPUT.ACTIVITY.MIMI_BEDROOM_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 10, Red: 0, Green: 0, Blue: 0 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'heyGhost', Index: 9 });

        } else if (lastDockedSombrero === 4) { //Zandloper dockt in Kitchen
            TurnOff(OUTPUT.ACTIVITY.KITCHEN_NERU);
            OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel', Index: 4, Red: 0, Green: 0, Blue: 0 });
            OOCSI.send('MODEL-HOUSE-SCREEN', { Type: 'heyGhost', Index: 3 });

        } 
    } else if (message.event === 'timerCompleted') {
        if (lastDockedSombrero == 1) {
            //
        }
    }
    
}

// Also subscribe to relevant OOCSI channels, so that we can invoke side effects
// from those as well
OOCSI.subscribe('MODEL-HOUSE', function(message) {
    if (message.data.Type !== 'DigitalInputBoard') {
        return;
    }
    
    // Deal with all the incoming messages from the DIGSIM Model House
    if (message.data.Index === 0) {
        presence = {
            Bernieroom: !message.data[INPUT.PRESENCE.BERNIE],
            Sidekitchen: !message.data[INPUT.PRESENCE.SIDE_KITCHEN],
            Kitchen: !message.data[INPUT.PRESENCE.KITCHEN],
            Livingroom: !message.data[INPUT.PRESENCE.LIVING_ROOM],
            Diningroom: !message.data[INPUT.PRESENCE.DINING_ROOM],
            Hallway: !message.data[INPUT.PRESENCE.HALLWAY],
            Bathroom: !message.data[INPUT.PRESENCE.BATHROOM],
            Masterbedroom: !message.data[INPUT.PRESENCE.MASTER_BEDROOM],
            Mimibedroom: !message.data[INPUT.PRESENCE.MIMI_BEDROOM],
            Gregorybedroom: !message.data[INPUT.PRESENCE.GREG_BEDROOM],
            Garden: !message.data[INPUT.PRESENCE.GARDEN]
        };    
    } else if (message.data.Index === 2) {
        activity ={
            BernieBed: !!message.data[INPUT.ACTIVITY.BERNIE_BED],
            KitchenWasher: !!message.data[INPUT.ACTIVITY.SIDEKITCHEN_WASHER],
            KitchenDryer: !!message.data[INPUT.ACTIVITY.SIDEKITCHEN_DRYER],
            KitchenCooking: !!message.data[INPUT.ACTIVITY.KITCHEN_COOKING],
            KitchenOven: !!message.data[INPUT.ACTIVITY.KITCHEN_OVEN],
            LivingRoomCouch: !!message.data[INPUT.ACTIVITY.LIVING_ROOM_COUCH],
            LivingRoomDesk: !!message.data[INPUT.ACTIVITY.LIVING_ROOM_DESK],
            LivingRoomBom: !!message.data[INPUT.ACTIVITY.LIVING_ROOM_BOM],
            BathroomSink: !!message.data[INPUT.ACTIVITY.BATHROOM_SINK],
            MasterBedroomBed: !!message.data[INPUT.ACTIVITY.MASTER_BEDROOM_BED],
            MimiBed: !!message.data[INPUT.ACTIVITY.MIMI_BED],
            GregBed: !!message.data[INPUT.ACTIVITY.GREG_BED]
        };    
    } else if (message.data.Index === 1) {
        buttons = {
            Doorbell: !message.data[INPUT.BUTTON.DOORBELL],
            Hallway: !message.data[INPUT.BUTTON.HALLWAY],
        };
    }

    // Send prompt
    console.log('DEBUG PROMPT', buttons.Doorbell, activity.LivingRoomCouch);
    if (buttons.Doorbell === true && activity.LivingRoomCouch === true) {
        Blink(OUTPUT.LIGHTING.LIVING_ROOM_1);
        Blink(OUTPUT.LIGHTING.LIVING_ROOM_2);
        Blink(OUTPUT.LIGHTING.KITCHEN);
        Blink(OUTPUT.LIGHTING.HALLWAY);
        OOCSI.send("MODEL-HOUSE-SCREEN",{Type: "setScreen", Index: 6});
    }
});

// Trigger setup message from the house, so we get seeded values
OOCSI.send('MODEL-HOUSE', { Type: 'GetDigitalInput' });

/**====================================================
* STATUS INDICATORS 
=====================================================*/

/**
 * Blink a light
 * 
 * @param light The supplied light
 * @param interval How long the light will stay on
 */
function Blink(light, interval = 2000) {
    OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel',  Red: 255, Green: 0, Blue: 0,...light });
    setTimeout(() => OOCSI.send('MODEL-HOUSE', { Type: 'Neopixel',  Red: 220, Green: 180, Blue: 200,...light }), interval);
}

/**
 * Turn off a specified light
 * 
 * @param light 
 */
function TurnOff(light) {
    OOCSI.send('MODEL-HOUSE', { Type: 'PWMPin', High: 0, Low: 0, ...light });
}

/**
 * Turn on a specified light
 * 
 * @param light The light that should be switched
 * @param High The brightness of the light (0-4095)
 */
function TurnOn(light, High = 4095) {
    OOCSI.send('MODEL-HOUSE', { Type:'PWMPin', High, Low: 0, ...light });
}

/**====================================================
* REGULAR ROUTINE PROMPTS
=====================================================*/

// // CALM DOWN Prompt (single blink)
// if(presence.Livingroom = true && activity.MasterBedroomBed==false){
//     Blink(OUTPUT.ACTIVITY.LIVING_ROOM_NERU_CHARGER);
//     Blink(OUTPUT.LIGHTING.LIVING_ROOM_1);
//     Blink(OUTPUT.LIGHTING.LIVING_ROOM_2);
//     Blink(OUTPUT.LIGHTING.KITCHEN);
//     Blink(OUTPUT.LIGHTING.HALLWAY);
//     oocsi.send("MODEL-HOUSE-SCREEN",{Type: "setScreen", Index: 5});
// }

// // START ROUTINE Prompt (double blink)
// if(presence.Livingroom = true && activity.MasterBedroomBed==false){
//     Blink(OUTPUT.ACTIVITY.LIVING_ROOM_NERU_CHARGER);
//     Blink(OUTPUT.ACTIVITY.LIVING_ROOM_NERU_CHARGER);
//     Blink(OUTPUT.LIGHTING.LIVING_ROOM_1);
//     Blink(OUTPUT.LIGHTING.LIVING_ROOM_1);
//     Blink(OUTPUT.LIGHTING.LIVING_ROOM_2);
//     Blink(OUTPUT.LIGHTING.LIVING_ROOM_2);
//     Blink(OUTPUT.LIGHTING.KITCHEN);
//     Blink(OUTPUT.LIGHTING.KITCHEN);
//     Blink(OUTPUT.LIGHTING.HALLWAY);
//     Blink(OUTPUT.LIGHTING.HALLWAY);
//     oocsi.send("MODEL-HOUSE-SCREEN",{Type: "setScreen",Index: 6});
// }

/**====================================================
* REGULAR ROUTINE PROGRESS
=====================================================*/

//IF DEVICED IS TILTED LOAD ROOM SETTINGS


//IF DEVICED IS COUPLED & LOAD ROOM SETTINGS


//IF DEVICE IS DECOUPLED LOAD AFTER ACTIVITY ROOM SETTINGS


//IF DEVICE IS DECOUPLED LOAD NEXT ACTIVITY ROOM SETTINGS