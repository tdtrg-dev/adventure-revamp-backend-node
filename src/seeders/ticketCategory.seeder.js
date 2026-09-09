const TicketCategory = require('../models/TicketCategory');

/** Mirrors TicketCategorySeeder.php — ticket_category_details is embedded as `details[]` here. */
const CATEGORIES = [
  { title: 'General', details: ['Dinner', 'Early Access to Event', 'Discounted Price', 'Reserved Seating'] },
  { title: 'Child', details: ['Premium Seating', 'Sponsor Recognition', 'Access to Sponsor Lounge', 'Dedicated Host/Guide'] },
  { title: 'Senior', details: ['VIP Parking', 'Exclusive Meet and Greet', 'Complimentary Drinks', 'Backstage Pass'] },
  { title: 'Family', details: ['General Admission', 'Standard Seating', 'Access to Food Stalls', 'Event Merchandise Discounts'] },
];

async function seedTicketCategories() {
  for (const cat of CATEGORIES) {
    const existing = await TicketCategory.findOne({ title: cat.title });
    if (existing) {
      const have = new Set(existing.details.map((d) => d.offer_title));
      cat.details.filter((title) => !have.has(title)).forEach((offer_title) => existing.details.push({ offer_title }));
      await existing.save();
    } else {
      await TicketCategory.create({ title: cat.title, details: cat.details.map((offer_title) => ({ offer_title })) });
    }
  }

  console.log(`  Ticket categories: ${CATEGORIES.length} seeded (${CATEGORIES.map((c) => c.title).join(', ')})`);
}

module.exports = seedTicketCategories;
