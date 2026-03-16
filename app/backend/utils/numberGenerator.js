const prisma = require('../lib/prisma');

const pad = (n, width = 4) => String(n).padStart(width, '0');

const generateSphNumber = async (prefix = 'SPH') => {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1, 2);
  const count = await prisma.sph.count({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  });
  return `${prefix}/${year}/${month}/${pad(count + 1)}`;
};

const generateInvoiceNumber = async (prefix = 'INV') => {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1, 2);
  const count = await prisma.invoice.count({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  });
  return `${prefix}/${year}/${month}/${pad(count + 1)}`;
};

const generateRfpNumber = async (prefix = 'RFP') => {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1, 2);
  const count = await prisma.expenseRequest.count({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  });
  return `${prefix}/${year}/${month}/${pad(count + 1)}`;
};

module.exports = { generateSphNumber, generateInvoiceNumber, generateRfpNumber };
