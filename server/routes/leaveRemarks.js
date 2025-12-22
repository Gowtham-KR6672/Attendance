import express from 'express';
import LeaveRemarks from '../models/LeaveRemarks.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// Parse "YYYY-MM-DD" or date-like into local midnight
const toLocalMidnight = (input) => {
  if (!input) return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y,m,d] = input.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const dt = new Date(input);
  dt.setHours(0,0,0,0);
  return dt;
};

// GET remarks for an employee & range
router.get('/', async (req, res) => {
  const { employeeId, from, to } = req.query;
  if (!employeeId || !from || !to) {
    return res.status(400).json({ message: 'employeeId, from, to are required' });
  }
  const doc = await LeaveRemarks.findOne({
    employee: employeeId,
    from: toLocalMidnight(from),
    to: toLocalMidnight(to)
  });
  res.json(doc || { employee: employeeId, from, to, remarks: {} });
});

// UPSERT remarks for an employee & range
router.post('/', async (req, res) => {
  const { employeeId, from, to, remarks } = req.body;
  if (!employeeId || !from || !to) {
    return res.status(400).json({ message: 'employeeId, from, to are required' });
  }
  const doc = await LeaveRemarks.findOneAndUpdate(
    { employee: employeeId, from: toLocalMidnight(from), to: toLocalMidnight(to) },
    { $set: { remarks: remarks || {} } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json(doc);
});

export default router;
