const express = require('express');
const { requestLeave, myLeaves } = require('../controllers/leaveController');
const { protectEmployee } = require('../middleware/auth');

const router = express.Router();

router.post('/request', protectEmployee, requestLeave);
router.get('/mine', protectEmployee, myLeaves);

module.exports = router;
