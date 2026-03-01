# Together Watch (Mobile)

تطبيق مشاهدة جماعية للهاتف، مبني بـ HTML/CSS/JS ومربوط بـ Firebase.

## الميزات المنفذة

- تسجيل دخول مبدئي بالاسم + صورة بروفايل.
- إنشاء غرفة مع رفع فيديو أولي وإظهار خط تحميل واضح.
- الانضمام للغرف المفتوحة مع عرض اسم الغرفة وعدد المتصلين وبيانات المدير.
- مشغل فيديو مخصص داخل الموقع (بدون أدوات المتصفح الافتراضية).
- تحكم الفيديو للمدير فقط (تشغيل/إيقاف/تقديم/ترجيع/شريط زمني).
- المشاهدون يمكنهم تكبير العرض فقط.
- مزامنة تشغيل الفيديو لكل الموجودين في الغرفة.
- دردشة أسفل الفيديو أثناء المشاهدة.
- قائمة جانبية (ثلاث نقاط) فيها:
  - نسخ رابط الغرفة بصيغة: `https://arbtha.github.io/together/?room=<roomId>`
  - رفع فيديوهات متعددة بالتدريج مع شريط تحميل لكل فيديو.
  - قائمة الفيديوهات المرفوعة وزر "عرض" مع تأكيد قبل التبديل.
- عند الضغط على صورة الحساب:
  - تعديل الاسم
  - تغيير الصورة
  - تسجيل الخروج
- عند خروج المدير يتم نقل الإدارة تلقائياً للمستخدم التالي المتصل.
- إمكانية تعيين مدير يدويًا من قائمة المشاهدين.

## ملفات المشروع

- `index.html`
- `styles.css`
- `app.js`

## إعداد Firebase المطلوب

1. فعّل **Anonymous Authentication** من Firebase Console.
2. أنشئ **Cloud Firestore** (Production أو Test حسب رغبتك).
3. فعّل **Firebase Storage**.
4. تأكد أن دومين GitHub Pages مضاف في Authorized domains (إن لزم).

## قواعد Firestore (بسيطة للتشغيل)

> ملاحظة: هذه القواعد مناسبة كبداية/تجربة. للأمان الإنتاجي، يفضل تضييقها حسب منطق التطبيق.

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;

      match /participants/{participantId} {
        allow read, write: if request.auth != null;
      }

      match /chat/{chatId} {
        allow read, write: if request.auth != null;
      }

      match /videos/{videoId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

## قواعد Storage (بسيطة للتشغيل)

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /rooms/{roomId}/videos/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## التشغيل المحلي

يمكنك تشغيله بأي سيرفر ملفات ثابتة، مثال:

```bash
npx serve .
```

ثم افتح الرابط المحلي في المتصفح.

## النشر على GitHub Pages

ارفع نفس الملفات إلى مستودع `arbtha.github.io/together` (أو فرع Pages) وتأكد أن `index.html` في الجذر.

