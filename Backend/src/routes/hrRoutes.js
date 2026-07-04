const express = require('express');
const {
  getRequests,
  decide,
  getLeaves,
  decideLeave,
  getStaff,
  registerEmployee,
} = require('../controllers/hrController');
const { protectHR } = require('../middleware/auth');

const router = express.Router();

// Every HR route requires a valid HR/Admin JWT.
router.use(protectHR);

// WFH
router.get('/requests', getRequests);
router.post('/approve', decide);

// Leave
router.get('/leaves', getLeaves);
router.post('/leave/approve', decideLeave);

// Staff & employee management
router.get('/staff', getStaff);
router.post('/employees', registerEmployee);

module.exports = router;
