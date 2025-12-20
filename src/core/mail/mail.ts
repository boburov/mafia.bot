import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter;
  private readonly logger = new Logger(MailerService.name);
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendVerificationCodeEmail(
    to: string,
    code: string,
    name: string = 'Foydalanuvchi',
  ) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Email tasdiqlash kodi</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 20px; }
        .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #8b5cf6, #ec4899); padding: 40px 30px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .body { padding: 40px 30px; text-align: center; color: #333; }
        .code-box { 
          background: #f3e8ff; 
          border: 2px dashed #c4b5fd; 
          border-radius: 12px; 
          padding: 20px; 
          margin: 24px 0; 
          font-size: 36px; 
          font-weight: bold; 
          letter-spacing: 8px; 
          color: #6b21a8;
          display: inline-block;
        }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #94a3b8; font-size: 14px; }
        .btn { 
          background: #8b5cf6; 
          color: #fff; 
          padding: 14px 32px; 
          text-decoration: none; 
          border-radius: 50px; 
          display: inline-block; 
          margin: 20px 0; 
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AnimeFx</h1>
        </div>
        <div class="body">
          <h2>Salom, <strong>${name}</strong>! 👋</h2>
          <p>Ro'yxatdan o'tishni yakunlash uchun emailingizni tasdiqlang</p>
          
          <div class="code-box">${code}</div>
          
          <p>Yuqoridagi 6 xonali kodni ilovaga kiriting</p>
          <p><strong>Kod faqat 10 daqiqa amal qiladi ⏰</strong></p>
          
          <a href="${this.frontendUrl}" class="btn">Ilovaga qaytish</a>
        </div>
        <div class="footer">
          <p>Bu xatni siz so'ragansiz. Agar siz emas bo'lsangiz, e'tibor bermang.</p>
          <p>© 2025 AnimeFx. Barcha huquqlar himoyalangan.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    await this.transporter.sendMail({
      from: `"AnimeFx" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: '🔥 Tasdiqlash kodi | AnimeFx',
      html,
    });

    this.logger.log(`Verification CODE sent → ${to} | Code: ${code}`);
  }

  async sendToken(to: string, token: string) {
    const verifyUrl = `${this.frontendUrl}/verify?token=${token}`;

    const html = `
    <!DOCTYPE html>
    <html lang="uz">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Tasdiqlash kodi • AnimeFx</title>
      <style>
        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
          background: #f8fafc; 
          margin: 0; 
          padding: 20px; 
          color: #1e293b;
        }
        .container { 
          max-width: 780px; 
          margin: 40px auto; 
          background: white; 
          border-radius: 20px; 
          overflow: hidden; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.08); 
          border: 1px solid #e2e8f0;
        }
        .header { 
          background: linear-gradient(135deg, #a78bfa, #ec4899); 
          padding: 48px 32px; 
          text-align: center; 
          color: white; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 32px; 
          font-weight: 800; 
          letter-spacing: -0.5px;
        }
        .body { 
          padding: 40px 32px; 
          text-align: center; 
        }
        .greeting { 
          font-size: 20px; 
          margin-bottom: 8px; 
        }
        .code { 
          background: linear-gradient(135deg, #ddd6fe, #fce7f3);
          color: #6b21a8;
          font-size: 12px; 
          font-weight: 800; 
          letter-spacing: 10px; 
          padding: 20px 28px; 
          border-radius: 16px; 
          display: inline-block; 
          margin: 28px 0;
          border: 3px solid #c4b5fd;
          box-shadow: 0 8px 20px rgba(139,92,246,0.15);
        }
      
        .btn:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(139,92,246,0.5); }
        .warning { color: #ef4444; font-weight: 600; }
        .footer { 
          background: #f1f5f9; 
          padding: 28px; 
          text-align: center; 
          color: #64748b; 
          font-size: 14px; 
        }
        .footer a { color: #8b5cf6; text-decoration: none; }

          .btn {
          display: inline-block;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: #fff;
          font-weight: 700;
          font-size: 18px;
          padding: 16px 40px;
          border-radius: 50px;
          text-decoration: none;
          margin: 24px 0;
          box-shadow: 0 10px 25px rgba(139,92,246,0.4);
          transition: all 0.2s;
        }
          
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AnimeFx</h1>
        </div>
        <div class="body">
          <h2 class="greeting">Salom bro! 👋</h2>
          <p>Akkountingizni faollashtirish uchun tasdiqlang:</p>
          
          <div class="code">Tasdiqlash Tugmasini Bosing</div>
          
          <p>yoki bir marta bosish bilan tasdiqlang:</p>
          <a href="${verifyUrl}" class="btn">✅ Tasdiqlash</a>
          
          <p class="warning">⚠️ Kod faqat 10 daqiqa ishlaydi!</p>
        </div>
        <div class="footer">
          <p>Bu xatni siz so'ragansiz. Agar emas bo'lsa — ignore qiling.</p>
          <p>© 2025 <a href="${this.frontendUrl}">AnimeFx</a>. Made with ❤️ in Uzbekistan</p>
        </div>
      </div>
    </body>
    </html>
    `;

    await this.transporter.sendMail({
      from: `"AnimeFx" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: '🔥 Tasdiqlash kodingiz • AnimeFx',
      html,
    });

    this.logger.log(`Verification link sent → ${to} | ${verifyUrl}`);
  }

  async sendPasswordResetCodeEmail(to: string, code: string) {
    const html = `
    <!DOCTYPE html>
    <html>
    <!-- shu yerda yuqoridagi dizaynni ozgina o'zgartirib qo'yamiz -->
    <body>
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #ef4444, #f97316);">
          <h1>Parolni tiklash</h1>
        </div>
        <div class="body">
          <h2>Yangi parol o'rnatish</h2>
          <p>Parolingizni tiklash uchun quyidagi kodni kiriting:</p>
          <div class="code-box" style="background:#fee2e2; border-color:#fca5a5; color:#dc2626;">
            ${code}
          </div>
          <p><strong>10 daqiqa ichida ishlatishingiz kerak</strong></p>
        </div>
        <div class="footer">
          <p>Agar siz so'ramagan bo'lsangiz, bu xatni o'chirib tashlang.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    await this.transporter.sendMail({
      from: `"SAVOLCHI" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: '🔴 Parolni tiklash kodi',
      html,
    });
  }
}
