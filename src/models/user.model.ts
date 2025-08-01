import { Document, Schema, model } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Constants
const SALT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRES_MINUTES = 10;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 16;

// Enums
export enum UserRole {
  ADMIN = 'admin',
  SUB_ADMIN = 'sub-admin',
  USER = 'user',
}

// Interface for methods
interface IUserMethods {
  isPasswordCorrect(providedPassword: string): Promise<boolean>;
  createPasswordResetToken(): string;
  changePasswordAfter(JWTTimestamp: number): boolean;
}

// Main User interface
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  password: string;
  confirmPassword?: string;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  parentId?: Schema.Types.ObjectId;
  fullName: string; // Virtual property
}

// Model type combining document and methods
export interface IUserModel extends IUser, IUserMethods {}

const userSchema = new Schema<IUserModel>(
  {
    firstName: {
      type: String,
      required: [true, 'Please provide your first name'],
      minlength: [
        NAME_MIN_LENGTH,
        `First name should not be less than ${NAME_MIN_LENGTH} characters`,
      ],
      maxlength: [
        NAME_MAX_LENGTH,
        `First name should not be more than ${NAME_MAX_LENGTH} characters`,
      ],
      trim: true,
    },

    lastName: {
      type: String,
      required: [true, 'Please provide your last name'],
      minlength: [
        NAME_MIN_LENGTH,
        `Last name should not be less than ${NAME_MIN_LENGTH} characters`,
      ],
      maxlength: [
        NAME_MAX_LENGTH,
        `Last name should not be more than ${NAME_MAX_LENGTH} characters`,
      ],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'Please provide your email address'],
      trim: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: (value: string) => validator.isEmail(value),
        message: 'Invalid Email! Please provide a valid email address',
      },
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
      required: [true, 'Role is required'],
    },

    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [
        PASSWORD_MIN_LENGTH,
        `Password should contain at least ${PASSWORD_MIN_LENGTH} characters`,
      ],
      maxlength: [
        PASSWORD_MAX_LENGTH,
        `Password should not be more than ${PASSWORD_MAX_LENGTH} characters`,
      ],
      select: false,
      validate: {
        validator: (value: string) => {
          // Enhanced password strength validation
          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumbers = /\d/.test(value);
          const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

          return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
        },
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      },
    },

    confirmPassword: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        validator: function (this: IUserModel, value: string) {
          return value === this.password;
        },
        message: 'Passwords do not match',
      },
    },

    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      validate: {
        validator: async function (this: IUserModel, parentId: Schema.Types.ObjectId) {
          if (!parentId) {
            // Only admins can have no parent
            return this.role === UserRole.ADMIN;
          }

          // Find the parent user
          const parent = await model<IUserModel>('User').findById(parentId);
          if (!parent) return false;

          // Role-based parent validation
          switch (this.role) {
            case UserRole.ADMIN:
              // Admins should not have parents
              return false;
            case UserRole.SUB_ADMIN:
              // Sub-admins can only have Admin parents
              return parent.role === UserRole.ADMIN;
            case UserRole.USER:
              // Users can only have Sub-admin parents
              return parent.role === UserRole.SUB_ADMIN;
            default:
              return false;
          }
        },
        message: 'Invalid parent assignment for the given role',
      },
    },

    passwordChangedAt: {
      type: Date,
      select: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.confirmPassword;
        delete ret.passwordChangedAt;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        delete ret._id;
        return ret;
      },
    },
  }
);

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ parentId: 1 });
userSchema.index({ passwordResetToken: 1 });

userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.confirmPassword;
    delete ret.passwordChangedAt;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Pre-save middleware
userSchema.pre('save', async function (next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) return next();

  try {
    // Hash the password
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);

    // Remove confirmPassword field
    this.confirmPassword = undefined;

    // Set passwordChangedAt for existing users
    if (this.isModified('password') && !this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000); // Subtract 1 second to ensure JWT is created after password change
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance methods
userSchema.methods.isPasswordCorrect = async function (
  this: IUserModel,
  providedPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(providedPassword, this.password);
  } catch (error) {
    return false;
  }
};

userSchema.methods.createPasswordResetToken = function (this: IUserModel): string {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  this.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

  return resetToken;
};

userSchema.methods.changePasswordAfter = function (
  this: IUserModel,
  JWTTimestamp: number
): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Virtual for full name
userSchema.virtual('fullName').get(function (this: IUserModel) {
  return `${this.firstName} ${this.lastName}`;
});

// Create and export the model
const User = model<IUserModel>('User', userSchema);
export default User;
