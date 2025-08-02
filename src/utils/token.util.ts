import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

export const generateToken = (tokenType: 'access' | 'refresh', userId: Types.ObjectId) => {
  const secretKey =
    tokenType === 'access'
      ? process.env.ACCESS_TOKEN_SECRET_KEY
      : process.env.REFRESH_TOKEN_SECRET_KEY;
  const expiresIn =
    tokenType === 'access'
      ? process.env.ACCESS_TOKEN_EXPIRES_IN
      : process.env.REFRESH_TOKEN_EXPIRES_IN;

  return jwt.sign({ id: userId, tokenType }, secretKey!, { expiresIn });
};
