const express = require('express');
const Rating = require('../models/Ratings');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// 🔹 إنشاء تقييم جديد
router.post('/', auth, async (req, res) => {
  try {
    const { description } = req.body;

    // التحقق من وجود الوصف
    if (!description) {
      return res.status(400).json({ 
        message: 'وصف التقييم مطلوب' 
      });
    }

    // التحقق من طول الوصف
    if (description.length < 10) {
      return res.status(400).json({ 
        message: 'الوصف يجب أن يكون至少 10 أحرف' 
      });
    }

    if (description.length > 500) {
      return res.status(400).json({ 
        message: 'الوصف يجب ألا يتجاوز 500 حرف' 
      });
    }

    // التحقق إذا كان المستخدم قد قام بالتقييم مسبقاً
    const existingRating = await Rating.findOne({ 
      createdBy: req.user.id 
    });

    if (existingRating) {
      return res.status(400).json({ 
        message: 'لقد قمت بالتقييم مسبقاً' 
      });
    }

    // إنشاء التقييم الجديد
    const newRating = new Rating({
      description: description.trim(),
      createdBy: req.user.id,
      username: req.user.username || req.user.name,
      isVisible: true // جديد
    });

    await newRating.save();

    res.status(201).json({
      message: 'تم إضافة التقييم بنجاح',
      rating: {
        id: newRating._id,
        description: newRating.description,
        username: newRating.username,
        isVisible: newRating.isVisible, // جديد
        createdAt: newRating.createdAt
      }
    });

  } catch (error) {
    console.error('Create rating error:', error);
    res.status(500).json({ 
      message: 'خطأ في إضافة التقييم', 
      error: error.message 
    });
  }
});

// 🔹 الحصول على جميع التقييمات مع الباجينيشن (التقييمات الظاهرة فقط)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // التحقق من أن الصفحة والحدود أرقام صحيحة موجبة
    if (page < 1 || limit < 1) {
      return res.status(400).json({ 
        message: 'رقم الصفحة والحد يجب أن يكونا أرقاماً صحيحة موجبة' 
      });
    }

    // الحد الأقصى للعناصر في الصفحة الواحدة
    const actualLimit = Math.min(limit, 50);

    // جلب التقييمات الظاهرة فقط مع الباجينيشن
    const ratings = await Rating.find({ isVisible: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(actualLimit)
      .select('description username createdAt isVisible'); // جديد

    // إحصائيات - فقط التقييمات الظاهرة
    const totalRatings = await Rating.countDocuments({ isVisible: true });
    const totalPages = Math.ceil(totalRatings / actualLimit);

    // التحقق إذا كانت الصفحة المطلوبة موجودة
    if (page > totalPages && totalPages > 0) {
      return res.status(400).json({ 
        message: `الصفحة ${page} غير موجودة. إجمالي الصفحات: ${totalPages}` 
      });
    }

    res.json({
      ratings,
      pagination: {
        currentPage: page,
        totalPages,
        totalRatings,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        limit: actualLimit
      },
      statistics: {
        totalRatings
      }
    });
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ 
      message: 'خطأ في جلب التقييمات', 
      error: error.message 
    });
  }
});

// 🔹 جلب جميع التقييمات (بما فيها المخفية) - للمشرفين فقط
router.get('/admin/all-ratings', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // التحقق من أن الصفحة والحدود أرقام صحيحة موجبة
    if (page < 1 || limit < 1) {
      return res.status(400).json({ 
        message: 'رقم الصفحة والحد يجب أن يكونا أرقاماً صحيحة موجبة' 
      });
    }

    const actualLimit = Math.min(limit, 50);

    // جلب جميع التقييمات بما فيها المخفية
    const ratings = await Rating.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(actualLimit)
      .select('description username createdAt isVisible createdBy');

    // إحصائيات شاملة
    const totalRatings = await Rating.countDocuments();
    const visibleRatings = await Rating.countDocuments({ isVisible: true });
    const hiddenRatings = await Rating.countDocuments({ isVisible: false });
    const totalPages = Math.ceil(totalRatings / actualLimit);

    if (page > totalPages && totalPages > 0) {
      return res.status(400).json({ 
        message: `الصفحة ${page} غير موجودة. إجمالي الصفحات: ${totalPages}` 
      });
    }

    res.json({
      ratings,
      pagination: {
        currentPage: page,
        totalPages,
        totalRatings,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        limit: actualLimit
      },
      statistics: {
        totalRatings,
        visibleRatings,
        hiddenRatings
      }
    });
  } catch (error) {
    console.error('Get all ratings error:', error);
    res.status(500).json({ 
      message: 'خطأ في جلب جميع التقييمات', 
      error: error.message 
    });
  }
});

