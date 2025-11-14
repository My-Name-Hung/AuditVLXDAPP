const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.Password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.Id, username: user.Username, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.Id,
        userCode: user.UserCode,
        username: user.Username,
        fullName: user.FullName,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const register = async (req, res) => {
  try {
    const { username, password, fullName, email, phone, role } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, and fullName are required' });
    }

    // Check if user exists
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      Username: username,
      Password: hashedPassword,
      FullName: fullName,
      Email: email,
      Phone: phone,
      Role: role || 'user',
    });

    const token = jwt.sign(
      { id: user.Id, username: user.Username, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.Id,
        userCode: user.UserCode,
        username: user.Username,
        fullName: user.FullName,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newToken = jwt.sign(
      { id: user.Id, username: user.Username, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token: newToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = {
  login,
  register,
  refreshToken,
};

