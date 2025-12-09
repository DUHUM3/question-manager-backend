const nodemailer = require('nodemailer');

// 🚀 إنشاء ناقل بريد يعمل 100% مع Gmail + App Password
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // مهم جداً
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// قالب HTML أنيق لإعادة تعيين كلمة المرور
const getResetPasswordTemplate = (link, adminName) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>إعادة تعيين كلمة المرور</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Cairo', sans-serif; background:#f8f9fa; margin:0; padding:20px; }
        .email-container { max-width:600px; margin:0 auto; background:white; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.1); }
        .header { background:linear-gradient(135deg,#320A6B,#4a1a8c); padding:40px; color:white; text-align:center; }
        .content { padding:40px; }
        .reset-button {
            display:inline-block; background:linear-gradient(135deg,#320A6B,#4a1a8c);
            color:white; padding:16px 40px; border-radius:12px; text-decoration:none;
            font-size:16px; font-weight:600; margin:25px 0; box-shadow:0 4px 15px rgba(50,10,107,0.2);
        }
        .link-container { background:#f8f9fa; padding:20px; border-radius:10px; margin:20px 0; border-right:4px solid #320A6B; }
        .link-text { font-size:14px; word-break:break-all; font-family:monospace; }
        .footer { padding:30px; text-align:center; background:#fafafa; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h2>إعادة تعيين كلمة المرور</h2>
            <p>أمن حسابك يهمنا</p>
        </div>
        <div class="content">
            <p style="font-size:18px; font-weight:600; color:#320A6B;">
                مرحباً ${adminName || 'عزيزي المسؤول'},
            </p>
            <p style="color:#555;">
                لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.
            </p>

            <div style="text-align:center;">
                <a href="${link}" class="reset-button" target="_blank">إعادة تعيين كلمة المرور</a>
            </div>

            <div class="link-container">
                <p style="color:#320A6B; font-weight:600;">أو انسخ الرابط التالي:</p>
                <p class="link-text">${link}</p>
            </div>

            <p style="color:#777;">⚠️ هذا الرابط صالح لمدة 30 دقيقة فقط.</p>
        </div>

        <div class="footer">
            <p>© ${new Date().getFullYear()} منصة نافس برو</p>
            <p>بريد مرسل تلقائياً — لا ترد عليه</p>
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
        name: 'منصة نافش برو',
        address: process.env.EMAIL_USER
      },
      to,
      subject: '🔐 إعادة تعيين كلمة المرور - منصة نافس برو',
      html: getResetPasswordTemplate(link, adminName),
      text: `
        إعادة تعيين كلمة المرور
        
        مرحباً ${adminName || 'عزيزي المسؤول'},
        الرابط: ${link}
        صالح لمدة 30 دقيقة فقط.
      `
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("تم إرسال بريد إعادة التعيين:", info.messageId);

    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error("خطأ إرسال البريد:", error.message);
    throw new Error("فشل في إرسال البريد: " + error.message);
  }
}

// دالة إرسال بريد نجاح إعادة التعيين
async function sendPasswordResetSuccessEmail(to, adminName = null) {
  try {
    const mailOptions = {
      from: {
        name: 'منصة نافس برو',
        address: process.env.EMAIL_USER
      },
      to,
      subject: '✅ تم تغيير كلمة المرور بنجاح',
      text: `تم تغيير كلمة المرور لحسابك بتاريخ ${new Date().toLocaleString('ar-SA')}`
    };

    const info = await transporter.sendMail(mailOptions);

    return { success: true };

  } catch (error) {
    console.error("خطأ إرسال بريد النجاح:", error.message);
    throw error;
  }
}

module.exports = {
  transporter,
  sendResetEmail,
  sendPasswordResetSuccessEmail,
  getResetPasswordTemplate
};
