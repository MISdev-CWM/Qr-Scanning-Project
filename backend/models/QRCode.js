import mongoose from 'mongoose';

const qrCodeSchema = new mongoose.Schema({
  qrId: {
    type: String,
    unique: true,
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  companyName: {
    type: String,
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  qrType: {
    type: String,
    enum: ['manpower', 'permanent', 'casual'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('QRCode', qrCodeSchema);
