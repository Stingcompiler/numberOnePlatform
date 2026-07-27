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

    if (!response || !response.data) {
      throw new Error('لم يتم استلام استجابة من الخادم (Response is undefined).');
    }

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

    // حفظ نسخة من ملف المستخدم لاستعادة الجلسة عند تعذّر الوصول للخادم
    // (انقطاع شبكة أو انتهاء مهلة عند الإقلاع) بدل إظهار شاشة الدخول بلا داعٍ.
    if (user) {
      try {
        await SecureStore.setItemAsync('student_user', JSON.stringify(user));
      } catch (e) {
        // تخزين اختياري — لا يمنع تسجيل الدخول إن فشل
      }
    }

    return user;
  },

  async logout() {
    try {
      const refreshToken = await SecureStore.getItemAsync('student_refresh_token');
      await apiClient.post('/auth/logout/', {
        refresh: refreshToken,
      });
    } catch (e) {
      console.error('[authService logout Error]: Backend logout failed', e, e?.stack);
      throw e;
    } finally {
      await SecureStore.deleteItemAsync('student_access_token');
      await SecureStore.deleteItemAsync('student_refresh_token');
      await SecureStore.deleteItemAsync('student_user');
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
