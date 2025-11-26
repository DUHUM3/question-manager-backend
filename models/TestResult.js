const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  testId: {
    type: String,
    required: true
  },
  testTitle: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  correctAnswers: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  wrongAnswers: {
    type: Number,
    required: true
  },
  unansweredQuestions: {
    type: Number,
    default: 0
  },
  duration: {
    type: String,
    required: true
  },
  totalTimeSeconds: {
    type: Number,
    required: true
  },
  levelResults: [{
    name: String,
    totalQuestions: Number,
    correctAnswers: Number,
    wrongAnswers: Number,
    score: Number
  }],
  timeAnalysis: {
    averageTime: Number,
    fastestAnswer: Number,
    slowestAnswer: Number,
    totalTime: Number,
    timeUpAnswers: Number
  },
  strengthsAndWeaknesses: {
    strengths: [{
      name: String,
      ratio: Number
    }],
    weaknesses: [{
      name: String,
      ratio: Number
    }]
  },
  additionalStats: {
    heartsUsed: Number,
    hintsUsed: Number,
    accuracy: Number,
    completionRate: Number
  },
  userAnswers: [{
    questionIndex: Number,
    selectedIndex: Number,
    isCorrect: Boolean,
    timeSpent: Number,
    timeUp: Boolean,
    questionText: String,
    correctAnswer: String,
    userAnswer: String
  }],
  performanceLevel: {
    type: String,
    enum: ['ممتاز', 'متميز', 'جيد جداً', 'جيد', 'مقبول'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  certificateGenerated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// إنشاء index للبحث السريع
testResultSchema.index({ userId: 1, testId: 1 });
testResultSchema.index({ createdAt: -1 });
testResultSchema.index({ score: -1 });

module.exports = mongoose.model('TestResult', testResultSchema);