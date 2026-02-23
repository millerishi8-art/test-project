import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
const casesFile = path.join(dataDir, 'cases.json');

/**
 * מבנה תיק (Case)
 * @typedef {Object} Case
 * @property {string} id
 * @property {string} userId
 * @property {string} benefitType - family | individual | minor
 * @property {string} address
 * @property {string} [familyBackground]
 * @property {Object} personalDetails
 * @property {boolean} [signature]
 * @property {string} status - submitted | ...
 * @property {string} createdAt - ISO date
 * @property {string} renewalDate - ISO date
 * @property {boolean} isRenewed
 * @property {string} [lastRenewedAt] - ISO date
 */

export const readCases = () => {
  try {
    if (fs.existsSync(casesFile)) {
      return JSON.parse(fs.readFileSync(casesFile, 'utf8'));
    }
    return [];
  } catch (error) {
    return [];
  }
};

export const writeCases = (cases) => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(casesFile, JSON.stringify(cases, null, 2));
};

export const findCaseById = (id) => {
  const cases = readCases();
  return cases.find((c) => c.id === id);
};

export const findCasesByUserId = (userId) => {
  const cases = readCases();
  return cases.filter((c) => c.userId === userId);
};

export const createCase = (caseData) => {
  const cases = readCases();
  cases.push(caseData);
  writeCases(cases);
  return caseData;
};

export const updateCase = (caseId, updates) => {
  const cases = readCases();
  const index = cases.findIndex((c) => c.id === caseId);
  if (index === -1) return null;
  cases[index] = { ...cases[index], ...updates };
  writeCases(cases);
  return cases[index];
};

/**
 * מוחק תיק לצמיתות לפי מזהה
 */
export const deleteCase = (caseId) => {
  const cases = readCases();
  const index = cases.findIndex((c) => c.id === caseId);
  if (index === -1) return null;
  const removed = cases.splice(index, 1)[0];
  writeCases(cases);
  return removed;
};
