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

  addDevice(device: Device): void {
    this.devices.set(device.id, device);
  }

  getDevice(id: string): Device | undefined {
    return this.devices.get(id);
  }

  getAllDevices(): Device[] {
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