// 🔹 الحصول على تقييم المستخدم الحالي
router.get('/my-rating', auth, async (req, res) => {
  try {
    const rating = await Rating.findOne({ 
      createdBy: req.user.id 
    }).select('description createdAt isVisible'); // جديد

    if (!rating) {
      return res.json({ 
        hasRated: false,
        message: 'لم تقم بالتقييم بعد' 
      });
    }

    res.json({
      hasRated: true,
      rating: {
        id: rating._id,
        description: rating.description,
        isVisible: rating.isVisible, // جديد
        createdAt: rating.createdAt
      }
    });
  } catch (error) {
    console.error('Get my rating error:', error);
    res.status(500).json({ 
      message: 'خطأ في جلب تقييمك', 
      error: error.message 
    });
  }
});

// 🔹 تحديث حالة العرض (إظهار/إخفاء) - للمشرفين
router.patch('/admin/:id/visibility', async (req, res) => {
  try {
    const { id } = req.params;
    const { isVisible } = req.body;

    // التحقق من صحة الـ ID
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: 'معرف التقييم مطلوب' 
      });
    }

    // التحقق من وجود حالة العرض
    if (typeof isVisible !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        message: 'حالة العرض مطلوبة (true/false)' 
      });
    }

    // تحديث حالة العرض
    const updatedRating = await Rating.findByIdAndUpdate(
      id,
      { isVisible },
      { new: true, runValidators: true }
    );

    if (!updatedRating) {
      return res.status(404).json({ 
        success: false,
        message: 'التقييم غير موجود' 
      });
    }

    res.json({
      success: true,
      message: `تم ${isVisible ? 'إظهار' : 'إخفاء'} التقييم بنجاح`,
      rating: {
        id: updatedRating._id,
        description: updatedRating.description,
        username: updatedRating.username,
        isVisible: updatedRating.isVisible,
        createdAt: updatedRating.createdAt
      }
    });

  } catch (error) {
    console.error('Update visibility error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        message: 'معرف التقييم غير صالح' 
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'خطأ في تحديث حالة العرض', 
      error: error.message 
    });
  }
});

// 🔹 تحديث التقييم
router.put('/', auth, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ 
        message: 'وصف التقييم مطلوب' 
      });
    }

    if (description.length < 10) {
      return res.status(400).json({ 
        message: 'الوصف يجب أن يكون至少 10 أحرف' 
      });
    }

    if (description.length > 500) {
      return res.status(400).json({ 
        message: 'الوصف يجب ألا يتجاوز 500 حرف' 
      });
    }

    const updatedRating = await Rating.findOneAndUpdate(
      { createdBy: req.user.id },
      { 
        description: description.trim(),
        username: req.user.username || req.user.name
      },
      { new: true, runValidators: true }
    );

    if (!updatedRating) {
      return res.status(404).json({ 
        message: 'لم تقم بالتقييم مسبقاً' 
      });
    }

    res.json({
      message: 'تم تحديث التقييم بنجاح',
      rating: {
        id: updatedRating._id,
        description: updatedRating.description,
        username: updatedRating.username,
        isVisible: updatedRating.isVisible, // جديد
        createdAt: updatedRating.createdAt
      }
    });
  } catch (error) {
    console.error('Update rating error:', error);
    res.status(500).json({ 
      message: 'خطأ في تحديث التقييم', 
      error: error.message 
    });
  }
});

// 🔹 حذف التقييم
router.delete('/', auth, async (req, res) => {
  try {
    const deletedRating = await Rating.findOneAndDelete({ 
      createdBy: req.user.id 
    });

    if (!deletedRating) {
      return res.status(404).json({ 
        message: 'لم تقم بالتقييم مسبقاً' 
      });
    }

    res.json({
      message: 'تم حذف التقييم بنجاح'
    });
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({ 
      message: 'خطأ في حذف التقييم', 
      error: error.message 
    });
  }
});

// 🔹 روت عام لحذف أي تقييم عبر الـ ID (للمشرفين فقط)
router.delete('/admin/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // التحقق من صحة الـ ID
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: 'معرف التقييم مطلوب' 
      });
    }

    // البحث عن التقييم وحذفه
    const deletedRating = await Rating.findByIdAndDelete(id);

    if (!deletedRating) {
      return res.status(404).json({ 
        success: false,
        message: 'التقييم غير موجود' 
      });
    }

    res.json({
      success: true,
      message: 'تم حذف التقييم بنجاح',
      deletedRating: {
        id: deletedRating._id,
        description: deletedRating.description,
        username: deletedRating.username,
        isVisible: deletedRating.isVisible, // جديد
        createdAt: deletedRating.createdAt
      }
    });

  } catch (error) {
    console.error('Admin delete rating error:', error);
    
    // معالجة الأخطاء المختلفة
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        message: 'معرف التقييم غير صالح' 
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'خطأ في حذف التقييم', 
      error: error.message 
    });
  }
});

module.exports = router;