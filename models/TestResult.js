const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  currentLevel: {
    type: Number,
    default: 1
  },
  completed: {
    type: Boolean,
    default: false
  },
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  attempts: {
    type: Number,
    default: 1
  },
  hintsUsed: {
    type: Number,
    default: 0
  },
  className: { // حفظ اسم الفصل للعرض
    type: String,
    default: 'عام'
  },
  lastAttemptDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// إضافة مؤشر مركب لتحسين أداء الاستعلام
testResultSchema.index({ userId: 1, testId: 1 }, { unique: true });

module.exports = mongoose.model('TestResult', testResultSchema);