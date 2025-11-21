const express = require('express');
const Test = require('../models/Test');
const Question = require('../models/Question');
const TestResult = require('../models/TestResult');
const { auth } = require('../middleware/auth');

const router = express.Router();

// مسار جديد: جلب الاختبارات المتاحة مع جميع الأسئلة والإجابات الصحيحة (بدون توكن)
router.get('/available-with-questions', async (req, res) => {
  try {
    console.log('=== START FETCHING TESTS WITH QUESTIONS ===');
    
    // الحصول على الاختبارات المفعلة والمفتوحة للجميع
    const tests = await Test.find({
      isActive: true,
      isPublic: true
    })
      .populate('classId', 'name')
      .select('title description totalLevels heartsPerAttempt hintsPerAttempt classId levels')
      .sort({ createdAt: -1 });

    console.log('Found tests:', tests.length);
    tests.forEach(test => {
      console.log(`Test: ${test._id}, Title: ${test.title}`);
    });

    // جلب جميع الأسئلة لكل اختبار
    const testsWithQuestions = await Promise.all(
      tests.map(async (test) => {
        console.log(`\n=== Processing Test: ${test._id} ===`);
        
        // جمع جميع أسئلة الاختبار من جميع المستويات
        const allQuestionIds = [];
        test.levels.forEach(level => {
          if (level.questions && level.questions.length > 0) {
            allQuestionIds.push(...level.questions);
          }
        });

        console.log('Question IDs for this test:', allQuestionIds);

        // جلب جميع الأسئلة مع الإجابات الصحيحة والصور
        const questions = await Question.find({
          _id: { $in: allQuestionIds }
        });

        console.log('Fetched questions details:');
        questions.forEach(q => {
          console.log(`Question: ${q._id}, Type: ${q.questionType}, OptionsImages: ${q.optionsImages ? q.optionsImages.length : 0}`);
          if (q.optionsImages && q.optionsImages.length > 0) {
            console.log('  Options Images paths:', q.optionsImages);
          }
        });

        // دالة لتحويل المسار إلى رابط URL كامل
        const getImageUrl = (imagePath) => {
          if (!imagePath) return null;
          // تحويل المسار إلى رابط URL
          const url = `${req.protocol}://${req.get('host')}/${imagePath.replace(/\\/g, '/')}`;
          console.log('Converted path to URL:', imagePath, '->', url);
          return url;
        };

        // تنظيم الأسئلة حسب المستويات
        const questionsByLevel = {};
        test.levels.forEach(level => {
          questionsByLevel[level.levelNumber] = questions.filter(
            q => q.level === level.levelNumber
          );
        });

        // إحصائيات الاختبار
        const totalQuestions = questions.length;
        const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

        // بناء النتيجة النهائية
        const result = {
          id: test._id,
          title: test.title,
          description: test.description,
          className: test.classId ? test.classId.name : 'عام',
          totalLevels: test.totalLevels,
          hearts: {
            total: test.heartsPerAttempt,
            remaining: test.heartsPerAttempt
          },
          hints: {
            total: test.hintsPerAttempt,
            remaining: test.hintsPerAttempt,
            used: 0
          },
          statistics: {
            totalQuestions: totalQuestions,
            totalPoints: totalPoints,
            averagePointsPerQuestion: Math.round((totalPoints / totalQuestions) * 100) / 100
          },
          levels: test.levels.map(level => ({
            levelNumber: level.levelNumber,
            levelTitle: level.levelTitle || `المستوى ${level.levelNumber}`,
            numberOfQuestions: level.numberOfQuestions,
            questions: questionsByLevel[level.levelNumber] ? questionsByLevel[level.levelNumber].map(q => ({
              id: q._id,
              questionText: q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              points: q.points || 1,
              questionType: q.questionType || 'multiple-choice',
              difficulty: q.difficulty || 'medium',
              level: q.level,
              questionImage: q.questionImage ? getImageUrl(q.questionImage) : null,
              optionsImages: q.optionsImages && q.optionsImages.length > 0 ? 
                q.optionsImages.map(img => getImageUrl(img)) : []
            })) : []
          })),
          allQuestions: questions.map(q => ({
            id: q._id,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            points: q.points || 1,
            questionType: q.questionType || 'multiple-choice',
            difficulty: q.difficulty || 'medium',
            level: q.level,
            questionImage: q.questionImage ? getImageUrl(q.questionImage) : null,
            optionsImages: q.optionsImages && q.optionsImages.length > 0 ? 
              q.optionsImages.map(img => getImageUrl(img)) : []
          })),
          status: 'متاح',
          progress: null
        };

        console.log('Final questions with images:');
        result.allQuestions.forEach(q => {
          if (q.optionsImages && q.optionsImages.length > 0) {
            console.log(`Question ${q.id} has optionsImages:`, q.optionsImages);
          }
        });

        return result;
      })
    );

    console.log('=== FINAL RESPONSE ===');
    res.json({
      success: true,
      tests: testsWithQuestions,
      count: testsWithQuestions.length,
      totalQuestions: testsWithQuestions.reduce((sum, test) => sum + test.statistics.totalQuestions, 0),
      message: 'تم جلب الاختبارات مع الأسئلة والصور بنجاح'
    });

  } catch (error) {
    console.error('Error fetching tests with questions:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});




// الحصول على قائمة الاختبارات المتاحة (للجميع بدون توكن)
router.get('/available', async (req, res) => {
  try {
    // الحصول على الاختبارات المفعلة والمفتوحة للجميع
    const tests = await Test.find({
      isActive: true,
      isPublic: true // فقط الاختبارات المفتوحة للجميع
    })
      .populate('classId', 'name')
      .select('title description totalLevels heartsPerAttempt hintsPerAttempt classId')
      .sort({ createdAt: -1 });

    // إذا كان هناك توكن، نجلب نتائج الطالب
    let testResults = [];
    let userHeartsData = {};

    if (req.headers.authorization) {
      try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
          const User = require('../models/User');
          const user = await User.findById(decoded.userId);

          if (user) {
            testResults = await TestResult.find({
              userId: user._id,
              testId: { $in: tests.map(test => test._id) }
            });

            // إنشاء بيانات القلوب لكل اختبار
            testResults.forEach(result => {
              userHeartsData[result.testId.toString()] = {
                remainingHearts: result.remainingHearts,
                remainingHints: result.remainingHints
              };
            });
          }
        }
      } catch (error) {
        // تجاهل خطأ التوكن، نستمر بدون نتائج المستخدم
      }
    }

    // دمج المعلومات
    const testsWithStatus = tests.map(test => {
      const result = testResults.find(
        result => result.testId.toString() === test._id.toString()
      );

      const userHearts = userHeartsData[test._id.toString()];

      return {
        id: test._id,
        title: test.title,
        description: test.description,
        className: test.classId ? test.classId.name : 'عام',
        totalLevels: test.totalLevels,
        // معلومات القلوب والتلميحات
        hearts: {
          total: test.heartsPerAttempt,
          remaining: userHearts ? userHearts.remainingHearts : test.heartsPerAttempt
        },
        hints: {
          total: test.hintsPerAttempt,
          remaining: userHearts ? userHearts.remainingHints : test.hintsPerAttempt,
          used: result ? result.hintsUsed : 0
        },
        status: result ? (result.completed ? 'مكتمل' : 'قيد التقدم') : 'جديد',
        progress: result ? {
          currentLevel: result.currentLevel,
          score: result.score,
          maxScore: result.maxScore,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
          attempts: result.attempts,
          lastAttemptDate: result.lastAttemptDate
        } : null
      };
    });

    res.json({
      tests: testsWithStatus,
      count: testsWithStatus.length
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// بدء أو استئناف اختبار (يتطلب توكن)
router.post('/start/:testId', auth, async (req, res) => {
  try {
    const { testId } = req.params;

    // الحصول على الاختبار
    const test = await Test.findOne({
      _id: testId,
      isActive: true,
      isPublic: true // التأكد من أن الاختبار مفتوح للجميع
    });

    if (!test) {
      return res.status(404).json({ message: 'الاختبار غير موجود أو غير مفعل' });
    }

    // البحث عن نتيجة اختبار سابقة أو إنشاء واحدة جديدة
    let testResult = await TestResult.findOne({
      userId: req.user.id,
      testId: test._id
    });

    if (!testResult) {
      // حساب إجمالي عدد الأسئلة والنقاط المحتملة
      let totalQuestions = 0;
      let maxScore = 0;

      for (const level of test.levels) {
        totalQuestions += level.numberOfQuestions;

        // جمع نقاط كل سؤال إذا كانت متوفرة
        if (level.questions && level.questions.length > 0) {
          const questions = await Question.find({
            _id: { $in: level.questions }
          });

          maxScore += questions.reduce((sum, q) => sum + (q.points || 1), 0);
        } else {
          // إذا لم تكن الأسئلة متوفرة، نفترض أن كل سؤال بنقطة واحدة
          maxScore += level.numberOfQuestions;
        }
      }

      // إنشاء نتيجة جديدة
      testResult = new TestResult({
        userId: req.user.id,
        testId: test._id,
        totalQuestions,
        maxScore,
        className: test.classId ? test.classId.name : 'عام' // حفظ اسم الفصل
      });

      await testResult.save();
    }

    // الحصول على مستوى الطالب الحالي
    const currentLevel = test.levels.find(
      level => level.levelNumber === testResult.currentLevel
    );

    if (!currentLevel) {
      return res.status(404).json({ message: 'مستوى الاختبار غير موجود' });
    }

    // الحصول على أسئلة المستوى الحالي
    const questions = await Question.find({
      _id: { $in: currentLevel.questions }
    }).select('questionText options _id');

    // إخفاء الإجابة الصحيحة
    const questionsForStudent = questions.map(q => ({
      id: q._id,
      questionText: q.questionText,
      options: q.options
    }));

    res.json({
      message: 'تم بدء الاختبار بنجاح',
      testInfo: {
        id: test._id,
        title: test.title,
        currentLevel: testResult.currentLevel,
        totalLevels: test.totalLevels,
        heartsPerAttempt: test.heartsPerAttempt,
        hintsPerAttempt: test.hintsPerAttempt,
        hintsUsed: testResult.hintsUsed,
        questions: questionsForStudent
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// استخدام تلميح لحذف خيارين خاطئين
router.post('/hint/:testId/:questionId', auth, async (req, res) => {
  try {
    const { testId, questionId } = req.params;

    // الحصول على الاختبار
    const test = await Test.findOne({ _id: testId, isActive: true });

    if (!test) {
      return res.status(404).json({ message: 'الاختبار غير موجود أو غير مفعل' });
    }

    // الحصول على نتيجة الاختبار الحالية للطالب
    const testResult = await TestResult.findOne({
      userId: req.user.id,
      testId: test._id
    });

    if (!testResult) {
      return res.status(404).json({ message: 'يجب بدء الاختبار أولاً' });
    }

    // التحقق من عدد التلميحات المتاحة
    if (testResult.hintsUsed >= test.hintsPerAttempt) {
      return res.status(400).json({ message: 'لقد استنفدت جميع التلميحات المتاحة' });
    }

    // الحصول على السؤال
    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    // التحقق من أن السؤال ينتمي للاختبار وللمستوى الحالي
    if (question.testId.toString() !== testId ||
      question.level !== testResult.currentLevel) {
      return res.status(403).json({ message: 'ليس لديك صلاحية الوصول لهذا السؤال' });
    }

    // الحصول على الإجابة الصحيحة والخيارات الخاطئة
    const correctAnswer = question.correctAnswer;
    const incorrectOptions = question.options.filter(option => option !== correctAnswer);

    // اختيار خيارين خاطئين لإزالتهما بشكل عشوائي
    const shuffledIncorrectOptions = incorrectOptions.sort(() => 0.5 - Math.random());
    const optionsToRemove = shuffledIncorrectOptions.slice(0, 2);

    // تحديث عدد التلميحات المستخدمة
    testResult.hintsUsed += 1;
    await testResult.save();

    res.json({
      message: 'تم استخدام التلميح بنجاح',
      optionsToRemove,
      remainingHints: test.hintsPerAttempt - testResult.hintsUsed
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تقديم إجابة لسؤال
router.post('/answer/:testId/:questionId', auth, async (req, res) => {
  try {
    const { testId, questionId } = req.params;
    const { answer } = req.body;

    if (!answer) {
      return res.status(400).json({ message: 'الإجابة مطلوبة' });
    }

    // الحصول على الاختبار
    const test = await Test.findOne({ _id: testId, isActive: true });

    if (!test) {
      return res.status(404).json({ message: 'الاختبار غير موجود أو غير مفعل' });
    }

    // الحصول على نتيجة الاختبار الحالية للطالب
    const testResult = await TestResult.findOne({
      userId: req.user.id,
      testId: test._id
    });

    if (!testResult) {
      return res.status(404).json({ message: 'يجب بدء الاختبار أولاً' });
    }

    // الحصول على السؤال
    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    // التحقق من أن السؤال ينتمي للاختبار وللمستوى الحالي
    if (question.testId.toString() !== testId ||
      question.level !== testResult.currentLevel) {
      return res.status(403).json({ message: 'ليس لديك صلاحية الوصول لهذا السؤال' });
    }

    // التحقق من صحة الإجابة
    const isCorrect = answer === question.correctAnswer;

    // نموذج للاستجابة
    const response = {
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation
    };

    // تحديث النتيجة فقط إذا كانت الإجابة صحيحة
    if (isCorrect) {
      testResult.score += question.points || 1;
      testResult.correctAnswers += 1;

      // التحقق مما إذا كان هذا هو آخر سؤال في المستوى
      const currentLevel = test.levels.find(
        level => level.levelNumber === testResult.currentLevel
      );

      if (testResult.correctAnswers >= currentLevel.numberOfQuestions) {
        // انتقل للمستوى التالي
        if (testResult.currentLevel < test.totalLevels) {
          testResult.currentLevel += 1;
          testResult.correctAnswers = 0; // إعادة ضبط عداد الإجابات الصحيحة للمستوى الجديد
        } else {
          // إكمال الاختبار
          testResult.completed = true;
        }
      }

      await testResult.save();

      // تحديث استجابة إضافية للمستوى/الاختبار المكتمل
      if (testResult.completed) {
        response.message = 'تهانينا! لقد أكملت الاختبار بنجاح';
        response.testCompleted = true;
        response.finalScore = {
          score: testResult.score,
          maxScore: testResult.maxScore,
          percentage: Math.round((testResult.score / testResult.maxScore) * 100)
        };
      } else if (testResult.currentLevel > currentLevel.levelNumber) {
        response.message = `تهانينا! لقد أكملت المستوى ${currentLevel.levelNumber}`;
        response.levelCompleted = true;
        response.nextLevel = testResult.currentLevel;
      }
    } else {
      // إذا كانت الإجابة خاطئة، قم بخصم قلب
      const hearts = req.session.hearts || test.heartsPerAttempt;
      const remainingHearts = hearts - 1;

      // تخزين القلوب المتبقية في الجلسة
      req.session.hearts = remainingHearts;

      response.heartsRemaining = remainingHearts;

      if (remainingHearts <= 0) {
        response.message = 'انتهت المحاولة! لقد نفذت قلوبك';
        response.attemptFailed = true;

        // إعادة ضبط الجلسة لمحاولة جديدة
        req.session.hearts = test.heartsPerAttempt;

        // تحديث عدد المحاولات في قاعدة البيانات
        testResult.attempts += 1;
        testResult.lastAttemptDate = new Date();
        await testResult.save();
      }
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على نتائج اختباراتي
router.get('/results', auth, async (req, res) => {
  try {
    const results = await TestResult.find({ userId: req.user.id })
      .populate({
        path: 'testId',
        select: 'title totalLevels',
        populate: {
          path: 'classId',
          select: 'name'
        }
      })
      .sort({ updatedAt: -1 });

    const formattedResults = results.map(result => ({
      id: result._id,
      testTitle: result.testId.title,
      className: result.testId.classId.name,
      completed: result.completed,
      score: result.score,
      maxScore: result.maxScore,
      percentage: Math.round((result.score / result.maxScore) * 100),
      currentLevel: result.currentLevel,
      totalLevels: result.testId.totalLevels,
      attempts: result.attempts,
      lastAttemptDate: result.lastAttemptDate
    }));

    res.json({
      results: formattedResults,
      count: formattedResults.length
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على نتائج تفصيلية لاختبار معين بعد الانتهاء
// الحصول على نتائج تفصيلية لاختبار معين بعد الانتهاء
router.get('/results/:testId/detailed', auth, async (req, res) => {
  try {
    const { testId } = req.params;

    // الحصول على نتيجة الاختبار للطالب
    const testResult = await TestResult.findOne({
      userId: req.user.id,
      testId: testId
    }).populate({
      path: 'testId',
      select: 'title totalLevels heartsPerAttempt hintsPerAttempt',
      populate: {
        path: 'classId',
        select: 'name'
      }
    });

    if (!testResult) {
      return res.status(404).json({ message: 'لم يتم العثور على نتائج لهذا الاختبار' });
    }

    // الحصول على الاختبار الكامل مع الأسئلة
    const test = await Test.findById(testId)
      .populate({
        path: 'levels.questions',
        select: 'questionText options correctAnswer explanation points level'
      });

    if (!test) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    // جمع جميع الأسئلة من جميع المستويات
    const allQuestions = [];
    test.levels.forEach(level => {
      if (level.questions && level.questions.length > 0) {
        level.questions.forEach(question => {
          allQuestions.push({
            ...question.toObject(),
            levelNumber: level.levelNumber
          });
        });
      }
    });

    // إحصائيات عامة عن الاختبار
    const statistics = {
      totalQuestions: testResult.totalQuestions,
      correctAnswers: testResult.correctAnswers,
      wrongAnswers: testResult.totalQuestions - testResult.correctAnswers,
      score: testResult.score,
      maxScore: testResult.maxScore,
      percentage: Math.round((testResult.score / testResult.maxScore) * 100),
      attempts: testResult.attempts,
      hintsUsed: testResult.hintsUsed,
      completionTime: testResult.updatedAt - testResult.createdAt,
      completedAt: testResult.updatedAt
    };

    // تحليل الأداء حسب المستويات
    const levelPerformance = test.levels.map(level => {
      const levelQuestions = allQuestions.filter(q => q.levelNumber === level.levelNumber);
      const levelMaxScore = levelQuestions.reduce((sum, q) => sum + (q.points || 1), 0);

      return {
        levelNumber: level.levelNumber,
        totalQuestions: level.numberOfQuestions,
        maxScore: levelMaxScore,
        completed: testResult.currentLevel > level.levelNumber || testResult.completed
      };
    });

    // تقييم الأداء
    let performanceRating = '';
    let performanceColor = '';

    if (statistics.percentage >= 90) {
      performanceRating = 'ممتاز';
      performanceColor = 'success';
    } else if (statistics.percentage >= 75) {
      performanceRating = 'جيد جداً';
      performanceColor = 'primary';
    } else if (statistics.percentage >= 60) {
      performanceRating = 'جيد';
      performanceColor = 'warning';
    } else {
      performanceRating = 'بحاجة للتحسين';
      performanceColor = 'danger';
    }

    // إحصائيات مقارنة
    const comparisonStats = {
      averageScore: Math.round(testResult.maxScore * 0.7),
      topScore: testResult.maxScore,
      userRank: '1',
      totalParticipants: 1
    };

    res.json({
      testInfo: {
        id: test._id,
        title: test.title,
        className: test.classId?.name || 'عام',
        totalLevels: test.totalLevels,
        heartsPerAttempt: test.heartsPerAttempt,
        hintsPerAttempt: test.hintsPerAttempt
      },
      userResult: {
        completed: testResult.completed,
        currentLevel: testResult.currentLevel,
        finalScore: statistics,
        performance: {
          rating: performanceRating,
          color: performanceColor,
          message: getPerformanceMessage(performanceRating, statistics.percentage) // استدعاء مباشر للدالة
        }
      },
      detailedStatistics: statistics,
      levelPerformance: levelPerformance,
      comparison: comparisonStats,
      questionsOverview: {
        total: statistics.totalQuestions,
        correct: statistics.correctAnswers,
        wrong: statistics.wrongAnswers,
        accuracy: Math.round((statistics.correctAnswers / statistics.totalQuestions) * 100)
      },
      recommendations: generateRecommendations(statistics, levelPerformance), // استدعاء مباشر للدالة
      certificate: testResult.completed && statistics.percentage >= 60 ? {
        eligible: true,
        certificateId: `CERT-${testId.slice(-8)}-${req.user.id.slice(-8)}`,
        issueDate: new Date().toISOString().split('T')[0]
      } : {
        eligible: false,
        message: 'تحتاج إلى تحقيق 60% على الأقل للحصول على الشهادة'
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تعريف الدوال المساعدة بشكل صحيح
function getPerformanceMessage(rating, percentage) {
  const messages = {
    'ممتاز': `أداء رائع! لقد حققت ${percentage}% - استمر في هذا التميز!`,
    'جيد جداً': `أداء ممتاز! ${percentage}% نتيجة مشرفة، يمكنك التحسين أكثر.`,
    'جيد': `أداء جيد! ${percentage}% حاول مراجعة الأخطاء للتحسين.`,
    'بحاجة للتحسين': `حاول مرة أخرى! ${percentage}% راجع الدروس وحاول تحسين نتيجتك.`
  };
  return messages[rating] || `نتيجتك: ${percentage}%`;
}

function generateRecommendations(statistics, levelPerformance) {
  const recommendations = [];

  if (statistics.percentage < 60) {
    recommendations.push({
      type: 'critical',
      message: 'نوصي بإعادة دراسة المواد الأساسية ومحاولة الاختبار مرة أخرى',
      action: 'إعادة الاختبار'
    });
  }

  if (statistics.hintsUsed > 0) {
    recommendations.push({
      type: 'improvement',
      message: `استخدمت ${statistics.hintsUsed} تلميحاً، حاول الاعتماد على فهمك الخاص أكثر`,
      action: 'تدريب على حل الأسئلة بدون مساعدات'
    });
  }

  if (statistics.attempts > 1) {
    recommendations.push({
      type: 'persistence',
      message: `محاولاتك المتعددة (${statistics.attempts}) تظهر مثابرتك، استمر!`,
      action: 'مراجعة الأخطاء السابقة'
    });
  }

  // تحليل المستويات التي تحتاج تحسين
  const weakLevels = levelPerformance.filter(level => !level.completed);
  if (weakLevels.length > 0) {
    recommendations.push({
      type: 'focus',
      message: `ركز على تحسين المستويات: ${weakLevels.map(l => l.levelNumber).join(', ')}`,
      action: 'مراجعة المستويات الضعيفة'
    });
  }

  return recommendations;
}

function getGrade(percentage) {
  if (percentage >= 95) return 'امتياز';
  if (percentage >= 85) return 'ممتاز';
  if (percentage >= 75) return 'جيد جداً';
  if (percentage >= 65) return 'جيد';
  return 'مقبول';
}

function getRankMessage(rank, total) {
  if (rank === 1) return '🎉 أنت الأول! أداء متميز!';
  if (rank <= 3) return `🥈 أنت في المركز ${rank} من ${total}! أداء رائع!`;
  if (rank <= 10) return `🎯 أنت في المركز ${rank} من ${total}! أداء جيد جداً!`;
  return `📊 أنت في المركز ${rank} من ${total}. استمر في التحسين!`;
};
module.exports = router;