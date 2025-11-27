const express = require('express');
const TestResult = require('../models/TestResult');
const Test = require('../models/Test');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// الحصول على نتائج اختبار معين
router.get('/test/:testId', auth, adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    
    // التحقق من ملكية الاختبار
    const test = await Test.findOne({ _id: testId, adminId: req.user.id });
    
    if (!test) {
      return res.status(404).json({ 
        message: 'الاختبار غير موجود أو ليس لديك صلاحية الوصول' 
      });
    }
    
    // الحصول على نتائج الاختبار
    const results = await TestResult.find({ testId })
      .populate('userId', 'name email')
      .sort({ score: -1 });
    
    // تنسيق النتائج
    const formattedResults = results.map(result => ({
      id: result._id,
      student: {
        id: result.userId._id,
        name: result.userId.name,
        email: result.userId.email
      },
      completed: result.completed,
      score: result.score,
      maxScore: result.maxScore,
      percentage: Math.round((result.score / result.maxScore) * 100),
      currentLevel: result.currentLevel,
      attempts: result.attempts,
      hintsUsed: result.hintsUsed,
      lastAttemptDate: result.lastAttemptDate,
      createdAt: result.createdAt
    }));
    
    // إحصائيات عامة
    const statistics = {
      totalStudents: results.length,
      completedCount: results.filter(r => r.completed).length,
      averageScore: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) 
        : 0,
      averagePercentage: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + (r.score / r.maxScore) * 100, 0) / results.length) 
        : 0,
      averageAttempts: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.attempts, 0) / results.length * 10) / 10
        : 0,
      highestScore: results.length > 0 
        ? Math.max(...results.map(r => r.score)) 
        : 0,
      lowestScore: results.length > 0 
        ? Math.min(...results.map(r => r.score)) 
        : 0
    };
    
    res.json({
      testInfo: {
        id: test._id,
        title: test.title,
        levels: test.totalLevels,
        heartsPerAttempt: test.heartsPerAttempt,
        hintsPerAttempt: test.hintsPerAttempt
      },
      statistics,
      results: formattedResults
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على نتائج طالب معين في جميع اختبارات المدرس
router.get('/student/:studentId', auth, adminAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // التحقق من وجود الطالب
    const student = await User.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ message: 'الطالب غير موجود' });
    }
    
    // الحصول على اختبارات المدرس
    const adminTests = await Test.find({ adminId: req.user.id });
    
    if (adminTests.length === 0) {
      return res.json({
        student: {
          id: student._id,
          name: student.name,
          email: student.email
        },
        results: [],
        message: 'لا توجد اختبارات لهذا المدرس بعد'
      });
    }
    
    // الحصول على نتائج الطالب في اختبارات المدرس
    const results = await TestResult.find({
      userId: studentId,
      testId: { $in: adminTests.map(test => test._id) }
    }).populate('testId', 'title totalLevels heartsPerAttempt hintsPerAttempt');
    
    // تنسيق النتائج
    const formattedResults = results.map(result => ({
      id: result._id,
      test: {
        id: result.testId._id,
        title: result.testId.title,
        totalLevels: result.testId.totalLevels
      },
      completed: result.completed,
      score: result.score,
      maxScore: result.maxScore,
      percentage: Math.round((result.score / result.maxScore) * 100),
      currentLevel: result.currentLevel,
      attempts: result.attempts,
      hintsUsed: result.hintsUsed,
      lastAttemptDate: result.lastAttemptDate
    }));
    
    // إحصائيات عامة
    const statistics = {
      totalTests: results.length,
      completedTests: results.filter(r => r.completed).length,
      averageScore: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + (r.score / r.maxScore) * 100, 0) / results.length) 
        : 0,
      totalAttempts: results.reduce((sum, r) => sum + r.attempts, 0)
    };
    
    res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email
      },
      statistics,
      results: formattedResults
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على إحصائيات عامة لجميع الاختبارات
router.get('/statistics', auth, adminAuth, async (req, res) => {
  try {
    // الحصول على اختبارات المدرس
    const tests = await Test.find({ adminId: req.user.id });
    
    if (tests.length === 0) {
      return res.json({
        testsCount: 0,
        message: 'لا توجد اختبارات لهذا المدرس بعد'
      });
    }
    
    // الحصول على نتائج جميع الاختبارات
    const results = await TestResult.find({
      testId: { $in: tests.map(test => test._id) }
    }).populate('testId', 'title');
    
    // عدد الطلاب الفريدين
    const uniqueStudents = [...new Set(results.map(r => r.userId.toString()))];
    
    // تجميع الإحصائيات حسب الاختبار
    const testStats = tests.map(test => {
      const testResults = results.filter(r => r.testId._id.toString() === test._id.toString());
      const completedCount = testResults.filter(r => r.completed).length;
      const averageScore = testResults.length > 0 
        ? Math.round(testResults.reduce((sum, r) => sum + (r.score / r.maxScore) * 100, 0) / testResults.length) 
        : 0;
      
      return {
        id: test._id,
        title: test.title,
        studentsCount: testResults.length,
        completedCount,
        completionRate: testResults.length > 0 
          ? Math.round((completedCount / testResults.length) * 100) 
          : 0,
        averageScore
      };
    });
    
    // الإحصائيات العامة
    const generalStats = {
      totalTests: tests.length,
      activeTests: tests.filter(t => t.isActive).length,
      uniqueStudents: uniqueStudents.length,
      totalAttempts: results.reduce((sum, r) => sum + r.attempts, 0),
      averageScore: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + (r.score / r.maxScore) * 100, 0) / results.length) 
        : 0,
      completedTests: results.filter(r => r.completed).length,
      completionRate: results.length > 0 
        ? Math.round((results.filter(r => r.completed).length / results.length) * 100) 
        : 0
    };
    
    res.json({
      generalStats,
      testStats
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

module.exports = router;    