const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth , superAdminAuth, adminAuth } = require('../middleware/auth');
const { sendResetEmail, sendPasswordResetSuccessEmail  } = require('../utils/emailService');

const router = express.Router();

// 🔹 روت التحقق من اسم المستخدم
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ 
        available: false,
        message: 'اسم المستخدم مطلوب' 
      });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        available: false,
        message: 'اسم المستخدم يجب أن يحتوي على 3-30 حرفاً (أحرف إنجليزية، أرقام و _ فقط)' 
      });
    }

    const existingUser = await User.findOne({ 
      username: username.toLowerCase().trim(),
      role: 'user'
    });

    if (existingUser) {
      return res.json({ 
        available: false,
        message: 'اسم المستخدم موجود مسبقاً' 
      });
    }

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

// مسار نسيان كلمة المرور
router.post('/admin/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "البريد الإلكتروني مطلوب",
        errorCode: "EMAIL_REQUIRED"
      });
    }

    // تنظيف البريد الإلكتروني
    const cleanEmail = email.toLowerCase().trim();

    // البحث عن المسؤول
    const admin = await User.findOne({ 
      email: cleanEmail,
      role: { $in: ["admin", "superadmin"] }
    });

    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: "لا يوجد حساب مرتبط بهذا البريد الإلكتروني",
        errorCode: "USER_NOT_FOUND"
      });
    }

    // التحقق من حالة الحساب
    // if (admin.status !== 'active') {
    //   return res.status(403).json({ 
    //     success: false,
    //     message: "الحساب غير نشط. الرجاء التواصل مع الدعم الفني",
    //     errorCode: "ACCOUNT_INACTIVE"
    //   });
    // }

    // إنشاء توكن إعادة التعيين
    const token = jwt.sign(
      { 
        userId: admin._id,
        email: admin.email,
        role: admin.role,
        type: 'password_reset'
      },
      process.env.RESET_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "30m" }
    );

    // إنشاء رابط إعادة التعيين
    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/reset-password?token=${token}`;

    // إرسال الإيميل
    await sendResetEmail(
      admin.email,
      resetLink,
      admin.fullname || admin.username
    );

    // تسجيل النشاط
    console.log('تم طلب إعادة تعيين كلمة المرور:', {
      adminId: admin._id,
      email: admin.email,
      timestamp: new Date().toLocaleString('ar-SA'),
      ip: req.ip
    });

    res.json({
      success: true,
      message: "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني",
      data: {
        email: admin.email,
        expiresIn: "30 دقيقة"
      }
    });

  } catch (error) {
    console.error('خطأ في طلب إعادة تعيين كلمة المرور:', {
      error: error.message,
      email: req.body.email,
      timestamp: new Date().toLocaleString('ar-SA')
    });
    
    res.status(500).json({ 
      success: false,
      message: "حدث خطأ أثناء معالجة طلبك",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorCode: "SERVER_ERROR"
    });
  }
});


// 🔹 تسجيل مستخدم جديد (بدون إيميل)
router.post('/register', async (req, res) => {
  try {
    const { name, username, password, class: userClass, school, city } = req.body;

    // تنظيف البيانات
    const cleanUsername = username ? username.toLowerCase().trim() : '';
    const cleanName = name ? name.trim() : '';
    const cleanClass = userClass ? userClass.trim() : '';
    const cleanSchool = school ? school.trim() : '';
    const cleanCity = city ? city.trim() : '';

    // التحقق من الحقول المطلوبة
    if (!cleanName || !cleanUsername || !password || !cleanClass || !cleanSchool || !cleanCity) {
      return res.status(400).json({ 
        message: 'جميع الحقول مطلوبة: الاسم، اسم المستخدم، كلمة السر، الصف، المدرسة، المدينة' 
      });
    }

    // التحقق من صحة اسم المستخدم
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ 
        message: 'اسم المستخدم يجب أن يحتوي على 3-30 حرفاً (أحرف إنجليزية، أرقام و _ فقط)' 
      });
    }

    // التحقق من قوة كلمة السر
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'كلمة السر يجب أن تكون至少 6 أحرف' 
      });
    }

    // التحقق من وجود المستخدم مسبقاً
    const existingUser = await User.findOne({
      username: cleanUsername,
      role: 'user'
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'اسم المستخدم موجود مسبقاً' 
      });
    }

    // إنشاء مستخدم جديد - مهم: لا نضع حقل email إطلاقاً
    const user = new User({
      name: cleanName,
      username: cleanUsername,
      password,
      class: cleanClass,
      school: cleanSchool,
      city: cleanCity,
      role: 'user'
      // لا نضيف حقل email للمستخدم العادي
    });

    // تشفير كلمة السر
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // إنشاء token
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '336d' });

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
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      // إذا كان الخطأ بسبب الاسم المستخدم
      if (error.keyPattern && error.keyPattern.username) {
        return res.status(400).json({ 
          message: 'اسم المستخدم موجود مسبقاً' 
        });
      }
      // إذا كان الخطأ بسبب الإيميل (يجب ألا يحدث مع المخطط الجديد)
      if (error.keyPattern && error.keyPattern.email) {
        return res.status(400).json({ 
          message: 'حدث خطأ في النظام. يرجى المحاولة مرة أخرى' 
        });
      }
    }
    
    res.status(500).json({ 
      message: 'خطأ في الخادم', 
      error: error.message 
    });
  }
});

// 🔹 إنشاء حساب أدمن
router.post('/create-admin', superAdminAuth, async (req, res) => {
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

    const cleanEmail = email.toLowerCase().trim();

    // التحقق من وجود الأدمن مسبقاً
    const existingAdmin = await User.findOne({ 
      email: cleanEmail,
      role: { $in: ['admin', 'superadmin'] }
    });
    
    if (existingAdmin) {
      return res.status(400).json({ message: 'الحساب موجود مسبقاً' });
    }

    // إنشاء أدمن جديد
    const admin = new User({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: 'admin'
    });

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(password, salt);

    await admin.save();

    res.status(201).json({
      message: 'تم إنشاء الأدمن بنجاح',
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'الإيميل موجود مسبقاً' 
      });
    }
    
    res.status(500).json({ 
      message: 'خطأ في الخادم', 
      error: error.message 
    });
  }
});


// 🔹 تسجيل دخول الإدارة
// 🔹 تسجيل دخول الإدارة (للسوبر أدمن والأدمن العادي)
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'الإيميل وكلمة السر مطلوبان' 
      });
    }

    // البحث عن أدمن أو سوبر أدمن
    const admin = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      role: { $in: ['admin', 'superadmin'] } // البحث في كلا الدورين
    });
    
    if (!admin) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const payload = { userId: admin.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3d' });

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

// 🔹 تسجيل دخول المستخدم العادي
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        message: 'اسم المستخدم وكلمة السر مطلوبان' 
      });
    }

    const user = await User.findOne({ 
      username: username.toLowerCase().trim(), 
      role: 'user' 
    });
    
    if (!user) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '336d' });

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

// 🔹 روت لفحص صلاحية التوكن (للتجربة فقط)
router.get('/debug-token', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(400).json({ message: 'لا يوجد توكن' });
    }

    // فك التوكن دون التحقق (لرؤية البيانات)
    const decoded = jwt.decode(token);
    
    // حساب الوقت المتبقي
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = decoded.exp - now;
    const daysLeft = Math.floor(timeLeft / (60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (60 * 60 * 24)) / 3600);
    
    res.json({
      tokenData: decoded,
      expiresAt: new Date(decoded.exp * 1000),
      timeLeft: {
        seconds: timeLeft,
        days: daysLeft,
        hours: hoursLeft,
        formatted: `${daysLeft} يوم و ${hoursLeft} ساعة`
      },
      createdAt: new Date(decoded.iat * 1000),
      isValid: timeLeft > 0
    });
    
  } catch (error) {
    res.status(500).json({ 
      message: 'خطأ في فحص التوكن',
      error: error.message 
    });
  }
});

// الحصول على بيانات المستخدم الحالي
router.get('/me', auth, async (req, res) => {
  const userData = {
    id: req.user.id,
    name: req.user.name,
    role: req.user.role
  };

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

// تحديث بيانات المستخدم
router.put('/profile', auth, async (req, res) => {
  try {
    const updates = { ...req.body };
    
    delete updates.role;

    if (req.user.role === 'admin') {
      const allowedFields = ['name', 'email'];
      Object.keys(updates).forEach(key => {
        if (!allowedFields.includes(key)) delete updates[key];
      });

      if (updates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.email)) {
          return res.status(400).json({ message: 'صيغة الإيميل غير صحيحة' });
        }
        updates.email = updates.email.toLowerCase().trim();
      }
    } else {
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
        updates.username = updates.username.toLowerCase().trim();
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


// 🔹 روت لتغيير كلمة السر للأدمن العادي (أو السوبر)
// يحتاج تسجيل دخول فقط
router.put('/admin/change-password', adminAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // التحقق من البيانات
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: 'الرجاء إدخال كلمة السر القديمة والجديدة'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل'
      });
    }

    // جلب البيانات من المستخدم المسجّل
    const admin = await User.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // التحقق من كلمة السر القديمة
    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'كلمة السر القديمة غير صحيحة' });
    }

    // تشفير كلمة السر الجديدة
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);

    await admin.save();

    res.json({
      message: 'تم تغيير كلمة السر بنجاح'
    });

  } catch (error) {
    res.status(500).json({
      message: 'خطأ في الخادم أثناء تغيير كلمة السر',
      error: error.message
    });
  }
});


// 🔹 روت واحد لجلب جميع الأدمن (يحتاج صلاحية أدمن)
router.get('/admins', adminAuth , async (req, res) => {
  try {
    // جلب جميع الأدمن (بدون السوبر أدمن)
    const admins = await User.find(
      { role: 'admin' },
      { password: 0 }
    ).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: admins.length,
      admins: admins.map(admin => ({
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }))
    });

  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في الخادم أثناء جلب قائمة الأدمن', 
      error: error.message 
    });
  }
});

// 🔹 روت حذف الأدمن (للسوبر أدمن فقط)
router.delete('/admin/:id', superAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // منع حذف السوبر أدمن
    const adminToDelete = await User.findOne({ _id: id, role: 'admin' });

    if (!adminToDelete) {
      return res.status(404).json({ 
        message: 'الأدمن غير موجود أو لا يمكن حذف سوبر أدمن' 
      });
    }

    await User.findByIdAndDelete(id);

    res.json({
      message: 'تم حذف الأدمن بنجاح',
      deletedAdmin: {
        id: adminToDelete._id,
        name: adminToDelete.name,
        email: adminToDelete.email
      }
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'خطأ في الخادم أثناء حذف الأدمن', 
      error: error.message 
    });
  }
});

module.exports = router;