const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, class: userClass, school, city } = req.body;

    // التحقق من الحقول المطلوبة للمستخدم
    if (!name || !email || !password || !userClass || !school || !city) {
      return res.status(400).json({ 
        message: 'جميع الحقول مطلوبة: الاسم، الإيميل، كلمة السر، الصف، المدرسة، المدينة' 
      });
    }

    // التحقق من وجود المستخدم مسبقاً
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'المستخدم موجود مسبقاً' });
    }

    // إنشاء مستخدم جديد
    user = new User({
      name,
      email,
      password,
      class: userClass,
      school,
      city,
      role: 'user'
    });

    // تشفير كلمة السر
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // إنشاء token
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        class: user.class,
        school: user.school,
        city: user.city,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تسجيل دخول الإدارة
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'الإيميل وكلمة السر مطلوبان' 
      });
    }

    // البحث عن الأدمن
    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    // التحقق من كلمة السر
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    // إنشاء token
    const payload = { userId: admin.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// تسجيل دخول المستخدم
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'الإيميل وكلمة السر مطلوبان' 
      });
    }

    // البحث عن المستخدم
    const user = await User.findOne({ email, role: 'user' });
    if (!user) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    // التحقق من كلمة السر
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    // إنشاء token
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        class: user.class,
        school: user.school,
        city: user.city,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// الحصول على بيانات المستخدم الحالي
router.get('/me', auth, async (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    class: req.user.class,
    school: req.user.school,
    city: req.user.city,
    role: req.user.role
  });
});

// إنشاء حساب أدمن (للتطوير فقط)
router.post('/create-admin', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'الاسم، الإيميل وكلمة السر مطلوبة' 
      });
    }

    let admin = await User.findOne({ email });
    if (admin) {
      return res.status(400).json({ message: 'الحساب موجود مسبقاً' });
    }

    admin = new User({
      name,
      email,
      password,
      role: 'admin'
    });

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(password, salt);

    await admin.save();

    const payload = { userId: admin.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

module.exports = router;