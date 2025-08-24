export interface Device {
  id: string;
  name: string;
  type: 'ESP32' | 'ESP8266' | 'ESP32-S3' | 'ESP32-C3';
  status: 'online' | 'offline';
  state: 'on' | 'off';
  lastSeen: Date;
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  uptime?: number;
  wifiStrength?: number;
}

export interface DeviceUpdate {
  id: string;
  status?: 'online' | 'offline';
  state?: 'on' | 'off';
  lastSeen?: Date;
  ipAddress?: string;
  wifiStrength?: number;
  uptime?: number;
}
