import apiClient from './apiClient';

export const notificationService = {
  async getNotifications() {
    // Fetch announcements from public announcements endpoint as system alerts/notifications
    const response = await apiClient.get('/public/announcements/');
    return response.data;
  }
};

export default notificationService;
