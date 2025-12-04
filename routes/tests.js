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

// تعديل سؤال معين
router.put('/questions/:questionId', auth, adminAuth, uploadAnyImages, async (req, res) => {
  try {
    const { questionId } = req.params;
    const updateData = req.body;
    const files = req.files || [];

    // البحث عن السؤال
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'السؤال غير موجود'
      });
    }

    // التأكد من أن السؤال يتبع لاختبار الأدمن
    const test = await Test.findOne({
      _id: question.testId,
      adminId: req.user.id
    });

    if (!test) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتعديل هذا السؤال'
      });
    }

    // التحقق من صحة البيانات
    if (updateData.options) {
      try {
        const options = typeof updateData.options === 'string' 
          ? JSON.parse(updateData.options) 
          : updateData.options;

        if (!Array.isArray(options) || options.length < 4) {
          return res.status(400).json({
            success: false,
            message: 'يجب أن يحتوي السؤال على 4 خيارات على الأقل'
          });
        }

        updateData.options = options;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'تنسيق الخيارات غير صحيح'
        });
      }
    }

    // التحقق من الإجابة الصحيحة
    if (updateData.correctAnswer && updateData.options) {
      if (!updateData.options.includes(updateData.correctAnswer)) {
        return res.status(400).json({
          success: false,
          message: 'الإجابة الصحيحة يجب أن تكون موجودة في الخيارات'
        });
      }
    }

    // التحقق من صحة مستوى السؤال
    if (updateData.level) {
      const newLevel = parseInt(updateData.level);
      const levelExists = test.levels.some(l => l.levelNumber === newLevel);
      if (!levelExists) {
        return res.status(400).json({
          success: false,
          message: `المستوى ${newLevel} غير موجود في هذا الاختبار`
        });
      }
    }

    // معالجة الصور المرفوعة
    const uploadedFiles = req.files || [];
    const filesMap = new Map();

    // تجميع الملفات حسب نوعها
    uploadedFiles.forEach(file => {
      const fieldName = file.fieldname;
      if (!filesMap.has(fieldName)) {
        filesMap.set(fieldName, []);
      }
      filesMap.get(fieldName).push(file);
    });

    // تحديث بيانات الصور
    if (updateData.questionType === 'image-options') {
      // البحث عن صور الخيارات الجديدة
      const optionImages = filesMap.get('optionsImages') || [];
      
      if (optionImages.length > 0) {
        // إذا تم رفع صور جديدة، استخدامها
        updateData.optionsImages = optionImages.slice(0, 4).map(file => file.path);
      } else {
        // إذا لم يتم رفع صور جديدة، الاحتفاظ بالصور القديمة
        delete updateData.optionsImages;
      }
      
      // التأكد من عدم وجود صورة سؤال في هذا النوع
      updateData.questionImage = null;

    } else if (updateData.questionType === 'image-question') {
      // البحث عن صورة السؤال الجديدة
      const questionImages = filesMap.get('questionImage') || [];
      
      if (questionImages.length > 0) {
        updateData.questionImage = questionImages[0].path;
      } else {
        // إذا لم يتم رفع صورة جديدة، الاحتفاظ بالصورة القديمة
        delete updateData.questionImage;
      }
      
      // التأكد من عدم وجود صور للخيارات في هذا النوع
      updateData.optionsImages = [];

    } else if (updateData.questionType === 'text-only') {
      // النص فقط - إزالة أي صور
      updateData.questionImage = null;
      updateData.optionsImages = [];
    }

    // تحديث السؤال
    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      { 
        ...updateData,
        updatedAt: Date.now()
      },
      { 
        new: true,
        runValidators: true 
      }
    );

    res.json({
      success: true,
      message: 'تم تحديث السؤال بنجاح',
      data: {
        question: {
          id: updatedQuestion._id,
          questionText: updatedQuestion.questionText,
          options: updatedQuestion.options,
          correctAnswer: updatedQuestion.correctAnswer,
          explanation: updatedQuestion.explanation,
          level: updatedQuestion.level,
          points: updatedQuestion.points,
          questionType: updatedQuestion.questionType,
          optionsImages: updatedQuestion.optionsImages,
          questionImage: updatedQuestion.questionImage,
          testId: updatedQuestion.testId,
          createdAt: updatedQuestion.createdAt,
          updatedAt: updatedQuestion.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});
// الحصول على جميع اختبارات الأدمن مع أسئلتها
router.get('/admin', auth, adminAuth, async (req, res) => {
  try {
    // الحصول على جميع اختبارات الأدمن
    const tests = await Test.find({ adminId: req.user.id })
      .populate('classId', 'name')
      .select('-adminId')
      .sort({ createdAt: -1 });

    // جلب كل الأسئلة لكل اختبار
    const testsWithQuestions = await Promise.all(
      tests.map(async (test) => {
        // جلب الأسئلة لهذا الاختبار
        const questions = await Question.find({ testId: test._id })
          .select('questionText questionType level points createdAt')
          .sort({ level: 1, createdAt: 1 });

        // تنظيم الأسئلة حسب المستوى
        const questionsByLevel = {};
        let totalQuestions = 0;
        let totalPoints = 0;

        questions.forEach(question => {
          const level = question.level;
          if (!questionsByLevel[level]) {
            questionsByLevel[level] = {
              count: 0,
              questions: []
            };
          }
          questionsByLevel[level].count++;
          questionsByLevel[level].questions.push({
            id: question._id,
            questionText: question.questionText,
            questionType: question.questionType,
            points: question.points,
            createdAt: question.createdAt
          });

          totalQuestions++;
          totalPoints += question.points || 1;
        });

        // إحصاءات حسب نوع السؤال
        const questionTypes = {
          'text-only': questions.filter(q => q.questionType === 'text-only').length,
          'image-question': questions.filter(q => q.questionType === 'image-question').length,
          'image-options': questions.filter(q => q.questionType === 'image-options').length
        };

        // تحديث معلومات المستويات
        const updatedLevels = test.levels.map(level => {
          const levelQuestions = questionsByLevel[level.levelNumber] || { count: 0, questions: [] };
          return {
            ...level.toObject(),
            actualQuestionsCount: levelQuestions.count,
            questions: levelQuestions.questions
          };
        });

        return {
          id: test._id,
          title: test.title,
          description: test.description,
          class: test.classId,
          levels: updatedLevels,
          totalLevels: test.totalLevels,
          heartsPerAttempt: test.heartsPerAttempt,
          hintsPerAttempt: test.hintsPerAttempt,
          isActive: test.isActive,
          isPublic: test.isPublic,
          questionTypes,
          summary: {
            totalQuestions,
            totalPoints,
            levelsWithQuestions: Object.keys(questionsByLevel).length
          },
          createdAt: test.createdAt,
          updatedAt: test.updatedAt
        };
      })
    );

    res.json({
      success: true,
      tests: testsWithQuestions,
      count: testsWithQuestions.length,
      totalTests: testsWithQuestions.length,
      overallStats: {
        totalQuestions: testsWithQuestions.reduce((sum, test) => sum + test.summary.totalQuestions, 0),
        totalPoints: testsWithQuestions.reduce((sum, test) => sum + test.summary.totalPoints, 0),
        activeTests: testsWithQuestions.filter(test => test.isActive).length,
        publicTests: testsWithQuestions.filter(test => test.isPublic).length
      }
    });
  } catch (error) {
    console.error('Error fetching admin tests:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في الخادم', 
      error: error.message 
    });
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