import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import VideoPlayer from '../../../src/components/VideoPlayer';
import courseService from '../../../src/services/courseService';
import Card from '../../../src/components/Card';
import Button from '../../../src/components/Button';
import StatusView from '../../../src/components/StatusView';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../../src/theme/tokens';
import { ChevronRight, FileText, ExternalLink, Award, AlertCircle, CheckCircle2 } from 'lucide-react-native';

export default function LessonDetailsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { lessonId, courseId } = useLocalSearchParams();
  const router = useRouter();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'files', 'exercise'

  // Exercise State
  const [selectedChoices, setSelectedChoices] = useState({}); // { questionId: choiceId }
  const [submittingExercise, setSubmittingExercise] = useState(false);
  const [exerciseResult, setExerciseResult] = useState(null);
  const [exerciseError, setExerciseError] = useState(null);

  const loadData = async () => {
    try {
      setError(null);
      const studentProfile = user?.student_profile || {};
      const isFlash = studentProfile?.system_type === 'flash';

      // Flash students: lesson detail endpoint may not be accessible;
      // load directly from course details fallback.
      if (isFlash && courseId) {
        const courseData = await courseService.getCourseDetails(courseId, studentProfile);
        let foundLesson = null;
        if (courseData && courseData.units) {
          for (const unit of courseData.units) {
            if (unit.lessons) {
              const match = unit.lessons.find(l => l.id === parseInt(lessonId));
              if (match) {
                foundLesson = match;
                break;
              }
            }
          }
        }
        if (foundLesson) {
          setLesson({
            id: foundLesson.id,
            title: foundLesson.title,
            youtube_url: foundLesson.youtube_url,
            youtube_embed_url: foundLesson.youtube_embed_url,
            pdf_file: foundLesson.pdf_file,
            duration_minutes: foundLesson.duration_minutes,
            description: foundLesson.description || '',
            is_completed: false,
            exercise: null
          });
          // Reset exercise state
          setSelectedChoices({});
          setExerciseResult(null);
          setExerciseError(null);
          return;
        }
        // If lesson not found in course data, fall through to standard endpoint
      }

      const data = await courseService.getLessonDetails(lessonId);
      setLesson(data);
      // Reset exercise answers/result when loading new lesson
      setSelectedChoices({});
      setExerciseResult(null);
      setExerciseError(null);
    } catch (e) {
      // If primary endpoint fails and courseId is available, try fetching from course details
      if (courseId) {
        console.log('Primary lesson endpoint failed, trying course details fallback for courseId:', courseId);
        try {
          const studentProfile = user?.student_profile || {};
          const courseData = await courseService.getCourseDetails(courseId, studentProfile);
          let foundLesson = null;
          if (courseData && courseData.units) {
            for (const unit of courseData.units) {
              if (unit.lessons) {
                const match = unit.lessons.find(l => l.id === parseInt(lessonId));
                if (match) {
                  foundLesson = match;
                  break;
                }
              }
            }
          }
          if (foundLesson) {
            setLesson({
              id: foundLesson.id,
              title: foundLesson.title,
              youtube_url: foundLesson.youtube_url,
              youtube_embed_url: foundLesson.youtube_embed_url,
              pdf_file: foundLesson.pdf_file,
              duration_minutes: foundLesson.duration_minutes,
              description: foundLesson.description || 'تفاصيل المحاضرة متاحة للمشتركين.',
              is_completed: false,
              exercise: null
            });
            // Reset exercise state
            setSelectedChoices({});
            setExerciseResult(null);
            setExerciseError(null);
            return;
          }
        } catch (fallbackErr) {
          console.log('Fallback error loading lesson details:', fallbackErr);
        }
      }

      console.log('Error loading lesson details:', e);
      if (e.response && e.response.status === 403) {
        setError(e.response.data?.detail || 'ليس لديك صلاحية الوصول لهذه المحاضرة.');
      } else {
        setError('تعذر تحميل تفاصيل المحاضرة. يرجى التحقق من اتصالك بالإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [lessonId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMarkComplete = async () => {
    setMarkingComplete(true);
    try {
      await courseService.markLessonComplete(lessonId);
      setLesson((prev) => ({ ...prev, is_completed: true }));
    } catch (e) {
      console.log('Error marking lesson complete:', e);
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleOpenPDF = () => {
    if (lesson?.pdf_file) {
      Linking.openURL(lesson.pdf_file).catch((e) => console.log('Could not open PDF URL:', e));
    }
  };

  const selectChoice = (questionId, choiceId) => {
    if (exerciseResult) return; // Prevent changing choices after submission
    setSelectedChoices((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }));
  };

  const handleExerciseSubmit = async () => {
    if (!lesson?.exercise) return;

    const questions = lesson.exercise.questions || [];
    if (Object.keys(selectedChoices).length < questions.length) {
      setExerciseError('يرجى الإجابة على جميع الأسئلة أولاً.');
      return;
    }

    setSubmittingExercise(true);
    setExerciseError(null);

    try {
      const answersPayload = Object.entries(selectedChoices).map(([qId, cId]) => ({
        question_id: parseInt(qId),
        choice_id: parseInt(cId),
      }));

      const result = await courseService.submitExercise(lesson.exercise.id, answersPayload);
      setExerciseResult(result);
    } catch (e) {
      console.log('Error submitting exercise:', e);
      setExerciseError('حدث خطأ أثناء تسليم التمرين. يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmittingExercise(false);
    }
  };

  const handleRetryExercise = () => {
    setExerciseResult(null);
    setSelectedChoices({});
    setExerciseError(null);
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusView loading={true} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusView error={error} onRetry={loadData} />
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>المحاضرة غير موجودة.</Text>
      </View>
    );
  }

  const exercise = lesson.exercise;
  const questionsCount = exercise?.questions?.length || 0;
  const answeredCount = Object.keys(selectedChoices).length;
  const allAnswered = answeredCount === questionsCount;

  const tabs = [
    { id: 'details', label: 'الوصف والملخص' },
    { id: 'files', label: 'المرفقات والملفات', hasDot: !!lesson.pdf_file },
    // { id: 'exercise', label: 'تمارين التقييم', hasDot: !!exercise }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      {!isFullscreen && (
        <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronRight size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {lesson.title}
          </Text>
        </View>
      )}

      {/* Video Player */}
      {(lesson.youtube_url || lesson.youtube_embed_url) && (
        <View style={isFullscreen ? styles.fullscreenVideoWrapper : styles.inlineVideoWrapper}>
          <VideoPlayer
            videoUrl={lesson.youtube_url || lesson.youtube_embed_url}
            isFullscreen={isFullscreen}
            setIsFullscreen={setIsFullscreen}
          />
        </View>
      )}

      {!isFullscreen && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {/* Global Lesson Header Card */}
          <Card style={styles.globalHeaderCard}>
            <View style={styles.titleRow}>
              {lesson.is_completed ? (
                <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: colors.success }]}>
                  <CheckCircle2 size={12} color={colors.success} style={{ marginLeft: 4 }} />
                  <Text style={[styles.badgeText, { color: colors.success }]}>مكتملة</Text>
                </View>
              ) : (
                <Button
                  title="تحديد كمكتملة"
                  onPress={handleMarkComplete}
                  loading={markingComplete}
                  style={[styles.completeBtn, { backgroundColor: colors.success }]}
                  textStyle={{ fontSize: 12, color: '#0B0F19', fontWeight: 'bold' }}
                />
              )}
              <Text style={[styles.lessonTitleText, { color: colors.text }]}>{lesson.title}</Text>
            </View>
          </Card>

          {/* Segment Tab Controller */}
          <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.tabButton,
                    isActive && { borderBottomColor: colors.accent }
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.tabLabel,
                    { color: isActive ? colors.text : colors.textSecondary }
                  ]}>
                    {tab.label}
                  </Text>
                  {tab.hasDot && (
                    <View style={[styles.tabDot, { backgroundColor: colors.accent }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab Content Areas */}
          {activeTab === 'details' && (
            <Card style={styles.tabCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>وصف المحاضرة</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {lesson.description || 'لا يوجد وصف وتفاصيل مضافة لهذه المحاضرة حالياً.'}
              </Text>
              {lesson.duration_minutes ? (
                <Text style={[styles.durationMeta, { color: colors.textMuted }]}>
                  مدة المحاضرة المقدرة: {lesson.duration_minutes} دقيقة
                </Text>
              ) : null}
            </Card>
          )}

          {activeTab === 'files' && (
            <View>
              {lesson.pdf_file ? (
                <TouchableOpacity onPress={handleOpenPDF} activeOpacity={0.8} style={styles.pdfButton}>
                  <Card style={styles.pdfCard}>
                    <ExternalLink size={18} color={colors.accent} />
                    <View style={styles.pdfInfo}>
                      <Text style={[styles.pdfTitle, { color: colors.text }]}>ملف PDF المرفق</Text>
                      <Text style={[styles.pdfSubtitle, { color: colors.textSecondary }]}>انقر لفتح وتحميل الملخص والواجب</Text>
                    </View>
                    <View style={[styles.pdfIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                      <FileText size={24} color="#EF4444" />
                    </View>
                  </Card>
                </TouchableOpacity>
              ) : (
                <Card style={styles.emptyTabCard}>
                  <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>
                    لا توجد ملفات أو مرفقات دراسية لهذه المحاضرة.
                  </Text>
                </Card>
              )}
            </View>
          )}

          {activeTab === 'exercise' && (
            <View>
              {exercise ? (
                <View style={styles.exerciseSection}>
                  {exerciseResult ? (
                    <Card style={[
                      styles.resultCard,
                      { borderColor: exerciseResult.is_passed ? colors.success : colors.error }
                    ]}>
                      <View style={[
                        styles.resultIconBg,
                        { backgroundColor: exerciseResult.is_passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                      ]}>
                        {exerciseResult.is_passed ? (
                          <Award size={40} color={colors.success} />
                        ) : (
                          <AlertCircle size={40} color={colors.error} />
                        )}
                      </View>

                      <Text style={[styles.resultTitle, { color: colors.text }]}>
                        {exerciseResult.is_passed ? '🎉 أحسنت! لقد اجتزت التمرين بنجاح' : 'حاول مرة أخرى لتحسين درجتك'}
                      </Text>

                      <View style={styles.resultDetails}>
                        <Text style={[styles.resultScore, { color: colors.textSecondary }]}>
                          درجتك: <Text style={{ color: exerciseResult.is_passed ? colors.success : colors.error, fontWeight: 'bold' }}>
                            {exerciseResult.score} / {exercise.total_marks}
                          </Text>
                        </Text>
                        <Text style={[styles.resultPercentage, { color: colors.textMuted }]}>
                          نسبة النجاح: {Math.round(exerciseResult.percentage)}%
                        </Text>
                      </View>

                      {!exerciseResult.is_passed && (
                        <Button
                          title="حاول مرة أخرى"
                          onPress={handleRetryExercise}
                          variant="outline"
                          style={styles.retryBtn}
                        />
                      )}
                    </Card>
                  ) : (
                    <Card style={styles.exerciseCard}>
                      <View style={styles.exerciseHeader}>
                        <Text style={[styles.exerciseInfoText, { color: colors.textSecondary }]}>
                          {questionsCount} أسئلة • {exercise.total_marks} درجة
                        </Text>
                        <Text style={[styles.exerciseTitle, { color: colors.text }]}>{exercise.title || 'تمرين للتقييم'}</Text>
                      </View>

                      {exercise.instructions ? (
                        <View style={[styles.instructionsBox, { backgroundColor: colors.border }]}>
                          <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
                            {exercise.instructions}
                          </Text>
                        </View>
                      ) : null}

                      {/* Questions List */}
                      <View style={styles.questionsList}>
                        {exercise.questions?.map((question, index) => (
                          <View key={question.id} style={styles.questionItem}>
                            <Text style={[styles.questionText, { color: colors.text }]}>
                              {index + 1}. {question.text}
                            </Text>

                            <View style={styles.choicesList}>
                              {question.choices?.map((choice) => {
                                const isSelected = selectedChoices[question.id] === choice.id;
                                return (
                                  <TouchableOpacity
                                    key={choice.id}
                                    onPress={() => selectChoice(question.id, choice.id)}
                                    activeOpacity={0.7}
                                    style={[
                                      styles.choiceBtn,
                                      {
                                        borderColor: isSelected ? colors.accent : colors.border,
                                        backgroundColor: isSelected ? `${colors.accent}12` : 'rgba(255,255,255,0.01)',
                                      },
                                    ]}
                                  >
                                    <Text style={[
                                      styles.choiceText,
                                      { color: isSelected ? colors.accent : colors.textSecondary }
                                    ]}>
                                      {choice.text}
                                    </Text>
                                    <View style={[
                                      styles.radioIndicator,
                                      {
                                        borderColor: isSelected ? colors.accent : colors.border,
                                        backgroundColor: isSelected ? colors.accent : 'transparent',
                                      }
                                    ]} />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        ))}
                      </View>

                      {exerciseError ? (
                        <Text style={[styles.exerciseErrorText, { color: colors.error }]}>{exerciseError}</Text>
                      ) : null}

                      <Button
                        title={submittingExercise ? 'جاري إرسال الإجابات...' : 'تسليم التمرين'}
                        onPress={handleExerciseSubmit}
                        loading={submittingExercise}
                        disabled={!allAnswered}
                        style={styles.submitExerciseBtn}
                      />

                      {!allAnswered && (
                        <Text style={[styles.remainingText, { color: colors.textMuted }]}>
                          أجب على جميع الأسئلة للتسليم ({answeredCount} / {questionsCount})
                        </Text>
                      )}
                    </Card>
                  )}
                </View>
              ) : (
                <Card style={styles.emptyTabCard}>
                  <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>
                    لا توجد تمارين تقييمية مضافة لهذه المحاضرة.
                  </Text>
                </Card>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    height: 60,
    marginTop: 40,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1.5,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    maxWidth: '80%',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  globalHeaderCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lessonTitleText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    flex: 1,
    paddingLeft: SPACING.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  completeBtn: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    minHeight: 28,
    borderRadius: RADIUS.sm,
  },
  inlineVideoWrapper: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  fullscreenVideoWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
  },
  tabBar: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
    marginTop: SPACING.xs,
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabCard: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: TYPOGRAPHY.size.sm,
    lineHeight: 22,
    textAlign: 'right',
  },
  durationMeta: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: SPACING.md,
  },
  pdfButton: {
    marginBottom: SPACING.lg,
  },
  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  pdfInfo: {
    flex: 1,
    paddingRight: SPACING.md,
    alignItems: 'flex-end',
  },
  pdfTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
  },
  pdfSubtitle: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
  },
  pdfIconBg: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseSection: {
    marginBottom: SPACING.lg,
  },
  exerciseCard: {
    padding: SPACING.lg,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
  },
  exerciseTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
  },
  exerciseInfoText: {
    fontSize: 11,
  },
  instructionsBox: {
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  instructionsText: {
    fontSize: TYPOGRAPHY.size.xs,
    lineHeight: 18,
    textAlign: 'right',
  },
  questionsList: {
    marginBottom: SPACING.lg,
  },
  questionItem: {
    marginBottom: SPACING.xl,
  },
  questionText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.medium,
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: SPACING.md,
  },
  choicesList: {
    paddingRight: SPACING.sm,
  },
  choiceBtn: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  choiceText: {
    fontSize: TYPOGRAPHY.size.sm,
    marginRight: SPACING.md,
    flex: 1,
    textAlign: 'right',
  },
  radioIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  exerciseErrorText: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  submitExerciseBtn: {
    marginTop: SPACING.sm,
  },
  remainingText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  resultCard: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderWidth: 1.5,
  },
  resultIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  resultTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  resultDetails: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  resultScore: {
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: SPACING.xs,
  },
  resultPercentage: {
    fontSize: TYPOGRAPHY.size.xs,
  },
  retryBtn: {
    minWidth: 180,
  },
  emptyTabCard: {
    padding: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTabText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.xs,
  },
});
