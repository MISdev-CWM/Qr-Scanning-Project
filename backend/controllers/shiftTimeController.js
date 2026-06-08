import ShiftTime from '../models/ShiftTime.js';

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const normalizeTime = (value) => String(value || '').trim();

const isValidTime = (value) => TIME_RE.test(value);

export const getShiftTimes = async (req, res) => {
  try {
    const shiftTimes = await ShiftTime.findOne().sort({ updatedAt: -1 });
    return res.status(200).json(shiftTimes || null);
  } catch (err) {
    return res.status(500).json({
      message: 'Error fetching shift times',
      error: err.message,
    });
  }
};

export const upsertShiftTimes = async (req, res) => {
  try {
    const fields = [
      'manpowerDayStart', 'manpowerDayEnd', 'manpowerNightStart', 'manpowerNightEnd',
      'permanentDayStart', 'permanentDayEnd', 'permanentNightStart', 'permanentNightEnd',
      'manpowerDayOtStart', 'manpowerDayOtEnd', 'manpowerNightOtStart', 'manpowerNightOtEnd',
      'permanentDayOtStart', 'permanentDayOtEnd', 'permanentNightOtStart', 'permanentNightOtEnd'
    ];

    const payload = {};
    for (const field of fields) {
      if (req.body?.[field] === undefined) continue;

      const val = normalizeTime(req.body?.[field]);
      if (!val) {
        return res.status(400).json({ message: `${field} is required` });
      }
      if (!isValidTime(val)) {
        return res.status(400).json({ message: `${field} must be in HH:mm format` });
      }
      payload[field] = val;
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'No shift times provided' });
    }

    let shiftTimes = await ShiftTime.findOne().sort({ updatedAt: -1 });
    if (shiftTimes) {
      shiftTimes.set(payload);
      if (req.userId) {
        shiftTimes.updatedBy = req.userId;
      }
      await shiftTimes.save();
      return res.status(200).json(shiftTimes);
    }

    shiftTimes = await ShiftTime.create({
      ...payload,
      updatedBy: req.userId || undefined,
    });

    return res.status(201).json(shiftTimes);
  } catch (err) {
    return res.status(500).json({
      message: 'Error updating shift times',
      error: err.message,
    });
  }
};
