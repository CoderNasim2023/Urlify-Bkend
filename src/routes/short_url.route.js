import express from 'express';
import { createCustomShortUrl, createShortUrl, resolveShortUrl } from '../controller/short_url.controller.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

const validate = (checks) => [
  ...checks,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

/**
 * @swagger
 * /api/create:
 *   post:
 *     summary: Create a short URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Success
 */
// Normal short URL
router.post("/", validate([
  body('url').isURL().withMessage('Valid URL is required')
]), createShortUrl);

/**
 * @swagger
 * /api/create/custom:
 *   post:
 *     summary: Create a custom short URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               slug:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Success
 */
// Custom short URL (example: /custom)
router.post("/custom", validate([
  body('url').isURL().withMessage('Valid URL is required'),
  body('slug').optional().isAlphanumeric().withMessage('Slug must be alphanumeric')
]), createCustomShortUrl);

// Resolve endpoint to be used by edge workers (returns JSON, not redirect)
router.get('/resolve/:id', resolveShortUrl);

export default router;