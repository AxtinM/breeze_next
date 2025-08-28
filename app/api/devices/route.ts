import { NextRequest, NextResponse } from 'next/server';
import { deviceStore } from '@/lib/deviceStore';
import { mqttManager } from '@/lib/mqtt';

// Initialize MQTT connection
mqttManager.connect();

export async function GET() {
  try {
    const devices = deviceStore.getAllDevices();
    return NextResponse.json({ devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, deviceId, data } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'toggle':
        const device = deviceStore.toggleDeviceState(deviceId);
        if (!device) {
          return NextResponse.json(
            { error: 'Device not found' },
            { status: 404 }
          );
        }
        
        // Send command to device via MQTT
        mqttManager.publishCommand(deviceId, 'set_state', {
          state: device.state
        });

        return NextResponse.json({ device });

      case 'update':
        const updatedDevice = deviceStore.updateDevice(deviceId, data);
        if (!updatedDevice) {
          return NextResponse.json(
            { error: 'Device not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ device: updatedDevice });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing device action:', error);
    return NextResponse.json(
      { error: 'Failed to process device action' },
      { status: 500 }
    );
  }
}
