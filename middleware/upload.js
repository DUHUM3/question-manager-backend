// middleware/upload.js - نسخة مبسطة مع fetch مباشر
const multer = require('multer');

// إعداد multer للصور المؤقتة
const storage = multer.memoryStorage(); // تخزين الصور في الذاكرة مؤقتًا

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('فقط الصور مسموح بها'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB كحد أقصى
  }
});

// دالة لرفع الملف إلى Uploadcare
async function uploadToUploadcare(fileBuffer, fileName, mimeType) {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, fileName);
  formData.append('UPLOADCARE_PUB_KEY', '3c2a7fea89e6f9c2d940');
  formData.append('UPLOADCARE_STORE', '1');

  try {
    const response = await fetch('https://upload.uploadcare.com/base/', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      file: data.file,
      url: `https://ucarecdn.com/${data.file}/`,
      cdnUrl: `https://ucarecdn.com/${data.file}/`
    };
  } catch (error) {
    console.error('Upload to Uploadcare failed:', error);
    throw error;
  }
}

// Middleware لرفع أي عدد من الصور
const uploadAnyImages = (req, res, next) => {
  const uploadMiddleware = upload.any();
  
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: 'خطأ في رفع الملفات',
        error: err.message
      });
    }

    try {
      // إذا كانت هناك ملفات مرفوعة، قم برفعها إلى Uploadcare
      if (req.files && req.files.length > 0) {
        const uploadedFiles = [];

        // رفع كل صورة إلى Uploadcare
        for (const file of req.files) {
          try {
            // رفع الملف إلى Uploadcare
            const result = await uploadToUploadcare(
              file.buffer,
              file.originalname,
              file.mimetype
            );

            // حفظ معلومات الملف
            uploadedFiles.push({
              fieldname: file.fieldname,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              path: result.cdnUrl, // استخدام رابط Uploadcare بدلاً من المسار المحلي
              filename: result.file,
              cdnUrl: result.cdnUrl
            });

          } catch (uploadError) {
            console.error('Uploadcare error:', uploadError);
            return res.status(500).json({
              success: false,
              message: 'فشل في رفع الصور إلى Uploadcare',
              error: uploadError.message
            });
          }
        }

        // استبدال req.files بالروابط من Uploadcare
        req.files = uploadedFiles;
      }

      next();
    } catch (error) {
      console.error('Error in upload middleware:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في معالجة الملفات',
        error: error.message
      });
    }
  });
};

module.exports = {
  uploadAnyImages
};