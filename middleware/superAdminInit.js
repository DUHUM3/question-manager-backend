const User = require('../models/User');
const bcrypt = require('bcryptjs');

const initializeSuperAdmin = async () => {
  try {
    // التحقق من وجود سوبر أدمن مسبقاً
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    
    if (existingSuperAdmin) {
      console.log('✅ السوبر أدمن موجود مسبقاً');
      return;
    }

    // إنشاء سوبر أدمن جديد
    const superAdminData = {
      name: 'Super Admin',
      email: 'superadmin@nafspro.com',
      password: 'Nafs@2025!Admin', // يجب تغيير هذا في البيئة الإنتاجية
      role: 'superadmin'
    };

    // تشفير كلمة السر
    const salt = await bcrypt.genSalt(10);
    superAdminData.password = await bcrypt.hash(superAdminData.password, salt);

    const superAdmin = new User(superAdminData);
    await superAdmin.save();

    console.log('✅ تم إنشاء السوبر أدمن تلقائياً');
    console.log('📧 الإيميل:', superAdminData.email);
    console.log('🔑 كلمة السر:', 'superadmin123');
    console.log('⚠️  يرجى تغيير كلمة السر فوراً بعد الدخول الأول');

  } catch (error) {
    console.error('❌ خطأ في إنشاء السوبر أدمن:', error.message);
  }
};

module.exports = initializeSuperAdmin;