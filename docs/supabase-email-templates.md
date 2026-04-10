# TraderCafé Supabase Email Templates

Copy these HTML templates into your Supabase Dashboard:
**Authentication > Email Templates**

---

## 1. Confirm Sign Up

**Subject:** Confirm your TraderCafé account ☕

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f1117; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(15, 17, 23, 0.95) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 16px; padding: 40px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-size: 48px;">☕</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <h1 style="margin: 0; color: #22c55e; font-size: 28px; font-weight: 700;">TraderCafé</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h2 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">Welcome to the Trading Community!</h2>
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 15px; line-height: 1.7; padding-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Hello trader,</p>
              <p style="margin: 0 0 16px 0;">Thank you for joining TraderCafé! You're just one step away from tracking your trades, analyzing your performance, and achieving your trading goals.</p>
              <p style="margin: 0;">Please confirm your email address to activate your account and start your trading journal journey.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">Confirm My Email</a>
            </td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 13px; line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 8px 0;">If you didn't create an account with TraderCafé, you can safely ignore this email.</p>
              <p style="margin: 0;">This link will expire in 24 hours for your security.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; color: #52525b; font-size: 12px;">© 2024 TraderCafé. All rights reserved.</p>
              <p style="margin: 8px 0 0 0; color: #52525b; font-size: 12px;">Your trading journal companion ☕</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Invite User

**Subject:** You've been invited to TraderCafé ☕

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f1117; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(15, 17, 23, 0.95) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 16px; padding: 40px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-size: 48px;">☕</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <h1 style="margin: 0; color: #22c55e; font-size: 28px; font-weight: 700;">TraderCafé</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h2 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">You're Invited!</h2>
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 15px; line-height: 1.7; padding-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Hello,</p>
              <p style="margin: 0 0 16px 0;">Great news! You've been invited to join TraderCafé, the ultimate trading journal platform for serious traders.</p>
              <p style="margin: 0 0 16px 0;">With TraderCafé, you'll be able to:</p>
              <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #a1a1aa;">
                <li style="margin-bottom: 8px;">📊 Track and journal all your trades</li>
                <li style="margin-bottom: 8px;">📈 Analyze your trading performance</li>
                <li style="margin-bottom: 8px;">🎯 Set and achieve weekly goals</li>
                <li style="margin-bottom: 8px;">🔔 Get reminders and alerts</li>
              </ul>
              <p style="margin: 0;">Click below to accept your invitation and create your account.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">Accept Invitation</a>
            </td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 13px; line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 8px 0;">If you weren't expecting this invitation, you can safely ignore this email.</p>
              <p style="margin: 0;">This invitation link will expire in 7 days.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; color: #52525b; font-size: 12px;">© 2024 TraderCafé. All rights reserved.</p>
              <p style="margin: 8px 0 0 0; color: #52525b; font-size: 12px;">Your trading journal companion ☕</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Magic Link

**Subject:** Your TraderCafé login link ☕

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f1117; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(15, 17, 23, 0.95) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 16px; padding: 40px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-size: 48px;">☕</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <h1 style="margin: 0; color: #22c55e; font-size: 28px; font-weight: 700;">TraderCafé</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h2 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">Your Magic Login Link</h2>
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 15px; line-height: 1.7; padding-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Hello trader,</p>
              <p style="margin: 0 0 16px 0;">You requested a magic link to sign in to your TraderCafé account. No password needed – just click the button below to securely access your trading journal.</p>
              <p style="margin: 0;">This is a one-time use link that will log you in instantly.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">Sign In to TraderCafé</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 16px 0; background-color: rgba(34, 197, 94, 0.1); border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 0; color: #71717a; font-size: 13px;">Or use this one-time code:</p>
              <p style="margin: 8px 0 0 0; color: #22c55e; font-size: 24px; font-weight: 700; letter-spacing: 4px;">{{ .Token }}</p>
            </td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 13px; line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 8px 0;">⚠️ <strong style="color: #fbbf24;">Security Notice:</strong> If you didn't request this login link, please ignore this email. Someone may have entered your email by mistake.</p>
              <p style="margin: 0;">This link expires in 1 hour for your security.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; color: #52525b; font-size: 12px;">© 2024 TraderCafé. All rights reserved.</p>
              <p style="margin: 8px 0 0 0; color: #52525b; font-size: 12px;">Your trading journal companion ☕</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Change Email Address

