const mongoose = require('mongoose');

const ROLES = ['EMPLOYEE', 'HR', 'ADMIN'];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    nickname: {
      type: String,
      trim: true,
      default: '',
    },
    // Last 6 digits of the national ID. HR pre-registers employees with this
    // value; the employee later links their LINE account against it.
    nationalIdLast6: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{6}$/, 'nationalIdLast6 must be exactly 6 digits'],
    },
    // Populated once the employee links their LINE account. Sparse + unique so
    // multiple un-linked (null) users are allowed but a LINE id maps to one user.
    lineUserId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'EMPLOYEE',
    },
    // HR/Admin web login credentials. Employees authenticate via LINE and have
    // neither field. `passwordHash` is never returned by default (select:false).
    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    maxWfhPerMonth: {
      type: Number,
      default: 10,
      min: 0,
    },
    annualLeaveQuota: {
      type: Number,
      default: 6,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

userSchema.virtual('isLinked').get(function isLinked() {
  return Boolean(this.lineUserId);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
