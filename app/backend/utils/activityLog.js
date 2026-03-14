const prisma = require('../lib/prisma');

const logActivity = async (userId, action, entity, entityId = null, detail = null) => {
  try {
    await prisma.activityLog.create({ data: { userId, action, entity, entityId, detail } });
  } catch (e) {
    console.error('Activity log error:', e.message);
  }
};

module.exports = { logActivity };
