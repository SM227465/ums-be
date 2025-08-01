import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User, { UserRole } from '../models/user.model';
import { EmailService } from '../services/email.service';
import AppError from '../utils/app-error.util';
import catchAsync from '../utils/catch-async.util';
import { generateToken } from '../utils/token.util';

export const signup = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password, confirmPassword, role, parentId } = req.body;

  const userWithEmailOrPhone = await User.findOne({ email });

  if (userWithEmailOrPhone) {
    return next(new AppError(`A user exists with this email; if it's you, please login.`, 400));
  }

  if (role === UserRole.SUB_ADMIN && !parentId) {
    return next(new AppError('Sub-admin must select an Admin', 400));
  }

  if (role === UserRole.USER && !parentId) {
    return next(new AppError('User must select a Sub-admin', 400));
  }

  if (role === UserRole.ADMIN && parentId) {
    return next(new AppError('Admin cannot have a parent', 400));
  }

  if (parentId) {
    const parent = await User.findById(parentId);

    if (!parent) {
      return next(new AppError('Selected parent (user) does not exist', 400));
    }

    if (role === UserRole.SUB_ADMIN && parent.role !== UserRole.ADMIN) {
      return next(new AppError('Sub-admin can only be assigned to Admin', 400));
    }

    if (role === UserRole.USER && parent.role !== UserRole.SUB_ADMIN) {
      return next(new AppError('User can only be assigned to Sub-admin', 400));
    }
  }

  const newUser = await User.create({
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    role,
    parentId,
  });

  const userInfo = JSON.parse(JSON.stringify(newUser));
  delete userInfo.password;
  delete userInfo.confirmPassword;

  res.status(201).json({
    success: true,
    message: 'Account Created Successfully',
    tokens: {
      access: {
        token: generateToken('access', newUser._id),
        expiresIn: Number(process.env.ACCESS_TOKEN_MAX_AGE!),
        tokenExpireUnit: 'milliseconds',
      },
      refresh: {
        token: generateToken('refresh', newUser._id),
        expiresIn: Number(process.env.REFRESH_TOKEN_MAX_AGE!),
        tokenExpireUnit: 'milliseconds',
      },
    },
    user: userInfo,
  });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide an email and password.', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.isPasswordCorrect(password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  const userInfo = JSON.parse(JSON.stringify(user));
  delete userInfo.password;
  delete userInfo.confirmPassword;

  res.status(200).json({
    success: true,
    tokens: {
      access: {
        token: generateToken('access', user._id),
        expiresIn: Number(process.env.ACCESS_TOKEN_MAX_AGE!),
        tokenExpireUnit: 'milliseconds',
      },
      refresh: {
        token: generateToken('refresh', user._id),
        expiresIn: Number(process.env.REFRESH_TOKEN_MAX_AGE!),
        tokenExpireUnit: 'milliseconds',
      },
    },
    user: userInfo,
  });
});

export const refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('No refresh token found, Please login', 401));
  }

  const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET_KEY!) as {
    id: string;
    tokenType: string;
    iat: number;
    exp: number;
  };

  if (decoded.tokenType !== 'refresh') {
    return next(new AppError('Type of token is not a refresh token', 400));
  }

  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist', 401));
  }

  res.status(200).json({
    success: true,
    message: 'Token refreshed',
    tokens: {
      access: {
        token: generateToken('access', currentUser._id),
        expiresIn: 3600000,
        tokenExpireUnit: 'millisecond',
      },
    },
  });
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email, domain, path } = req.body;

  if (!email || !domain || !path) {
    return next(new AppError('Please provide these, email, domain, path', 400));
  }

  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('There is no user with this email address.', 404));
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    const emailService = EmailService.getInstance();

    await emailService.sendMail('RESET_PASSWORD', {
      firstName: user.firstName,
      subject: 'Password Reset Request',
      resetUrl: `${domain}/${path}/${resetToken}`,
      toMail: user.email,
      year: new Date().getFullYear(),
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email}`,
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });
    return next(new AppError('There was an error to sending the email, Try again later.', 500));
  }
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return next(new AppError('Password reset token is missing', 400));
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return next(new AppError('Please provide both fields, password and confirmPassword', 400));
  }

  user.password = password;
  user.confirmPassword = confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Your password reset was successful',
  });
});

export const protect = catchAsync(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token) {
    return next(new AppError('Your are not login! please login to get access.', 401));
  }

  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY!) as {
    id: string;
    tokenType: string;
    iat: number;
    exp: number;
  };

  if (decoded.tokenType !== 'access') {
    return next(new AppError('Type of token is not an access token', 400));
  }

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user token belonging to this does no longer exits.', 401));
  }

  if (currentUser.changePasswordAfter(decoded.iat)) {
    return next(new AppError('User changed password recently! Please login again.', 401));
  }

  // @ts-ignore
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

export const getProfile = catchAsync(async (req, res, next) => {
  // @ts-ignore
  const user = req.user;

  res.status(200).json(user);
});
