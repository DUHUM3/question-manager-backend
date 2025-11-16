const express = require('express');
const Test = require('../models/Test');
const Question = require('../models/Question');
const TestResult = require('../models/TestResult');
const User = require('../models/User');
const Class = require('../models/Class');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// 📊 داشبورد الإحصائيات العامة
router.get('/dashboard/stats', auth, adminAuth, async (req, res) => {
  try {
    const adminId = req.user.id;

    // الإحصائيات الأساسية
    const totalTests = await Test.countDocuments({ adminId });
    const totalQuestions = await Question.countDocuments({ adminId });
    const totalClasses = await Class.countDocuments({ adminId });
    const totalUsers = await User.countDocuments({ role: 'student' });

    // إحصائيات الاختبارات
    const activeTests = await Test.countDocuments({ 
      adminId, 
      isActive: true 
    });
    
    const publicTests = await Test.countDocuments({ 
      adminId, 
      isPublic: true 
    });

    // إحصائيات نتائج الاختبارات
    const testResults = await TestResult.find()
      .populate({
        path: 'testId',
        match: { adminId }
      })
      .exec();

    const filteredResults = testResults.filter(result => result.testId);

    const totalAttempts = filteredResults.length;
    const completedTests = filteredResults.filter(result => result.completed).length;
    
    // متوسط النتائج
    const averageScore = filteredResults.length > 0 
      ? filteredResults.reduce((sum, result) => sum + (result.score / result.maxScore * 100), 0) / filteredResults.length 
      : 0;

    // المدارس الأكثر تسجيلاً (بناءً على نتائج الاختبارات)
    const schoolStats = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      {
        $unwind: '$test'
      },
      {
        $match: {
          'test.adminId': adminId
        }
      },
      {
        $group: {
          _id: '$className',
          totalAttempts: { $sum: 1 },
          completedTests: { 
            $sum: { $cond: ['$completed', 1, 0] }
          },
          averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
          totalStudents: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          schoolName: '$_id',
          totalAttempts: 1,
          completedTests: 1,
          averageScore: { $round: ['$averageScore', 2] },
          totalStudents: { $size: '$totalStudents' }
        }
      },
      {
        $sort: { totalAttempts: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // الاختبارات الأكثر شعبية
    const popularTests = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      {
        $unwind: '$test'
      },
      {
        $match: {
          'test.adminId': adminId
        }
      },
      {
        $group: {
          _id: '$testId',
          testTitle: { $first: '$test.title' },
          totalAttempts: { $sum: 1 },
          completedAttempts: { 
            $sum: { $cond: ['$completed', 1, 0] }
          },
          averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
          uniqueStudents: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          testTitle: 1,
          totalAttempts: 1,
          completedAttempts: 1,
          averageScore: { $round: ['$averageScore', 2] },
          uniqueStudents: { $size: '$uniqueStudents' },
          completionRate: {
            $round: [
              { $multiply: [{ $divide: ['$completedAttempts', '$totalAttempts'] }, 100] },
              2
            ]
          }
        }
      },
      {
        $sort: { totalAttempts: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // توزيع المستخدمين حسب الأداء
    const performanceDistribution = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      {
        $unwind: '$test'
      },
      {
        $match: {
          'test.adminId': adminId,
          completed: true
        }
      },
      {
        $project: {
          percentage: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] }
        }
      },
      {
        $bucket: {
          groupBy: '$percentage',
          boundaries: [0, 50, 65, 75, 85, 95, 101],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            minScore: { $min: '$percentage' },
            maxScore: { $max: '$percentage' }
          }
        }
      }
    ]);

    // إحصائيات النشاط اليومي (آخر 7 أيام)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyActivity = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      {
        $unwind: '$test'
      },
      {
        $match: {
          'test.adminId': adminId,
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          attempts: { $sum: 1 },
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          date: '$_id',
          attempts: 1,
          completed: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalTests,
          totalQuestions,
          totalClasses,
          totalUsers,
          activeTests,
          publicTests,
          totalAttempts,
          completedTests,
          averageScore: Math.round(averageScore * 100) / 100,
          completionRate: totalAttempts > 0 ? Math.round((completedTests / totalAttempts) * 100) : 0
        },
        topSchools: schoolStats,
        popularTests,
        performanceDistribution,
        dailyActivity,
        charts: {
          // بيانات جاهزة للرسوم البيانية
          testStatus: {
            active: activeTests,
            inactive: totalTests - activeTests,
            public: publicTests,
            private: totalTests - publicTests
          },
          performance: performanceDistribution.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات الداشبورد',
      error: error.message
    });
  }
});

