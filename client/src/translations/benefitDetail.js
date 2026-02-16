/**
 * תרגום תוכן ההטבות (כותרת, תיאור, הסבר) – אנגלית לדף פרטי ההטבה
 * בעברית משתמשים בנתונים מהשרת/fallback
 */
export const benefitDetailTranslations = {
  en: {
    family: {
      title: 'Family',
      description: 'Benefits for a family',
      criteria: 'Family with children (parents + children up to age 21). ID documents for all family members and family relationship documents are required when needed.',
      instructions: 'Fill out the family benefit application form, attach ID documents for each family member, and proof of address. After submission the case will be reviewed and you will receive an update within 2–3 weeks.',
      estimatedTime: '2-3 weeks',
      details: 'The family benefit covers the entire family unit and is suitable for households with children. We recommend preparing all documents in advance to speed up processing.',
      fullExplanation: [
        { heading: 'What does the family benefit include?', text: 'This benefit is for families with children and covers all household members as one unit. The total price (₪1,800 / $500) applies to the whole family, not per person. The benefit is suitable for a household with children up to age 21.' },
        { heading: 'Who is it suitable for?', text: 'Couples with children, single parents with children, or any family unit with at least one child up to age 21. You must present ID documents and documents supporting the family composition.' },
        { heading: 'How do I get started?', text: 'Click "Continue to fill details", fill in the details of all family members and attach the required documents. After submission you will receive confirmation and can track the case status.' },
      ],
    },
    individual: {
      title: 'Single person',
      description: 'Benefits for a single person',
      criteria: 'Adult (over 21) with no children. A valid ID and proof of address are required.',
      instructions: 'Fill out the single-person benefit application form, attach ID and proof of address. After submission the case will be reviewed and you will receive an update within 1–2 weeks.',
      estimatedTime: '1-2 weeks',
      details: 'The single-person benefit is for those with no dependents who want personal coverage only. The process is relatively quick as fewer documents are required.',
      fullExplanation: [
        { heading: 'What does the single-person benefit include?', text: 'A benefit for adults over 21 with no children. Coverage is personal only and the price (₪1,100 / $300) applies to one person.' },
        { heading: 'Who is it suitable for?', text: 'Young adults after military service, singles, or anyone seeking benefit coverage on an individual basis without dependents.' },
        { heading: 'How do I get started?', text: 'Click "Continue to fill details", fill in your personal details and attach ID and proof of address. Processing is usually faster than for family benefits.' },
      ],
    },
    minor: {
      title: 'Minor under 21',
      description: 'Benefits for a minor under 21',
      criteria: 'Minor under 21. ID or birth certificate of the minor and parent/guardian approval are required.',
      instructions: 'Fill out the form for the minor, attach the minor’s ID/birth certificate and a document from the parent or guardian. After submission the case will be reviewed and you will receive an update within 1–2 weeks.',
      estimatedTime: '1-2 weeks',
      details: 'The minor benefit covers only the minor (up to age 21). You must present the minor’s ID and consent from a parent or legal guardian.',
      fullExplanation: [
        { heading: 'What does the minor benefit include?', text: 'A benefit for minors under 21 only. Coverage applies to the minor as an individual and the price (₪750 / $200) is for one minor. If there is more than one minor in the family, you must choose the family benefit or open a separate case for each minor.' },
        { heading: 'Who is it suitable for?', text: 'Children and youth up to age 21. The request can be submitted by the parent or legal guardian, along with documents confirming the minor’s age and legal relationship.' },
        { heading: 'How do I get started?', text: 'Click "Continue to fill details", fill in the minor’s details and attach the minor’s ID or birth certificate and a document from the parent/guardian. Remember that when the minor turns 21, the case must be renewed or converted to another benefit type.' },
      ],
    },
  },
};
