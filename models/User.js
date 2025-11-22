const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  username: { 
    type: String, 
    required: function() { return this.role === 'user'; },
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30
  },
  email: { 
    type: String, 
    required: function() { return this.role === 'admin'; },
    unique: true,
    sparse: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['admin', 'user'], 
    default: 'user' 
  },
  class: { 
    type: String, 
    required: function() { return this.role === 'user'; } 
  },
  school: { 
    type: String, 
    required: function() { return this.role === 'user'; } 
  },
  city: { 
    type: String, 
    required: function() { return this.role === 'user'; } 
  }
}, { 
  timestamps: true 
});

// إنشاء فهارس للبحث السريع
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);