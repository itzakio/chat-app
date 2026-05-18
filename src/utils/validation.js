// Email validation
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Password validation (minimum 6 characters)
const validatePassword = (password) => {
  return password && password.length >= 6;
};

// Name validation (2-50 characters)
const validateName = (name) => {
  return name && name.length >= 2 && name.length <= 50;
};

// Message validation
const validateMessage = (message) => {
  return message && message.trim().length > 0 && message.trim().length <= 2000;
};

module.exports = { 
  validateEmail, 
  validatePassword, 
  validateName,
  validateMessage 
};