const express = require('express');
const router = express.Router();
const Statistics = require('../models/Statistics');
const {adminAuth} = require('../middleware/auth');

// 🔹 الحصول على الإحصائيات النشطة
router.get('/', async (req, res) => {
  try {
    const statistics = await Statistics.findOne({ isActive: true })
      .populate('createdBy', 'name username')
      .select('-__v');

    if (!statistics) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد إحصائيات متاحة'
      });
    }

    res.json({
      success: true,
      statistics: {
        id: statistics._id,
        activeStudents: statistics.activeStudents,
        weeklyReviews: statistics.weeklyReviews,
        satisfactionRate: statistics.satisfactionRate,
        supportAvailability: statistics.supportAvailability,
        labels: statistics.labels,
        createdAt: statistics.createdAt,
        updatedAt: statistics.updatedAt
      }
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإحصائيات'
    });
  }
});

// 🔹 إنشاء إحصائيات جديدة 
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      activeStudents,
      weeklyReviews,
      satisfactionRate,
      supportAvailability,
      labels
    } = req.body;

    // التحقق من البيانات المطلوبة
    if (!activeStudents || !weeklyReviews || !satisfactionRate || !supportAvailability) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    // تعطيل الإحصائيات القديمة
    await Statistics.updateMany(
      { isActive: true },
      { isActive: false }
    );

    // إنشاء إحصائيات جديدة
    const newStatistics = new Statistics({
      activeStudents: activeStudents.trim(),
      weeklyReviews: weeklyReviews.trim(),
      satisfactionRate: satisfactionRate.trim(),
      supportAvailability: supportAvailability.trim(),
      labels: labels || {},
      createdBy: req.user.id,
      isActive: true
    });

    await newStatistics.save();

    res.status(201).json({
      success: true,
      message: 'تم إضافة الإحصائيات بنجاح',
      statistics: {
        id: newStatistics._id,
        activeStudents: newStatistics.activeStudents,
        weeklyReviews: newStatistics.weeklyReviews,
        satisfactionRate: newStatistics.satisfactionRate,
        supportAvailability: newStatistics.supportAvailability,
        labels: newStatistics.labels,
        createdAt: newStatistics.createdAt
      }
    });

  } catch (error) {
    console.error('Create statistics error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'يوجد إحصائيات نشطة بالفعل'
      });
    }

    res.status(500).json({
      success: false,
      message: 'خطأ في إضافة الإحصائيات'
    });
  }
});

// 🔹 تحديث الإحصائيات (للمستخدمين المسجلين)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      activeStudents,
      weeklyReviews,
      satisfactionRate,
      supportAvailability,
      labels
    } = req.body;

    const statistics = await Statistics.findById(id);

    if (!statistics) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على الإحصائيات'
      });
    }

    // التحقق من أن المستخدم هو من أنشأ الإحصائيات
    if (statistics.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل هذه الإحصائيات'
      });
    }

    // تحديث البيانات
    const updateData = {};
    if (activeStudents) updateData.activeStudents = activeStudents.trim();
    if (weeklyReviews) updateData.weeklyReviews = weeklyReviews.trim();
    if (satisfactionRate) updateData.satisfactionRate = satisfactionRate.trim();
    if (supportAvailability) updateData.supportAvailability = supportAvailability.trim();
    if (labels) updateData.labels = { ...statistics.labels, ...labels };

    const updatedStatistics = await Statistics.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'تم تحديث الإحصائيات بنجاح',
      statistics: {
        id: updatedStatistics._id,
        activeStudents: updatedStatistics.activeStudents,
        weeklyReviews: updatedStatistics.weeklyReviews,
        satisfactionRate: updatedStatistics.satisfactionRate,
        supportAvailability: updatedStatistics.supportAvailability,
        labels: updatedStatistics.labels,
        updatedAt: updatedStatistics.updatedAt
      }
    });

  } catch (error) {
    console.error('Update statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث الإحصائيات'
    });
  }
});

// 🔹 الحصول على جميع الإحصائيات (للمسؤولين)
router.get('/all', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const statistics = await Statistics.find()
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const totalStatistics = await Statistics.countDocuments();

    res.json({
      success: true,
      statistics: statistics.map(stat => ({
        id: stat._id,
        activeStudents: stat.activeStudents,
        weeklyReviews: stat.weeklyReviews,
        satisfactionRate: stat.satisfactionRate,
        supportAvailability: stat.supportAvailability,
        labels: stat.labels,
        isActive: stat.isActive,
        createdBy: stat.createdBy,
        createdAt: stat.createdAt,
        updatedAt: stat.updatedAt
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalStatistics / limit),
        totalStatistics,
        hasNextPage: page < Math.ceil(totalStatistics / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get all statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإحصائيات'
    });
  }
});

// 🔹 تفعيل/تعطيل الإحصائيات (للمسؤولين)
router.patch('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const statistics = await Statistics.findById(id);

    if (!statistics) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على الإحصائيات'
      });
    }

    if (statistics.isActive) {
      // تعطيل الإحصائيات
      statistics.isActive = false;
      await statistics.save();
      
      res.json({
        success: true,
        message: 'تم تعطيل الإحصائيات بنجاح'
      });
    } else {
      // تفعيل الإحصائيات وتعطيل الآخرين
      await Statistics.updateMany(
        { isActive: true },
        { isActive: false }
      );
      
      statistics.isActive = true;
      await statistics.save();
      
      res.json({
        success: true,
        message: 'تم تفعيل الإحصائيات بنجاح'
      });
    }

  } catch (error) {
    console.error('Toggle statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تغيير حالة الإحصائيات'
    });
  }
});

module.exports = router;