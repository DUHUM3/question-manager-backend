const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
  levelNumber: { 
    type: Number, 
    required: true 
  },
  numberOfQuestions: { 
    type: Number, 
    required: true 
  },
  questions: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Question' 
  }]
});

const testSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  classId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: true 
  },
  adminId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  levels: [levelSchema],
  totalLevels: { 
    type: Number, 
    required: true 
  },
  heartsPerAttempt: {
    type: Number,
    default: 6
  },
  hintsPerAttempt: {
    type: Number,
    default: 4
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  // إضافة حقل لتحديد إذا كان الاختبار مفتوح للجميع
  isPublic: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Test', testSchema);