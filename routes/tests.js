const express = require('express');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Class = require('../models/Class');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// إنشاء اختبار جديد (الإدارة فقط)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { title, description, classId, levels } = req.body;

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
      totalLevels
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
        createdAt: test.createdAt
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
      .select('title description levels totalLevels isActive createdAt')
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

module.exports = router;