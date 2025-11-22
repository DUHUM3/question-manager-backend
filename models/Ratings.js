const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'وصف التقييم مطلوب'],
    trim: true,
    minlength: [10, 'الوصف يجب أن يكون至少 10 أحرف'],
    maxlength: [500, 'الوصف يجب ألا يتجاوز 500 حرف']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Rating', ratingSchema);