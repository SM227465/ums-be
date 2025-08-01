import User, { IUserModel, UserRole } from '../models/user.model';

interface PaginationOptions {
  page: number;
  limit: number;
  role?: UserRole;
  search?: string;
}

export class UserService {
  static async getAllUsers(currentUser: IUserModel, options: PaginationOptions) {
    const { page, limit, role, search } = options;
    const skip = (page - 1) * limit;

    // Build query based on user role
    let query: any = {};

    if (currentUser.role === UserRole.ADMIN) {
      // Admin can see all users
      if (role) query.role = role;
    } else if (currentUser.role === UserRole.SUB_ADMIN) {
      // Sub-admin can see their child users and other sub-admins under the same admin
      query.$or = [
        { parentId: currentUser._id }, // Direct children
        { _id: currentUser._id }, // Themselves
        { parentId: currentUser.parentId, role: UserRole.SUB_ADMIN }, // Sibling sub-admins
      ];
      if (role) query.role = role;
    } else {
      // Regular users can only see themselves
      query._id = currentUser._id;
    }

    // Add search functionality
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .populate('parentId', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return {
      users,
      meta: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  static async getUserById(userId: string, currentUser: IUserModel) {
    const user = await User.findById(userId).populate('parentId', 'firstName lastName email role');

    if (!user) {
      throw new Error('User not found');
    }

    // Check if current user has permission to view this user
    if (!this.canAccessUser(currentUser, user)) {
      throw new Error('Access denied');
    }

    return user;
  }

  static async updateUser(userId: string, updateData: any, currentUser: IUserModel) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if current user has permission to update this user
    if (!this.canModifyUser(currentUser, user)) {
      throw new Error('Access denied');
    }

    // Prevent role changes that would break hierarchy
    if (updateData.role && updateData.role !== user.role) {
      throw new Error('Role changes are not allowed through this endpoint');
    }

    // Remove sensitive fields
    delete updateData.password;
    delete updateData.confirmPassword;
    delete updateData.role;
    delete updateData.parentId;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).populate('parentId', 'firstName lastName email role');

    return updatedUser;
  }

  static async deleteUser(userId: string, currentUser: IUserModel) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if current user has permission to delete this user
    if (!this.canModifyUser(currentUser, user)) {
      throw new Error('Access denied');
    }

    // Check if user has children (prevent deletion if they do)
    const childrenCount = await User.countDocuments({ parentId: userId });
    if (childrenCount > 0) {
      throw new Error(
        'Cannot delete user with child users. Please reassign or delete child users first.'
      );
    }

    await User.findByIdAndDelete(userId);
  }

  static async getUsersByParent(
    parentId: string,
    currentUser: IUserModel,
    options: { page: number; limit: number }
  ) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Verify parent exists and current user has access
    const parent = await User.findById(parentId);
    if (!parent) {
      throw new Error('Parent user not found');
    }

    if (!this.canAccessUser(currentUser, parent)) {
      throw new Error('Access denied');
    }

    const [users, total] = await Promise.all([
      User.find({ parentId })
        .populate('parentId', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments({ parentId }),
    ]);

    return {
      users,
      parent: {
        id: parent._id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        fullName: parent.fullName,
        email: parent.email,
        role: parent.role,
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  static async getAvailableParents(role: UserRole, currentUser: IUserModel) {
    let query: any = {};

    if (role === UserRole.SUB_ADMIN) {
      // Sub-admins can be assigned to admins
      query.role = UserRole.ADMIN;

      // If current user is not admin, only show admins they have access to
      if (currentUser.role !== UserRole.ADMIN) {
        query._id = currentUser.parentId;
      }
    } else if (role === UserRole.USER) {
      // Users can be assigned to sub-admins
      query.role = UserRole.SUB_ADMIN;

      // Show sub-admins based on current user's access level
      if (currentUser.role === UserRole.SUB_ADMIN) {
        query.$or = [
          { _id: currentUser._id }, // Themselves
          { parentId: currentUser.parentId }, // Sibling sub-admins
        ];
      } else if (currentUser.role === UserRole.USER) {
        query._id = currentUser.parentId; // Only their parent
      }
    }

    const parents = await User.find(query)
      .select('firstName lastName email role')
      .sort({ firstName: 1 });

    return parents;
  }

  // Helper methods
  private static canAccessUser(currentUser: IUserModel, targetUser: IUserModel): boolean {
    if (currentUser.role === UserRole.ADMIN) {
      return true; // Admin can access all users
    }

    if (currentUser.role === UserRole.SUB_ADMIN) {
      // Sub-admin can access their children, themselves, and sibling sub-admins
      return (
        targetUser._id.toString() === currentUser._id.toString() ||
        targetUser.parentId?.toString() === currentUser._id.toString() ||
        (targetUser.role === UserRole.SUB_ADMIN &&
          targetUser.parentId?.toString() === currentUser.parentId?.toString())
      );
    }

    // Regular users can only access themselves
    return targetUser._id.toString() === currentUser._id.toString();
  }

  private static canModifyUser(currentUser: IUserModel, targetUser: IUserModel): boolean {
    if (currentUser.role === UserRole.ADMIN) {
      return targetUser._id.toString() !== currentUser._id.toString(); // Admin can modify others but not themselves through this endpoint
    }

    if (currentUser.role === UserRole.SUB_ADMIN) {
      // Sub-admin can modify their direct children
      return targetUser.parentId?.toString() === currentUser._id.toString();
    }

    // Regular users cannot modify anyone
    return false;
  }
}
