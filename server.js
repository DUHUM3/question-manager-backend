const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// إعداد الجلسات (مهم لنظام القلوب)
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false, 
  cookie: { secure: false } // ضع true إذا كنت تستخدم HTTPS
}));

app.use('/uploads', express.static('uploads'));
const initializeSuperAdmin = require('./middleware/superAdminInit');


// routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/admin/tests', require('./routes/tests'));
app.use('/api/student/tests', require('./routes/studentTest'));
app.use('/api/admin/reports', require('./routes/adminReports'));
app.use('/api/dashboard', require ('./routes/dashboard'));
app.use('/api/rating', require ('./routes/ratings') );
app.use('/api/result',require('./routes/testResults'));
app.use('/api/statis',require('./routes/statistics'));
// route أساسي للتحقق
app.get('/', (req, res) => {
  res.json({ message: 'نظام إدارة الاختبارات - واجهة برمجة التطبيقات' });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'حدث خطأ في الخادم', error: err.message });
});

// الاتصال بقاعدة البيانات
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exam-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB successfully');
    
    // تهيئة السوبر أدمن بعد الاتصال بقاعدة البيانات
    await initializeSuperAdmin();
    
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  }
};

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});