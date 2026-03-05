// Example file to demonstrate the analyzer's capabilities

const express = require('express');
const axios = require('axios');
const lodash = require('lodash');

/**
 * User management class
 */
class UserManager {
  constructor() {
    this.users = [];
  }

  /**
   * Add a new user
   * @param {Object} user - User object
   */
  addUser(user) {
    if (!user || !user.name) {
      throw new Error('Invalid user');
    }
    
    if (this.users.find(u => u.id === user.id)) {
      return false;
    }
    
    this.users.push(user);
    return true;
  }

  /**
   * Find user by ID with complexity
   * @param {string} userId - User ID
   */
  findUserById(userId) {
    if (!userId) {
      return null;
    }

    for (let i = 0; i < this.users.length; i++) {
      if (this.users[i].id === userId) {
        if (this.users[i].active) {
          return this.users[i];
        } else if (this.users[i].deleted) {
          return null;
        } else {
          return this.users[i];
        }
      }
    }

    return null;
  }

  /**
   * Complex function with high cyclomatic complexity
   */
  processUser(user, options) {
    if (!user) return null;
    
    if (options.validateEmail && !this.isValidEmail(user.email)) {
      return null;
    }
    
    if (options.checkAge && user.age < 18) {
      return null;
    }
    
    if (options.checkCountry && user.country !== 'US') {
      return null;
    }
    
    if (user.status === 'active' || user.status === 'pending') {
      if (options.requireVerification && !user.verified) {
        return null;
      }
    }
    
    return user;
  }

  isValidEmail(email) {
    return email && email.includes('@');
  }
}

/**
 * Data processor class
 */
class DataProcessor {
  static processData(data) {
    return data.map(item => item.value);
  }

  static filterData(data, condition) {
    return data.filter(condition);
  }
}

// Exported functions
export function createServer() {
  const app = express();
  return app;
}

export function fetchUserData(userId) {
  return axios.get(`/api/users/${userId}`);
}

export default UserManager;
