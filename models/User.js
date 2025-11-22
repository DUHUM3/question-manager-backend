const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  username: { 
    type: String, 
    required: function() { return this.role === 'user'; },
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30
  },
  email: { 
    type: String, 
    required: function() { return this.role === 'admin'; },
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  role: { 
    type: String, 
    enum: ['admin', 'user'], 
    default: 'user' 
  },
  class: { 
    type: String, 
    required: function() { return this.role === 'user'; },
    trim: true
  },
  school: { 
    type: String, 
    required: function() { return this.role === 'user'; },
    trim: true
  },
  city: { 
    type: String, 
    required: function() { return this.role === 'user'; },
    trim: true
  }
}, { 
  timestamps: true 
});

// إنشاء الفهارس المخصصة بعد تعريف المخطط
userSchema.index({ 
  username: 1 
}, { 
  unique: true, 
  partialFilterExpression: { role: 'user' }
});

userSchema.index({ 
  email: 1 
}, { 
  unique: true, 
  partialFilterExpression: { role: 'admin' }
});

module.exports = mongoose.model('User', userSchema);