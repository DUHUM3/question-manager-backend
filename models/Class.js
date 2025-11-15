const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  students: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// موديل للعلاقة بين الطالب والفصل
const studentClassSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  }
});

// إضافة الفهرس المركب لمنع الازدواجية
studentClassSchema.index({ studentId: 1, classId: 1 }, { unique: true });

// إنشاء الموديلات
const Class = mongoose.model('Class', classSchema);
const StudentClass = mongoose.model('StudentClass', studentClassSchema);

module.exports = { Class, StudentClass };