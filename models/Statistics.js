const mongoose = require('mongoose');

const statisticsSchema = new mongoose.Schema({
  activeStudents: {
    type: String,
    required: true,
    trim: true
  },
  weeklyReviews: {
    type: String,
    required: true,
    trim: true
  },
  satisfactionRate: {
    type: String,
    required: true,
    trim: true
  },
  supportAvailability: {
    type: String,
    required: true,
    trim: true
  },
  labels: {
    activeStudentsLabel: {
      type: String,
      default: 'طالب نشط'
    },
    weeklyReviewsLabel: {
      type: String,
      default: 'مراجعة أسبوعية'
    },
    satisfactionRateLabel: {
      type: String,
      default: 'نسبة الرضا'
    },
    supportAvailabilityLabel: {
      type: String,
      default: 'دعم متواصل'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// لمنع وجود أكثر من إحصائيات نشطة
statisticsSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('Statistics', statisticsSchema);