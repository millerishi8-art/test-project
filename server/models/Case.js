// בקובץ זה נישאר רק עם השלד המקורי או שנעדכן אותו לעבוד מול מונגו
import { getDb } from '../db/mongodb.js';

export const readCases = async () => {
  try {
    const db = getDb();
    return await db.collection('cases').find({}).toArray();
  } catch (error) {
    console.error('Error reading cases from DB:', error);
    return [];
  }
};

export const findCaseById = async (id) => {
  try {
    const db = getDb();
    return await db.collection('cases').findOne({ id });
  } catch (error) {
    return null;
  }
};

export const findCasesByUserId = async (userId) => {
  try {
    const db = getDb();
    return await db.collection('cases').find({ userId }).toArray();
  } catch (error) {
    return [];
  }
};

export const createCase = async (caseData) => {
  const db = getDb();
  await db.collection('cases').insertOne(caseData);
  return caseData;
};

export const updateCase = async (caseId, updates) => {
  const db = getDb();
  const result = await db.collection('cases').findOneAndUpdate(
    { id: caseId },
    { $set: updates },
    { returnDocument: 'after' }
  );
  return result.value;
};

export const deleteCase = async (caseId) => {
  const db = getDb();
  const result = await db.collection('cases').findOneAndDelete({ id: caseId });
  return result.value;
};
