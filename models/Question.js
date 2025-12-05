const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { 
    type: String, 
    required: true 
  },
  options: [{ 
    type: String, 
    required: true 
  }],
  correctAnswer: { 
    type: String, 
    required: true 
  },
  level: { 
    type: Number, 
    required: true 
  },
  testId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Test', 
    required: true 
  },
  points: { 
    type: Number, 
    default: 1 
  },
  explanation: {
    type: String,
    default: ''
  },
  // الحقول المحدثة
  questionType: {
    type: String,
    enum: ['text-only', 'image-options', 'image-question'], // أضفنا النوع الجديد
    default: 'text-only'
  },
  optionsImages: [{
    type: String // مسارات صور الخيارات
  }],
  questionImage: { // حقل جديد لصورة السؤال
    type: String,
    default: null
  }
}, { 
  timestamps: true 
});

questionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Question', questionSchema);