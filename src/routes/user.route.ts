import { Router } from 'express';
import { protect } from '../controllers/auth.controller';
import { getAllUsers, getAvailableParents, getUsersByParent } from '../controllers/user.controller';

const router = Router();

router.get('/available-parents', getAvailableParents);

// All routes require authentication
router.use(protect);

// Get all users (with pagination and filtering)
router.get('/', getAllUsers);

// Get available parents for a role

// Get users by parent ID
router.get('/parent/:parentId', getUsersByParent);

// Get user by ID
// router.get('/:id', UserController.getUserById);

// Update user (only admins and sub-admins can update their children)
// router.put('/:id', authorize(UserRole.ADMIN, UserRole.SUB_ADMIN), UserController.updateUser);

// Delete user (only admins and sub-admins can delete their children)
// router.delete('/:id', authorize(UserRole.ADMIN, UserRole.SUB_ADMIN), UserController.deleteUser);

export default router;
