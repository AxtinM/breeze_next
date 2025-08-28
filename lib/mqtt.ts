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
      const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
      console.log(`🔄 Connecting to MQTT broker: ${brokerUrl}`);
      
      this.client = mqtt.connect(brokerUrl, {
        clientId: `breeze_server_${Math.random().toString(16).substr(2, 8)}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      });

      this.client.on('connect', () => {
        console.log('✅ MQTT Client connected successfully');
        this.isConnected = true;
        this.subscribeToTopics();
      });

      this.client.on('error', (err) => {
        console.error('❌ MQTT connection error:', err);
        this.isConnected = false;
      });

      this.client.on('message', this.handleMessage.bind(this));

      this.client.on('close', () => {
        console.log('📴 MQTT Client disconnected');
        this.isConnected = false;
      });

    } catch (error) {
      console.error('❌ Failed to connect to MQTT broker:', error);
    }
  }

  private subscribeToTopics() {
    if (!this.client || !this.isConnected) return;

    // ✅ Subscribe to all breeze topics with flexible patterns
    const topics = [
      'breeze/+/+/+',        // Support both old and new topic formats
      'breeze/devices/+/+',  // Legacy format support
      'breeze/devices/+/discovery',
      'breeze/devices/+/status', 
      'breeze/devices/+/state'
    ];

    topics.forEach(topic => {
      this.client?.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📡 Subscribed to ${topic}`);
        }
      });
    });
  }

  private handleMessage(topic: string, message: Buffer) {
    try {
      const messageStr = message.toString();
      console.log(`📨 MQTT Message: ${topic} -> ${messageStr}`);
      
      // Extract device ID from topic - be flexible with topic formats
      let deviceId = '';
      const topicParts = topic.split('/');
      
      if (topicParts.length >= 3) {
        // Support both breeze/devices/ID/type and breeze/ID/type formats
        if (topicParts[1] === 'devices') {
          deviceId = topicParts[2];
        } else {
          deviceId = topicParts[1];
        }
      }

      if (!deviceId) {
        console.warn(`⚠️ Could not extract device ID from topic: ${topic}`);
        return;
      }

      // Parse message - handle both JSON and plain text
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(messageStr);
      } catch {
        // Handle plain text messages
        console.log(`📝 Plain text message: ${messageStr}`);
        data = { raw_message: messageStr };
        
        // Try to interpret plain text as state
        if (messageStr.toLowerCase() === 'on' || messageStr.toLowerCase() === 'off') {
          data.state = messageStr.toLowerCase();
        }
      }

      // Determine message type from topic
      const lastPart = topicParts[topicParts.length - 1];
      
      switch (lastPart) {
        case 'discovery':
          console.log(`🔍 Discovery message received: ${deviceId}`);
          if (data.id || deviceId) {
            data.id = data.id || deviceId;
            deviceStore.addOrUpdateDevice(data);
          }
          break;
          
        case 'status':
          console.log(`📊 Status message received: ${deviceId}`);
          deviceStore.updateDeviceStatus(deviceId, data);
          break;
          
        case 'state':
          console.log(`🔄 State message received: ${deviceId}`);
          deviceStore.updateDeviceState(deviceId, data);
          break;
          
        default:
          console.log(`📝 Generic message received: ${deviceId}`);
          // Try to handle as discovery if it has device info
          if (data.id || data.name || data.type) {
            data.id = data.id || deviceId;
            deviceStore.addOrUpdateDevice(data);
          } else {
            // Handle as status update
            deviceStore.updateDeviceStatus(deviceId, data);
          }
          break;
      }

    } catch (error) {
      console.error('❌ Error handling MQTT message:', error);
      console.error('Topic:', topic);
      console.error('Message:', message.toString());
    }
  }

  async publishCommand(deviceId: string, command: string, data: Record<string, unknown>): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      console.error('❌ MQTT client not connected');
      return false;
    }

    try {
      const topic = `breeze/devices/${deviceId}/command/${command}`;
      const payload = JSON.stringify(data);
      
      console.log(`📤 Publishing command: ${topic} -> ${payload}`);
      
      return new Promise((resolve) => {
        this.client!.publish(topic, payload, (err) => {
          if (err) {
            console.error('❌ Error publishing MQTT command:', err);
            resolve(false);
          } else {
            console.log('✅ Command published successfully');
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error publishing MQTT command:', error);
      return false;
    }
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  async disconnect() {
    if (this.client) {
      await this.client.endAsync();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const mqttManager = new MQTTManager();
