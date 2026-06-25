import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

function generateUUID() {
  let d = new Date().getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
}

export async function getDeviceIdentifier() {
  try {
    // 1. Check if we already have a device ID stored in SecureStore (for backward compatibility)
    let deviceId = await SecureStore.getItemAsync('student_device_uuid');
    if (deviceId) {
      return deviceId;
    }

    // 2. Otherwise, retrieve the stable hardware/vendor unique ID
    if (Platform.OS === 'android' && Application.androidId) {
      deviceId = 'hw-android-' + Application.androidId;
    } else if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      if (iosId) {
        deviceId = 'hw-ios-' + iosId;
      }
    }

    // 3. Fallback to generating a unique ID if hardware ID is unavailable
    if (!deviceId) {
      deviceId = 'gen-' + Platform.OS + '-' + generateUUID();
    }

    // 4. Save to SecureStore so it is persistent and cached for instant lookups
    await SecureStore.setItemAsync('student_device_uuid', deviceId);
    return deviceId;
  } catch (error) {
    console.error('Error retrieving/generating device identifier:', error);
    return 'fallback-device-id-' + Platform.OS + '-' + (Device.modelName || 'device').replace(/\s+/g, '-');
  }
}

export function getDeviceMetadata() {
  return {
    brand: Device.brand || 'Unknown',
    model: Device.modelName || 'Unknown',
    osName: Device.osName || 'Unknown',
    osVersion: Device.osVersion || 'Unknown',
    deviceName: Device.deviceName || 'Unknown',
  };
}
