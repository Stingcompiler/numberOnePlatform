import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from './apiClient';

// Configure how notifications behave when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  /**
   * Request permissions and get the Expo Push Token.
   */
  async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return null;
      }

      // projectId must be provided explicitly for EAS builds
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      })).data;
    } else {
      console.warn('Must use physical device for Push Notifications');
    }

    return token;
  },

  /**
   * Sync the token with the Django backend.
   */
  async syncPushToken(token) {
    if (!token) return;
    try {
      const deviceId = Device.osBuildId || Device.modelName || 'unknown-device';
      await apiClient.post('/notifications/register-token/', {
        token: token,
        device_id: deviceId
      });
    } catch (e) {
      console.error('Failed to sync push token with backend:', e);
    }
  },

  /**
   * Get paginated notifications from backend
   */
  async getNotifications(page = 1) {
    const response = await apiClient.get(`/notifications/?page=${page}`);
    return response.data;
  },

  /**
   * Get unread count
   */
  async getUnreadCount() {
    const response = await apiClient.get('/notifications/count/');
    return response.data;
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(id) {
    const response = await apiClient.post(`/notifications/${id}/read/`);
    return response.data;
  },

  /**
   * Mark all as read
   */
  async markAllAsRead() {
    const response = await apiClient.post('/notifications/read-all/');
    return response.data;
  }
};

export default notificationService;
