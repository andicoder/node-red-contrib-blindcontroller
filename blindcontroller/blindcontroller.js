/**
 * Copyright 2015 Alisdair Smyth
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
module.exports = function(RED) {
    "use strict";

    /*
     * Tests the validity of the input msg.payload before using this payload to run the calculation
     */
    function validateMsg(node, msg) {
        var validMsg = true;

        if (!(typeof msg.payload === "object")) {
            node.error("blindcontroller.error.invalid-msg-payload", msg);
            validMsg = false;;
        } else {
            switch (msg.topic) {
                case "sun":
                    validMsg = validateSunPositionMsg (node, msg);
                    break;
                case "blind":
                    validMsg = validateBlindMsg (node, msg);
                    break;
                case "weather":
                    validMsg = validateWeatherMsg (node, msg);
                    break;
                default:
                    node.error("blindcontroller.error.unknown-msg-topic: "+ msg.topic, msg);
                    validMsg = false;
            }
        }
        return validMsg;
    }

    /*
     * Validate Sun Position message
     */
    function validateSunPositionMsg (node, msg) {
        var validMsg = true;
        var sunProperty = [
            "sunInSky",
            "azimuth",
            "altitude",
            "altitudeRadians"
        ];
        var i;

        for (i in sunProperty) {
            if (!(sunProperty[i] in msg.payload)) {
                node.error("blindcontroller.error.property-" + sunProperty[i] + "-missing", msg);
                validMsg = false;
            }
        }
        if (validMsg) {
            if (typeof msg.payload.sunInSky != "boolean") {
                node.error("blindcontroller.error.invalid-sunInSky: "+ msg.payload.sunInSky, msg);
                validMsg = false;
            }
            if (msg.payload.altitude > 90) {
                node.error("blindcontroller.error.invalid-altitude: "+ msg.payload.altitude, msg);
                validMsg = false;
            }
            if ((msg.payload.azimuth < 0) || (msg.payload.azimuth > 360)) {
                node.error("blindcontroller.error.invalid-azimuth: "+ msg.payload.azimuth, msg);
                validMsg = false;
            }
            if ((msg.payload.increment <0) || (msg.payload.increment > 100)) {
                node.error("blindcontroller.error.invalid-increment: "+ msg.payload.increment, msg);
                validMsg = false;
            }
        }
        return validMsg;
    }

    /*
     * Validate Blind message
     */
    function validateBlindMsg (node, msg) {
        var validMsg = true;
        var blindProperty = [
            "channel",
            "orientation",
            "noffset",
            "poffset",
            "top",
            "bottom",
            "depth",
            "increment"
        ];
        var i;

        for (i in blindProperty) {
            if (!(blindProperty[i] in msg.payload)) {
                node.error("blindcontroller.error.property-" + blindProperty[i] + "-missing", msg);
                validMsg = false;
            }
        }
        if (validMsg) {
            if ((msg.payload.orientation < 0) || (msg.payload.orienation > 360)) {
                node.error("blindcontroller.error.invalid-orientation: "+ msg.payload.orienation, msg);
                validMsg = false;
            }
            if ((msg.payload.noffset < 0) || (msg.payload.noffset > 90)) {
                node.error("blindcontroller.error.invalid-altitude: "+ msg.payload.noffset, msg);
                validMsg = false;
            }
            if ((msg.payload.poffset < 0) || (msg.payload.poffset > 90)) {
                node.error("blindcontroller.error.invalid-azimuth: "+ msg.payload.poffset, msg);
                validMsg = false;
            }
            if (msg.payload.top < 0) {
                node.error("blindcontroller.error.invalid-top: "+ msg.payload.top, msg);
                validMsg = false;
            }
            if (msg.payload.bottom < 0) {
                node.error("blindcontroller.error.invalid-bottom: "+ msg.payload.bottom, msg);
                validMsg = false;
            }
            if (msg.payload.depth < 0) {
                node.error("blindcontroller.error.invalid-depth: "+ msg.payload.depth, msg);
                validMsg = false;
            }
            if (msg.payload.top < msg.payload.bottom) {
                node.error("blindcontroller.error.invalid-dimensions: "+ msg.payload.top +" "+ msg.payload.bottom, msg);
                validMsg = false;
            }
            if ((msg.payload.increment < 0) || (msg.payload.increment > 100)) {
                node.error("blindcontroller.error.invalid-increment: "+ msg.payload.increment, msg);
                validMsg = false;
            }
            if ((msg.payload.cloudsthreshold < 0) || (msg.payload.cloudsthreshold > 1)) {
                node.error("blindcontroller.error.invalid-cloudsthreshold: "+ msg.payload.cloudsthreshold, msg);
                validMsg = false;
            }
        }
        return validMsg;
    }

    /*
     * Validate Blind message
     */
    function validateWeatherMsg (node, msg) {
        var validMsg = true;
        if ((msg.payload.clouds < 0) || (msg.payload.clouds > 1)) {
            node.error("blindscontroller.error.invalid-clouds: "+ msg.payload.clouds, msg);
            validMsg = false;
        }
        return validMsg;
    }

    /*
     * Function to determine whether the sun is considered to be in the window based on the orientation of the
     * window and the azimuth of the sun
     */
    function isSunInWindow(blind, azimuth) {
        var noffset = blind.noffset ? blind.noffset : 90;
        var poffset = blind.poffset ? blind.poffset : 90;

        var sunInWindow = false;

        /*
         * Checks the sun azimuth is between window orientation +/- offset.  Where the range includes ranges each
         * side of north, separate checks need to be performed either side of north
         */
        if (blind.orientation - noffset < 0) {
            if ((((360 - blind.orientation - noffset) <= azimuth) & (azimuth <= 360)) ||
                ((0 <= azimuth) && (azimuth <= blind.orientation + poffset))) {
                sunInWindow = true;
            }
        } else if (blind.orientation + poffset > 360) {
            if (((0 <= azimuth) & (azimuth <= (blind.orientation + poffset - 360))) ||
                (((blind.orientation - noffset) <= azimuth) && (azimuth <= 360))) {
                sunInWindow = true;
            }
        } else {
            if (((blind.orientation - noffset) <= azimuth) && (azimuth <= (blind.orientation + poffset))) {
                sunInWindow = true;
            }
        }
        return sunInWindow;
    }

    /*
     * Function to calculate the appropriate blind position based on the altitude of the sun, characteristics of
     * the window, with the target of restricting the extent to which direct sunlight enters the room
     */
    function calcBlindPosition (blind, sunPosition, weather) {
        /*
         * For the given altitude of the sun, calculate the minimum height of an object that casts a shadow to the
         * specified depth. Convert this height into a blind position based on the dimensions of the window
         */
        var blindPosition = 0;
        var isTemperatureAConcern = ((weather.maxtemp) && (blind.temperaturethreshold)) ? (weather.maxtemp > blind.temperaturethreshold) : false;
        var isOvercast = ((weather.clouds) && (blind.cloudsthreshold)) ? (weather.clouds > blind.cloudsthreshold) : false;

        if (sunPosition.sunInSky) {
            if (isTemperatureAConcern) {
                blindPosition = 100;
            } else {
                blind.sunInWindow = isSunInWindow(blind, sunPosition.azimuth);
                if (blind.sunInWindow) {
                    if (sunPosition.altitude > blind.altitudethreshold && !isOvercast) {
                        var height = Math.tan(sunPosition.altitudeRadians) * blind.depth;
                        if (height <= blind.bottom) {
                            blindPosition = 100;
                        } else if (height >= blind.top) {
                            blindPosition = 0;
                        } else {
                            blindPosition = Math.ceil(100 * (1 - (height - blind.bottom) / (blind.top - blind.bottom)));
                            blindPosition = Math.ceil(blindPosition / blind.increment) * blind.increment;
                        }
                    }
                }
            }
        } else {
            blindPosition = 100;
        }
        return blindPosition;
    }

    function runCalc (node, msg, blinds, sunPosition, weather) {
        var i;
        for (i in blinds) {
            var previousBlindPosition = blinds[i].blindPosition;
            blinds[i].blindPosition = calcBlindPosition(blinds[i], sunPosition, weather);
            if (blinds[i].blindPosition != previousBlindPosition) {
                msg.payload = {
                    channel: blinds[i].channel,
                    blindPosition: blinds[i].blindPosition
                };
                msg.data = {
                    channel: blinds[i].channel,
                    altitude: sunPosition.altitude,
                    azimuth: sunPosition.azimuth,
                    blindPosition: blinds[i].blindPosition
                };
                msg.topic = "blind";
                node.send(msg);
            }
        }
    }

    function BlindControllerWithoutConfig(config) {
        RED.nodes.createNode(this, config);
        /*
         * Initialise node with value of configurable properties
         */
        this.name       = config.name;
        var node        = this;
        var blinds      = [];
        var weather     = {};
        var sunPosition = {};

        /*
         * Registers a listener on the input event to receive messages from the up-stream nodes in a flow.  This
         * function does not any values from the input message.
         */
        this.on("input", function(msg) {
            var validMsg = validateMsg(node, msg);

            if (validMsg) {
                switch (msg.topic) {
                    case "sun":
                        sunPosition = msg.payload;
                        runCalc(node, msg, blinds, sunPosition, weather);
                        break;
                    case "blind":
                        var channel = msg.payload.channel;
                        blinds[channel] = msg.payload;
                        break;
                    case "weather":
                        weather = msg.payload;
                        runCalc(node, msg, blinds, sunPosition, weather);
                        break;
                    default:
                        break;
                };
            }
        });
    }

    /*
     * Function which is exported when the node-RED runtime loads the node on start-up.
     */
    function BlindControllerWithConfig(config) {
        RED.nodes.createNode(this, config);
        /*
         * Initialise node with value of configurable properties
         */
        this.name     = config.name;
        var channel   = config.channel;
        var blinds      = [];
        blinds[channel] = {
            channel:              channel,
            orientation:          Number(config.orientation),
            noffset:              Number(config.noffset),
            poffset:              Number(config.poffset),
            top:                  Number(config.top),
            bottom:               Number(config.bottom),
            depth:                Number(config.depth),
            altitudethreshold:    Number(config.altitudethreshold),
            increment:            Number(config.increment),
            temperaturethreshold: config.temperaturethreshold,
            cloudsthreshold:      config.cloudsthreshold
        };

        this.blind      = blinds[channel];
        var node        = this;
        var sunPosition = {};
        var weather     = {};

        /*
         * Registers a listener on the input event to receive messages from the up-stream nodes in a flow.  This
         * function does not any values from the input message.
         */
        var previousBlindPosition = -1;
        this.on("input", function(msg) {
            var validMsg = validateMsg(node, msg);

            if (validMsg) {
                switch (msg.topic) {
                    case "sun":
                        sunPosition = msg.payload;
                        runCalc(node, msg, blinds, sunPosition, weather);
                        break;
                    case "weather":
                        weather = msg.payload;
                        runCalc(node, msg, blinds, sunPosition, weather);
                        break;
                    default:
                        break;
                }

                if (blinds[channel].blindPosition != previousBlindPosition) {
                    msg.payload = {
                        channel:       channel,
                        blindPosition: blinds[channel].blindPosition
                    };
                    msg.data = {
                        channel:       channel,
                        altitude:      sunPosition.altitude,
                        azimuth:       sunPosition.azimuth,
                        blindPosition: blinds[channel].blindPosition
                    };
                    msg.topic = "blind";
                    node.send(msg);

                    previousBlindPosition = blinds[channel].blindPosition;
                }
                node.status({
                    fill:  (sunPosition.sunInSky) ? "yellow" : "blue",
                    shape: (blinds[channel].blindPosition == 100) ? "dot" : "ring",
                    text:  blinds[channel].blindPosition + "%"
                });
            }
        });
    }

    RED.nodes.registerType("multiblindcontroller", BlindControllerWithoutConfig);
    RED.nodes.registerType("blindcontroller", BlindControllerWithConfig);
};
