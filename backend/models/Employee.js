import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    default: null,
    // validate: {
    //   validator: function(v) {
    //     if (this.employeeType === 'permanent') {
    //       return v != null && v !== '';
    //     }
    //     if (this.employeeType === 'manpower') {
    //       return v == null || v === '';
    //     }
    //     return true;
    //   },
    //   message: function(props) {
    //     if (this.employeeType === 'permanent') {
    //       return 'Permanent employees must have an employeeId.';
    //     }
    //     if (this.employeeType === 'manpower') {
    //       return 'Manpower employees must not have an employeeId.';
    //     }
    //     return 'Invalid employeeId.';
    //   }
    // }
  },
  name: {
    type: String,
    default: null
  },
  employeeType: {
    type: String,
    enum: ['manpower', 'permanent', 'casual'],
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Employee', employeeSchema);
