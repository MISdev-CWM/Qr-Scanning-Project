import WorkSession from '../models/WorkSession.js';
import QRCode from '../models/QRCode.js';
import Employee from '../models/Employee.js';
import Company from '../models/Company.js';
import AttendanceLog from '../models/AttendanceLog.js';
import Process from '../models/Process.js';

const DUPLICATE_SCAN_WINDOW_MS = 1 * 60 * 1000;

const isMongoObjectId = (value) => typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

const resolveQRCode = async (qrId) => {
  if (!qrId) return null;
  if (isMongoObjectId(qrId)) {
    const byId = await QRCode.findById(qrId).populate('employeeId companyId');
    if (byId) return byId;
  }
  return QRCode.findOne({ qrId }).populate('employeeId companyId');
};

const parseOptionalDate = (value) => {
  if (value === undefined) return { provided: false };
  if (value === null || value === '') return { provided: true, date: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { provided: true, invalid: true };
  return { provided: true, date: d };
};

// GET /api/work-session/all
export const getAllSessions = async (req, res) => {
  try {
    const { date } = req.query;

    const query = {};
    if (date) {
      // Expect YYYY-MM-DD; interpret as local calendar date
      const parts = String(date).split('-').map(n => Number(n));
      if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
        return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      const [year, month, day] = parts;
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      query.startTime = { $gte: start, $lte: end };
    }

    const sessions = await WorkSession.find(query)
      .sort({ startTime: -1 })
      .populate('qrId companyId employeeId');
    res.status(200).json({
      message: 'All work sessions retrieved',
      sessions
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// POST /api/work-session/start
export const startSession = async (req, res) => {
  try {
    const { qrId, processName } = req.body;
    if (!qrId || !processName) {
      return res.status(400).json({ message: 'qrId and processName are required' });
    }
    // Find QR code and related info
    const qr = await resolveQRCode(qrId);
    if (!qr) {
      return res.status(404).json({ message: 'QR code not found' });
    }
    const qrObjectId = qr._id;
    const companyId = qr.companyId?._id || qr.companyId;
    const employeeId = qr.employeeId?._id || qr.employeeId || null;
    // const machineId = qr.machineId?._id || qr.machineId || null;
    // if (!machineId) {
    //   return res.status(400).json({ message: 'machineId must be present in QR code' });
    // }
    // Prevent overlapping sessions
    const openSession = await WorkSession.findOne({
      qrId: qrObjectId,
      processName,
      endTime: { $exists: false }
    });
    if (openSession) {
      return res.status(400).json({
        message: 'A work session is already in progress for this QR code and process.'
      });
    }

    const now = new Date();
    const recentEndedSession = await WorkSession.findOne({
      qrId: qrObjectId,
      processName,
      endTime: {
        $gte: new Date(now.getTime() - DUPLICATE_SCAN_WINDOW_MS),
        $lte: now,
      },
    }).sort({ endTime: -1 });

    if (recentEndedSession) {
      return res.status(200).json({
        message: 'Duplicate work session scan ignored. Session was already ended.',
        session: recentEndedSession,
        duplicate: true,
        scanType: 'OUT',
        scanTime: recentEndedSession.endTime,
      });
    }

    // Block if employee is already assigned to another open process
    if (employeeId) {
      const parallelSession = await WorkSession.findOne({
        employeeId,
        endTime: { $exists: false }
      });
      if (parallelSession) {
        return res.status(400).json({
          message: 'Employee is already assigned to another open process.'
        });
      }

      // Enforce attendance IN before starting any process work session.
      // Rule: employee must have at least one attendance log today, and the latest log must be IN.
      const workDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (matches attendanceController)
      const lastAttendance = await AttendanceLog.findOne({
        employeeId,
        companyId,
        workDate,
        scanLocation: 'SECURITY'
      }).sort({ scanTime: -1 });

      if (!lastAttendance) {
        return res.status(400).json({
          message: 'Employee must check IN at security before starting a process.'
        });
      }

      if (lastAttendance.scanType !== 'IN') {
        return res.status(400).json({
          message: 'Employee is currently checked OUT. Please check IN before starting a process.'
        });
      }
    }
    
    const session = new WorkSession({
      qrId: qrObjectId,
      companyId,
      employeeId,
      // machineId,
      processName,
      startTime: now
    });
    await session.save();
    res.status(201).json({
      message: 'Work session started',
      session
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// POST /api/work-session/stop
export const stopSession = async (req, res) => {
  try {
    const { qrId, processName } = req.body;
    if (!qrId || !processName) {
      return res.status(400).json({ message: 'qrId and processName are required' });
    }
    // Find QR code and related info
    const qr = await resolveQRCode(qrId);
    if (!qr) {
      return res.status(404).json({ message: 'QR code not found' });
    }
    const qrObjectId = qr._id;
    // Find open session
    const session = await WorkSession.findOne({
      qrId: qrObjectId,
      processName,
      endTime: { $exists: false }
    });
    if (!session) {
      return res.status(404).json({
        message: 'No open work session found for this QR code and process.'
      });
    }
    const now = new Date();
    const startTime = new Date(session.startTime);

    if (!Number.isNaN(startTime.getTime()) && now.getTime() - startTime.getTime() <= DUPLICATE_SCAN_WINDOW_MS) {
      return res.status(200).json({
        message: 'Duplicate work session scan ignored. Session was already started.',
        session,
        duplicate: true,
        scanType: 'IN',
        scanTime: session.startTime,
      });
    }

    session.endTime = now;
    session.durationMinutes = Math.round(
      (now - session.startTime) / 60000
    );
    await session.save();
    res.status(200).json({
      message: 'Work session ended',
      session
    });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// PUT /api/work-session/sessions/:id/times
// Admin-only: update a session's startTime/endTime and recompute durationMinutes
export const updateWorkSessionTimes = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({ message: 'Invalid work session id' });
    }

    const startParsed = parseOptionalDate(req.body?.startTime);
    const endParsed = parseOptionalDate(req.body?.endTime);

    if (!startParsed.provided && !endParsed.provided) {
      return res.status(400).json({ message: 'startTime or endTime is required' });
    }

    if (startParsed.invalid) {
      return res.status(400).json({ message: 'startTime must be a valid date/time' });
    }
    if (endParsed.invalid) {
      return res.status(400).json({ message: 'endTime must be a valid date/time or null' });
    }

    const session = await WorkSession.findById(id);
    if (!session) {
      return res.status(404).json({ message: 'Work session not found' });
    }

    if (startParsed.provided && startParsed.date) {
      session.startTime = startParsed.date;
    }

    if (endParsed.provided) {
      if (endParsed.date === null) {
        session.endTime = undefined;
        session.durationMinutes = undefined;
      } else if (endParsed.date) {
        session.endTime = endParsed.date;
      }
    }

    // Validate ordering when endTime exists
    if (session.endTime && session.startTime && session.endTime < session.startTime) {
      return res.status(400).json({ message: 'endTime cannot be before startTime' });
    }

    // Recompute durationMinutes if complete
    if (session.endTime && session.startTime) {
      session.durationMinutes = Math.round((session.endTime - session.startTime) / 60000);
    }

    await session.save();

    return res.status(200).json({
      message: 'Work session times updated successfully',
      session,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error updating work session times',
      error: err.message,
    });
  }
};

// GET /api/work-session/active-by-process
// Returns currently active (no endTime) work sessions grouped by processName.
// If logged in user is a process user, filters only by their linked processName.
export const getActiveSessionsByProcess = async (req, res) => {
  try {
    const filter = {
      $or: [
        { endTime: { $exists: false } },
        { endTime: null },
      ],
    };

    if (req.user && req.user.role === 'process') {
      const linkedProcess = await Process.findOne({ userId: req.user._id });
      if (linkedProcess && linkedProcess.processName) {
        filter.processName = linkedProcess.processName;
      }
    }

    const activeSessions = await WorkSession.find(filter)
      .sort({ startTime: -1 })
      .populate('employeeId', 'name employeeId')
      .populate('companyId', 'companyName')
      .lean();

    // Group by processName
    const grouped = {};
    for (const session of activeSessions) {
      const key = session.processName || 'Unknown';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({
        sessionId: session._id,
        employeeName: session.employeeId?.name || '—',
        employeeCode: session.employeeId?.employeeId || '—',
        companyName: session.companyId?.companyName || '—',
        startTime: session.startTime,
      });
    }

    return res.status(200).json({ grouped });
  } catch (err) {
    return res.status(500).json({
      message: 'Error fetching active sessions by process',
      error: err.message,
    });
  }
};
