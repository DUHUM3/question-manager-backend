const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
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

module.exports = mongoose.model('User', userSchema);