// 📈 تفاصيل اختبار معين
router.get('/tests/:testId/analytics', auth, adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const adminId = req.user.id;

    // التحقق من ملكية الاختبار
    const test = await Test.findOne({ _id: testId, adminId })
      .populate('classId', 'name');

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'الاختبار غير موجود أو ليس لديك صلاحية الوصول'
      });
    }

    // إحصائيات الاختبار
    const testResults = await TestResult.find({ testId })
      .populate('userId', 'name email');

    const totalAttempts = testResults.length;
    const completedAttempts = testResults.filter(result => result.completed).length;
    
    // تحليل النتائج
    const scoreAnalysis = testResults
      .filter(result => result.completed)
      .map(result => ({
        percentage: Math.round((result.score / result.maxScore) * 100),
        userId: result.userId._id,
        userName: result.userId.name,
        attempts: result.attempts,
        completedAt: result.updatedAt
      }));

    const averageScore = scoreAnalysis.length > 0
      ? scoreAnalysis.reduce((sum, item) => sum + item.percentage, 0) / scoreAnalysis.length
      : 0;

    // تحليل المستويات
    const levelAnalysis = test.levels.map(level => {
      const levelResults = testResults.filter(result => 
        result.currentLevel > level.levelNumber
      );
      
      return {
        levelNumber: level.levelNumber,
        levelTitle: level.levelTitle || `المستوى ${level.levelNumber}`,
        completedBy: levelResults.length,
        completionRate: totalAttempts > 0 ? Math.round((levelResults.length / totalAttempts) * 100) : 0
      };
    });

    // المستخدمون النشطون
    const activeUsers = testResults
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map(result => ({
        userId: result.userId._id,
        userName: result.userId.name,
        score: result.score,
        maxScore: result.maxScore,
        percentage: Math.round((result.score / result.maxScore) * 100),
        attempts: result.attempts,
        lastAttempt: result.updatedAt,
        completed: result.completed
      }));

    // توزيع الوقت المستغرق
    const timeAnalysis = testResults
      .filter(result => result.completed)
      .map(result => {
        const timeSpent = result.updatedAt - result.createdAt;
        const minutes = Math.floor(timeSpent / (1000 * 60));
        return minutes;
      });

    res.json({
      success: true,
      data: {
        testInfo: {
          id: test._id,
          title: test.title,
          description: test.description,
          className: test.classId?.name,
          totalLevels: test.totalLevels,
          isActive: test.isActive,
          isPublic: test.isPublic,
          createdAt: test.createdAt
        },
        statistics: {
          totalAttempts,
          completedAttempts,
          completionRate: Math.round((completedAttempts / totalAttempts) * 100),
          averageScore: Math.round(averageScore * 100) / 100,
          averageTime: timeAnalysis.length > 0 
            ? Math.round(timeAnalysis.reduce((a, b) => a + b, 0) / timeAnalysis.length)
            : 0,
          uniqueUsers: [...new Set(testResults.map(result => result.userId._id.toString()))].length
        },
        levelAnalysis,
        scoreDistribution: scoreAnalysis,
        topPerformers: activeUsers.filter(user => user.completed).sort((a, b) => b.percentage - a.percentage).slice(0, 5),
        recentActivity: activeUsers.slice(0, 5),
        timeAnalysis: {
          min: timeAnalysis.length > 0 ? Math.min(...timeAnalysis) : 0,
          max: timeAnalysis.length > 0 ? Math.max(...timeAnalysis) : 0,
          average: timeAnalysis.length > 0 ? Math.round(timeAnalysis.reduce((a, b) => a + b, 0) / timeAnalysis.length) : 0
        }
      }
    });

  } catch (error) {
    console.error('Test analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب تحليلات الاختبار',
      error: error.message
    });
  }
});

