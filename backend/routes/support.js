'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const SupportTicket = require('../models/SupportTicket');
const logger = require('../core/logger');

// POST /api/support — submit a support ticket (auth required)
router.post('/', auth, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (typeof subject !== 'string') return res.status(400).json({ message: 'Subject is required.' });
    if (!subject.trim()) return res.status(400).json({ message: 'Subject is required.' });
    if (typeof message !== 'string') return res.status(400).json({ message: 'Message is required.' });
    if (!message.trim()) return res.status(400).json({ message: 'Message is required.' });
    if (subject.trim().length > 120) return res.status(400).json({ message: 'Subject too long (max 120 chars).' });
    if (message.trim().length > 2000) return res.status(400).json({ message: 'Message too long (max 2000 chars).' });

    const user = await User.findById(req.userId);
    const ticket = await SupportTicket.create({
      userId: req.userId,
      name:  user?.name  || '',
      email: user?.email || '',
      subject: subject.trim(),
      message: message.trim(),
    });

    logger.info('support_ticket_created', { ticketId: ticket.id, userId: req.userId });
    res.status(201).json({ message: 'Support ticket submitted.', ticketId: ticket.id });
  } catch (err) {
    logger.error('Error creating support ticket', { message: err.message, code: err.code });
    // Supabase error when the support_tickets table has not been created yet
    if (err.code === '42P01' || (err.message && err.message.includes('support_tickets'))) {
      return res.status(503).json({ message: 'Support service is temporarily unavailable. Please try again later or contact the administrator.' });
    }
    res.status(500).json({ message: 'Failed to submit support ticket.' });
  }
});

// GET /api/support/my-tickets — list logged-in user's own tickets
router.get('/my-tickets', auth, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.userId }, { sort: { createdAt: -1 }, limit: 50 });
    res.json({ tickets });
  } catch (err) {
    logger.error('Error fetching user tickets', { message: err.message });
    res.status(500).json({ message: 'Failed to load tickets.' });
  }
});

module.exports = router;
