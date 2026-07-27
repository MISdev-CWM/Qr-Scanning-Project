import BreakSession from '../models/BreakSession.js';
import QRCode from '../models/QRCode.js';
import Employee from '../models/Employee.js';


// POST /api/break-session/create
// Toggle break: if open, end it; if not, start new
export const createBreak = async (req, res) => { 
  try {
    const { breakType, startTime, endTime, durationMinutes } = req.body;
    if (!breakType) {
      return res.status(400).json({ message: 'breakType is required' });
    }

    const duration = durationMinutes === undefined || durationMinutes === null
      ? null
      : Number(durationMinutes);
    if (duration !== null && (Number.isNaN(duration) || duration < 0)) {
      return res.status(400).json({ message: 'durationMinutes must be a non-negative number' });
    }

    const effectiveStartTime = startTime || new Date().toISOString();
    const effectiveEndTime = endTime
      ? endTime
      : (duration !== null
        ? new Date(new Date(effectiveStartTime).getTime() + duration * 60000).toISOString()
        : undefined);

    const breakSession = new BreakSession({
      breakType,
      ...(duration !== null && { durationMinutes: duration }),
      startTime: effectiveStartTime,
      ...(effectiveEndTime && { endTime: effectiveEndTime })
    });
    await breakSession.save();
    res.status(201).json({
      message: 'Break session created',
      breakSession
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// PUT /api/break-session/:id
export const updateBreak = async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };

    if (update.durationMinutes !== undefined) {
      const duration = update.durationMinutes === null ? null : Number(update.durationMinutes);
      if (duration !== null && (Number.isNaN(duration) || duration < 0)) {
        return res.status(400).json({ message: 'durationMinutes must be a non-negative number' });
      }
      update.durationMinutes = duration;

      // If a duration is provided and no explicit endTime, keep endTime in sync.
      if (duration !== null) {
        const start = update.startTime ? new Date(update.startTime) : null;
        const startValid = start && !Number.isNaN(start.getTime());
        if (startValid && update.endTime === undefined) {
          update.endTime = new Date(start.getTime() + duration * 60000).toISOString();
        }
      }
    }

    if (update.startTime === undefined) {
      // Preserve existing startTime if not provided.
      delete update.startTime;
    }

    const breakSession = await BreakSession.findByIdAndUpdate(id, update, { new: true });
    if (!breakSession) {
      return res.status(404).json({ message: 'Break session not found.' });
    }
    res.status(200).json({
      message: 'Break session updated',
      breakSession
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// DELETE /api/break-session/:id
export const deleteBreak = async (req, res) => {
  try {
    const { id } = req.params;
    const breakSession = await BreakSession.findByIdAndDelete(id);
    if (!breakSession) {
      return res.status(404).json({ message: 'Break session not found.' });
    }
    res.status(200).json({
      message: 'Break session deleted',
      breakSession
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// GET /api/break-session
export const getBreaks = async (req, res) => {
  try {
    const breaks = await BreakSession.find().sort({ startTime: -1 });
    res.status(200).json(breaks);
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};
