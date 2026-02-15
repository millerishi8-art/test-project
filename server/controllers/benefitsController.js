import { getAllBenefits } from '../components/benefitsData.js';

/**
 * קבלת מידע על סוגי ההטבות – נתונים מ-components
 */
export const getBenefits = (req, res) => {
  const benefits = getAllBenefits();
  res.json(benefits);
};
