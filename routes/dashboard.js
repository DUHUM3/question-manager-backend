const express = require('express');
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');
const { Class } = require('../models/Class');
const TestResult = require('../models/TestResult');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// الحصول على إحصائيات النظام الكاملة (الإدارة فقط)
router.get('/admin/statistics', auth, adminAuth, async (req, res) => {
  try {
    // إحصائيات المستخدمين
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const recentUsers = await User.countDocuments({ 
      role: 'user',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // آخر 7 أيام
    });

    // إحصائيات الفصول
    const totalClasses = await Class.countDocuments({ adminId: req.user.id });
    const classesWithStats = await Class.aggregate([
      { $match: { adminId: req.user.id } },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: 'classId',
          as: 'students'
        }
      },
      {
        $project: {
          name: 1,
          studentCount: { $size: '$students' }
        }
      }
    ]);

    // إحصائيات الاختبارات
    const totalTests = await Test.countDocuments({ adminId: req.user.id });
    const activeTests = await Test.countDocuments({ 
      adminId: req.user.id, 
      isActive: true 
    });
    const publicTests = await Test.countDocuments({ 
      adminId: req.user.id, 
      isPublic: true 
    });

    // إحصائيات الأسئلة
    const totalQuestions = await Question.countDocuments();
    const questionsByLevel = await Question.aggregate([
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // إحصائيات نتائج الاختبارات
    const testResultsStats = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      { $unwind: '$test' },
      { $match: { 'test.adminId': req.user.id } },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: '$attempts' },
          totalCompleted: { $sum: { $cond: ['$completed', 1, 0] } },
          avgScore: { $avg: '$score' },
          avgMaxScore: { $avg: '$maxScore' },
          avgPercentage: { 
            $avg: { 
              $multiply: [
                { $divide: ['$score', '$maxScore'] },
                100
              ]
            }
          }
        }
      }
    ]);

    // الاختبارات الأكثر نشاطاً
    const popularTests = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      { $unwind: '$test' },
      { $match: { 'test.adminId': req.user.id } },
      {
        $group: {
          _id: '$testId',
          testTitle: { $first: '$test.title' },
          attemptCount: { $sum: 1 },
          completionCount: { $sum: { $cond: ['$completed', 1, 0] } },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { attemptCount: -1 } },
      { $limit: 5 }
    ]);

    // توزيع المستخدمين حسب المدينة
    const usersByCity = await User.aggregate([
      { $match: { role: 'user' } },
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // توزيع المستخدمين حسب الصف
    const usersByClass = await User.aggregate([
      { $match: { role: 'user' } },
      {
        $group: {
          _id: '$class',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // إحصائيات الأداء حسب الوقت
    const weeklyActivity = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      { $unwind: '$test' },
      { $match: { 'test.adminId': req.user.id } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            week: { $week: '$createdAt' }
          },
          attempts: { $sum: 1 },
          completions: { $sum: { $cond: ['$completed', 1, 0] } },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { '_id.year': -1, '_id.week': -1 } },
      { $limit: 8 }
    ]);

    // تجميع جميع الإحصائيات
    const statistics = {
      users: {
        total: totalUsers,
        admins: totalAdmins,
        recent: recentUsers,
        byCity: usersByCity,
        byClass: usersByClass
      },
      classes: {
        total: totalClasses,
        details: classesWithStats,
        totalStudents: classesWithStats.reduce((sum, cls) => sum + cls.studentCount, 0)
      },
      tests: {
        total: totalTests,
        active: activeTests,
        public: publicTests,
        popular: popularTests
      },
      questions: {
        total: totalQuestions,
        byLevel: questionsByLevel
      },
      performance: testResultsStats[0] ? {
        totalAttempts: testResultsStats[0].totalAttempts,
        totalCompleted: testResultsStats[0].totalCompleted,
        completionRate: Math.round((testResultsStats[0].totalCompleted / testResultsStats[0].totalAttempts) * 100) || 0,
        averageScore: Math.round(testResultsStats[0].avgScore * 100) / 100 || 0,
        averagePercentage: Math.round(testResultsStats[0].avgPercentage * 100) / 100 || 0
      } : {
        totalAttempts: 0,
        totalCompleted: 0,
        completionRate: 0,
        averageScore: 0,
        averagePercentage: 0
      },
      activity: {
        weekly: weeklyActivity
      },
      summary: {
        totalContent: totalTests + totalQuestions,
        engagementRate: totalUsers > 0 ? Math.round((testResultsStats[0]?.totalAttempts / totalUsers) * 100) / 100 : 0,
        successRate: testResultsStats[0] ? Math.round(testResultsStats[0].avgPercentage) : 0
      }
    };

    res.json({
      success: true,
      statistics,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في جلب إحصائيات النظام', 
      error: error.message 
    });
  }
});

// إحصائيات سريعة للوحة التحكم
router.get('/admin/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      totalClasses,
      totalTests,
      totalQuestions,
      activeTests,
      recentResults
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Class.countDocuments({ adminId: req.user.id }),
      Test.countDocuments({ adminId: req.user.id }),
      Question.countDocuments(),
      Test.countDocuments({ adminId: req.user.id, isActive: true }),
      TestResult.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    const recentTests = await Test.find({ adminId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title isActive isPublic createdAt')
      .populate('classId', 'name');

    const dashboardStats = {
      quickStats: {
        users: totalUsers,
        classes: totalClasses,
        tests: totalTests,
        questions: totalQuestions,
        activeTests: activeTests,
        recentActivity: recentResults
      },
      recentTests: recentTests,
      systemStatus: {
        users: totalUsers > 0 ? 'نشط' : 'غير نشط',
        tests: totalTests > 0 ? 'نشط' : 'غير نشط',
        classes: totalClasses > 0 ? 'نشط' : 'غير نشط',
        overall: (totalUsers > 0 && totalTests > 0) ? 'نشط' : 'محدود'
      }
    };

    res.json({
      success: true,
      dashboard: dashboardStats
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'خطأ في جلب إحصائيات اللوحة', 
      error: error.message 
    });
  }
});

module.exports = router;