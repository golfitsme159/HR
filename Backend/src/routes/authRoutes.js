const express = require('express');
const { linkLine, hrLogin, getMe } = require('../controllers/authController');
const { protectEmployee } = require('../middleware/auth');

const router = express.Router();

router.post('/link-line', linkLine);
router.post('/hr-login', hrLogin);
router.get('/me', protectEmployee, getMe);

module.exports = router;
