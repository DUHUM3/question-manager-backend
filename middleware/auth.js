// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// const auth = async (req, res, next) => {
//   try {
//     const token = req.header('Authorization')?.replace('Bearer ', '');
    
//     if (!token) {
//       return res.status(401).json({ message: 'لا يوجد token، الوصول مرفوض' });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
//     const user = await User.findById(decoded.userId).select('-password');
    
//     if (!user) {
//       return res.status(401).json({ message: 'Token غير صالح' });
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     res.status(401).json({ message: 'Token غير صالح' });
//   }
// };

// const adminAuth = (req, res, next) => {
//   if (req.user.role !== 'admin') {
//     return res.status(403).json({ message: 'الوصول مرفوض. للإدارة فقط' });
//   }
//   next();
// };

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'لا يوجد token، الوصول مرفوض' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Token غير صالح' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token غير صالح' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {});
    
    if (!req.user) {
      return res.status(401).json({ message: 'المستخدم غير معروف' });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'الوصول مرفوض. للإدارة فقط' });
    }
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ message: 'غير مصرح' });
  }
};

const superAdminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {});
    
    if (!req.user) {
      return res.status(401).json({ message: 'المستخدم غير معروف' });
    }
    
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'الوصول مرفوض. لسوبر أدمن فقط' });
    }
    
    next();
  } catch (error) {
    console.error('SuperAdmin auth error:', error);
    res.status(401).json({ message: 'غير مصرح' });
  }
};

module.exports = { auth, adminAuth, superAdminAuth };