// 👥 إحصائيات المستخدمين
router.get('/users/analytics', auth, adminAuth, async (req, res) => {
  try {
    const adminId = req.user.id;

    // إحصائيات المستخدمين
    const users = await User.find({ role: 'student' })
      .select('name email createdAt lastLogin');

    const userStats = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      {
        $unwind: '$test'
      },
      {
        $match: {
          'test.adminId': adminId
        }
      },
      {
        $group: {
          _id: '$userId',
          totalTestsAttempted: { $addToSet: '$testId' },
          totalAttempts: { $sum: 1 },
          completedTests: { $sum: { $cond: ['$completed', 1, 0] } },
          totalScore: { $sum: '$score' },
          totalMaxScore: { $sum: '$maxScore' },
          averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
          lastActivity: { $max: '$updatedAt' },
          totalHintsUsed: { $sum: '$hintsUsed' }
        }
      },
      {
        $project: {
          userId: '$_id',
          totalTestsAttempted: { $size: '$totalTestsAttempted' },
          totalAttempts: 1,
          completedTests: 1,
          totalScore: 1,
          totalMaxScore: 1,
          averageScore: { $round: ['$averageScore', 2] },
          successRate: {
            $round: [
              { $multiply: [{ $divide: ['$completedTests', '$totalAttempts'] }, 100] },
              2
            ]
          },
          lastActivity: 1,
          totalHintsUsed: 1
        }
      }
    ]);

    // دمج بيانات المستخدمين مع الإحصائيات
    const usersWithStats = users.map(user => {
      const userStat = userStats.find(stat => stat.userId.toString() === user._id.toString());
      
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        joinedAt: user.createdAt,
        lastLogin: user.lastLogin,
        stats: userStat ? {
          totalTestsAttempted: userStat.totalTestsAttempted,
          totalAttempts: userStat.totalAttempts,
          completedTests: userStat.completedTests,
          averageScore: userStat.averageScore,
          successRate: userStat.successRate,
          totalHintsUsed: userStat.totalHintsUsed,
          lastActivity: userStat.lastActivity
        } : {
          totalTestsAttempted: 0,
          totalAttempts: 0,
          completedTests: 0,
          averageScore: 0,
          successRate: 0,
          totalHintsUsed: 0,
          lastActivity: null
        }
      };
    });

    // إحصائيات عامة عن المستخدمين
    const activeUsers = usersWithStats.filter(user => user.stats.totalAttempts > 0).length;
    const topPerformers = usersWithStats
      .filter(user => user.stats.completedTests >= 3)
      .sort((a, b) => b.stats.averageScore - a.stats.averageScore)
      .slice(0, 10);

    const recentUsers = usersWithStats
      .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        totalUsers: users.length,
        activeUsers,
        inactiveUsers: users.length - activeUsers,
        userEngagement: Math.round((activeUsers / users.length) * 100),
        users: usersWithStats,
        topPerformers,
        recentUsers,
        summary: {
          averageTestsPerUser: users.length > 0 ? Math.round(usersWithStats.reduce((sum, user) => sum + user.stats.totalTestsAttempted, 0) / users.length) : 0,
          averageScore: usersWithStats.length > 0 ? Math.round(usersWithStats.reduce((sum, user) => sum + user.stats.averageScore, 0) / usersWithStats.length) : 0,
          totalHintsUsed: usersWithStats.reduce((sum, user) => sum + user.stats.totalHintsUsed, 0)
        }
      }
    });

  } catch (error) {
    console.error('Users analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات المستخدمين',
      error: error.message
    });
  }
});

