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
      username: req.user.username || req.user.name
    });

    await newRating.save();

    res.status(201).json({
      message: 'تم إضافة التقييم بنجاح',
      rating: {
        id: newRating._id,
        description: newRating.description,
        username: newRating.username,
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

// 🔹 الحصول على جميع التقييمات مع الباجينيشن
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
    const actualLimit = Math.min(limit, 50); // لا تسمح بأكثر من 50 عنصر في الصفحة

    // جلب التقييمات مع الباجينيشن
    const ratings = await Rating.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(actualLimit)
      .select('description username createdAt');

    // إحصائيات
    const totalRatings = await Rating.countDocuments();
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


// 🔹 الحصول على تقييم المستخدم الحالي
router.get('/my-rating', auth, async (req, res) => {
  try {
    const rating = await Rating.findOne({ 
      createdBy: req.user.id 
    }).select('description createdAt');

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

module.exports = router;