import express from 'express';
import CompOff from '../models/CompOff.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// local-midnight helpers
const toLocalMidnight = (input) => {
  if (!input) return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const dt = new Date(input);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

// LIST (optionally by employee)
router.get('/', async (req, res) => {
  const { employeeId } = req.query;
  const filter = {};
  if (employeeId) filter.employee = employeeId;

  const list = await CompOff.find(filter)
    .populate('employee')
    .sort({ workDate: -1, createdAt: -1 });

  res.json(list);
});

// CREATE or UPDATE (id optional; upsert by employee+workDate)
router.post('/', async (req, res) => {
  const { id, employeeId, workDate, leaveDate, status, remark } = req.body;

  if (id) {
    const updated = await CompOff.findByIdAndUpdate(
      id,
      {
        ...(employeeId ? { employee: employeeId } : {}),
        ...(workDate ? { workDate: toLocalMidnight(workDate) } : {}),
        ...(leaveDate !== undefined ? { leaveDate: leaveDate ? toLocalMidnight(leaveDate) : null } : {}),
        ...(status ? { status } : {}),
        ...(remark !== undefined ? { remark } : {}),
      },
      { new: true }
    ).populate('employee');
    if (!updated) return res.status(404).json({ message: 'CompOff not found' });
    return res.json(updated);
  }

  if (!employeeId || !workDate) {
    return res.status(400).json({ message: 'employeeId and workDate are required' });
  }

  const doc = await CompOff.findOneAndUpdate(
    { employee: employeeId, workDate: toLocalMidnight(workDate) },
    {
      $setOnInsert: {
        employee: employeeId,
        workDate: toLocalMidnight(workDate),
      },
      ...(leaveDate ? { leaveDate: toLocalMidnight(leaveDate) } : {}),
      ...(status ? { status } : {}),
      ...(remark !== undefined ? { remark } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('employee');

  res.status(201).json(doc);
});

// DELETE
router.delete('/:id', async (req, res) => {
  await CompOff.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
