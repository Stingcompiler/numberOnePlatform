import apiClient from './apiClient';

export const courseService = {
  async getMyCourses(studentProfile = null) {
    if (studentProfile?.system_type === 'online') {
      const response = await apiClient.get('/academic/courses/', {
        params: {
          grade: studentProfile.enrolled_grade_id,
          system_type: 'online'
        }
      });
      if (response.data && typeof response.data === 'object' && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      return Array.isArray(response.data) ? response.data : [];
    }
    const response = await apiClient.get('/academic/my-courses/');
    return Array.isArray(response.data) ? response.data : [];
  },

  async getCourseDetails(courseId, studentProfile = null) {
    if (studentProfile?.system_type === 'online') {
      const response = await apiClient.get(`/academic/courses/${courseId}/`);
      return response.data;
    }
    const response = await apiClient.get(`/academic/my-courses/${courseId}/`);
    return response.data;
  },

  async getLessonDetails(lessonId) {
    const response = await apiClient.get(`/academic/my-lessons/${lessonId}/`);
    return response.data;
  },

  async markLessonComplete(lessonId) {
    const response = await apiClient.post(`/academic/my-lessons/${lessonId}/complete/`);
    return response.data;
  },

  async submitExercise(exerciseId, answers) {
    // answers structure: [{ question_id: X, choice_id: Y }]
    const response = await apiClient.post('/academic/submit/', {
      exercise_id: exerciseId,
      answers,
    });
    return response.data;
  },

  async getMySubmissions(exerciseId = null) {
    const params = {};
    if (exerciseId) {
      params.exercise = exerciseId;
    }
    const response = await apiClient.get('/academic/my-submissions/', { params });
    return response.data;
  },

  async getMyProgress() {
    const response = await apiClient.get('/academic/my-progress/');
    return response.data;
  }
};

export default courseService;
