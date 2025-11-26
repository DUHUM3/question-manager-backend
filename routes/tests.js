const express = require('express');
const Test = require('../models/Test');
const Question = require('../models/Question');
const { Class } = require('../models/Class');
const { auth, adminAuth } = require('../middleware/auth');
const { uploadAnyImages } = require('../middleware/upload');

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

router.post('/:testId/levels/:levelNumber/questions', auth, adminAuth, uploadAnyImages, async (req, res) => {
  try {
    const { testId, levelNumber } = req.params;
    const { questions } = req.body;

    if (!questions) {
      return res.status(400).json({ 
        success: false,
        message: 'الأسئلة مطلوبة' 
      });
    }

    // تحليل الأسئلة من JSON
    let questionsData;
    try {
      questionsData = typeof questions === 'string' ? JSON.parse(questions) : questions;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'تنسيق الأسئلة غير صحيح'
      });
    }

    if (!Array.isArray(questionsData)) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن تكون الأسئلة مصفوفة'
      });
    }

    // البحث عن الاختبار
    const test = await Test.findOne({ 
      _id: testId, 
      adminId: req.user.id 
    });

    if (!test) {
      return res.status(404).json({ 
        success: false,
        message: 'الاختبار غير موجود أو ليس لديك صلاحية الوصول' 
      });
    }

    const level = test.levels.find(l => l.levelNumber === parseInt(levelNumber));
    if (!level) {
      return res.status(404).json({ 
        success: false,
        message: 'المستوى غير موجود' 
      });
    }

    // التحقق من عدد الأسئلة
    if (questionsData.length > level.numberOfQuestions) {
      return res.status(400).json({ 
        success: false,
        message: `عدد الأسئلة المتاحة لهذا المستوى: ${level.numberOfQuestions}` 
      });
    }

    // تنظيم الملفات المرفوعة
    const uploadedFiles = req.files || [];
    const filesMap = new Map();

    // تجميع الملفات حسب أسمائها
    uploadedFiles.forEach(file => {
      const fieldName = file.fieldname;
      if (!filesMap.has(fieldName)) {
        filesMap.set(fieldName, []);
      }
      filesMap.get(fieldName).push(file);
    });

    // التحقق من صحة الأسئلة وتجهيزها
    const questionsToCreate = [];

    for (let i = 0; i < questionsData.length; i++) {
      const question = questionsData[i];
      const questionIndex = i;
      
      if (!question.options || !Array.isArray(question.options) || question.options.length < 4) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن يحتوي كل سؤال على 4 خيارات على الأقل'
        });
      }

      if (!question.options.includes(question.correctAnswer)) {
        return res.status(400).json({
          success: false,
          message: `الإجابة الصحيحة "${question.correctAnswer}" غير موجودة في الخيارات`
        });
      }

      const questionData = { ...question };

      if (question.questionType === 'image-options') {
        // البحث عن صور الخيارات لهذا السؤال
        const optionImagesKey = `optionImages_${questionIndex}`;
        const optionImages = filesMap.get(optionImagesKey) || [];
        
        if (optionImages.length < 4) {
          return res.status(400).json({
            success: false,
            message: `لا توجد صور كافية للخيارات. تحتاج 4 صور للسؤال "${question.questionText}"`
          });
        }

        questionData.optionsImages = optionImages.slice(0, 4).map(file => file.path);
        questionData.questionImage = null;

      } else if (question.questionType === 'image-question') {
        // البحث عن صورة السؤال
        const questionImageKey = `questionImage_${questionIndex}`;
        const questionImages = filesMap.get(questionImageKey) || [];
        
        if (questionImages.length === 0) {
          return res.status(400).json({
            success: false,
            message: `لا توجد صورة للسؤال "${question.questionText}"`
          });
        }

        questionData.questionImage = questionImages[0].path;
        questionData.optionsImages = [];

      } else {
        // النوع الافتراضي: نص فقط
        questionData.questionType = 'text-only';
        questionData.optionsImages = [];
        questionData.questionImage = null;
      }

      questionsToCreate.push(questionData);
    }

    // إنشاء الأسئلة في قاعدة البيانات
    const createdQuestions = await Question.insertMany(
      questionsToCreate.map(question => ({
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation || '',
        level: parseInt(levelNumber),
        testId: test._id,
        points: question.points || 1,
        questionType: question.questionType,
        optionsImages: question.optionsImages,
        questionImage: question.questionImage
      }))
    );

    // إضافة الأسئلة للمستوى
    level.questions.push(...createdQuestions.map(q => q._id));
    await test.save();

    res.status(201).json({
      success: true,
      message: `تم إضافة ${createdQuestions.length} سؤال للمستوى ${levelNumber}`,
      data: {
        questions: createdQuestions,
        level: {
          levelNumber: level.levelNumber,
          totalQuestions: level.questions.length,
          maxQuestions: level.numberOfQuestions
        }
      }
    });

  } catch (error) {
    console.error('Error adding questions:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في الخادم', 
      error: error.message 
    });
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