'use client';

import { useState, useEffect } from 'react';
import { Device } from '@/types/device';
import { 
  Wifi, 
  WifiOff, 
  Power, 
  PowerOff, 
  Smartphone, 
  Activity,
  Clock,
  Signal
} from 'lucide-react';

interface DeviceCardProps {
  device: Device;
  onToggle: (deviceId: string) => void;
}

function DeviceCard({ device, onToggle }: DeviceCardProps) {
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'ESP32':
      case 'ESP8266':
      case 'ESP32-S3':
      case 'ESP32-C3':
        return <Smartphone className="w-6 h-6" />;
      default:
        return <Activity className="w-6 h-6" />;
    }
  };

  const getSignalStrength = (strength?: number) => {
    if (!strength) return 'Unknown';
    if (strength >= -50) return 'Excellent';
    if (strength >= -60) return 'Good';
    if (strength >= -70) return 'Fair';
    return 'Poor';
  };

  const getUptime = (uptime?: number) => {
    if (!uptime) return 'Unknown';
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 transition-all duration-200 hover:shadow-lg ${
      device.status === 'online' 
        ? 'border-green-500' 
        : 'border-gray-400'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${
            device.status === 'online' 
              ? 'bg-green-100 text-green-600' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {getDeviceIcon(device.type)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{device.name}</h3>
            <p className="text-sm text-gray-500">{device.type}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            device.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-medium">
            {device.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">
            Uptime: {getUptime(device.uptime)}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Signal className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">
            Signal: {getSignalStrength(device.wifiStrength)}
          </span>
        </div>
        <div className="col-span-2 text-xs text-gray-500">
          Last seen: {new Date(device.lastSeen).toLocaleString()}
        </div>
        {device.ipAddress && (
          <div className="col-span-2 text-xs text-gray-500">
            IP: {device.ipAddress}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {device.state === 'on' ? (
            <Power className="w-5 h-5 text-green-500" />
          ) : (
            <PowerOff className="w-5 h-5 text-red-500" />
          )}
          <span className={`font-medium ${
            device.state === 'on' ? 'text-green-600' : 'text-red-600'
          }`}>
            {device.state === 'on' ? 'ON' : 'OFF'}
          </span>
        </div>
        <button
          onClick={() => onToggle(device.id)}
          disabled={device.status === 'offline'}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            device.status === 'offline'
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : device.state === 'on'
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {device.state === 'on' ? 'Turn Off' : 'Turn On'}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }
      const data = await response.json();
      setDevices(data.devices);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDevice = async (deviceId: string) => {
    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'toggle',
          deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle device');
      }

      const data = await response.json();
      setDevices(prev => 
        prev.map(device => 
          device.id === deviceId ? data.device : device
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle device');
    }
  };

  useEffect(() => {
    fetchDevices();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchDevices, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const totalDevices = devices.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Smart WiFi Portal
          </h1>
          <p className="text-gray-600">
            Manage your ESP devices remotely
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Devices</p>
                <p className="text-2xl font-bold text-gray-900">{totalDevices}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <Wifi className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Online</p>
                <p className="text-2xl font-bold text-gray-900">{onlineDevices}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100">
                <WifiOff className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Offline</p>
                <p className="text-2xl font-bold text-gray-900">{totalDevices - onlineDevices}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p>{error}</p>
            <button 
              onClick={fetchDevices}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Devices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onToggle={handleToggleDevice}
            />
          ))}
        </div>

        {devices.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="p-4 rounded-full bg-gray-100 w-16 h-16 mx-auto mb-4">
              <Activity className="w-8 h-8 text-gray-400 mx-auto mt-2" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No devices found
            </h3>
            <p className="text-gray-500">
              Connect your ESP devices to see them here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
