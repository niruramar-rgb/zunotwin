const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { dbAsync } = require('../database/connection');
const { requireAuth } = require('../middleware/authMiddleware');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.SESSION_EXPIRY }
  );
}

function setAuthCookie(res, token) {
  res.cookie('zuno_auth_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE_MS,
    path: '/'
  });
}

/**
 * POST /api/auth/register
 * Real user account creation with bcrypt hashing and duplicate email rejection
 */
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    // 1. Input validations
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid full name (at least 2 characters).'
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    // 2. Prevent duplicate registrations
    const existing = await dbAsync.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists. Please sign in instead.'
      });
    }

    // 3. Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const now = Date.now();
    const result = await dbAsync.run(
      'INSERT INTO users (email, full_name, password_hash, role, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)',
      [normalizedEmail, cleanName, passwordHash, 'operator', now, now]
    );

    const user = {
      id: result.lastID,
      email: normalizedEmail,
      fullName: cleanName,
      role: 'operator'
    };

    // 4. Issue session token
    const token = generateToken(user);

    await dbAsync.run(
      'INSERT INTO user_sessions (user_id, token, created_at, expires_at, is_revoked) VALUES (?, ?, ?, ?, 0)',
      [user.id, token, now, now + TOKEN_MAX_AGE_MS]
    );

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user,
      token
    });
  } catch (err) {
    console.error('[Auth Register Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Registration failed due to server error. Please try again.'
    });
  }
});

/**
 * POST /api/auth/login
 * Real authentication verification against hashed passwords
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter both email and password.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Fetch user by email
    const userRow = await dbAsync.get(
      'SELECT id, email, full_name, password_hash, role FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (!userRow) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const now = Date.now();
    await dbAsync.run('UPDATE users SET last_login = ? WHERE id = ?', [now, userRow.id]);

    const user = {
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.full_name,
      role: userRow.role
    };

    // 3. Issue session token
    const token = generateToken(user);

    await dbAsync.run(
      'INSERT INTO user_sessions (user_id, token, created_at, expires_at, is_revoked) VALUES (?, ?, ?, ?, 0)',
      [user.id, token, now, now + TOKEN_MAX_AGE_MS]
    );

    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: 'Login successful',
      user,
      token
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed due to server error.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate session and clear HTTP cookie
 */
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.zuno_auth_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await dbAsync.run('UPDATE user_sessions SET is_revoked = 1 WHERE token = ?', [token]);
    }

    res.clearCookie('zuno_auth_token', { path: '/' });

    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('[Auth Logout Error]:', err);
    return res.json({ success: true, message: 'Logged out' });
  }
});

/**
 * GET /api/auth/me
 * Validate current session and retrieve operator profile
 */
router.get('/me', requireAuth, async (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
