import { scanAtSecurity } from './attendanceController.js';
import { startSession, stopSession } from './workSessionController.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Process from '../models/Process.js';

const getAuthToken = (req) => req.header('Authorization')?.replace('Bearer ', '');

const requireAuthenticatedUser = async (req) => {
  const token = getAuthToken(req);
  if (!token) {
    const err = new Error('No authentication token provided');
    err.statusCode = 401;
    throw err;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    const err = new Error('Invalid authentication token');
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) {
    const err = new Error('User not found or inactive');
    err.statusCode = 401;
    throw err;
  }

  return user;
};

// POST /api/scan
export const handleScan = async (req, res) => {
  try {
    const { context, ...scanData } = req.body;

    if (!context) {
      return res.status(400).json({
        message: 'Scan context is required (SECURITY, SUPERVISOR, BREAK)'
      });
    }

    // SECURITY scan → attendance IN / OUT
    if (context === 'SECURITY') {
      return scanAtSecurity(req, res);
    }

    // PROCESS scan → work session toggle (IN/OUT) with processName derived from logged-in process user
    if (context === 'PROCESS') {
      const user = await requireAuthenticatedUser(req);
      if (user.role !== 'process') {
        return res.status(403).json({ message: 'Access forbidden: process role required' });
      }

      const linkedProcess = await Process.findOne({ userId: user._id });
      if (!linkedProcess) {
        return res.status(400).json({
          message: 'No process is linked to this user. Ask admin to link a process.'
        });
      }

      const processName = linkedProcess.processName;
      const payload = { ...scanData, processName };

      const stopResult = await new Promise(resolve => {
        const fakeRes = {
          status: code => ({
            json: obj => resolve({ code, obj })
          })
        };
        stopSession({ body: payload }, fakeRes);
      });

      if (stopResult.code === 200) {
        const stopScanType = stopResult.obj?.scanType || 'OUT';
        return res.status(200).json({
          ...stopResult.obj,
          scanType: stopScanType,
          scanTime: stopResult.obj?.scanTime || stopResult.obj?.session?.endTime || stopResult.obj?.session?.startTime || new Date(),
          processName
        });
      }

      // Only start a new session when there is no open session.
      if (stopResult.code !== 404) {
        return res.status(stopResult.code).json(stopResult.obj);
      }

      const startResult = await new Promise(resolve => {
        const fakeRes = {
          status: code => ({
            json: obj => resolve({ code, obj })
          })
        };
        startSession({ body: payload }, fakeRes);
      });

      if (startResult.code === 201 || startResult.obj?.duplicate) {
        const startScanType = startResult.obj?.scanType || 'IN';
        return res.status(startResult.code).json({
          ...startResult.obj,
          scanType: startScanType,
          scanTime: startResult.obj?.scanTime || startResult.obj?.session?.startTime || startResult.obj?.session?.endTime || new Date(),
          processName
        });
      }

      return res.status(startResult.code).json(startResult.obj);
    }

    // SUPERVISOR scan → work session start / stop
    if (context === 'SUPERVISOR') {
      req.body = scanData;

      const stopResult = await new Promise(resolve => {
        const fakeRes = {
          status: code => ({
            json: obj => resolve({ code, obj })
          })
        };
        stopSession({ body: scanData }, fakeRes);
      });

      if (stopResult.code === 200) {
        return res.status(200).json({
          ...stopResult.obj,
          scanType: stopResult.obj?.scanType || 'OUT',
          scanTime: stopResult.obj?.scanTime || stopResult.obj?.session?.endTime || stopResult.obj?.session?.startTime || new Date(),
        });
      }

      const startResult = await new Promise(resolve => {
        const fakeRes = {
          status: code => ({
            json: obj => resolve({ code, obj })
          })
        };
        startSession(req, fakeRes);
      });

      if (startResult.code === 201 || startResult.obj?.duplicate) {
        return res.status(startResult.code).json({
          ...startResult.obj,
          scanType: startResult.obj?.scanType || 'IN',
          scanTime: startResult.obj?.scanTime || startResult.obj?.session?.startTime || startResult.obj?.session?.endTime || new Date(),
        });
      }

      return res.status(startResult.code).json(startResult.obj);
    }
    
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({
      message: 'Scan error',
      error: err.message
    });
  }
};
