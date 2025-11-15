const express = require('express');
const Class = require('../models/Class');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// إنشاء فصل دراسي جديد (الإدارة فقط)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'اسم الفصل مطلوب' });
    }

    const newClass = new Class({
      name,
      description,
      adminId: req.user.id
    });

    await newClass.save();
    
    res.status(201).json({
      message: 'تم إنشاء الفصل بنجاح',
      class: newClass
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على جميع الفصول الخاصة بالأدمن
router.get('/admin', auth, adminAuth, async (req, res) => {
  try {
    const classes = await Class.find({ adminId: req.user.id })
      .populate('students', 'name email class school city')
      .select('-adminId');

    res.json({
      classes,
      count: classes.length
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// إضافة طالب إلى الفصل (الإدارة فقط)
router.post('/:classId/students', auth, adminAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    const { studentEmail } = req.body;

    if (!studentEmail) {
      return res.status(400).json({ message: 'إيميل الطالب مطلوب' });
    }

    // البحث عن الفصل والتأكد من ملكية الأدمن له
    const classObj = await Class.findOne({ _id: classId, adminId: req.user.id });
    if (!classObj) {
      return res.status(404).json({ message: 'الفصل غير موجود أو ليس لديك صلاحية الوصول' });
    }

    // البحث عن الطالب
    const student = await User.findOne({ 
      email: studentEmail, 
      role: 'user' 
    });

    if (!student) {
      return res.status(404).json({ message: 'الطالب غير موجود' });
    }

    // التحقق إذا كان الطالب مضافاً مسبقاً
    if (classObj.students.includes(student._id)) {
      return res.status(400).json({ message: 'الطالب مضاف مسبقاً لهذا الفصل' });
    }

    // تحديث الفصل وإضافة الطالب
    classObj.students.push(student._id);
    await classObj.save();

    // تحديث الفصل للطالب
    student.class = classObj.name;
    await student.save();

    res.json({
      message: 'تم إضافة الطالب إلى الفصل بنجاح',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        class: student.class,
        school: student.school,
        city: student.city
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على طلاب فصل معين
router.get('/:classId/students', auth, adminAuth, async (req, res) => {
  try {
    const { classId } = req.params;

    const classObj = await Class.findOne({ 
      _id: classId, 
      adminId: req.user.id 
    }).populate('students', 'name email class school city');

    if (!classObj) {
      return res.status(404).json({ message: 'الفصل غير موجود' });
    }

    res.json({
      class: classObj.name,
      students: classObj.students,
      count: classObj.students.length
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

module.exports = router;