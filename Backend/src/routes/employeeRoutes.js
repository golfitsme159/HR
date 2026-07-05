const express = require('express');
const {
  getEmployees,
  putEmployee,
  removeEmployee,
} = require('../controllers/employeeController');
const { protectHR } = require('../middleware/auth');

const router = express.Router();

// Employee CRUD is HR/Admin-only.
router.use(protectHR);

router.get('/', getEmployees);
router.put('/:id', putEmployee);
router.delete('/:id', removeEmployee);

module.exports = router;
