import apiClient from './apiClient';

export const examService = {
  async getStudentExams() {
    const response = await apiClient.get('/exams/student/list/');
    return response.data;
  },

  async getStudentExamDetails(examId) {
    const response = await apiClient.get(`/exams/student/${examId}/`);
    return response.data;
  },

  async submitExam(examId, answers) {
    // answers structure: [{ question_id: X, answer: { value: Y / option_id: Z / text: W } }]
    const response = await apiClient.post(`/exams/student/${examId}/submit/`, {
      answers,
    });
    return response.data;
  },

  async getAttemptDetail(attemptId) {
    const response = await apiClient.get(`/exams/student/attempts/${attemptId}/`);
    return response.data;
  }
};

export default examService;
