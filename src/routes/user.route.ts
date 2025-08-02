import { Router } from 'express';
import { protect } from '../controllers/auth.controller';
import {
  getAllUsers,
  getAvailableParents,
  getUserById,
  getUsersByParent,
} from '../controllers/user.controller';

const router = Router();

/**
 * @swagger
 * /api/v1/users/available-parents:
 *   get:
 *     summary: Get available parent users based on role
 *     description: Returns a list of parent users (admins or sub-admins) based on the role provided in the query.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [sub-admin, user, admin]
 *         description: Role for which to fetch available parents (e.g., "sub-admin" will return all admins).
 *     responses:
 *       200:
 *         description: A list of available parent users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Available parents retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 688d91357f961c6839017168
 *                       firstName:
 *                         type: string
 *                         example: New
 *                       lastName:
 *                         type: string
 *                         example: Admin
 *                       email:
 *                         type: string
 *                         example: new.admin@example.com
 *                       role:
 *                         type: string
 *                         example: admin
 *       400:
 *         description: Role is missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Role is required to get available parents
 */
router.get('/available-parents', getAvailableParents);

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all users
 *     description: |
 *       Retrieves a paginated list of users based on the current user's role.
 *       - **Admins** can view all users.
 *       - **Sub-admins** can view their child users, themselves, and sibling sub-admins.
 *       - **Users** can only view themselves.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of users per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, sub-admin, user]
 *         description: Filter users by role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to match `firstName`, `lastName`, or `email`
 *     responses:
 *       200:
 *         description: List of users with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Users retrieved successfully
 *                 meta:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 2
 *                     totalUsers:
 *                       type: integer
 *                       example: 13
 *                     hasNext:
 *                       type: boolean
 *                       example: true
 *                     hasPrev:
 *                       type: boolean
 *                       example: false
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 688d91357f961c6839017168
 *                       firstName:
 *                         type: string
 *                         example: New
 *                       lastName:
 *                         type: string
 *                         example: Admin
 *                       email:
 *                         type: string
 *                         example: new.admin@example.com
 *                       role:
 *                         type: string
 *                         example: admin
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-08-02T04:16:53.939Z
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-08-02T04:16:53.939Z
 *                       parentId:
 *                         oneOf:
 *                           - type: string
 *                             example: null
 *                           - type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                                 example: 688cf465eaa69d2b1a7ddb15
 *                               firstName:
 *                                 type: string
 *                                 example: Raizo
 *                               lastName:
 *                                 type: string
 *                                 example: Jr
 *                               email:
 *                                 type: string
 *                                 example: test1@gmail.com
 *                               role:
 *                                 type: string
 *                                 example: sub-admin
 *       401:
 *         description: Unauthorized - user not authenticated
 *       403:
 *         description: Forbidden - user does not have access to requested data
 */
router.get('/', getAllUsers);

/**
 * @swagger
 * /api/v1/users/parent/{parentId}:
 *   get:
 *     summary: Get users by parent ID
 *     description: |
 *       Retrieves a paginated list of users who have the specified `parentId`.
 *       Only users with access to the parent can view the child users.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent user
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: List of users with the specified parent ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Child users retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     parent:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: 688cf465eaa69d2b1a7ddb15
 *                         firstName:
 *                           type: string
 *                           example: Raizo
 *                         lastName:
 *                           type: string
 *                           example: Jr
 *                         fullName:
 *                           type: string
 *                           example: Raizo Jr
 *                         email:
 *                           type: string
 *                           example: test1@gmail.com
 *                         role:
 *                           type: string
 *                           example: sub-admin
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 688cf6edeaa69d2b1a7ddb4b
 *                           firstName:
 *                             type: string
 *                             example: Raizo
 *                           lastName:
 *                             type: string
 *                             example: Mandal
 *                           email:
 *                             type: string
 *                             example: user3@example.com
 *                           role:
 *                             type: string
 *                             example: user
 *                           parentId:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               role:
 *                                 type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                           example: 1
 *                         totalPages:
 *                           type: integer
 *                           example: 2
 *                         totalUsers:
 *                           type: integer
 *                           example: 12
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *                         hasPrev:
 *                           type: boolean
 *                           example: false
 *       401:
 *         description: Unauthorized - user not authenticated
 *       403:
 *         description: Forbidden - access denied to parent or its users
 *       404:
 *         description: Parent user not found
 */
router.get('/parent/:parentId', getUsersByParent);

// Get user by ID
router.get('/:id', getUserById);

// Update user (only admins and sub-admins can update their children)
// router.put('/:id', authorize(UserRole.ADMIN, UserRole.SUB_ADMIN), UserController.updateUser);

// Delete user (only admins and sub-admins can delete their children)
// router.delete('/:id', authorize(UserRole.ADMIN, UserRole.SUB_ADMIN), UserController.deleteUser);

export default router;
