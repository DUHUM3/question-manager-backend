const express = require('express');
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');
const { Class } = require('../models/Class');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// الحصول على إحصائيات النظام الأساسية (الإدارة فقط)
router.get('/admin/statistics', auth, adminAuth, async (req, res) => {
  try {
    // إحصائيات الاختبارات مع بيانات الصف
    const totalTests = await Test.countDocuments({ adminId: req.user.id });
    const publicTests = await Test.countDocuments({ 
      adminId: req.user.id, 
      isPublic: true 
    });
    const privateTests = totalTests - publicTests;

    // الحصول على تفاصيل الاختبارات مع بيانات الصف
    const testsDetails = await Test.find(
      { adminId: req.user.id }
    ).populate('classId', 'name');

    // تجميع بيانات المستويات مع اسم الاختبار والصف
    const levelsData = testsDetails.flatMap(test => {
      // إذا كان الاختبار يحتوي على مستويات متعددة
      if (test.levels && test.levels.length > 0) {
        return test.levels.map(level => ({
          testTitle: test.title,
          className: test.classId ? test.classId.name : 'غير محدد',
          levelNumber: level.levelNumber,
          heartsPerAttempt: test.heartsPerAttempt,
          hintsPerAttempt: test.hintsPerAttempt,
          isPublic: test.isPublic,
          numberOfQuestions: level.numberOfQuestions,
          questionsCount: level.questions ? level.questions.length : 0
        }));
      } else {
        // إذا كان الاختبار بدون مستويات محددة
        return [{
          testTitle: test.title,
          className: test.classId ? test.classId.name : 'غير محدد',
          levelNumber: 1,
          heartsPerAttempt: test.heartsPerAttempt,
          hintsPerAttempt: test.hintsPerAttempt,
          isPublic: test.isPublic,
          numberOfQuestions: 0,
          questionsCount: 0
        }];
      }
    });

    // إحصائيات الفصول
    const classesDetails = await Class.find(
      { adminId: req.user.id },
      'name description students'
    );

    const formattedClasses = classesDetails.map(cls => ({
      name: cls.name,
      description: cls.description || 'لا يوجد وصف',
      studentCount: cls.students ? cls.students.length : 0
    }));

    // إحصائيات الأسئلة
    const totalQuestions = await Question.countDocuments();

    // إحصائيات المستخدمين
    const totalUsers = await User.countDocuments({ role: 'user' });
    
    // تجميع المستخدمين يدوياً حسب المدينة
    const allUsers = await User.find({ role: 'user' }, 'city school class');
    
    const cityMap = new Map();
    const schoolMap = new Map();
    const classMap = new Map();

    allUsers.forEach(user => {
      // حسب المدينة
      const city = user.city || 'غير محدد';
      cityMap.set(city, (cityMap.get(city) || 0) + 1);

      // حسب المدرسة
      const school = user.school || 'غير محدد';
      schoolMap.set(school, (schoolMap.get(school) || 0) + 1);

      // حسب الصف
      const class_ = user.class || 'غير محدد';
      classMap.set(class_, (classMap.get(class_) || 0) + 1);
    });

    // تجميع البيانات النهائية
    const statistics = {
      tests: {
        total: totalTests,
        public: publicTests,
        private: privateTests,
        levels: levelsData
      },
      classes: {
        total: formattedClasses.length,
        details: formattedClasses
      },
      questions: {
        total: totalQuestions
      },
      users: {
        totalUsers: totalUsers,
        byCity: Array.from(cityMap, ([city, count]) => ({ city, count })),
        bySchool: Array.from(schoolMap, ([school, count]) => ({ school, count })),
        byClass: Array.from(classMap, ([class_, count]) => ({ class: class_, count }))
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