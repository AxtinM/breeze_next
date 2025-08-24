#!/usr/bin/env node

/**
 * ESP Device Simulator for testing the Breeze portal
 * This script simulates ESP32/ESP8266 devices connecting to the MQTT broker
 * and sending status updates, responding to commands, etc.
 */

const mqtt = require('mqtt');

class DeviceSimulator {
  constructor(deviceId, deviceName, deviceType = 'ESP32') {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.deviceType = deviceType;
    this.state = 'off';
    this.online = false;
    this.client = null;
    this.uptime = 0;
    this.wifiStrength = -50 + Math.random() * 20; // -50 to -70 dBm
    
    this.topics = {
      discovery: `breeze/devices/${deviceId}/discovery`,
      status: `breeze/devices/${deviceId}/status`,
      state: `breeze/devices/${deviceId}/state`,
      command: `breeze/devices/${deviceId}/command/+`
    };
  }

  async connect() {
    try {
      this.client = mqtt.connect('mqtt://localhost:1883', {
        clientId: `${this.deviceId}_simulator`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      });

      this.client.on('connect', () => {
        console.log(`[${this.deviceId}] Connected to MQTT broker`);
        this.online = true;
        this.subscribeToCommands();
        this.sendDiscoveryMessage();
        this.startStatusUpdates();
      });

      this.client.on('error', (err) => {
        console.error(`[${this.deviceId}] MQTT error:`, err);
        this.online = false;
      });

      this.client.on('message', (topic, message) => {
        this.handleCommand(topic, message);
      });

      this.client.on('close', () => {
        console.log(`[${this.deviceId}] Disconnected from MQTT broker`);
        this.online = false;
      });

    } catch (error) {
      console.error(`[${this.deviceId}] Failed to connect:`, error);
    }
  }

  subscribeToCommands() {
    this.client.subscribe(this.topics.command, (err) => {
      if (!err) {
        console.log(`[${this.deviceId}] Subscribed to commands`);
      }
    });
  }

  sendDiscoveryMessage() {
    const discovery = {
      id: this.deviceId,
      name: this.deviceName,
      type: this.deviceType,
      firmware: '1.0.0',
      ip: `192.168.1.${100 + Math.floor(Math.random() * 50)}`,
      mac: this.generateMacAddress(),
      state: this.state
    };

    this.client.publish(this.topics.discovery, JSON.stringify(discovery), { retain: true });
    console.log(`[${this.deviceId}] Discovery message sent`);
  }

  sendStatusUpdate() {
    if (!this.online) return;

    const status = {
      online: true,
      wifi_strength: this.wifiStrength + (Math.random() - 0.5) * 5, // Add some variation
      uptime: this.uptime,
      free_heap: 200000 + Math.floor(Math.random() * 100000)
    };

    this.client.publish(this.topics.status, JSON.stringify(status));
    this.uptime += 30; // Increment by 30 seconds
  }

  sendStateUpdate() {
    if (!this.online) return;

    const stateUpdate = {
      state: this.state,
      timestamp: Date.now()
    };

    this.client.publish(this.topics.state, JSON.stringify(stateUpdate));
    console.log(`[${this.deviceId}] State updated to: ${this.state}`);
  }

  handleCommand(topic, message) {
    try {
      const command = topic.split('/').pop();
      const data = JSON.parse(message.toString());

      console.log(`[${this.deviceId}] Received command: ${command}`, data);

      if (command === 'set_state') {
        this.state = data.state;
        this.sendStateUpdate();
        
        // Simulate some delay
        setTimeout(() => {
          console.log(`[${this.deviceId}] Device is now ${this.state}`);
        }, 500);
      }
    } catch (error) {
      console.error(`[${this.deviceId}] Error handling command:`, error);
    }
  }

  startStatusUpdates() {
    // Send status updates every 30 seconds
    setInterval(() => {
      this.sendStatusUpdate();
    }, 30000);

    // Send initial status
    setTimeout(() => {
      this.sendStatusUpdate();
    }, 1000);
  }

  generateMacAddress() {
    return Array.from({length: 6}, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':').toUpperCase();
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.online = false;
    }
  }
}

// Create and start device simulators
const devices = [
  new DeviceSimulator('esp32-001', 'Living Room Light', 'ESP32'),
  new DeviceSimulator('esp8266-001', 'Kitchen Fan', 'ESP8266'),
  new DeviceSimulator('esp32-s3-001', 'Bedroom AC', 'ESP32-S3'),
  new DeviceSimulator('esp32-c3-001', 'Garden Sprinkler', 'ESP32-C3'),
];

console.log('Starting device simulators...');

// Connect all devices
devices.forEach(device => {
  setTimeout(() => {
    device.connect();
  }, Math.random() * 2000); // Stagger connections
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down device simulators...');
  devices.forEach(device => device.disconnect());
  process.exit(0);
});

// Simulate some random state changes
setInterval(() => {
  const randomDevice = devices[Math.floor(Math.random() * devices.length)];
  if (randomDevice.online && Math.random() < 0.1) { // 10% chance every minute
    randomDevice.state = randomDevice.state === 'on' ? 'off' : 'on';
    randomDevice.sendStateUpdate();
    console.log(`[${randomDevice.deviceId}] Random state change to: ${randomDevice.state}`);
  }
}, 60000); // Every minute
