/**
 * Maps case benefit route type to client profile type for rent amount generation.
 */
export function benefitTypeToProfileType(benefitType) {
  switch (benefitType) {
    case 'minor':
      return 'young_under_21';
    case 'individual':
      return 'young_over_21';
    case 'family':
      return 'family';
    default:
      return 'young_over_21';
  }
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random monthly rent amount (USD) based on profile type.
 * @param {'young_under_21' | 'young_over_21' | 'family'} profileType
 * @returns {number}
 */
export function generateRandomRentAmount(profileType) {
  switch (profileType) {
    case 'young_under_21':
    case 'young_over_21':
      return randomIntInclusive(1500, 1900);
    case 'family':
      return randomIntInclusive(2500, 3000);
    default:
      return randomIntInclusive(1500, 1900);
  }
}
