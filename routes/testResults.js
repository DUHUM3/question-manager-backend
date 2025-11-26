const express = require('express');
const router = express.Router(); // هذا هو الصحيح
const TestResult = require('../models/TestResult');
const { auth } = require('../middleware/auth'); // تأكد من الاستيراد الصحيح

// @route   POST /api/test-results
// @desc    حفظ نتيجة اختبار جديد
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      testId,
      testTitle,
      score,
      correctAnswers,
      totalQuestions,
      wrongAnswers,
      unansweredQuestions,
      duration,
      totalTimeSeconds,
      levelResults,
      timeAnalysis,
      strengthsAndWeaknesses,
      additionalStats,
      userAnswers,
      performanceLevel
    } = req.body;

    console.log('Received test result data:', {
      testId, testTitle, score, correctAnswers, totalQuestions
    });

    // التحقق من البيانات المطلوبة
    if (!testId || !testTitle || score === undefined || !totalQuestions) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير مكتملة'
      });
    }

    // إنشاء نتيجة جديدة
    const testResult = new TestResult({
      userId: req.user._id || req.user.id,
      testId,
      testTitle,
      score,
      correctAnswers: correctAnswers || 0,
      totalQuestions,
      wrongAnswers: wrongAnswers || 0,
      unansweredQuestions: unansweredQuestions || 0,
      duration: duration || '0:00',
      totalTimeSeconds: totalTimeSeconds || 0,
      levelResults: levelResults || [],
      timeAnalysis: timeAnalysis || {},
      strengthsAndWeaknesses: strengthsAndWeaknesses || { strengths: [], weaknesses: [] },
      additionalStats: additionalStats || {},
      userAnswers: userAnswers || [],
      performanceLevel: performanceLevel || 'مقبول'
    });

    const savedResult = await testResult.save();
    console.log('Test result saved successfully:', savedResult._id);

    res.status(201).json({
      success: true,
      message: 'تم حفظ النتيجة بنجاح',
      data: savedResult
    });
  } catch (error) {
    console.error('Error saving test result:', error);
    res.status(500).json({
      success: false,
      message:' تم حفظ النتيجة مسبقاء',
      error: error.message
    });
  }
});

// @route   GET /api/test-results/user
// @desc    الحصول على جميع نتائج المستخدم
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    const results = await TestResult.find({ userId: req.user._id || req.user.id })
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-userAnswers');

    const total = await TestResult.countDocuments({ userId: req.user._id || req.user.id });

    res.json({
      success: true,
      data: results,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalResults: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching user results:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب النتائج',
      error: error.message
    });
  }
});

// @route   GET /api/test-results/user/:testId
// @desc    الحصول على نتائج مستخدم لاختبار محدد
// @access  Private
router.get('/user/:testId', auth, async (req, res) => {
  try {
    const { testId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const results = await TestResult.find({ 
      userId: req.user._id || req.user.id, 
      testId 
    })
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TestResult.countDocuments({ 
      userId: req.user._id || req.user.id, 
      testId 
    });

    const bestResult = await TestResult.findOne({ 
      userId: req.user._id || req.user.id, 
      testId 
    }).sort('-score').select('score createdAt');

    res.json({
      success: true,
      data: results,
      bestScore: bestResult ? bestResult.score : 0,
      totalAttempts: total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalResults: total
      }
    });
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب نتائج الاختبار',
      error: error.message
    });
  }
});

// @route   GET /api/test-results/:id
// @desc    الحصول على نتيجة محددة بالتفاصيل الكاملة
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await TestResult.findOne({ 
      _id: req.params.id, 
      userId: req.user._id || req.user.id 
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'النتيجة غير موجودة'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching result details:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تفاصيل النتيجة',
      error: error.message
    });
  }
});

// @route   GET /api/test-results/user/stats/summary
// @desc    الحصول على ملخص إحصائيات المستخدم
// @access  Private
router.get('/user/stats/summary', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    // إحصائيات أساسية
    const stats = await TestResult.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalTests: { $sum: 1 },
          averageScore: { $avg: "$score" },
          bestScore: { $max: "$score" },
          totalCorrectAnswers: { $sum: "$correctAnswers" },
          totalQuestions: { $sum: "$totalQuestions" },
          totalTimeSpent: { $sum: "$totalTimeSeconds" }
        }
      }
    ]);

    // أفضل النتائج لكل اختبار
    const bestResults = await TestResult.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      { $sort: { score: -1, createdAt: -1 } },
      {
        $group: {
          _id: "$testId",
          bestScore: { $first: "$score" },
          testTitle: { $first: "$testTitle" },
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: "$score" },
          lastAttempt: { $first: "$createdAt" }
        }
      }
    ]);

    // النتائج الحديثة
    const recentResults = await TestResult.find({ userId })
      .sort('-createdAt')
      .limit(5)
      .select('testTitle score createdAt testId');

    const summary = {
      overallStats: stats[0] || {
        totalTests: 0,
        averageScore: 0,
        bestScore: 0,
        totalCorrectAnswers: 0,
        totalQuestions: 0,
        totalTimeSpent: 0
      },
      bestResults: bestResults,
      recentResults: recentResults,
      accuracy: stats[0] && stats[0].totalQuestions > 0 ? 
        Math.round((stats[0].totalCorrectAnswers / stats[0].totalQuestions) * 100) : 0
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات المستخدم',
      error: error.message
    });
  }
});

// @route   PUT /api/test-results/:id/certificate
// @desc    تحديث حالة إنشاء الشهادة
// @access  Private
router.put('/:id/certificate', auth, async (req, res) => {
  try {
    const result = await TestResult.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.user._id || req.user.id 
      },
      { 
        certificateGenerated: true 
      },
      { 
        new: true 
      }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'النتيجة غير موجودة'
      });
    }

    res.json({
      success: true,
      message: 'تم تحديث حالة الشهادة',
      data: result
    });
  } catch (error) {
    console.error('Error updating certificate status:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث حالة الشهادة',
      error: error.message
    });
  }
});

// @route   DELETE /api/test-results/:id
// @desc    حذف نتيجة محددة
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await TestResult.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id || req.user.id 
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'النتيجة غير موجودة'
      });
    }

    res.json({
      success: true,
      message: 'تم حذف النتيجة بنجاح'
    });
  } catch (error) {
    console.error('Error deleting test result:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف النتيجة',
      error: error.message
    });
  }
});

module.exports = router;