const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { getUsersCollection, getTokensCollection } = require('../config/db');
const { validateEmail, validatePassword, validateName } = require('../utils/validation');

// Generate Access Token (short-lived)
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Generate Refresh Token (long-lived)
const generateRefreshToken = async (userId) => {
  const refreshToken = jwt.sign(
    { id: userId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );

  const tokensCollection = getTokensCollection();
  
  // Store refresh token in database
  await tokensCollection.insertOne({
    userId: new ObjectId(userId),
    token: refreshToken,
    type: 'refresh',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    isRevoked: false
  });

  return refreshToken;
};

// @desc    Register new user
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    if (!validateName(name)) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 50 characters'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const usersCollection = getUsersCollection();

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user',
      isEmailVerified: false,
      createdAt: new Date(),
      lastLogin: null,
      loginAttempts: 0,
      lockUntil: null
    };

    const result = await usersCollection.insertOne(newUser);
    
    // Get created user (without password)
    const user = await usersCollection.findOne({ _id: result.insertedId });
    delete user.password;

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const usersCollection = getUsersCollection();

    // Find user by email
    const user = await usersCollection.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Account is locked. Please try again later'
      });
    }

    // Verify password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    
    if (!isPasswordMatch) {
      // Increment login attempts
      const loginAttempts = (user.loginAttempts || 0) + 1;
      let lockUntil = null;
      
      // Lock account after 5 failed attempts
      if (loginAttempts >= 5) {
        lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // Lock for 2 hours
      }
      
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { loginAttempts, lockUntil } }
      );
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          loginAttempts: 0,
          lockUntil: null,
          lastLogin: new Date()
        }
      }
    );

    // Remove password from response
    delete user.password;

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        lastLogin: new Date()
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ _id: req.user._id });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    delete user.password;

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: oldRefreshToken } = req.body;

    if (!oldRefreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const tokensCollection = getTokensCollection();

    // Verify refresh token exists in database
    const tokenDoc = await tokensCollection.findOne({ 
      token: oldRefreshToken, 
      type: 'refresh',
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Verify JWT
    const decoded = jwt.verify(oldRefreshToken, process.env.JWT_SECRET);
    
    // Check if user exists
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ _id: new ObjectId(decoded.id) });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists'
      });
    }

    // Revoke old refresh token
    await tokensCollection.updateOne(
      { _id: tokenDoc._id },
      { $set: { isRevoked: true } }
    );

    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = await generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken: tokenToRevoke } = req.body;
    
    if (tokenToRevoke) {
      const tokensCollection = getTokensCollection();
      // Revoke refresh token
      await tokensCollection.updateOne(
        { token: tokenToRevoke },
        { $set: { isRevoked: true } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  refreshToken,
  logout
};