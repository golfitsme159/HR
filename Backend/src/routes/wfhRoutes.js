const express = require('express');
const { requestWfh, updateWfh, myRequests } = require('../controllers/wfhController');
const { protectEmployee } = require('../middleware/auth');

const router = express.Router();

router.post('/request', protectEmployee, requestWfh);
router.get('/mine', protectEmployee, myRequests);
router.put('/:id', protectEmployee, updateWfh);

module.exports = router;
