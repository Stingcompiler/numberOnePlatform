/**
 * mobile/src/services/liveService.js
 * ──────────────────────────────────────────────────────────────────────────
 * خدمة API لنظام البث المباشر الجديد (Live Rooms & Sessions)
 *
 * تتواصل مع: GET /api/live/my-sessions/
 * تُعيد: مصفوفة من الغرف، كل غرفة تحتوي على sessions داخلها
 * ──────────────────────────────────────────────────────────────────────────
 */

import apiClient from './apiClient';

const liveService = {
  /**
   * جلب الغرف والجلسات المتاحة للطالب بناءً على system_type.
   * @returns {Promise<Array>} مصفوفة من LiveRoom تحتوي كل منها على sessions[]
   */
  async getMyLiveSessions() {
    const response = await apiClient.get('/live/my-sessions/');
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  },
};

export default liveService;
