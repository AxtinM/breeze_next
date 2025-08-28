import { Device, DeviceUpdate } from '@/types/device';

class DeviceStore {
  private devices: Map<string, Device> = new Map();

  // Initialize with some example devices
  constructor() {
    this.addDevice({
      id: 'esp32-001',
      name: 'Living Room Light',
      type: 'ESP32',
      status: 'offline',
      state: 'off',
      lastSeen: new Date(),
      macAddress: '24:6F:28:12:34:56',
      firmwareVersion: '1.0.0'
    });

    this.addDevice({
      id: 'esp8266-001',
      name: 'Kitchen Fan',
      type: 'ESP8266',
      status: 'offline',
      state: 'off',
      lastSeen: new Date(),
      macAddress: '18:FE:34:98:76:54',
      firmwareVersion: '1.0.0'
    });
  }

  // ✅ NEW: Flexible device creation/update from MQTT discovery
  addOrUpdateDevice(deviceData: Record<string, unknown>): Device {
    const deviceId = deviceData.id as string;
    const existingDevice = this.devices.get(deviceId);
    
    // Create/update device with flexible parsing
    const device: Device = {
      id: deviceId,
      name: (deviceData.name as string) || existingDevice?.name || `Device ${deviceId}`,
      type: this.parseDeviceType(deviceData.type) || existingDevice?.type || 'ESP32',
      status: 'online', // If we receive any message, device is online
      state: this.parseState(deviceData.state) || existingDevice?.state || 'off',
      lastSeen: new Date(),
      ipAddress: (deviceData.ip as string) || (deviceData.ipAddress as string) || existingDevice?.ipAddress,
      macAddress: (deviceData.mac as string) || (deviceData.macAddress as string) || existingDevice?.macAddress,
      firmwareVersion: (deviceData.firmware as string) || (deviceData.firmwareVersion as string) || existingDevice?.firmwareVersion || '1.0.0',
      uptime: this.parseNumber(deviceData.uptime) || existingDevice?.uptime,
      wifiStrength: this.parseNumber(deviceData.wifi_strength || deviceData.signal || deviceData.wifiStrength) || existingDevice?.wifiStrength
    };

    this.devices.set(deviceId, device);
    console.log(`✅ Device ${deviceId} added/updated in store`);
    return device;
  }

  // ✅ NEW: Update device status from MQTT status messages
  updateDeviceStatus(deviceId: string, statusData: Record<string, unknown>): Device | null {
    const device = this.devices.get(deviceId);
    if (!device) {
      // Create device if it doesn't exist
      console.log(`Creating device ${deviceId} from status data`);
      return this.addOrUpdateDevice({
        id: deviceId,
        name: `Device ${deviceId}`,
        ...statusData
      });
    }

    // Update existing device status
    device.status = (statusData.online as boolean) !== false ? 'online' : 'offline';
    if (statusData.wifi_strength !== undefined) device.wifiStrength = this.parseNumber(statusData.wifi_strength);
    if (statusData.signal !== undefined) device.wifiStrength = this.parseNumber(statusData.signal);
    if (statusData.wifiStrength !== undefined) device.wifiStrength = this.parseNumber(statusData.wifiStrength);
    if (statusData.uptime !== undefined) device.uptime = this.parseNumber(statusData.uptime);
    device.lastSeen = new Date();

    this.devices.set(deviceId, device);
    console.log(`✅ Device ${deviceId} status updated`);
    return device;
  }

  // ✅ NEW: Update device state from MQTT state messages
  updateDeviceState(deviceId: string, stateData: Record<string, unknown>): Device | null {
    let device = this.devices.get(deviceId);
    if (!device) {
      // Create device if it doesn't exist
      console.log(`Creating device ${deviceId} from state data`);
      device = this.addOrUpdateDevice({
        id: deviceId,
        name: `Device ${deviceId}`,
        state: this.parseState(stateData.state || stateData) || 'off'
      });
    }

    // Update state - be flexible with different formats
    const newState = this.parseState(stateData.state || stateData);
    if (newState) {
      device.state = newState;
      device.lastSeen = new Date();
      this.devices.set(deviceId, device);
      console.log(`✅ Device ${deviceId} state updated to ${newState}`);
    }

    return device;
  }

  // ✅ NEW: Flexible state parsing
  private parseState(state: unknown): 'on' | 'off' | null {
    if (typeof state === 'boolean') return state ? 'on' : 'off';
    if (typeof state === 'string') {
      const lowerState = state.toLowerCase();
      if (lowerState === 'on' || lowerState === 'true' || lowerState === '1') return 'on';
      if (lowerState === 'off' || lowerState === 'false' || lowerState === '0') return 'off';
    }
    return null;
  }

  // ✅ NEW: Flexible number parsing
  private parseNumber(value: unknown): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  // ✅ NEW: Parse device type
  private parseDeviceType(type: unknown): 'ESP32' | 'ESP8266' | 'ESP32-S3' | 'ESP32-C3' | null {
    if (typeof type === 'string') {
      const upperType = type.toUpperCase();
      if (upperType.includes('ESP32-S3')) return 'ESP32-S3';
      if (upperType.includes('ESP32-C3')) return 'ESP32-C3';
      if (upperType.includes('ESP32')) return 'ESP32';
      if (upperType.includes('ESP8266')) return 'ESP8266';
    }
    return null;
  }

  addDevice(device: Device): void {
    this.devices.set(device.id, device);
  }

  getDevice(id: string): Device | undefined {
    return this.devices.get(id);
  }

  getAllDevices(): Device[] {
    // Mark devices as offline if not seen for 2 minutes
    const now = new Date();
    this.devices.forEach((device, id) => {
      const timeDiff = now.getTime() - device.lastSeen.getTime();
      if (timeDiff > 120000) { // 2 minutes
        device.status = 'offline';
        this.devices.set(id, device);
      }
    });

    return Array.from(this.devices.values());
  }

  updateDevice(id: string, update: Partial<DeviceUpdate>): Device | null {
    const device = this.devices.get(id);
    if (!device) return null;

    const updatedDevice = {
      ...device,
      ...update,
      lastSeen: new Date()
    };

    this.devices.set(id, updatedDevice);
    return updatedDevice;
  }

  removeDevice(id: string): boolean {
    return this.devices.delete(id);
  }

  toggleDeviceState(id: string): Device | null {
    const device = this.devices.get(id);
    if (!device) return null;

    const newState = device.state === 'on' ? 'off' : 'on';
    return this.updateDevice(id, { state: newState });
  }
}

// Singleton instance
export const deviceStore = new DeviceStore();
