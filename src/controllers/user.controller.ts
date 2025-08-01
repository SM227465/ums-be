import { Request, Response } from 'express';
import catchAsync from '../utils/catch-async.util';
import { UserService } from '../services/user.service';
import User, { UserRole } from '../models/user.model';
import AppError from '../utils/app-error.util';

export const getAllUsers = catchAsync(async (req, res, next) => {
  // @ts-ignore
  const currentUser = req.user!;
  const { page = 1, limit = 10, role, search } = req.query;

  const result = await UserService.getAllUsers(currentUser, {
    page: Number(page),
    limit: Number(limit),
    role: role as UserRole,
    search: search as string,
  });

  res.status(200).json({
    success: true,
    message: 'Users retrieved successfully',
    meta: result.meta,
    data: result.users,
  });
});

export const getUserById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // @ts-ignore
  const currentUser = req.user!;

  const user = await UserService.getUserById(id, currentUser);

  res.status(200).json({ success: true, message: 'User retrieved successfully', data: user });
});

export const getUsersByParent = catchAsync(async (req, res, next) => {
  const { parentId } = req.params;

  // @ts-ignore
  const currentUser = req.user!;
  const { page = 1, limit = 10 } = req.query;

  const result = await UserService.getUsersByParent(parentId, currentUser, {
    page: Number(page),
    limit: Number(limit),
  });

  res
    .status(200)
    .json({ success: true, message: 'Child users retrieved successfully', data: result });
});

export const getAvailableParents = catchAsync(async (req, res, next) => {
  const { role } = req.query;

  if (!role) {
    return next(new AppError('Role is required to get available parents', 400));
  }

  const parents = await UserService.getAvailableParents(role as UserRole);

  res
    .status(200)
    .json({ success: true, message: 'Available parents retrieved successfully', data: parents });
});

export class UserController {
  /*
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const currentUser = req.user!;

      const user = await UserService.getUserById(id, currentUser);

      const response: ApiResponse = {
        success: true,
        message: 'User retrieved successfully',
        data: user,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve user',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      res.status(404).json(response);
    }
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;
      const updateData = req.body;

      const user = await UserService.updateUser(id, updateData, currentUser);

      const response: ApiResponse = {
        success: true,
        message: 'User updated successfully',
        data: user,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to update user',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      res.status(400).json(response);
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      await UserService.deleteUser(id, currentUser);

      const response: ApiResponse = {
        success: true,
        message: 'User deleted successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      res.status(400).json(response);
    }
  }

  static async getUsersByParent(req: Request, res: Response): Promise<void> {
    try {
      const { parentId } = req.params;
      const currentUser = req.user!;
      const { page = 1, limit = 10 } = req.query;

      const result = await UserService.getUsersByParent(
        parentId,
        currentUser,
        {
          page: Number(page),
          limit: Number(limit),
        }
      );

      const response: ApiResponse = {
        success: true,
        message: 'Child users retrieved successfully',
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve child users',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      res.status(500).json(response);
    }
  }

  static async getAvailableParents(req: Request, res: Response): Promise<void> {
    try {
      const { role } = req.query;
      const currentUser = req.user!;

      if (!role) {
        const response: ApiResponse = {
          success: false,
          message: 'Role is required to get available parents',
        };
        res.status(400).json(response);
        return;
      }

      const parents = await UserService.getAvailableParents(role as UserRole, currentUser);

      const response: ApiResponse = {
        success: true,
        message: 'Available parents retrieved successfully',
        data: parents,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve available parents',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      res.status(500).json(response);
    }
  }
    */
}
