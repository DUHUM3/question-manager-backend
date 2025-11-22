const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// 🔹 روت التحقق من اسم المستخدم (جديد)
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // التحقق من وجود اسم المستخدم
    if (!username) {
      return res.status(400).json({ 
        available: false,
        message: 'اسم المستخدم مطلوب' 
      });
    }

    // التحقق من صحة اسم المستخدم
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        available: false,
        message: 'اسم المستخدم يجب أن يحتوي على 3-30 حرفاً (أحرف إنجليزية، أرقام و _ فقط)' 
      });
    }

    // البحث عن المستخدم في قاعدة البيانات
    const existingUser = await User.findOne({ 
      username: username.toLowerCase(),
      role: 'user' // التحقق من المستخدمين العاديين فقط
    });

    if (existingUser) {
      return res.json({ 
        available: false,
        message: 'اسم المستخدم موجود مسبقاً' 
      });
    }

    // اسم المستخدم متاح
    res.json({ 
      available: true,
      message: 'اسم المستخدم متاح' 
    });

  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({ 
      available: false,
      message: 'خطأ في الخادم أثناء التحقق من اسم المستخدم' 
    });
  }
});

// تسجيل مستخدم جديد (باستخدام username فقط)
router.post('/register', async (req, res) => {
  try {
    const { name, username, password, class: userClass, school, city } = req.body;

    // التحقق من الحقول المطلوبة للمستخدم العادي
    if (!name || !username || !password || !userClass || !school || !city) {
      return res.status(400).json({ 
        message: 'جميع الحقول مطلوبة: الاسم، اسم المستخدم، كلمة السر، الصف، المدرسة، المدينة' 
      });
    }

    // التحقق من صحة اسم المستخدم
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        message: 'اسم المستخدم يجب أن يحتوي على 3-30 حرفاً (أحرف إنجليزية، أرقام و _ فقط)' 
      });
    }

    // التحقق من وجود المستخدم مسبقاً
    let user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      return res.status(400).json({ message: 'اسم المستخدم موجود مسبقاً' });
    }

    // إنشاء مستخدم جديد
    user = new User({
      name,
      username: username.toLowerCase(),
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
        username: user.username,
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

// تسجيل دخول الإدارة (باستخدام الإيميل)
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'الإيميل وكلمة السر مطلوبان' 
      });
    }

    // البحث عن الأدمن باستخدام الإيميل
    const admin = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'admin' 
    });
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

// تسجيل دخول المستخدم العادي (باستخدام username)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        message: 'اسم المستخدم وكلمة السر مطلوبان' 
      });
    }

    // البحث عن المستخدم باستخدام username
    const user = await User.findOne({ 
      username: username.toLowerCase(), 
      role: 'user' 
    });
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
        username: user.username,
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
  const userData = {
    id: req.user.id,
    name: req.user.name,
    role: req.user.role
  };

  // إضافة الحقول حسب نوع المستخدم
  if (req.user.role === 'admin') {
    userData.email = req.user.email;
  } else {
    userData.username = req.user.username;
    userData.class = req.user.class;
    userData.school = req.user.school;
    userData.city = req.user.city;
  }

  res.json(userData);
});

// إنشاء حساب أدمن (باستخدام الإيميل)
router.post('/create-admin', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'الاسم، الإيميل وكلمة السر مطلوبة' 
      });
    }

    // التحقق من صحة الإيميل
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'صيغة الإيميل غير صحيحة' 
      });
    }

    let admin = await User.findOne({ email: email.toLowerCase() });
    if (admin) {
      return res.status(400).json({ message: 'الحساب موجود مسبقاً' });
    }

    admin = new User({
      name,
      email: email.toLowerCase(),
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

// تحديث بيانات المستخدم
router.put('/profile', auth, async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // منع تغيير role من خلال هذا المسار
    delete updates.role;

    // معالجة الحقول حسب نوع المستخدم
    if (req.user.role === 'admin') {
      // للأدمن: يمكن تحديث الاسم والإيميل فقط
      const allowedFields = ['name', 'email'];
      Object.keys(updates).forEach(key => {
        if (!allowedFields.includes(key)) delete updates[key];
      });

      if (updates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.email)) {
          return res.status(400).json({ message: 'صيغة الإيميل غير صحيحة' });
        }
        updates.email = updates.email.toLowerCase();
      }
    } else {
      // للمستخدم العادي: يمكن تحديث الاسم واسم المستخدم والحقول الأخرى
      const allowedFields = ['name', 'username', 'class', 'school', 'city'];
      Object.keys(updates).forEach(key => {
        if (!allowedFields.includes(key)) delete updates[key];
      });

      if (updates.username) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernameRegex.test(updates.username)) {
          return res.status(400).json({ 
            message: 'اسم المستخدم يجب أن يحتوي على 3-30 حرفاً (أحرف إنجليزية، أرقام و _ فقط)' 
          });
        }
        updates.username = updates.username.toLowerCase();
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // إعداد البيانات للإرجاع
    const userData = {
      id: user.id,
      name: user.name,
      role: user.role
    };

    if (user.role === 'admin') {
      userData.email = user.email;
    } else {
      userData.username = user.username;
      userData.class = user.class;
      userData.school = user.school;
      userData.city = user.city;
    }

    res.json(userData);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: req.user.role === 'admin' ? 'الإيميل موجود مسبقاً' : 'اسم المستخدم موجود مسبقاً' 
      });
    }
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

module.exports = router;