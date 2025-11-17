const express = require('express');
const Test = require('../models/Test');
const Question = require('../models/Question');
const { Class } = require('../models/Class');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();


// - Test Management API
//   ├── 🟢 Create Test (POST)
//   ├── 📝 Add Questions (POST)
//   ├── 📋 Get Admin Tests (GET)
//   ├── 🔍 Get Specific Test (GET)
//   ├── ⚙️ Update Test Status (PATCH)
//   ├── 🔧 Update Test Settings (PATCH)
//   └── 🚫 Error Scenarios

// إنشاء اختبار جديد (الإدارة فقط)
// إنشاء اختبار جديد (الإدارة فقط)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { title, description, classId, levels, heartsPerAttempt, hintsPerAttempt, isPublic } = req.body;

    // التحقق من الحقول المطلوبة
    if (!title || !classId || !levels || !Array.isArray(levels)) {
      return res.status(400).json({ 
        message: 'العنوان، الفصل، والمستويات مطلوبة' 
      });
    }

    // التحقق من أن الفصل يتبع للأدمن
    const classObj = await Class.findOne({ 
      _id: classId, 
      adminId: req.user.id 
    });

    if (!classObj) {
      return res.status(404).json({ 
        message: 'الفصل غير موجود أو ليس لديك صلاحية الوصول' 
      });
    }

    // حساب عدد المستويات الكلي
    const totalLevels = levels.length;

    // إنشاء الاختبار
    const test = new Test({
      title,
      description,
      classId,
      adminId: req.user.id,
      levels,
      totalLevels,
      heartsPerAttempt: heartsPerAttempt || 6,
      hintsPerAttempt: hintsPerAttempt || 4,
      isPublic: isPublic !== undefined ? isPublic : false // افتراضي غير مفتوح للجميع
    });

    await test.save();

    res.status(201).json({
      message: 'تم إنشاء الاختبار بنجاح',
      test: {
        id: test._id,
        title: test.title,
        description: test.description,
        class: classObj.name,
        levels: test.levels,
        totalLevels: test.totalLevels,
        heartsPerAttempt: test.heartsPerAttempt,
        hintsPerAttempt: test.hintsPerAttempt,
        isPublic: test.isPublic,
        createdAt: test.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تحديث إعدادات الاختبار including isPublic
router.patch('/:testId/settings', auth, adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const { heartsPerAttempt, hintsPerAttempt, isPublic } = req.body;

    if ((heartsPerAttempt !== undefined && heartsPerAttempt < 1) || 
        (hintsPerAttempt !== undefined && hintsPerAttempt < 0)) {
      return res.status(400).json({ 
        message: 'عدد القلوب يجب أن يكون أكبر من الصفر، وعدد المساعدات يجب أن يكون صفر أو أكبر' 
      });
    }

    const updateData = {};
    if (heartsPerAttempt !== undefined) updateData.heartsPerAttempt = heartsPerAttempt;
    if (hintsPerAttempt !== undefined) updateData.hintsPerAttempt = hintsPerAttempt;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const test = await Test.findOneAndUpdate(
      { _id: testId, adminId: req.user.id },
      updateData,
      { new: true }
    ).populate('classId', 'name');

    if (!test) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    res.json({
      message: 'تم تحديث إعدادات الاختبار بنجاح',
      settings: {
        heartsPerAttempt: test.heartsPerAttempt,
        hintsPerAttempt: test.hintsPerAttempt,
        isPublic: test.isPublic,
        className: test.classId.name
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});
// إضافة أسئلة لمستوى معين في الاختبار
router.post('/:testId/levels/:levelNumber/questions', auth, adminAuth, async (req, res) => {
  try {
    const { testId, levelNumber } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ message: 'الأسئلة مطلوبة' });
    }

    // البحث عن الاختبار والتأكد من ملكية الأدمن
    const test = await Test.findOne({ 
      _id: testId, 
      adminId: req.user.id 
    });

    if (!test) {
      return res.status(404).json({ 
        message: 'الاختبار غير موجود أو ليس لديك صلاحية الوصول' 
      });
    }

    // البحث عن المستوى المطلوب
    const level = test.levels.find(
      l => l.levelNumber === parseInt(levelNumber)
    );

    if (!level) {
      return res.status(404).json({ message: 'المستوى غير موجود' });
    }

    // التحقق من عدد الأسئلة
    if (questions.length > level.numberOfQuestions) {
      return res.status(400).json({ 
        message: `عدد الأسئلة المتاحة لهذا المستوى: ${level.numberOfQuestions}` 
      });
    }

    // التأكد من أن كل سؤال يحتوي على 4 خيارات على الأقل للمساعدات
    for (const question of questions) {
      if (!question.options || !Array.isArray(question.options) || question.options.length < 4) {
        return res.status(400).json({
          message: 'يجب أن يحتوي كل سؤال على 4 خيارات على الأقل لدعم نظام المساعدات'
        });
      }
    }

    // إنشاء الأسئلة
    const createdQuestions = await Question.insertMany(
      questions.map(question => ({
        ...question,
        level: parseInt(levelNumber),
        testId: test._id
      }))
    );

    // إضافة الأسئلة للمستوى
    level.questions.push(...createdQuestions.map(q => q._id));
    await test.save();

    res.status(201).json({
      message: `تم إضافة ${createdQuestions.length} سؤال للمستوى ${levelNumber}`,
      questions: createdQuestions,
      level: {
        levelNumber: level.levelNumber,
        totalQuestions: level.questions.length,
        maxQuestions: level.numberOfQuestions
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على جميع اختبارات الأدمن
router.get('/admin', auth, adminAuth, async (req, res) => {
  try {
    const tests = await Test.find({ adminId: req.user.id })
      .populate('classId', 'name')
      .select('-adminId')
      .sort({ createdAt: -1 });

    res.json({
      tests,
      count: tests.length
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على اختبار معين مع أسئلته
router.get('/:testId', auth, adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findOne({
      _id: testId,
      adminId: req.user.id
    })
      .populate('classId', 'name')
      .populate('levels.questions');

    if (!test) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    res.json({
      test: {
        id: test._id,
        title: test.title,
        description: test.description,
        class: test.classId,
        levels: test.levels,
        totalLevels: test.totalLevels,
        heartsPerAttempt: test.heartsPerAttempt,
        hintsPerAttempt: test.hintsPerAttempt,
        isActive: test.isActive,
        createdAt: test.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على اختبارات فصل معين
router.get('/class/:classId', auth, adminAuth, async (req, res) => {
  try {
    const { classId } = req.params;

    const tests = await Test.find({
      classId,
      adminId: req.user.id
    })
      .populate('classId', 'name')
      .select('title description levels totalLevels heartsPerAttempt hintsPerAttempt isActive createdAt')
      .sort({ createdAt: -1 });

    res.json({
      tests,
      count: tests.length
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تحديث حالة الاختبار (تفعيل/تعطيل)
router.patch('/:testId/status', auth, adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const { isActive } = req.body;

    const test = await Test.findOneAndUpdate(
      { _id: testId, adminId: req.user.id },
      { isActive },
      { new: true }
    ).populate('classId', 'name');

    if (!test) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    res.json({
      message: `تم ${isActive ? 'تفعيل' : 'تعطيل'} الاختبار بنجاح`,
      test: {
        id: test._id,
        title: test.title,
        isActive: test.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تحديث إعدادات القلوب والمساعدات
router.patch('/:testId/settings', auth, adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const { heartsPerAttempt, hintsPerAttempt } = req.body;

    if ((heartsPerAttempt !== undefined && heartsPerAttempt < 1) || 
        (hintsPerAttempt !== undefined && hintsPerAttempt < 0)) {
      return res.status(400).json({ 
        message: 'عدد القلوب يجب أن يكون أكبر من الصفر، وعدد المساعدات يجب أن يكون صفر أو أكبر' 
      });
    }

    const updateData = {};
    if (heartsPerAttempt !== undefined) updateData.heartsPerAttempt = heartsPerAttempt;
    if (hintsPerAttempt !== undefined) updateData.hintsPerAttempt = hintsPerAttempt;

    const test = await Test.findOneAndUpdate(
      { _id: testId, adminId: req.user.id },
      updateData,
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    res.json({
      message: 'تم تحديث إعدادات الاختبار بنجاح',
      settings: {
        heartsPerAttempt: test.heartsPerAttempt,
        hintsPerAttempt: test.hintsPerAttempt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// حذف اختبار وجميع الأسئلة والمستويات المرتبطة به
router.delete('/:testId', auth, adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;

    // البحث عن الاختبار والتأكد من ملكية الأدمن
    const test = await Test.findOne({ 
      _id: testId, 
      adminId: req.user.id 
    });

    if (!test) {
      return res.status(404).json({ 
        message: 'الاختبار غير موجود أو ليس لديك صلاحية الوصول' 
      });
    }

    // استخدام transaction لضمان سلامة البيانات
    const session = await Test.startSession();
    session.startTransaction();

    try {
      // 1. حذف جميع الأسئلة المرتبطة بالاختبار
      await Question.deleteMany({ testId: testId }).session(session);

      // 2. حذف الاختبار نفسه
      await Test.findByIdAndDelete(testId).session(session);

      // تأكيد العملية
      await session.commitTransaction();
      session.endSession();

      res.json({
        message: 'تم حذف الاختبار وجميع الأسئلة والمستويات المرتبطة به بنجاح',
        deletedTest: {
          id: test._id,
          title: test.title,
          totalLevels: test.totalLevels
        }
      });

    } catch (error) {
      // التراجع عن العملية في حالة حدوث خطأ
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    res.status(500).json({ 
      message: 'خطأ في حذف الاختبار', 
      error: error.message 
    });
  }
});
  
module.exports = router;