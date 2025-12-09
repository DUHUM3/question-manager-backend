const nodemailer = require('nodemailer');

// إنشاء الناقل مع إعدادات متطورة
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000, // 10 ثواني
  greetingTimeout: 10000,
  socketTimeout: 10000
});

// قالب HTML أنيق لإعادة تعيين كلمة المرور
const getResetPasswordTemplate = (link, adminName) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعادة تعيين كلمة المرور</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Cairo', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
            direction: rtl;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            border: 1px solid #eaeaea;
        }
        
        .header {
            background: linear-gradient(135deg, #320A6B 0%, #4a1a8c 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        
        .logo {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .logo-icon {
            font-size: 32px;
        }
        
        .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 18px;
            color: #320A6B;
            margin-bottom: 25px;
            font-weight: 600;
        }
        
        .message {
            font-size: 16px;
            color: #555;
            margin-bottom: 30px;
            line-height: 1.8;
        }
        
        .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #320A6B 0%, #4a1a8c 100%);
            color: white;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            transition: all 0.3s ease;
            margin: 25px 0;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(50, 10, 107, 0.2);
        }
        
        .reset-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(50, 10, 107, 0.3);
            background: linear-gradient(135deg, #4a1a8c 0%, #5a2a9c 100%);
        }
        
        .link-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 25px 0;
            border-right: 4px solid #320A6B;
        }
        
        .link-text {
            font-size: 14px;
            color: #666;
            word-break: break-all;
            font-family: monospace;
        }
        
        .instructions {
            background: #fff9e6;
            padding: 20px;
            border-radius: 10px;
            margin: 25px 0;
            border-right: 4px solid #ffc107;
        }
        
        .instructions h3 {
            color: #e6a700;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .instructions ul {
            padding-right: 20px;
        }
        
        .instructions li {
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .info-box {
            background: #e8f4ff;
            padding: 20px;
            border-radius: 10px;
            margin: 25px 0;
            border-right: 4px solid #007bff;
        }
        
        .info-box h3 {
            color: #007bff;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #eaeaea;
        }
        
        .footer p {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .contact-info {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .contact-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #666;
            font-size: 14px;
        }
        
        .contact-icon {
            color: #320A6B;
        }
        
        .social-links {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
        }
        
        .social-icon {
            width: 36px;
            height: 36px;
            background: #320A6B;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            transition: all 0.3s ease;
        }
        
        .social-icon:hover {
            background: #4a1a8c;
            transform: translateY(-2px);
        }
        
        @media (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            
            .header {
                padding: 30px 20px;
            }
            
            .reset-button {
                padding: 14px 30px;
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- رأس البريد -->
        <div class="header">
            <div class="logo">
                <span class="logo-icon">🔐</span>
                <span>منصة إدارة الاختبارات</span>
            </div>
            <h1>إعادة تعيين كلمة المرور</h1>
            <p>أمن وحماية حسابك أولويتنا</p>
        </div>
        
        <!-- محتوى البريد -->
        <div class="content">
            <div class="greeting">
                مرحباً ${adminName || 'عزيزي المسؤول'},
            </div>
            
            <div class="message">
                <p>لقد تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في منصة إدارة الاختبارات.</p>
                <p>لإتمام عملية إعادة التعيين، يرجى النقر على الزر أدناه:</p>
            </div>
            
            <!-- زر إعادة التعيين -->
            <div style="text-align: center;">
                <a href="${link}" class="reset-button" target="_blank">
                    إعادة تعيين كلمة المرور
                </a>
            </div>
            
            <!-- الرابط النصي -->
            <div class="link-container">
                <p style="margin-bottom: 10px; font-weight: 600; color: #320A6B;">أو يمكنك نسخ الرابط التالي:</p>
                <p class="link-text">${link}</p>
            </div>
            
            <!-- التعليمات -->
            <div class="instructions">
                <h3>⚠️ ملاحظات هامة:</h3>
                <ul>
                    <li>هذا الرابط صالح لمدة <strong>30 دقيقة</strong> فقط</li>
                    <li>لا تشارك هذا الرابط مع أي شخص</li>
                    <li>إذا لم تطلب إعادة التعيين، تجاهل هذا البريد</li>
                    <li>لضمان الأمان، استخدم كلمة مرور قوية تحتوي على أحرف وأرقام ورموز</li>
                </ul>
            </div>
            
            <!-- معلومات إضافية -->
            <div class="info-box">
                <h3>💡 نصائح أمنية:</h3>
                <ul>
                    <li>استخدم كلمة مرور مختلفة لكل حساب</li>
                    <li>تجنب استخدام المعلومات الشخصية في كلمة المرور</li>
                    <li>قم بتغيير كلمة المرور بشكل دوري</li>
                    <li>تفعيل المصادقة الثنائية إن أمكن</li>
                </ul>
            </div>
            
            <div class="message" style="text-align: center; font-style: italic; color: #666;">
                <p>شكراً لاستخدامك منصة إدارة الاختبارات</p>
                <p style="font-size: 14px; margin-top: 10px;">فريق الدعم الفني</p>
            </div>
        </div>
        
        <!-- تذييل البريد -->
        <div class="footer">
            <p>© ${new Date().getFullYear()} منصة إدارة الاختبارات. جميع الحقوق محفوظة.</p>
            <p>هذا البريد إلكتروني تم إرساله تلقائياً، يرجى عدم الرد عليه.</p>
            
            <div class="contact-info">
                <div class="contact-item">
                    <span class="contact-icon">📧</span>
                    <span>support@testmanager.com</span>
                </div>
                <div class="contact-item">
                    <span class="contact-icon">📞</span>
                    <span>+966 11 123 4567</span>
                </div>
                <div class="contact-item">
                    <span class="contact-icon">🌐</span>
                    <span>www.testmanager.com</span>
                </div>
            </div>
            
            <div class="social-links">
                <a href="#" class="social-icon">📘</a>
                <a href="#" class="social-icon">🐦</a>
                <a href="#" class="social-icon">📷</a>
                <a href="#" class="social-icon">🎬</a>
            </div>
        </div>
    </div>
</body>
</html>
`;

// دالة إرسال بريد إعادة التعيين
async function sendResetEmail(to, link, adminName = null) {
  try {
    const mailOptions = {
      from: {
        name: 'منصة إدارة الاختبارات',
        address: process.env.EMAIL_USER
      },
      to,
      subject: '🔐 إعادة تعيين كلمة المرور - منصة إدارة الاختبارات',
      html: getResetPasswordTemplate(link, adminName),
      // إضافة نص عادي للبريد الذي لا يدعم HTML
      text: `
        إعادة تعيين كلمة المرور
        
        مرحباً ${adminName || 'عزيزي المسؤول'},
        
        لقد تلقينا طلباً لإعادة تعيين كلمة مرور حسابك.
        
        الرابط: ${link}
        
        هذا الرابط صالح لمدة 30 دقيقة فقط.
        
        إذا لم تطلب إعادة التعيين، يرجى تجاهل هذا البريد.
        
        مع أطيب التحيات،
        فريق منصة إدارة الاختبارات
      `
    };

    // إرسال البريد
    const info = await transporter.sendMail(mailOptions);
    
    console.log('تم إرسال بريد إعادة التعيين بنجاح:', {
      to,
      messageId: info.messageId,
      timestamp: new Date().toLocaleString('ar-SA')
    });
    
    return {
      success: true,
      messageId: info.messageId
    };
    
  } catch (error) {
    console.error('خطأ في إرسال بريد إعادة التعيين:', {
      to,
      error: error.message,
      timestamp: new Date().toLocaleString('ar-SA')
    });
    
    throw new Error(`فشل في إرسال البريد: ${error.message}`);
  }
}

// دالة إرسال بريد تأكيد نجاح إعادة التعيين
async function sendPasswordResetSuccessEmail(to, adminName = null) {
  try {
    const mailOptions = {
      from: {
        name: 'منصة إدارة الاختبارات',
        address: process.env.EMAIL_USER
      },
      to,
      subject: '✅ تم تغيير كلمة المرور بنجاح - منصة إدارة الاختبارات',
      html: `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>تم تغيير كلمة المرور</title>
            <style>
                body {
                    font-family: 'Cairo', sans-serif;
                    direction: rtl;
                    background: #f8f9fa;
                    padding: 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 15px;
                    padding: 40px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    text-align: center;
                }
                .success-icon {
                    font-size: 60px;
                    color: #28a745;
                    margin-bottom: 20px;
                }
                h1 {
                    color: #28a745;
                    margin-bottom: 20px;
                }
                .message {
                    color: #666;
                    line-height: 1.8;
                    margin-bottom: 30px;
                }
                .info-box {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                    border-right: 4px solid #28a745;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✅</div>
                <h1>تم تغيير كلمة المرور بنجاح</h1>
                <div class="message">
                    <p>مرحباً ${adminName || 'عزيزي المسؤول'},</p>
                    <p>تم تغيير كلمة مرور حسابك في منصة إدارة الاختبارات بنجاح.</p>
                    <p>يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.</p>
                </div>
                <div class="info-box">
                    <p>📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}</p>
                    <p>⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}</p>
                </div>
                <p style="color: #666; margin-top: 30px;">
                    إذا لم تقم بإجراء هذا التغيير، يرجى التواصل مع الدعم الفني فوراً.
                </p>
            </div>
        </body>
        </html>
      `,
      text: `
        تم تغيير كلمة المرور بنجاح
        
        مرحباً ${adminName || 'عزيزي المسؤول'},
        
        تم تغيير كلمة مرور حسابك في منصة إدارة الاختبارات بنجاح.
        
        التاريخ: ${new Date().toLocaleDateString('ar-SA')}
        الوقت: ${new Date().toLocaleTimeString('ar-SA')}
        
        إذا لم تقم بإجراء هذا التغيير، يرجى التواصل مع الدعم الفني فوراً.
        
        مع أطيب التحيات،
        فريق منصة إدارة الاختبارات
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('تم إرسال بريد تأكيد تغيير كلمة المرور:', {
      to,
      messageId: info.messageId
    });
    
    return {
      success: true,
      messageId: info.messageId
    };
    
  } catch (error) {
    console.error('خطأ في إرسال بريد التأكيد:', error);
    throw error;
  }
}

module.exports = { 
  transporter,
  sendResetEmail,
  sendPasswordResetSuccessEmail,
  getResetPasswordTemplate
};