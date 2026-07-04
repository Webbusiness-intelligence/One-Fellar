# Genalot — Supabase Auth email templates

Clean, light, professional (Stripe/Postmark style). Paste each block into
**Supabase Dashboard → Authentication → Email Templates**, into the matching template's
**Message body (HTML)**. Table-based + inline styles = renders consistently in Gmail,
Outlook, Apple Mail. Logo is served from `https://genalot.com/email-logo.png`.

Subjects (set the **Subject** field too):
- Confirm signup → `Confirm your Genalot account`
- Reset password → `Reset your Genalot password`
- Magic link → `Your Genalot sign-in link`
- Change email → `Confirm your new email`

---

## 1. Confirm signup

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;margin:0;padding:40px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #eaeaea;border-radius:16px;">
      <tr><td style="padding:36px 40px 0;">
        <img src="https://genalot.com/email-logo.png" width="40" height="40" alt="Genalot" style="display:block;border-radius:10px;">
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <h1 style="margin:0;font-size:22px;font-weight:600;color:#0a0a0c;letter-spacing:-0.01em;">Confirm your email</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#5c5c62;">Welcome to Genalot. Confirm your email address to activate your account and start creating.</p>
      </td></tr>
      <tr><td style="padding:28px 40px 0;">
        <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/ad-studio" style="display:inline-block;background:#f5e31d;color:#0a0a0c;font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:12px;">Confirm email</a>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#9a9aa0;">Or paste this link into your browser:<br><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/ad-studio" style="color:#8a8a90;word-break:break-all;">{{ .SiteURL }}/auth/confirm</a></p>
      </td></tr>
      <tr><td style="padding:24px 40px 36px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#b0b0b6;border-top:1px solid #f0f0ee;padding-top:20px;">If you didn't create a Genalot account, you can safely ignore this email.</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#b8b8be;">Genalot — AI creation suite &nbsp;·&nbsp; &copy; 2026 Genalot</p>
  </td></tr>
</table>
```

---

## 2. Reset password

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;margin:0;padding:40px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #eaeaea;border-radius:16px;">
      <tr><td style="padding:36px 40px 0;">
        <img src="https://genalot.com/email-logo.png" width="40" height="40" alt="Genalot" style="display:block;border-radius:10px;">
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <h1 style="margin:0;font-size:22px;font-weight:600;color:#0a0a0c;letter-spacing:-0.01em;">Reset your password</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#5c5c62;">We got a request to reset your Genalot password. Choose a new one below.</p>
      </td></tr>
      <tr><td style="padding:28px 40px 0;">
        <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" style="display:inline-block;background:#f5e31d;color:#0a0a0c;font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:12px;">Reset password</a>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#9a9aa0;">Or paste this link into your browser:<br><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" style="color:#8a8a90;word-break:break-all;">{{ .SiteURL }}/auth/confirm</a></p>
      </td></tr>
      <tr><td style="padding:24px 40px 36px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#b0b0b6;border-top:1px solid #f0f0ee;padding-top:20px;">This link expires in 1 hour. If you didn't request a reset, you can ignore this email — your password stays the same.</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#b8b8be;">Genalot — AI creation suite &nbsp;·&nbsp; &copy; 2026 Genalot</p>
  </td></tr>
</table>
```

---

## 3. Magic Link (only if you enable magic-link login later)

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;margin:0;padding:40px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #eaeaea;border-radius:16px;">
      <tr><td style="padding:36px 40px 0;">
        <img src="https://genalot.com/email-logo.png" width="40" height="40" alt="Genalot" style="display:block;border-radius:10px;">
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <h1 style="margin:0;font-size:22px;font-weight:600;color:#0a0a0c;letter-spacing:-0.01em;">Sign in to Genalot</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#5c5c62;">Click below to sign in. No password needed.</p>
      </td></tr>
      <tr><td style="padding:28px 40px 0;">
        <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/ad-studio" style="display:inline-block;background:#f5e31d;color:#0a0a0c;font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:12px;">Sign in</a>
      </td></tr>
      <tr><td style="padding:24px 40px 36px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#b0b0b6;border-top:1px solid #f0f0ee;padding-top:20px;">This link expires in 1 hour. If you didn't try to sign in, ignore this email.</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#b8b8be;">Genalot — AI creation suite &nbsp;·&nbsp; &copy; 2026 Genalot</p>
  </td></tr>
</table>
```

---

## 4. Change Email Address

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;margin:0;padding:40px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #eaeaea;border-radius:16px;">
      <tr><td style="padding:36px 40px 0;">
        <img src="https://genalot.com/email-logo.png" width="40" height="40" alt="Genalot" style="display:block;border-radius:10px;">
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <h1 style="margin:0;font-size:22px;font-weight:600;color:#0a0a0c;letter-spacing:-0.01em;">Confirm your new email</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#5c5c62;">Confirm this address to finish updating the email on your Genalot account.</p>
      </td></tr>
      <tr><td style="padding:28px 40px 0;">
        <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/settings" style="display:inline-block;background:#f5e31d;color:#0a0a0c;font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:12px;">Confirm new email</a>
      </td></tr>
      <tr><td style="padding:24px 40px 36px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#b0b0b6;border-top:1px solid #f0f0ee;padding-top:20px;">If you didn't request this change, ignore this email and your address stays the same.</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#b8b8be;">Genalot — AI creation suite &nbsp;·&nbsp; &copy; 2026 Genalot</p>
  </td></tr>
</table>
```
