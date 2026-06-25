import apiClient from './apiClient';

export const profileService = {
  async getProfile() {
    const response = await apiClient.get('/auth/me/');
    return response.data;
  }
};

export default profileService;
