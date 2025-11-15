const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/tests', require('./routes/tests'))

// route أساسي للتحقق
app.get('/', (req, res) => {
  res.json({ message: 'نظام إدارة الاختبارات - واجهة برمجة التطبيقات' });
});

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exam-management')
  .then(() => console.log('تم الاتصال بقاعدة البيانات'))
  .catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
});