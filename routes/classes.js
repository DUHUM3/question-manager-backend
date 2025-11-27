const express = require('express');
const { Class, StudentClass } = require('../models/Class');
const Test = require('../models/Test'); // تأكد من استيراد موديل Test
const Question = require('../models/Question'); // تأكد من استيراد موديل Question
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

router.delete('/:classId', auth, adminAuth, async (req, res) => {
  try {
    const { classId } = req.params;

    // البحث عن الفصل والتأكد من ملكية الأدمن
    const classObj = await Class.findOne({ 
      _id: classId, 
      adminId: req.user.id 
    });

    if (!classObj) {
      return res.status(404).json({ 
        message: 'الفصل غير موجود أو ليس لديك صلاحية الوصول' 
      });
    }

    // استخدام transaction لضمان سلامة البيانات
    const session = await Class.startSession();
    session.startTransaction();

    try {
      // 1. الحصول على جميع الاختبارات المرتبطة بالفصل
      const tests = await Test.find({ classId: classId }).session(session);
      
      // 2. حذف جميع الأسئلة المرتبطة باختبارات الفصل
      const testIds = tests.map(test => test._id);
      if (testIds.length > 0) {
        await Question.deleteMany({ 
          testId: { $in: testIds } 
        }).session(session);
      }

      // 3. حذف جميع الاختبارات المرتبطة بالفصل
      await Test.deleteMany({ classId: classId }).session(session);

      // 4. حذف جميع تسجيلات الطلاب في الفصل
      await StudentClass.deleteMany({ classId: classId }).session(session);

      // 5. حذف الفصل نفسه
      await Class.findByIdAndDelete(classId).session(session);

      // تأكيد العملية
      await session.commitTransaction();
      session.endSession();

      res.json({
        message: 'تم حذف الفصل وجميع الاختبارات والأسئلة والطلاب المرتبطين به بنجاح',
        deletedClass: {
          id: classObj._id,
          name: classObj.name,
          testsCount: tests.length,
          studentsCount: classObj.students.length
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
      message: 'خطأ في حذف الفصل', 
      error: error.message 
    });
  }
});

// إنشاء فصل جديد (الإدارة فقط)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'اسم الفصل مطلوب' });
    }

    const classObj = new Class({
      name,
      description,
      adminId: req.user.id
    });

    await classObj.save();

    res.status(201).json({
      message: 'تم إنشاء الفصل بنجاح',
      class: {
        id: classObj._id,
        name: classObj.name,
        description: classObj.description,
        studentsCount: classObj.students.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// إضافة طالب للفصل
router.post('/:classId/students', auth, adminAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ message: 'معرف الطالب مطلوب' });
    }

    // التحقق من وجود الفصل وملكيته للأدمن
    const classObj = await Class.findOne({ 
      _id: classId, 
      adminId: req.user.id 
    });

    if (!classObj) {
      return res.status(404).json({ message: 'الفصل غير موجود' });
    }

    // إضافة الطالب للفصل باستخدام StudentClass
    const studentClass = new StudentClass({
      studentId,
      classId
    });

    await studentClass.save();

    // تحديث الفصل بإضافة الطالب
    classObj.students.push({
      studentId,
      enrolledAt: new Date()
    });

    await classObj.save();

    res.status(201).json({
      message: 'تم إضافة الطالب للفصل بنجاح',
      enrollment: {
        classId: classObj._id,
        className: classObj.name,
        studentId
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'الطالب مسجل بالفعل في هذا الفصل' });
    }
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على فصول الأدمن
router.get('/admin', auth, adminAuth, async (req, res) => {
  try {
    const classes = await Class.find({ adminId: req.user.id })
      .populate('students.studentId', 'name email')
      .select('-adminId')
      .sort({ createdAt: -1 });

    const formattedClasses = classes.map(classObj => ({
      id: classObj._id,
      name: classObj.name,
      createdAt: classObj.createdAt
    }));

    res.json({
      classes: formattedClasses,
      count: formattedClasses.length
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على فصول الطالب
router.get('/student', auth, async (req, res) => {
  try {
    const studentClasses = await StudentClass.find({ studentId: req.user.id })
      .populate('classId', 'name description')
      .sort({ enrolledAt: -1 });

    const formattedClasses = studentClasses.map(sc => ({
      id: sc.classId._id,
      name: sc.classId.name,
      description: sc.classId.description,
      enrolledAt: sc.enrolledAt
    }));

    res.json({
      classes: formattedClasses,
      count: formattedClasses.length
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

module.exports = router;