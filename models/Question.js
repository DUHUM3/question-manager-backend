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
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Question', questionSchema);