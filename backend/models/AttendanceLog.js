import mongoose from 'mongoose';

const AttendanceLogSchema = new mongoose.Schema({
  qrId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QRCode',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  scanType: {
    type: String,
    enum: ['IN', 'OUT'],
    required: true
  },
  scanLocation: {
    type: String,
    enum: ['SECURITY'],
    required: true
  },
  shift: {
    type: String,
    enum: [
      'DAY',
      'NIGHT',
      'NORMAL',
      'SPECIAL',
      'SATURDAY',
      'SATURDAY_DAY',
      'SATURDAY_NIGHT',
      'SUNDAY',
      'ADOC'
    ]
  },
  scanTime: {
    type: Date,
    required: true
  },
  workDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  editedAt: {
    type: Date
  },
  editedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

export default mongoose.model('AttendanceLog', AttendanceLogSchema);
