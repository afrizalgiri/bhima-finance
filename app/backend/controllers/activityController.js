const prisma = require('../lib/prisma');

const getAll = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && !req.user.canViewHistory) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    const { page = 1, limit = 50, entity } = req.query;
    const where = {};
    if (entity) where.entity = entity;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.activityLog.count({ where }),
    ]);
    res.json({ success: true, data: logs, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll };
