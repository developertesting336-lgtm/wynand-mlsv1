import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// Allow CORS from anywhere
app.use(cors({ origin: '*' }));
app.use(express.json());

// Configure nodemailer with Gmail SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.APP_EMAIL,
    pass: process.env.APP_PASS,
  },
});





const supabase = createClient(
  process.env.SUPABASE_URL,
  // Prefer service role key so we can bypass RLS for profile management
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function logServerAction({ userId = null, action, entityType = null, entityId = null }) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null
    });
  } catch (err) {
    console.error('[logServerAction] Logging error:', err);
  }
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatMoney = (amount, currency = 'MXN') => {
  const numericAmount = Number(amount || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(numericAmount);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const renderPaymentEmail = ({ recipientName, recipientType, renterName, ownerName, listing, booking, amount, currency, paymentDate }) => {
  const conditions = booking.agreement_conditions || {};
  const propertyName = listing?.title || conditions.propertyAddress || 'Your rental property';
  const leaseDuration = conditions.leaseDuration || `${booking.lease_duration_months || 12} months`;
  const monthlyRent = conditions.monthlyRent || listing?.price_mxn || listing?.price_usd || '—';
  const agreementLink = booking.lease_pdf_url;
  const isOwner = recipientType === 'owner';
  const intro = isOwner
    ? `${escapeHtml(renterName)} has completed payment for <strong>${escapeHtml(propertyName)}</strong>.`
    : `Your payment for <strong>${escapeHtml(propertyName)}</strong> was received successfully.`;

  return `
    <div style="margin:0;background:#f3f6f8;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#17212b;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e3e9ee;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.07);">
        <div style="padding:25px 30px;text-align:center;background:#ffffff;border-bottom:1px solid #edf1f4;">
          <img src="https://pvverified.com/logo.png" alt="PV Verified Rentals" width="170" style="display:inline-block;max-width:170px;height:auto;border:0;" />
        </div>
        <div style="padding:32px 30px 12px;">
          <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#e8f8f0;color:#11804b;font-size:12px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;">Payment confirmed</div>
          <h1 style="margin:16px 0 10px;font-size:26px;line-height:1.2;color:#17212b;">${isOwner ? 'A booking has been paid' : 'Your payment receipt'}</h1>
          <p style="margin:0;color:#5d6b78;font-size:15px;line-height:1.7;">Hi ${escapeHtml(recipientName || (isOwner ? ownerName : renterName) || 'there')},</p>
          <p style="margin:8px 0 0;color:#5d6b78;font-size:15px;line-height:1.7;">${intro}</p>
        </div>
        <div style="margin:22px 30px 0;padding:20px;border:1px solid #e6edf2;border-radius:14px;background:#fbfcfd;">
          <p style="margin:0 0 15px;font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#73808c;">Booking details</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;">
            <tr><td style="padding:6px 0;color:#71808c;">Property</td><td style="padding:6px 0;text-align:right;font-weight:bold;color:#17212b;">${escapeHtml(propertyName)}</td></tr>
            <tr><td style="padding:6px 0;color:#71808c;">Tenant</td><td style="padding:6px 0;text-align:right;color:#17212b;">${escapeHtml(renterName || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#71808c;">Owner</td><td style="padding:6px 0;text-align:right;color:#17212b;">${escapeHtml(ownerName || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#71808c;">Lease duration</td><td style="padding:6px 0;text-align:right;color:#17212b;">${escapeHtml(leaseDuration)}</td></tr>
            <tr><td style="padding:6px 0;color:#71808c;">Monthly rent</td><td style="padding:6px 0;text-align:right;color:#17212b;">${escapeHtml(String(monthlyRent))}</td></tr>
            <tr><td style="padding:12px 0 5px;border-top:1px solid #e6edf2;color:#71808c;">Amount paid</td><td style="padding:12px 0 5px;border-top:1px solid #e6edf2;text-align:right;font-size:18px;font-weight:bold;color:#11804b;">${escapeHtml(formatMoney(amount, currency))}</td></tr>
            <tr><td style="padding:5px 0;color:#71808c;">Payment date</td><td style="padding:5px 0;text-align:right;color:#17212b;">${escapeHtml(formatDate(paymentDate))}</td></tr>
          </table>
        </div>
        <div style="padding:25px 30px 32px;text-align:center;">
          ${agreementLink ? `<a href="${escapeHtml(agreementLink)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1296d4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">View lease agreement</a>` : '<p style="margin:0;color:#73808c;font-size:13px;">Your lease agreement link will be available in your dashboard.</p>'}
          <p style="margin:24px 0 0;color:#9aa6b1;font-size:12px;line-height:1.6;">PV Verified Rentals<br />Thank you for using our secure rental platform.</p>
        </div>
      </div>
    </div>
  `;
};





// Generic send email endpoint
app.post('/send-email', async (req, res) => {
  const { to, subject, body, fromEmail, fromName } = req.body;


  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
  }

  try {
    const from = fromEmail && fromName ? `${fromName} <${fromEmail}>` : `PV Verified Rentals <${process.env.APP_EMAIL}>`;

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html: body,
    });

    res.json({ success: true, id: info.messageId });
  } catch (err) {
    console.error('[send-email] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});


// Send signup OTP - generates and emails an OTP for new user registration
app.post('/send-signup-otp', async (req, res) => {
  const { email, phone_number } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!phone_number) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    // Check if email already exists in profiles
    const { data: existingEmail, error: emailCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (emailCheckError) {
      console.error('[send-signup-otp] Database error:', emailCheckError);
      throw new Error('Failed to check email');
    }

    // Check if phone number already exists in profiles
    const { data: existingPhone, error: phoneCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone_number', phone_number.trim())
      .maybeSingle();

    if (phoneCheckError) {
      console.error('[send-signup-otp] Phone check error:', phoneCheckError);
      throw new Error('Failed to check phone number');
    }

    if (existingEmail || existingPhone) {
      // Check if they exist in Supabase Auth
      let authUser = null;
      try {
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        authUser = authUsers?.users?.find(u => 
          u.email?.toLowerCase() === email.toLowerCase().trim() ||
          u.phone === phone_number.trim() ||
          u.user_metadata?.phone_number === phone_number.trim()
        );
      } catch (err) {
        console.error('[send-signup-otp] Error checking auth users:', err);
      }

      if (authUser) {
        // Real user exists in auth. Block them.
        if (existingEmail) {
          return res.status(409).json({ error: 'An account with this email already exists' });
        }
        if (existingPhone) {
          return res.status(409).json({ error: 'This phone number is already registered' });
        }
      } else {
        // User does not exist in Auth. The profile row is a stale/unverified temporary row.
        // Delete the stale profile row(s) to allow a clean signup retry.
        console.log('[send-signup-otp] Stale unverified profile found. Deleting stale profiles to allow retry.');
        const deleteIds = [existingEmail?.id, existingPhone?.id].filter(Boolean);
        await supabase.from('profiles').delete().in('id', deleteIds);
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Generate a UUID for the new user's temporary profile row
    const crypto = await import('crypto');
    const userId = crypto.randomUUID();

    // Store OTP in the profiles table using upsert on email
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: email.toLowerCase().trim(),
          reset_otp: otp,
          reset_otp_expires_at: expiresAt,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      );

    if (upsertError) {
      console.error('[send-signup-otp] Failed to store OTP:', upsertError);
      throw new Error('Failed to generate OTP');
    }

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">PV Verified Rentals</h1>
        </div>
        <h2 style="color: #1f2937;">Verify Your Email Address</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
          Thank you for signing up! Please use the following OTP code to verify your email address and complete your registration.
        </p>
        <div style="background: #f3f4f6; padding: 24px; text-align: center; border-radius: 12px; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #1f2937;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code will expire in <strong>10 minutes</strong>.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          PV Verified Rentals &bull; Secure email verification
        </p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `PV Verified Rentals <${process.env.APP_EMAIL}>`,
      to: email,
      subject: 'Verify Your Email - PV Verified Rentals',
      html: emailHtml,
    });

    await logServerAction({
      userId: userId,
      action: 'SEND_SIGNUP_OTP',
      entityType: 'profiles',
      entityId: userId
    });

    return res.json({
      success: true,
      message: 'OTP sent successfully. Please check your email.',
    });
  } catch (err) {
    console.error('[send-signup-otp] Error:', err);
    res.status(500).json({ error: err.message || 'Something went wrong' });
  }
});

// Verify signup OTP - validates OTP for new user registration
app.post('/verify-signup-otp', async (req, res) => {
  const { email, otp, password, full_name, phone_number, role } = req.body;



  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    // Find the user with matching email and valid OTP
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('reset_otp', otp.trim())
      .gt('reset_otp_expires_at', new Date().toISOString())
      .maybeSingle();

    if (userError || !user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Create Supabase Auth user via admin API
    let authUser = null;
    try {
      const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || email.split('@')[0],
          phone_number: phone_number || null,
          role: role || 'renter',
        }
      });

      if (createError) {
        if (!createError.message.includes('already registered') && !createError.message.includes('already exists')) {
          console.error('[verify-signup-otp] Admin createUser error:', createError);
          throw createError;
        }
        
        // Fetch existing user to get their ID
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const existingUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
        if (!existingUser) {
          throw new Error('User already registered in Auth but could not be retrieved');
        }
        authUser = existingUser;
      } else {
        authUser = authData.user;
      }
    } catch (err) {
      console.error('[verify-signup-otp] Auth creation failed:', err);
      return res.status(500).json({ error: 'Auth registration failed: ' + err.message });
    }

    // Update the temporary profile row with full registration details AND the correct ID
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        id: authUser.id,
        full_name: full_name || null,
        phone_number: phone_number || null,
        role: role || 'renter',
        reset_otp: null,
        reset_otp_expires_at: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[verify-signup-otp] Update error:', updateError);
      throw new Error('Failed to complete registration');
    }

    await logServerAction({
      userId: authUser.id,
      action: 'VERIFY_SIGNUP_OTP',
      entityType: 'profiles',
      entityId: authUser.id
    });

    res.json({ success: true, message: 'Registration completed successfully' });
  } catch (err) {
    console.error('[verify-signup-otp] Error:', err);
    res.status(500).json({ error: err.message || 'Something went wrong' });
  }
});


// Link auth user - updates the temp profile row's id to the real Supabase auth user UUID.
// Called by the frontend AFTER supabase.auth.signUp() returns the auth user id.
// This reconciles the temp profile (created with a random UUID by /send-signup-otp)
// with the actual Supabase auth user UUID.
app.post('/link-auth-user', async (req, res) => {
  const { email, auth_user_id } = req.body;

  if (!email || !auth_user_id) {
    return res.status(400).json({ error: 'email and auth_user_id are required' });
  }

  try {
    // Find the existing profile row by email
    const { data: existingProfile, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (findError) {
      console.error('[link-auth-user] Find error:', findError);
      throw new Error('Failed to find profile');
    }

    if (!existingProfile) {
      // Profile doesn't exist yet (DB trigger may not be set up) - nothing to link
      return res.json({ success: true, message: 'No profile to link (will be created by trigger)' });
    }

    if (existingProfile.id === auth_user_id) {
      // Already linked correctly
      return res.json({ success: true, message: 'Profile already linked' });
    }

    // Auto-confirm the user's email since we verified it via OTP
    try {
      await supabase.auth.admin.updateUserById(auth_user_id, {
        email_confirm: true
      });
    } catch (confirmErr) {
      console.warn('[link-auth-user] Failed to auto-confirm user email (non-fatal):', confirmErr);
    }

    // Update the profile's id to match the auth user's UUID
    // This requires the service role key to bypass RLS
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ id: auth_user_id })
      .eq('email', email.toLowerCase().trim());

    if (updateError) {
      console.error('[link-auth-user] Update error:', updateError);
      throw new Error('Failed to link profile: ' + updateError.message);
    }

    await logServerAction({
      userId: auth_user_id,
      action: 'LINK_AUTH_USER',
      entityType: 'profiles',
      entityId: auth_user_id
    });

    res.json({ success: true, message: 'Profile linked to auth user' });
  } catch (err) {
    console.error('[link-auth-user] Error:', err);
    res.status(500).json({ error: err.message || 'Something went wrong' });
  }
});

// Forgot password - send OTP
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (userError || !user) {
      // Don't reveal if email exists
      return res.json({ success: true, message: 'If an account exists, you will receive an OTP' });
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        reset_otp: otp,
        reset_otp_expires_at: expiresAt,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[forgot-password] Failed to store OTP:', updateError);
      throw new Error('Failed to generate OTP');
    }

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>You requested to reset your password. Use the following OTP code:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `PV Verified Rentals <${process.env.APP_EMAIL}>`,
        to: email,
        subject: 'Password Reset OTP - PV Verified Rentals',
        html: emailHtml,
      });

    } catch (emailErr) {
      console.error('[forgot-password] Failed to send OTP email:', emailErr);
    }

    await logServerAction({
      userId: user.id,
      action: 'SEND_PASSWORD_RESET_OTP',
      entityType: 'profiles',
      entityId: user.id
    });

    return res.json({ success: true, message: 'If an account exists, you will receive an OTP' });
  } catch (err) {
    console.error('[forgot-password] Error:', err);
    res.status(500).json({ error: err.message || 'Something went wrong' });
  }
});

// Reset password - verify OTP and update password
app.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {

    // Find user with valid OTP
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('reset_otp', otp.trim())
      .gt('reset_otp_expires_at', new Date().toISOString())
      .maybeSingle();

    if (userError || !user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Use auth_user_id if available, otherwise fall back to id
    const authUserId = user.auth_user_id || user.id;

    // Update password in Supabase Auth (not in profiles table)
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      authUserId,
      { password: newPassword }
    );

    if (authUpdateError) {
      console.error('[reset-password] Auth password update error:', authUpdateError);
      throw new Error('Failed to update password');
    }

    // Clear OTP from profiles table
    const { error: clearError } = await supabase
      .from('profiles')
      .update({
        reset_otp: null,
        reset_otp_expires_at: null,
      })
      .eq('id', user.id);

    if (clearError) {
      console.error('[reset-password] OTP clear error:', clearError);
      // Don't throw - password was updated successfully
    }

    await logServerAction({
      userId: authUserId,
      action: 'RESET_PASSWORD',
      entityType: 'profiles',
      entityId: authUserId
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('[reset-password] Error:', err);
    res.status(500).json({ error: err.message || 'Something went wrong' });
  }
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'PV Verified Email API Service Running',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});



// Send payment receipt to both the renter and owner after a booking payment.
app.post('/send-payment-invoice', async (req, res) => {
  const suppliedSecret = req.get('x-internal-email-secret');
  if (process.env.INTERNAL_EMAIL_SECRET && suppliedSecret !== process.env.INTERNAL_EMAIL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { bookingId, amount, currency = 'MXN', paymentDate, stripeSessionId, stripePaymentIntentId } = req.body;
  if (!bookingId || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'bookingId and amount are required' });
  }

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, owner_id, renter_id, listing_id, lease_duration_months, lease_pdf_url, agreement_conditions')
      .eq('id', bookingId)
      .single();
    if (bookingError || !booking) throw new Error('Booking not found');

    const [{ data: listing }, { data: renter }, { data: owner }] = await Promise.all([
      supabase.from('listings').select('title, address, price_mxn, price_usd').eq('id', booking.listing_id).maybeSingle(),
      supabase.from('profiles').select('id, email, full_name').eq('id', booking.renter_id).maybeSingle(),
      supabase.from('profiles').select('id, email, full_name').eq('id', booking.owner_id).maybeSingle(),
    ]);

    if (!renter?.email || !owner?.email) throw new Error('Renter or owner email not found');

    const details = {
      renterName: renter.full_name || renter.email,
      ownerName: owner.full_name || owner.email,
      listing,
      booking,
      amount,
      currency,
      paymentDate: paymentDate || new Date().toISOString(),
    };
    const subject = `Payment confirmed: ${listing?.title || 'Rental booking'}`;
    const renterEmail = renderPaymentEmail({ ...details, recipientName: renter.full_name || renter.email, recipientType: 'renter' });
    const ownerEmail = renderPaymentEmail({ ...details, recipientName: owner.full_name || owner.email, recipientType: 'owner' });

    const [renterResult, ownerResult] = await Promise.all([
      transporter.sendMail({
        from: `PV Verified Rentals <${process.env.APP_EMAIL}>`,
        to: renter.email,
        subject,
        html: renterEmail,
        headers: { 'X-Booking-Id': bookingId, 'X-Stripe-Session-Id': stripeSessionId || '' },
      }),
      transporter.sendMail({
        from: `PV Verified Rentals <${process.env.APP_EMAIL}>`,
        to: owner.email,
        subject,
        html: ownerEmail,
        headers: { 'X-Booking-Id': bookingId, 'X-Stripe-Payment-Intent-Id': stripePaymentIntentId || '' },
      }),
    ]);

    await logServerAction({ action: 'SEND_BOOKING_PAYMENT_INVOICE', entityType: 'bookings', entityId: bookingId });
    return res.json({ success: true, recipients: [renter.email, owner.email], messageIds: [renterResult.messageId, ownerResult.messageId] });
  } catch (err) {
    console.error('[send-payment-invoice] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send payment invoice' });
  }
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Email Server] Running on http://localhost:${PORT}`);
  console.log(`[Email Server] SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  console.log(`[Email Server] From: ${process.env.APP_EMAIL}`);
});