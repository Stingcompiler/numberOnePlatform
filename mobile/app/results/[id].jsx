import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import examService from '../../src/services/examService';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import StatusView from '../../src/components/StatusView';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/theme/tokens';
import { ChevronRight, Award, CheckCircle, XCircle, ArrowLeftRight, Calendar } from 'lucide-react-native';

export default function ResultDetailsScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await examService.getAttemptDetail(id);
      setAttempt(data);
    } catch (e) {
      console.log('Error loading attempt details:', e);
      if (e.response && e.response.status === 403) {
        setError(e.response.data?.detail || 'ليس لديك صلاحية الوصول لنتيجة هذا الاختبار.');
      } else {
        setError('تعذر تحميل ورقة الإجابة. يرجى التحقق من اتصالك بالإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
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

  if (!attempt) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>المحاولة غير موجودة.</Text>
      </View>
    );
  }

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const correctAnswersCount = attempt.answers?.filter((ans) => ans.is_correct).length || 0;
  const totalQuestions = attempt.answers?.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronRight size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          ورقة الإجابة والنتيجة
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Score Dashboard Card */}
        <Card style={styles.dashboardCard}>
          <View style={styles.dashboardHeader}>
            <View style={styles.submittedRow}>
              <Calendar size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                تاريخ التسليم: {formatDate(attempt.submitted_at)}
              </Text>
            </View>
            <Text style={[styles.examTitle, { color: colors.text }]} numberOfLines={1}>
              {attempt.exam_title}
            </Text>
          </View>

          <View style={styles.statsRow}>
            {/* Grade Circular/Large display */}
            <View style={styles.gradeDisplay}>
              <Text style={[styles.percentageText, { color: attempt.is_passed ? colors.success : colors.error }]}>
                {attempt.percentage.toFixed(1)}%
              </Text>
              <Text style={[styles.scoreSub, { color: colors.textSecondary }]}>
                الدرجة: {attempt.score.toFixed(1)} / {attempt.exam_total_marks.toFixed(1)}
              </Text>
            </View>

            {/* Badges and summary */}
            <View style={styles.badgeColumn}>
              <View style={[
                styles.statusBadge,
                { 
                  backgroundColor: attempt.is_passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  borderColor: attempt.is_passed ? colors.success : colors.error 
                }
              ]}>
                {attempt.is_passed ? (
                  <CheckCircle size={14} color={colors.success} style={{ marginLeft: 4 }} />
                ) : (
                  <XCircle size={14} color={colors.error} style={{ marginLeft: 4 }} />
                )}
                <Text style={[styles.statusText, { color: attempt.is_passed ? colors.success : colors.error }]}>
                  {attempt.is_passed ? 'ناجح' : 'راسب'}
                </Text>
              </View>

              <Text style={[styles.correctCountText, { color: colors.textSecondary }]}>
                الإجابات الصحيحة: {correctAnswersCount} / {totalQuestions}
              </Text>
            </View>
          </View>
        </Card>

        {/* Answers Detailed Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          تفاصيل الأسئلة والإجابات
        </Text>

        <View style={styles.answersList}>
          {attempt.answers?.map((answer, index) => {
            const isCorrect = answer.is_correct;
            const borderCol = isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
            const headerBg = isCorrect ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)';
            
            return (
              <Card key={answer.id} style={[styles.answerCard, { borderColor: borderCol, padding: 0, overflow: 'hidden' }]}>
                {/* Question Card Header */}
                <View style={[styles.answerHeader, { backgroundColor: headerBg, borderBottomColor: colors.border }]}>
                  <View style={styles.marksContainer}>
                    <Text style={[styles.earnedMarks, { color: isCorrect ? colors.success : colors.error }]}>
                      {answer.earned_marks.toFixed(1)} / {answer.question_marks.toFixed(1)}
                    </Text>
                    {isCorrect ? (
                      <CheckCircle size={16} color={colors.success} style={{ marginRight: 6 }} />
                    ) : (
                      <XCircle size={16} color={colors.error} style={{ marginRight: 6 }} />
                    )}
                  </View>

                  <View style={styles.headerTitleRow}>
                    <View style={[
                      styles.typeBadge,
                      {
                        backgroundColor: 
                          answer.question_type === 'true_false' ? 'rgba(0, 216, 214, 0.1)' :
                          answer.question_type === 'multiple_choice' ? 'rgba(0, 184, 182, 0.1)' :
                          answer.question_type === 'fill_blank' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                        borderColor:
                          answer.question_type === 'true_false' ? colors.accent :
                          answer.question_type === 'multiple_choice' ? colors.accent :
                          answer.question_type === 'fill_blank' ? colors.warning : '#8B5CF6',
                      }
                    ]}>
                      <Text style={[
                        styles.typeText,
                        {
                          color:
                            answer.question_type === 'true_false' ? colors.accent :
                            answer.question_type === 'multiple_choice' ? colors.accent :
                            answer.question_type === 'fill_blank' ? colors.warning : '#A78BFA',
                        }
                      ]}>
                        {
                          answer.question_type === 'true_false' ? 'صح/خطأ' :
                          answer.question_type === 'multiple_choice' ? 'اختيار' :
                          answer.question_type === 'fill_blank' ? 'أكمل' : 'مطابقة'
                        }
                      </Text>
                    </View>

                    <Text style={[styles.questionNumberText, { color: colors.textSecondary }]}>
                      سؤال {index + 1}
                    </Text>
                  </View>
                </View>

                {/* Question Body */}
                <View style={styles.answerBody}>
                  <Text style={[styles.questionText, { color: colors.text }]}>
                    {answer.question_text}
                  </Text>

                  {/* Optional Question Image */}
                  {answer.image_url ? (
                    <Image 
                      source={{ uri: answer.image_url }} 
                      style={styles.questionImage} 
                      resizeMode="contain" 
                    />
                  ) : null}

                  {/* Render Answer Comparisons */}
                  <View style={styles.comparisonsContainer}>
                    
                    {/* True/False Comparison */}
                    {answer.question_type === 'true_false' && (
                      <View style={styles.tfCompareRow}>
                        {/* Student Choice */}
                        <View style={[
                          styles.compareBox,
                          {
                            backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                            borderColor: isCorrect ? colors.success : colors.error,
                          }
                        ]}>
                          <Text style={[styles.compareLabel, { color: colors.textMuted }]}>إجابتك</Text>
                          <Text style={[
                            styles.compareVal,
                            { color: isCorrect ? colors.success : colors.error, fontWeight: 'bold' }
                          ]}>
                            {answer.student_answer?.value === undefined ? 'لم تجب' : (answer.student_answer.value ? 'صح' : 'خطأ')}
                          </Text>
                        </View>

                        {/* Correct Choice */}
                        <View style={[styles.compareBox, { backgroundColor: 'rgba(16,185,129,0.05)', borderColor: colors.success }]}>
                          <Text style={[styles.compareLabel, { color: colors.textMuted }]}>الإجابة الصحيحة</Text>
                          <Text style={[styles.compareVal, { color: colors.success, fontWeight: 'bold' }]}>
                            {answer.correct_answer?.value ? 'صح' : 'خطأ'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* MCQ Options Highlights */}
                    {answer.question_type === 'multiple_choice' && (
                      <View style={styles.mcqOptionsList}>
                        {answer.options?.map((option) => {
                          const isCorrectOpt = option.id === answer.correct_answer?.option_id;
                          const isStudentOpt = option.id === answer.student_answer?.option_id;

                          let optionCol = 'rgba(255, 255, 255, 0.05)';
                          let textCol = colors.textSecondary;
                          let borderStyle = { borderColor: colors.border };
                          let badgeText = '';

                          if (isCorrectOpt && isStudentOpt) {
                            optionCol = 'rgba(16, 185, 129, 0.1)';
                            textCol = colors.success;
                            borderStyle = { borderColor: colors.success, borderWidth: 1.5 };
                            badgeText = '✓ إجابتك صحيحة';
                          } else if (isCorrectOpt) {
                            optionCol = 'rgba(16, 185, 129, 0.05)';
                            textCol = colors.success;
                            borderStyle = { borderColor: colors.success, borderWidth: 1.2 };
                            badgeText = '✓ الصحيحة';
                          } else if (isStudentOpt) {
                            optionCol = 'rgba(239, 68, 68, 0.08)';
                            textCol = colors.error;
                            borderStyle = { borderColor: colors.error, borderWidth: 1.5 };
                            badgeText = '✗ إجابتك';
                          }

                          return (
                            <View 
                              key={option.id}
                              style={[
                                styles.mcqOptionReviewRow, 
                                borderStyle, 
                                { backgroundColor: optionCol }
                              ]}
                            >
                              {badgeText !== '' && (
                                <Text style={[
                                  styles.optionReviewBadge,
                                  { color: isCorrectOpt ? colors.success : colors.error }
                                ]}>
                                  {badgeText}
                                </Text>
                              )}
                              <Text style={[styles.optionReviewText, { color: textCol }]} numberOfLines={2}>
                                {option.text}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Fill in the Blank Comparison */}
                    {answer.question_type === 'fill_blank' && (
                      <View style={styles.tfCompareRow}>
                        {/* Student Value */}
                        <View style={[
                          styles.compareBox,
                          {
                            backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                            borderColor: isCorrect ? colors.success : colors.error,
                          }
                        ]}>
                          <Text style={[styles.compareLabel, { color: colors.textMuted }]}>إجابتك</Text>
                          <Text style={[
                            styles.compareVal,
                            { color: isCorrect ? colors.success : colors.error, fontWeight: 'bold' }
                          ]}>
                            {answer.student_answer?.text || 'لم تكتب إجابة'}
                          </Text>
                        </View>

                        {/* Correct Value */}
                        <View style={[styles.compareBox, { backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: colors.success }]}>
                          <Text style={[styles.compareLabel, { color: colors.textMuted }]}>الإجابة الصحيحة</Text>
                          <Text style={[styles.compareVal, { color: colors.success, fontWeight: 'bold' }]}>
                            {answer.correct_answer?.text || 'غير محدد'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Matching Pairs Reviewer */}
                    {answer.question_type === 'matching' && (
                      <View style={styles.matchingReviewContainer}>
                        {/* Correct Pairs list reference */}
                        <Text style={[styles.matchingSubtitle, { color: colors.success }]}>
                          ✓ التطابقات الصحيحة:
                        </Text>
                        {answer.correct_answer?.pairs?.map((pair, idx) => (
                          <View key={`corr-${idx}`} style={[styles.matchReviewRow, { backgroundColor: 'rgba(16, 185, 129, 0.03)', borderColor: 'rgba(16, 185, 129, 0.1)' }]}>
                            <Text style={[styles.matchReviewVal, { color: colors.text }]}>{pair.a}</Text>
                            <ArrowLeftRight size={10} color={colors.success} style={styles.arrowIcon} />
                            <Text style={[styles.matchReviewVal, { color: colors.text, textAlign: 'left' }]}>{pair.b}</Text>
                          </View>
                        ))}

                        {/* Student's Choices Review */}
                        <Text style={[styles.matchingSubtitle, { color: colors.textSecondary, marginTop: SPACING.md }]}>
                          خياراتك وإجاباتك:
                        </Text>
                        
                        {(!answer.student_answer?.pairs || answer.student_answer.pairs.length === 0) ? (
                          <View style={[styles.matchReviewRow, { borderColor: colors.error, backgroundColor: 'rgba(239, 68, 68, 0.03)' }]}>
                            <Text style={[styles.matchReviewVal, { color: colors.error, textAlign: 'center' }]}>
                              لم تجب على هذا السؤال
                            </Text>
                          </View>
                        ) : (
                          answer.student_answer.pairs.map((pair, idx) => {
                            // Check if student pair is correct by looking up left element 'a' in correct pairs
                            const correctPair = answer.correct_answer?.pairs?.find((cp) => cp.a === pair.a);
                            const pairCorrect = correctPair && correctPair.b === pair.b;
                            
                            return (
                              <View 
                                key={`stud-${idx}`}
                                style={[
                                  styles.matchReviewRow,
                                  {
                                    borderColor: pairCorrect ? colors.success : colors.error,
                                    backgroundColor: pairCorrect ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)',
                                  }
                                ]}
                              >
                                <Text style={[styles.matchReviewVal, { color: pairCorrect ? colors.textSecondary : colors.error }]}>
                                  {pair.a}
                                </Text>
                                <View style={styles.row}>
                                  {pairCorrect ? (
                                    <CheckCircle size={12} color={colors.success} style={{ marginLeft: 4 }} />
                                  ) : (
                                    <XCircle size={12} color={colors.error} style={{ marginLeft: 4 }} />
                                  )}
                                  <ArrowLeftRight size={10} color={pairCorrect ? colors.success : colors.error} style={styles.arrowIcon} />
                                </View>
                                <Text style={[styles.matchReviewVal, { color: pairCorrect ? colors.textSecondary : colors.error, textAlign: 'left' }]}>
                                  {pair.b}
                                </Text>
                                
                                {!pairCorrect && correctPair && (
                                  <Text style={[styles.matchingCorrectHint, { color: colors.success }]}>
                                    الصحيح: {correctPair.b}
                                  </Text>
                                )}
                              </View>
                            );
                          })
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>

        {/* Back To Exams list */}
        <Button
          title="العودة للاختبارات الأكاديمية"
          onPress={() => router.replace('/(tabs)/exams')}
          style={styles.backBtn}
        />
      </ScrollView>
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
    flexDirection: 'row',
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
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  dashboardCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  dashboardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
  },
  examTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: 'right',
    marginBottom: 4,
  },
  submittedRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 10,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gradeDisplay: {
    alignItems: 'center',
  },
  percentageText: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.black,
  },
  scoreSub: {
    fontSize: 10,
    marginTop: 2,
  },
  badgeColumn: {
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  statusText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: 'bold',
  },
  correctCountText: {
    fontSize: TYPOGRAPHY.size.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingRight: SPACING.xs,
    textAlign: 'right',
  },
  answersList: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  answerCard: {
    borderWidth: 1.5,
  },
  answerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  questionNumberText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: 'bold',
  },
  typeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  marksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earnedMarks: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: 'bold',
  },
  answerBody: {
    padding: SPACING.md,
  },
  questionText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.medium,
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: SPACING.md,
  },
  questionImage: {
    width: '100%',
    height: 180,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  comparisonsContainer: {
    marginTop: SPACING.sm,
  },
  tfCompareRow: {
    flexDirection: 'row-reverse',
    gap: SPACING.md,
  },
  compareBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  compareLabel: {
    fontSize: 9,
    marginBottom: 2,
  },
  compareVal: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  mcqOptionsList: {
    gap: SPACING.xs,
  },
  mcqOptionReviewRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  optionReviewText: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'right',
    flex: 1,
  },
  optionReviewBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: SPACING.md,
  },
  matchingReviewContainer: {
    gap: SPACING.xs,
  },
  matchingSubtitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  matchReviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    flexWrap: 'wrap',
  },
  matchReviewVal: {
    fontSize: TYPOGRAPHY.size.xs,
    flex: 1,
    textAlign: 'right',
  },
  arrowIcon: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchingCorrectHint: {
    width: '100%',
    fontSize: 9,
    textAlign: 'right',
    marginTop: 2,
    fontWeight: 'bold',
  },
  backBtn: {
    marginBottom: SPACING.xxl,
  },
});
