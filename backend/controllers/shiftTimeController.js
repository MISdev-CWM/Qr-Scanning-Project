import ShiftTime from '../models/ShiftTime.js';

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const normalizeTime = (value) => String(value || '').trim();

const isValidTime = (value) => TIME_RE.test(value);

const toMinutes = (value) => {
  const [hh, mm] = value.split(':').map(Number);
  return hh * 60 + mm;
};

const getDurationHours = (start, end) => {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  const durationMinutes =
    endMinutes > startMinutes
      ? endMinutes - startMinutes
      : endMinutes + 24 * 60 - startMinutes;

  return durationMinutes / 60;
};

const validateMaxDuration = (data, startField, endField, maxHours, label) => {
  const start = data?.[startField];
  const end = data?.[endField];
  if (!start || !end) return null;

  const durationHours = getDurationHours(start, end);
  if (durationHours > maxHours) {
    return `${label} must be maximum ${maxHours} hours`;
  }

  return null;
};

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
    const timeFields = [
      'manpowerDayStart', 'manpowerDayEnd', 'manpowerNightStart', 'manpowerNightEnd',
      'manpowerSaturdayStart', 'manpowerSaturdayEnd',
      'manpowerSaturdayNightStart', 'manpowerSaturdayNightEnd',
      'manpowerSundayStart', 'manpowerSundayEnd',
      'permanentDayStart', 'permanentDayEnd', 'permanentNightStart', 'permanentNightEnd',
      'permanentNormalStart', 'permanentNormalEnd',
      'permanentSpecialStart', 'permanentSpecialEnd',
      'permanentSaturdayStart', 'permanentSaturdayEnd',
      'permanentSundayStart', 'permanentSundayEnd',
      'manpowerDayOtStart', 'manpowerDayOtEnd', 'manpowerNightOtStart', 'manpowerNightOtEnd',
      'manpowerSaturdayOtStart', 'manpowerSaturdayOtEnd',
      'manpowerSaturdayNightOtStart', 'manpowerSaturdayNightOtEnd',
      'manpowerSundayOtStart', 'manpowerSundayOtEnd',
      'permanentDayOtStart', 'permanentDayOtEnd', 'permanentNightOtStart', 'permanentNightOtEnd',
      'permanentSaturdayOtStart', 'permanentSaturdayOtEnd', 'permanentSundayOtStart', 'permanentSundayOtEnd',
    ];

    const rateFields = [
      'permanentNormalOtRate', 'permanentNightOtRate', 'permanentSaturdayOtRate', 'permanentSundayOtRate',
      'manpowerDayOtRate', 'manpowerNightOtRate', 'manpowerSaturdayOtRate', 'manpowerSundayOtRate',
    ];

    const payload = {};

    // Validate and collect time fields (must be HH:mm)
    for (const field of timeFields) {
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

    // Validate and collect numeric rate fields
    for (const field of rateFields) {
      if (req.body?.[field] === undefined) continue;

      const num = Number(req.body[field]);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({ message: `${field} must be a non-negative number` });
      }
      payload[field] = num;
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'No shift times provided' });
    }

    let shiftTimes = await ShiftTime.findOne().sort({ updatedAt: -1 });
    const current = shiftTimes?.toObject ? shiftTimes.toObject() : {};
    const merged = { ...current, ...payload };
    const durationError =
      validateMaxDuration(merged, 'permanentNormalStart', 'permanentNormalEnd', 24, 'Permanent normal shift') ||
      validateMaxDuration(merged, 'permanentSpecialStart', 'permanentSpecialEnd', 8, 'Permanent special shift');

    if (durationError) {
      return res.status(400).json({ message: durationError });
    }

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
