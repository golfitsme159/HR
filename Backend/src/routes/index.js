const express = require('express');
const authRoutes = require('./authRoutes');
const wfhRoutes = require('./wfhRoutes');
const leaveRoutes = require('./leaveRoutes');
const hrRoutes = require('./hrRoutes');
const employeeRoutes = require('./employeeRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'nilecon-hr-api', status: 'ok', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/wfh', wfhRoutes);
router.use('/leave', leaveRoutes);
router.use('/hr', hrRoutes);
router.use('/employees', employeeRoutes);

module.exports = router;
