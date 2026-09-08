import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import examService from '../../src/services/examService';
import courseService from '../../src/services/courseService';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import StatusView from '../../src/components/StatusView';
import { SPACING, TYPOGRAPHY, RADIUS } from '../../src/theme/tokens';
import { Clock, ChevronRight, ChevronLeft, Send, CheckCircle2, Circle, HelpCircle, AlertTriangle } from 'lucide-react-native';

export default function ExamAttemptScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { examId } = useLocalSearchParams();
  const router = useRouter();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active attempt state
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: answerPayload }
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Picker modal state for matching questions
  const [showMatchingPicker, setShowMatchingPicker] = useState(false);
  const [activeMatchingQuestionId, setActiveMatchingQuestionId] = useState(null);
  const [activeMatchingLeftItem, setActiveMatchingLeftItem] = useState(null);

  const timerRef = useRef(null);
  // حراس ضد التسليم المزدوج:
  // timerStartedRef: يؤكد أن العدّ التنازلي بدأ فعلاً (يمنع تسليماً تلقائياً كاذباً)
  // autoSubmittedRef: يضمن تسليماً تلقائياً واحداً فقط عند انتهاء الوقت
  // submittingRef: يمنع إرسال طلبين متزامنين (يُصفّر عند الفشل للسماح بإعادة المحاولة)
  const timerStartedRef = useRef(false);
  const autoSubmittedRef = useRef(false);
  const submittingRef = useRef(false);

  const loadExam = async () => {
    try {
      setError(null);
      setLoading(true);
      const studentProfile = user?.student_profile || {};
      const [examData, coursesData] = await Promise.all([
        examService.getStudentExamDetails(examId),
        courseService.getMyCourses(studentProfile),
      ]);

      const studentSystemType = studentProfile.system_type || 'online';
      
      let filteredCourses = [];
      if (studentSystemType === 'online') {
        filteredCourses = (coursesData || []).filter(
          (course) => 
            course.system_type === 'online' && 
            course.grade === studentProfile.enrolled_grade_id
        );
      } else if (studentSystemType === 'flash') {
        filteredCourses = coursesData || [];
      }

      const allowedCourseIds = filteredCourses.map(c => c.id);

      if (examData && !allowedCourseIds.includes(examData.course)) {
        setError('الاختبار غير موجود أو ليس لديك صلاحية الوصول إليه.');
      } else {
        setExam(examData);
        // Initialize answers object
        const initialAnswers = {};
        examData.questions.forEach((q) => {
          if (q.question_type === 'true_false') {
            initialAnswers[q.id] = null; // boolean choice needed
          } else if (q.question_type === 'multiple_choice') {
            initialAnswers[q.id] = null; // option_id needed
          } else if (q.question_type === 'fill_blank') {
            initialAnswers[q.id] = { text: '' };
          } else if (q.question_type === 'matching') {
            initialAnswers[q.id] = { pairs: [] }; // array of { a, b }
          }
        });
        setAnswers(initialAnswers);
        setTimeLeft(examData.duration_minutes * 60);
      }
    } catch (e) {
      console.log('Error loading exam details:', e);
      if (e.response && e.response.status === 403) {
        setError(e.response.data?.detail || 'ليس لديك صلاحية الوصول لهذا الاختبار.');
      } else {
        setError('تعذر تحميل أسئلة الاختبار. يرجى التحقق من اتصالك بالإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExam();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examId, user]);

  // Start timer once exam details are loaded
  useEffect(() => {
    if (exam && timeLeft > 0) {
      timerStartedRef.current = true;
      timerRef.current = setInterval(() => {
        // مُحدِّث نقي: لا آثار جانبية بداخله.
        // استدعاء handleAutoSubmit هنا سابقاً كان قد يُنفَّذ مرتين (React 19)
        // فيُنتج تنبيهين ومحاولتَي تسليم للاختبار نفسه.
        setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [exam, timeLeft === 0]);

  // التسليم التلقائي عند انتهاء الوقت — خارج مُحدِّث الحالة ومحمي بحارس
  // لا يعمل إلا إذا كان العدّ التنازلي قد بدأ فعلاً (يمنع تسليم اختبار بلا مدة)
  useEffect(() => {
    if (timeLeft !== 0) return;
    if (!timerStartedRef.current) return;
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    handleAutoSubmit();
  }, [timeLeft]);

  const handleAutoSubmit = () => {
    Alert.alert(
      'انتهى وقت الاختبار',
      'لقد انتهى الوقت المخصص للاختبار. سيتم تسليم إجاباتك الحالية تلقائياً.',
      [{ text: 'موافق', onPress: () => submitAnswers(true) }],
      { cancelable: false }
    );
  };

  const submitAnswers = async (force = false) => {
    // حارس ضد التسليم المزدوج (نقر متكرر أو تسليم يدوي متزامن مع التلقائي)
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setShowConfirmModal(false);

    try {
      // Build answers payload: [{ question_id, answer }]
      const payload = Object.entries(answers).map(([qId, val]) => {
        let formattedVal = {};
        const question = exam.questions.find((q) => q.id === parseInt(qId));
        
        if (question) {
          if (question.question_type === 'true_false') {
            formattedVal = val !== null ? { value: val } : { value: null };
          } else if (question.question_type === 'multiple_choice') {
            formattedVal = val !== null ? { option_id: val } : { option_id: null };
          } else if (question.question_type === 'fill_blank') {
            formattedVal = { text: val?.text || '' };
          } else if (question.question_type === 'matching') {
            formattedVal = { pairs: val?.pairs || [] };
          }
        }

        return {
          question_id: parseInt(qId),
          answer: formattedVal,
        };
      });

      const response = await examService.submitExam(examId, payload);
      // Clean up timer
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Navigate to results screen of the newly created attempt
      if (response && response.attempt) {
        router.replace(`/results/${response.attempt.id}`);
      } else {
        router.replace('/(tabs)/exams');
      }
    } catch (e) {
      console.log('Error submitting exam:', e);
      // تصفير الحارس عند الفشل فقط، كي يستطيع الطالب إعادة المحاولة.
      // عند النجاح يبقى مرفوعاً لمنع إنشاء محاولة ثانية.
      submittingRef.current = false;
      Alert.alert('خطأ في التسليم', 'فشل تسليم إجابات الاختبار. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmitPress = () => {
    setShowConfirmModal(true);
  };

  const handleTrueFalseSelect = (qId, val) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: val,
    }));
  };

  const handleMCQSelect = (qId, optionId) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: optionId,
    }));
  };

  const handleFillBlankChange = (qId, text) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { text },
    }));
  };

  // Matching Pairing logic
  const handleOpenMatchingPicker = (qId, leftItem) => {
    setActiveMatchingQuestionId(qId);
    setActiveMatchingLeftItem(leftItem);
    setShowMatchingPicker(true);
  };

  const handleSelectMatch = (rightItem) => {
    const qId = activeMatchingQuestionId;
    const leftItem = activeMatchingLeftItem;
    
    setAnswers((prev) => {
      const currentPairs = prev[qId]?.pairs || [];
      // Remove any existing pair for this leftItem
      let updatedPairs = currentPairs.filter((pair) => pair.a !== leftItem);
      
      if (rightItem !== null) {
        // Add new pairing
        updatedPairs.push({ a: leftItem, b: rightItem });
      }

      return {
        ...prev,
        [qId]: { pairs: updatedPairs },
      };
    });

    setShowMatchingPicker(false);
    setActiveMatchingQuestionId(null);
    setActiveMatchingLeftItem(null);
  };

  // Format time display
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const hStr = h > 0 ? `${h.toString().padStart(2, '0')}:` : '';
    const mStr = m.toString().padStart(2, '0');
    const sStr = s.toString().padStart(2, '0');

    return `${hStr}${mStr}:${sStr}`;
  };

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
        <StatusView error={error} onRetry={loadExam} />
      </View>
    );
  }

  if (!exam || !exam.questions || exam.questions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>لا توجد أسئلة متوفرة للاختبار.</Text>
      </View>
    );
  }

  const currentQuestion = exam.questions[activeIdx];
  const totalQuestions = exam.questions.length;
  const isTimeLow = timeLeft < 300; // < 5 mins

  // Helper check if a question is answered
  const isQuestionAnswered = (q) => {
    const ans = answers[q.id];
    if (q.question_type === 'true_false' || q.question_type === 'multiple_choice') {
      return ans !== null;
    }
    if (q.question_type === 'fill_blank') {
      return ans?.text?.trim() !== '';
    }
    if (q.question_type === 'matching') {
      // Considered answered if there is at least one pair mapped
      return ans?.pairs && ans.pairs.length > 0;
    }
    return false;
  };

  const totalAnswered = exam.questions.filter(isQuestionAnswered).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Timer Header */}
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => {
              Alert.alert(
                'مغادرة الاختبار',
                'هل أنت متأكد أنك تريد المغادرة؟ لن يتم حفظ إجاباتك الحالية ما لم تقم بتسليم الاختبار.',
                [
                  { text: 'إلغاء', style: 'cancel' },
                  { text: 'مغادرة', style: 'destructive', onPress: () => router.replace('/(tabs)/exams') }
                ]
              );
            }} 
            style={styles.closeBtn}
          >
            <ChevronRight size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.timerContainer, isTimeLow && { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: colors.error }]}>
          <Clock size={16} color={isTimeLow ? colors.error : colors.accent} style={{ marginLeft: 6 }} />
          <Text style={[styles.timerText, { color: isTimeLow ? colors.error : colors.text }]}>
            {formatTime(timeLeft)}
          </Text>
        </View>

        <View style={styles.headerLeft}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {activeIdx + 1} / {totalQuestions}
          </Text>
        </View>
      </View>

      {/* Questions Navigator Grid */}
      <View style={[styles.navGrid, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navGridContent}>
          {exam.questions.map((q, idx) => {
            const active = idx === activeIdx;
            const answered = isQuestionAnswered(q);
            
            let btnStyle = { borderColor: colors.border };
            let textStyle = { color: colors.textSecondary };
            
            if (active) {
              btnStyle = { borderColor: colors.accent, backgroundColor: colors.accentMuted };
              textStyle = { color: colors.accent, fontWeight: 'bold' };
            } else if (answered) {
              btnStyle = { borderColor: colors.success, backgroundColor: 'rgba(16,185,129,0.05)' };
              textStyle = { color: colors.success };
            }

            return (
              <TouchableOpacity
                key={q.id}
                onPress={() => setActiveIdx(idx)}
                style={[styles.gridCircle, btnStyle]}
              >
                <Text style={[styles.gridCircleText, textStyle]}>{idx + 1}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Question Panel */}
        <Card style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={[styles.questionMarks, { color: colors.textMuted }]}>
              {currentQuestion.marks} درجات
            </Text>
            <Text style={[styles.questionTitleText, { color: colors.textSecondary }]}>
              السؤال {activeIdx + 1}: {
                currentQuestion.question_type === 'true_false' ? 'صح / خطأ' :
                currentQuestion.question_type === 'multiple_choice' ? 'اختيار من متعدد' :
                currentQuestion.question_type === 'fill_blank' ? 'أكمل الفراغ' : 'مطابقة القائمتين'
              }
            </Text>
          </View>

          <Text style={[styles.questionText, { color: colors.text }]}>
            {currentQuestion.text}
          </Text>

          {/* Render input forms based on question type */}
          <View style={styles.answerContainer}>
            {currentQuestion.question_type === 'true_false' && (
              <View style={styles.trueFalseContainer}>
                <TouchableOpacity
                  onPress={() => handleTrueFalseSelect(currentQuestion.id, true)}
                  activeOpacity={0.7}
                  style={[
                    styles.tfBtn,
                    {
                      borderColor: answers[currentQuestion.id] === true ? colors.accent : colors.border,
                      backgroundColor: answers[currentQuestion.id] === true ? colors.accentMuted : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.tfText, { color: answers[currentQuestion.id] === true ? colors.accent : colors.text }]}>
                    صح
                  </Text>
                  <View style={[styles.radioCircle, { borderColor: answers[currentQuestion.id] === true ? colors.accent : colors.border, backgroundColor: answers[currentQuestion.id] === true ? colors.accent : 'transparent' }]} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleTrueFalseSelect(currentQuestion.id, false)}
                  activeOpacity={0.7}
                  style={[
                    styles.tfBtn,
                    {
                      borderColor: answers[currentQuestion.id] === false ? colors.accent : colors.border,
                      backgroundColor: answers[currentQuestion.id] === false ? colors.accentMuted : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.tfText, { color: answers[currentQuestion.id] === false ? colors.accent : colors.text }]}>
                    خطأ
                  </Text>
                  <View style={[styles.radioCircle, { borderColor: answers[currentQuestion.id] === false ? colors.accent : colors.border, backgroundColor: answers[currentQuestion.id] === false ? colors.accent : 'transparent' }]} />
                </TouchableOpacity>
              </View>
            )}

            {currentQuestion.question_type === 'multiple_choice' && (
              <View style={styles.mcqContainer}>
                {currentQuestion.options?.map((option) => {
                  const isSelected = answers[currentQuestion.id] === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => handleMCQSelect(currentQuestion.id, option.id)}
                      activeOpacity={0.7}
                      style={[
                        styles.mcqBtn,
                        {
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.accentMuted : 'transparent',
                        },
                      ]}
                    >
                      <Text style={[styles.mcqText, { color: isSelected ? colors.accent : colors.textSecondary }]}>
                        {option.text}
                      </Text>
                      <View style={[styles.radioCircle, { borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {currentQuestion.question_type === 'fill_blank' && (
              <View style={styles.fillBlankContainer}>
                <TextInput
                  value={answers[currentQuestion.id]?.text || ''}
                  onChangeText={(text) => handleFillBlankChange(currentQuestion.id, text)}
                  placeholder="اكتب الإجابة هنا..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  textAlign="right"
                />
              </View>
            )}

            {currentQuestion.question_type === 'matching' && (
              <View style={styles.matchingContainer}>
                <Text style={[styles.matchingHelpText, { color: colors.textMuted }]}>
                  انقر على كل عنصر في القائمة اليمنى لاختيار العنصر المطابق له من القائمة اليسرى:
                </Text>
                
                {currentQuestion.matching_left?.map((leftItem, index) => {
                  const currentPairs = answers[currentQuestion.id]?.pairs || [];
                  const matchedPair = currentPairs.find((p) => p.a === leftItem);
                  const selectedMatchVal = matchedPair ? matchedPair.b : null;

                  return (
                    <View key={index} style={[styles.matchingRow, { borderBottomColor: colors.border }]}>
                      {/* Left Side Match Selection Box */}
                      <TouchableOpacity
                        onPress={() => handleOpenMatchingPicker(currentQuestion.id, leftItem)}
                        style={[
                          styles.matchSelectBox,
                          {
                            borderColor: selectedMatchVal ? colors.accent : colors.border,
                            backgroundColor: selectedMatchVal ? colors.accentMuted : 'rgba(255,255,255,0.02)',
                          }
                        ]}
                      >
                        <Text style={[styles.matchSelectText, { color: selectedMatchVal ? colors.accent : colors.textMuted }]} numberOfLines={1}>
                          {selectedMatchVal || 'اختر التطابق...'}
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.matchingArrow}>↔</Text>

                      {/* Right side static label */}
                      <View style={styles.matchItemLabelBox}>
                        <Text style={[styles.matchItemLabelText, { color: colors.text }]}>
                          {leftItem}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </Card>
      </ScrollView>

      {/* Navigation Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.footerRow}>
          {/* Previous Button */}
          <Button
            title="السابق"
            disabled={activeIdx === 0}
            onPress={() => setActiveIdx((prev) => prev - 1)}
            variant="secondary"
            style={styles.navBtn}
            textStyle={{ color: colors.text }}
          />

          {/* Next / Submit Button */}
          {activeIdx === totalQuestions - 1 ? (
            <Button
              title="تسليم الاختبار"
              onPress={handleManualSubmitPress}
              style={[styles.navBtn, { backgroundColor: colors.success }]}
              textStyle={{ color: '#ffffff' }}
            />
          ) : (
            <Button
              title="التالي"
              onPress={() => setActiveIdx((prev) => prev + 1)}
              style={styles.navBtn}
            />
          )}
        </View>
      </View>

      {/* Confirmation Modal before Submit */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { borderColor: colors.border }]}>
            <AlertTriangle size={48} color={colors.warning} style={styles.modalIcon} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>تأكيد تسليم الاختبار</Text>
            
            <View style={styles.modalStats}>
              <Text style={[styles.modalStatText, { color: colors.textSecondary }]}>
                لقد أجبت على <Text style={{ color: colors.accent, fontWeight: 'bold' }}>{totalAnswered}</Text> من أصل <Text style={{ fontWeight: 'bold' }}>{totalQuestions}</Text> أسئلة.
              </Text>
              
              {totalAnswered < totalQuestions && (
                <Text style={[styles.modalWarningText, { color: colors.error }]}>
                  تنبيه: هناك أسئلة لم تقم بالإجابة عليها بعد!
                </Text>
              )}
            </View>

            <Text style={[styles.modalPrompt, { color: colors.textMuted }]}>
              هل أنت متأكد من رغبتك في تسليم ورقة الإجابة الآن؟ لا يمكن تعديل إجاباتك بعد التسليم.
            </Text>

            <View style={styles.modalBtns}>
              <Button
                title="تسليم الآن"
                onPress={() => submitAnswers(false)}
                loading={submitting}
                style={[styles.modalBtn, { backgroundColor: colors.success }]}
                textStyle={{ color: '#ffffff' }}
              />
              <Button
                title="تراجع"
                onPress={() => setShowConfirmModal(false)}
                variant="secondary"
                style={styles.modalBtn}
                textStyle={{ color: colors.text }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Picker Modal for Matching Questions */}
      {showMatchingPicker && (
        <Modal
          visible={showMatchingPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowMatchingPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <Card style={[styles.pickerModalCard, { borderColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>اختر العنصر المطابق لـ:</Text>
              <Text style={[styles.pickerSubtitle, { color: colors.accent }]} numberOfLines={1}>
                "{activeMatchingLeftItem}"
              </Text>

              <ScrollView style={styles.pickerOptionsList}>
                {/* Add Unselect/Clear match choice */}
                <TouchableOpacity
                  onPress={() => handleSelectMatch(null)}
                  style={[styles.pickerOptionBtn, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.pickerOptionText, { color: colors.error, textAlign: 'center', fontWeight: 'bold' }]}>
                    إلغاء التحديد (مسح المطابقة)
                  </Text>
                </TouchableOpacity>

                {exam.questions.find((q) => q.id === activeMatchingQuestionId)
                  ?.matching_right?.map((rightItem, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleSelectMatch(rightItem)}
                      style={[styles.pickerOptionBtn, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.pickerOptionText, { color: colors.text }]}>
                        {rightItem}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <Button
                title="إلغاء"
                onPress={() => {
                  setShowMatchingPicker(false);
                  setActiveMatchingQuestionId(null);
                  setActiveMatchingLeftItem(null);
                }}
                variant="secondary"
                style={styles.pickerCloseBtn}
                textStyle={{ color: colors.text }}
              />
            </Card>
          </View>
        </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1.5,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-start',
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-end',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  timerText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: 'bold',
  },
  progressText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: 'bold',
  },
  navGrid: {
    height: 52,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  navGridContent: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
    flexDirection: 'row-reverse', // RTL matching grid
  },
  gridCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCircleText: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 120, // offset for absolute footer
  },
  questionCard: {
    padding: SPACING.lg,
  },
  questionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
  },
  questionTitleText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: 'bold',
  },
  questionMarks: {
    fontSize: TYPOGRAPHY.size.xs,
  },
  questionText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.medium,
    lineHeight: 22,
    textAlign: 'right',
    marginBottom: SPACING.xl,
  },
  answerContainer: {
    marginTop: SPACING.md,
  },
  trueFalseContainer: {
    gap: SPACING.md,
  },
  tfBtn: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
  },
  tfText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: 'bold',
    marginRight: SPACING.md,
    flex: 1,
    textAlign: 'right',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  mcqContainer: {
    gap: SPACING.sm,
  },
  mcqBtn: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  mcqText: {
    fontSize: TYPOGRAPHY.size.sm,
    marginRight: SPACING.md,
    flex: 1,
    textAlign: 'right',
  },
  fillBlankContainer: {
    marginTop: SPACING.sm,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
  },
  matchingContainer: {
    marginTop: SPACING.sm,
  },
  matchingHelpText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'right',
    marginBottom: SPACING.md,
  },
  matchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1.5,
  },
  matchSelectBox: {
    width: '45%',
    height: 40,
    borderWidth: 1.5,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  matchSelectText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: 'bold',
  },
  matchingArrow: {
    fontSize: 18,
    color: '#6b7280',
  },
  matchItemLabelBox: {
    width: '45%',
    alignItems: 'flex-end',
  },
  matchItemLabelText: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1.5,
  },
  footerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  navBtn: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    padding: SPACING.xl,
    borderWidth: 1.5,
  },
  modalIcon: {
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    marginBottom: SPACING.md,
  },
  modalStats: {
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  modalStatText: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  modalWarningText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalPrompt: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  modalBtns: {
    flexDirection: 'row-reverse',
    gap: SPACING.md,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
  },
  pickerModalCard: {
    width: '100%',
    maxHeight: '60%',
    padding: SPACING.lg,
    borderWidth: 1.5,
  },
  pickerTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#9ca3af',
    textAlign: 'right',
  },
  pickerSubtitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pickerOptionsList: {
    marginBottom: SPACING.md,
  },
  pickerOptionBtn: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  pickerOptionText: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'right',
  },
  pickerCloseBtn: {
    width: '100%',
  },
});