// 🏫 إحصائيات المدارس
router.get('/schools/analytics', auth, adminAuth, async (req, res) => {
  try {
    const adminId = req.user.id;

    const schoolStats = await TestResult.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      {
        $unwind: '$test'
      },
      {
        $match: {
          'test.adminId': adminId
        }
      },
      {
        $group: {
          _id: '$className',
          totalTests: { $addToSet: '$testId' },
          totalAttempts: { $sum: 1 },
          completedAttempts: { $sum: { $cond: ['$completed', 1, 0] } },
          totalStudents: { $addToSet: '$userId' },
          averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
          totalScore: { $sum: '$score' },
          totalMaxScore: { $sum: '$maxScore' },
          lastActivity: { $max: '$updatedAt' }
        }
      },
      {
        $project: {
          schoolName: '$_id',
          totalTests: { $size: '$totalTests' },
          totalAttempts: 1,
          completedAttempts: 1,
          completionRate: {
            $round: [
              { $multiply: [{ $divide: ['$completedAttempts', '$totalAttempts'] }, 100] },
              2
            ]
          },
          totalStudents: { $size: '$totalStudents' },
          averageScore: { $round: ['$averageScore', 2] },
          overallPerformance: {
            $round: [
              { $multiply: [{ $divide: ['$totalScore', '$totalMaxScore'] }, 100] },
              2
            ]
          },
          lastActivity: 1
        }
      },
      {
        $sort: { totalAttempts: -1 }
      }
    ]);

    // تفاصيل إضافية عن كل مدرسة
    const schoolsWithDetails = await Promise.all(
      schoolStats.map(async (school) => {
        const topStudents = await TestResult.aggregate([
          {
            $lookup: {
              from: 'tests',
              localField: 'testId',
              foreignField: '_id',
              as: 'test'
            }
          },
          {
            $unwind: '$test'
          },
          {
            $match: {
              'test.adminId': adminId,
              className: school.schoolName,
              completed: true
            }
          },
          {
            $group: {
              _id: '$userId',
              averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
              completedTests: { $sum: 1 }
            }
          },
          {
            $sort: { averageScore: -1 }
          },
          {
            $limit: 5
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          {
            $unwind: '$user'
          },
          {
            $project: {
              userId: '$_id',
              userName: '$user.name',
              averageScore: { $round: ['$averageScore', 2] },
              completedTests: 1
            }
          }
        ]);

        const popularTests = await TestResult.aggregate([
          {
            $lookup: {
              from: 'tests',
              localField: 'testId',
              foreignField: '_id',
              as: 'test'
            }
          },
          {
            $unwind: '$test'
          },
          {
            $match: {
              'test.adminId': adminId,
              className: school.schoolName
            }
          },
          {
            $group: {
              _id: '$testId',
              testTitle: { $first: '$test.title' },
              attempts: { $sum: 1 },
              averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } }
            }
          },
          {
            $project: {
              testTitle: 1,
              attempts: 1,
              averageScore: { $round: ['$averageScore', 2] }
            }
          },
          {
            $sort: { attempts: -1 }
          },
          {
            $limit: 5
          }
        ]);

        return {
          ...school,
          topStudents,
          popularTests
        };
      })
    );

    res.json({
      success: true,
      data: {
        schools: schoolsWithDetails,
        summary: {
          totalSchools: schoolsWithDetails.length,
          totalStudents: schoolsWithDetails.reduce((sum, school) => sum + school.totalStudents, 0),
          totalAttempts: schoolsWithDetails.reduce((sum, school) => sum + school.totalAttempts, 0),
          averageCompletionRate: schoolsWithDetails.length > 0 
            ? Math.round(schoolsWithDetails.reduce((sum, school) => sum + school.completionRate, 0) / schoolsWithDetails.length)
            : 0,
          averageScore: schoolsWithDetails.length > 0
            ? Math.round(schoolsWithDetails.reduce((sum, school) => sum + school.averageScore, 0) / schoolsWithDetails.length)
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Schools analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات المدارس',
      error: error.message
    });
  }
});

