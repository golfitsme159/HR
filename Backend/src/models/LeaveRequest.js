const mongoose = require('mongoose');

const LEAVE_TYPES = ['ANNUAL', 'PERSONAL', 'SICK'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: LEAVE_TYPES,
      required: true,
    },
    // Both normalized to 00:00 of their calendar day; range is inclusive.
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    // Business days (Mon–Fri) in [startDate, endDate], computed at creation.
    // This is the amount deducted from annualLeaveQuota on approval.
    numberOfDays: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'PENDING',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

module.exports = LeaveRequest;
module.exports.LEAVE_TYPES = LEAVE_TYPES;
module.exports.STATUSES = STATUSES;
