/**
 * api/examService.js
 * ─────────────────────────────────────────────────────────────────
 * خدمة API لإدارة الاختبارات
 */

import api from './axiosInstance'

const EXAMS_BASE = '/exams'

/**
 * إنشاء اختبار كامل (دفعي)
 */
export const createExam = (payload) =>
  api.post(`${EXAMS_BASE}/create/`, payload)

/**
 * جلب قائمة الاختبارات (مع فلتر اختياري حسب الكورس)
 */
export const fetchExams = (params = {}) =>
  api.get(`${EXAMS_BASE}/`, { params })

/**
 * جلب تفاصيل اختبار محدد
 */
export const fetchExam = (examId) =>
  api.get(`${EXAMS_BASE}/${examId}/`)

/**
 * تحديث اختبار كامل (دفعي)
 */
export const updateExam = (examId, payload) =>
  api.put(`${EXAMS_BASE}/${examId}/`, payload)

/**
 * حذف اختبار
 */
export const deleteExam = (examId) =>
  api.delete(`${EXAMS_BASE}/${examId}/`)

/**
 * جلب محاولات الطلاب لاختبار محدد
 */
export const fetchExamSubmissions = (examId, params = {}) =>
  api.get(`${EXAMS_BASE}/${examId}/submissions/`, { params })

/**
 * جلب تفاصيل محاولة طالب محدد
 */
export const fetchAttemptDetail = (attemptId) =>
  api.get(`${EXAMS_BASE}/attempts/${attemptId}/`)