// 📊 تقرير شامل لجميع الإحصائيات
router.get('/full-report', auth, adminAuth, async (req, res) => {
  try {
    const adminId = req.user.id;
    
    // جلب جميع البيانات في وقت واحد
    const [
      tests,
      questions,
      classes,
      users,
      testResults
    ] = await Promise.all([
      Test.find({ adminId }),
      Question.find({ adminId }),
      Class.find({ adminId }),
      User.find({ role: 'student' }),
      TestResult.find().populate({
        path: 'testId',
        match: { adminId }
      })
    ]);

    const filteredResults = testResults.filter(result => result.testId);

    // تحليل البيانات
    const report = {
      generatedAt: new Date(),
      period: 'كل الوقت',
      overview: {
        tests: tests.length,
        questions: questions.length,
        classes: classes.length,
        users: users.length,
        attempts: filteredResults.length,
        completedAttempts: filteredResults.filter(r => r.completed).length
      },
      performance: {
        averageScore: filteredResults.length > 0
          ? Math.round(filteredResults.reduce((sum, r) => sum + (r.score / r.maxScore * 100), 0) / filteredResults.length * 100) / 100
          : 0,
        completionRate: filteredResults.length > 0
          ? Math.round((filteredResults.filter(r => r.completed).length / filteredResults.length) * 100)
          : 0
      },
      topPerformers: {
        tests: tests.slice(0, 5).map(test => ({
          title: test.title,
          attempts: filteredResults.filter(r => r.testId._id.toString() === test._id.toString()).length
        })),
        schools: await getTopSchools(adminId),
        students: await getTopStudents(adminId)
      },
      recommendations: generateRecommendations(tests, filteredResults, users)
    };

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Full report error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء التقرير',
      error: error.message
    });
  }
});

// دوال مساعدة
async function getTopSchools(adminId) {
  const schools = await TestResult.aggregate([
    {
      $lookup: {
        from: 'tests',
        localField: 'testId',
        foreignField: '_id',
        as: 'test'
      }
    },
    { $unwind: '$test' },
    { $match: { 'test.adminId': adminId } },
    {
      $group: {
        _id: '$className',
        attempts: { $sum: 1 },
        averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } }
      }
    },
    { $sort: { attempts: -1 } },
    { $limit: 5 }
  ]);
  
  return schools;
}

async function getTopStudents(adminId) {
  const students = await TestResult.aggregate([
    {
      $lookup: {
        from: 'tests',
        localField: 'testId',
        foreignField: '_id',
        as: 'test'
      }
    },
    { $unwind: '$test' },
    { $match: { 'test.adminId': adminId, completed: true } },
    {
      $group: {
        _id: '$userId',
        averageScore: { $avg: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } },
        completedTests: { $sum: 1 }
      }
    },
    { $sort: { averageScore: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        name: '$user.name',
        averageScore: { $round: ['$averageScore', 2] },
        completedTests: 1
      }
    }
  ]);
  
  return students;
}

function generateRecommendations(tests, results, users) {
  const recommendations = [];
  
  const activeTests = tests.filter(test => test.isActive);
  if (activeTests.length < tests.length * 0.5) {
    recommendations.push({
      type: 'warning',
      message: 'أقل من 50% من اختباراتك مفعلة. قم بتفعيل المزيد من الاختبارات لزيادة المشاركة.',
      action: 'تفعيل الاختبارات'
    });
  }

  const completionRate = results.length > 0 
    ? results.filter(r => r.completed).length / results.length 
    : 0;
  
  if (completionRate < 0.3) {
    recommendations.push({
      type: 'improvement',
      message: 'معدل إكمال الاختبارات منخفض. فكر في تبسيط المستويات أو زيادة الحوافز.',
      action: 'مراجعة صعوبة الاختبارات'
    });
  }

  const activeUsers = [...new Set(results.map(r => r.userId.toString()))].length;
  const userEngagement = activeUsers / users.length;
  
  if (userEngagement < 0.4) {
    recommendations.push({
      type: 'engagement',
      message: 'مشاركة المستخدمين منخفضة. فكر في إطلاق اختبارات جديدة أو تحفيزات.',
      action: 'زيادة التفاعل'
    });
  }

  return recommendations;
}

module.exports = router;