import mqtt from 'mqtt';
import { deviceStore } from './deviceStore';

class MQTTManager {
  private client: mqtt.MqttClient | null = null;
  private isConnected = false;

  async connect() {
    if (this.client) {
      return;
    }

    try {
      this.client = mqtt.connect('mqtt://localhost:1883', {
        clientId: `breeze_server_${Math.random().toString(16).substr(2, 8)}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      });

      this.client.on('connect', () => {
        console.log('MQTT Client connected');
        this.isConnected = true;
        this.subscribeToTopics();
      });

      this.client.on('error', (err) => {
        console.error('MQTT connection error:', err);
        this.isConnected = false;
      });

      this.client.on('message', this.handleMessage.bind(this));

      this.client.on('close', () => {
        console.log('MQTT Client disconnected');
        this.isConnected = false;
      });

    } catch (error) {
      console.error('Failed to connect to MQTT broker:', error);
    }
  }

  private subscribeToTopics() {
    if (!this.client || !this.isConnected) return;

    // Subscribe to device discovery
    this.client.subscribe('breeze/devices/+/discovery');
    
    // Subscribe to device status updates
    this.client.subscribe('breeze/devices/+/status');
    
    // Subscribe to device state updates
    this.client.subscribe('breeze/devices/+/state');

    console.log('Subscribed to MQTT topics');
  }

  private handleMessage(topic: string, message: Buffer) {
    try {
      const messageStr = message.toString();
      console.log(`Received MQTT message on ${topic}: ${messageStr}`);
      
      const topicParts = topic.split('/');
      if (topicParts.length < 4) return;

      const deviceId = topicParts[2];
      const messageType = topicParts[3];

      let data;
      try {
        data = JSON.parse(messageStr);
      } catch {
        data = { value: messageStr };
      }

      switch (messageType) {
        case 'discovery':
          this.handleDeviceDiscovery(deviceId, data);
          break;
        case 'status':
          this.handleDeviceStatus(deviceId, data);
          break;
        case 'state':
          this.handleDeviceState(deviceId, data);
          break;
      }
    } catch (error) {
      console.error('Error handling MQTT message:', error);
    }
  }

  private handleDeviceDiscovery(deviceId: string, data: Record<string, unknown>) {
    const existingDevice = deviceStore.getDevice(deviceId);
    
    if (!existingDevice) {
      // New device discovered
      deviceStore.addDevice({
        id: deviceId,
        name: (typeof data.name === 'string' ? data.name : null) || `Device ${deviceId}`,
        type: (data.type === 'ESP32' || data.type === 'ESP8266' || data.type === 'ESP32-S3' || data.type === 'ESP32-C3') ? data.type : 'ESP32',
        status: 'online',
        state: (data.state === 'on' || data.state === 'off') ? data.state : 'off',
        lastSeen: new Date(),
        ipAddress: typeof data.ip === 'string' ? data.ip : undefined,
        macAddress: typeof data.mac === 'string' ? data.mac : undefined,
        firmwareVersion: typeof data.firmware === 'string' ? data.firmware : undefined,
      });
      console.log(`New device discovered: ${deviceId}`);
    } else {
      // Update existing device
      deviceStore.updateDevice(deviceId, {
        status: 'online',
        ipAddress: typeof data.ip === 'string' ? data.ip : undefined,
        lastSeen: new Date(),
      });
    }
  }

  private handleDeviceStatus(deviceId: string, data: Record<string, unknown>) {
    deviceStore.updateDevice(deviceId, {
      status: data.online === true ? 'online' : 'offline',
      wifiStrength: typeof data.wifi_strength === 'number' ? data.wifi_strength : undefined,
      uptime: typeof data.uptime === 'number' ? data.uptime : undefined,
    });
  }

  private handleDeviceState(deviceId: string, data: Record<string, unknown>) {
    deviceStore.updateDevice(deviceId, {
      state: (data.state === 'on' || data.state === 'off') ? data.state : 'off',
    });
  }

  publishDeviceCommand(deviceId: string, command: string, data: Record<string, unknown> = {}) {
    if (!this.client || !this.isConnected) {
      console.error('MQTT client not connected');
      return false;
    }

    const topic = `breeze/devices/${deviceId}/command/${command}`;
    const message = JSON.stringify(data);
    
    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error(`Failed to publish to ${topic}:`, err);
      } else {
        console.log(`Published command to ${topic}: ${message}`);
      }
    });

    return true;
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
    }
  }
}

export const mqttManager = new MQTTManager();
