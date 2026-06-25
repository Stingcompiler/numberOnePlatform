import apiClient from './apiClient';
import * as SecureStore from 'expo-secure-store';
import { getDeviceIdentifier } from '../utils/deviceInfo';

export const authService = {
  async login(username, password) {
    const deviceId = await getDeviceIdentifier();
    
    const response = await apiClient.post('/auth/login/', {
      username,
      password,
      device_id: deviceId,
    });

    const { access, refresh, user } = response.data;
    
    if (access) {
      await SecureStore.setItemAsync('student_access_token', String(access));
    } else {
      await SecureStore.deleteItemAsync('student_access_token');
    }
    if (refresh) {
      await SecureStore.setItemAsync('student_refresh_token', String(refresh));
    } else {
      await SecureStore.deleteItemAsync('student_refresh_token');
    }
    
    await SecureStore.setItemAsync('student_logged_in', 'true');
    
    return user;
  },

  async logout() {
    try {
      const refreshToken = await SecureStore.getItemAsync('student_refresh_token');
      await apiClient.post('/auth/logout/', {
        refresh: refreshToken,
      });
    } catch (e) {
      console.warn('Backend logout failed or token already invalid', e);
    } finally {
      await SecureStore.deleteItemAsync('student_access_token');
      await SecureStore.deleteItemAsync('student_refresh_token');
      await SecureStore.deleteItemAsync('student_logged_in');
    }
  },

  async getCurrentUser() {
    const response = await apiClient.get('/auth/me/');
    return response.data;
  },

  async changePassword(oldPassword, newPassword) {
    const response = await apiClient.post('/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return response.data;
  }
};
export default authService;