**Subject:** Confirm your new email address - TraderCafé ☕

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f1117; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(15, 17, 23, 0.95) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 16px; padding: 40px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-size: 48px;">☕</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <h1 style="margin: 0; color: #22c55e; font-size: 28px; font-weight: 700;">TraderCafé</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h2 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">Confirm Your New Email</h2>
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 15px; line-height: 1.7; padding-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Hello trader,</p>
              <p style="margin: 0 0 16px 0;">You've requested to change the email address associated with your TraderCafé account. To complete this change and secure your account, please confirm your new email address.</p>
              <p style="margin: 0 0 16px 0;">Your new email will be: <strong style="color: #22c55e;">{{ .Email }}</strong></p>
              <p style="margin: 0;">Click the button below to verify this email address belongs to you.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">Confirm New Email</a>
            </td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 13px; line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 8px 0;">⚠️ <strong style="color: #fbbf24;">Didn't request this?</strong> If you didn't request an email change, your account may be compromised. Please contact our support immediately and change your password.</p>
              <p style="margin: 0;">This confirmation link expires in 24 hours.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; color: #52525b; font-size: 12px;">© 2024 TraderCafé. All rights reserved.</p>
              <p style="margin: 8px 0 0 0; color: #52525b; font-size: 12px;">Your trading journal companion ☕</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 5. Reset Password

**Subject:** Reset your TraderCafé password ☕

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f1117; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(15, 17, 23, 0.95) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 16px; padding: 40px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-size: 48px;">☕</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <h1 style="margin: 0; color: #22c55e; font-size: 28px; font-weight: 700;">TraderCafé</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h2 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">Reset Your Password</h2>
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 15px; line-height: 1.7; padding-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Hello trader,</p>
              <p style="margin: 0 0 16px 0;">We received a request to reset the password for your TraderCafé account. No worries – it happens to the best of us!</p>
              <p style="margin: 0 0 16px 0;">Click the button below to create a new password. For your security, this link will only work once and expires shortly.</p>
              <p style="margin: 0;">After resetting, you'll be able to log back in and access your trading journal.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">Reset My Password</a>
            </td>
          </tr>
          <tr>
            <td style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 16px; margin-top: 16px;">
              <p style="margin: 0; color: #fca5a5; font-size: 13px; line-height: 1.6;">
                <strong>🔒 Security Tips:</strong><br>
                • Choose a strong, unique password<br>
                • Don't reuse passwords from other sites<br>
                • Consider enabling two-factor authentication
              </p>
            </td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 13px; line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 8px 0;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
              <p style="margin: 0;">This reset link expires in 1 hour for your security.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; color: #52525b; font-size: 12px;">© 2024 TraderCafé. All rights reserved.</p>
              <p style="margin: 8px 0 0 0; color: #52525b; font-size: 12px;">Your trading journal companion ☕</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 6. Reauthentication

**Subject:** Verify it's you - TraderCafé ☕

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f1117; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(15, 17, 23, 0.95) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 16px; padding: 40px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-size: 48px;">☕</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <h1 style="margin: 0; color: #22c55e; font-size: 28px; font-weight: 700;">TraderCafé</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h2 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">Verify Your Identity</h2>
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 15px; line-height: 1.7; padding-bottom: 24px;">
              <p style="margin: 0 0 16px 0;">Hello trader,</p>
              <p style="margin: 0 0 16px 0;">You're attempting to perform a sensitive action on your TraderCafé account. For your security, we need to verify that it's really you.</p>
              <p style="margin: 0 0 16px 0;">This extra step helps protect your trading data and account settings from unauthorized access.</p>
              <p style="margin: 0;">Click the button below to confirm your identity and proceed.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">Verify It's Me</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 16px 0; background-color: rgba(34, 197, 94, 0.1); border-radius: 8px; margin-bottom: 16px;">
              <p style="margin: 0; color: #71717a; font-size: 13px;">Or enter this verification code:</p>
              <p style="margin: 8px 0 0 0; color: #22c55e; font-size: 24px; font-weight: 700; letter-spacing: 4px;">{{ .Token }}</p>
            </td>
          </tr>
          <tr>
            <td style="color: #71717a; font-size: 13px; line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 8px 0;">⚠️ <strong style="color: #fbbf24;">Wasn't you?</strong> If you didn't try to perform this action, please change your password immediately and contact our support team.</p>
              <p style="margin: 0;">This verification link expires in 10 minutes for your security.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; color: #52525b; font-size: 12px;">© 2024 TraderCafé. All rights reserved.</p>
              <p style="margin: 8px 0 0 0; color: #52525b; font-size: 12px;">Your trading journal companion ☕</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## How to Apply These Templates

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Click on each template type
4. Replace the **Subject** line
5. Paste the HTML in the **Body** section
6. Click **Save**

All templates use:
- Dark background (#0f1117)
- Green accent (#22c55e) 
- TraderCafé branding with coffee ☕ theme
- Responsive design for mobile
- Security notices and expiration warnings
