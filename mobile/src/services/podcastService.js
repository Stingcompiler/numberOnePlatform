import apiClient from './apiClient';

/**
 * podcastService — خدمة البودكاست المباشر
 *
 * تتواصل مع نقطة النهاية:
 *   GET /api/academic/my-live-podcasts/
 *
 * تُعيد مصفوفة من كائنات المحاضرة التي تحتوي على:
 *   { id, title, live_podcast_title, live_podcast_url,
 *     course_id, course_name, unit_name, created_at }
 */

export const podcastService = {
  /**
   * جلب جميع جلسات البودكاست المباشر المتاحة للطالب.
   * @returns {Promise<Array>}
   */
  async getMyLivePodcasts() {
    const response = await apiClient.get('/academic/my-live-podcasts/');
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  },
};

export default podcastService;
