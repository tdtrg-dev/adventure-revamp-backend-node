const Interest = require('../models/Interest');

/** Mirrors InterestSeeder.php — 13 top-level categories with their sub-interests. */
const CATEGORIES = [
  {
    title: 'Landmarks & Attractions',
    image: 'category-images/1757790549_8zHikpBMwv.webp',
    children: [
      { title: 'Waterfalls', image: 'subcategory-images/69e3920ec617a.webp' },
      { title: 'Parks & Recreation', image: 'subcategory-images/69e2b99b0da67.webp' },
      { title: 'Lakes', image: 'subcategory-images/69e2ad48c2175.webp' },
      { title: 'Other Attractions', image: 'subcategory-images/69616369ac1fb.webp' },
      { title: 'Photo Spots', image: 'subcategory-images/68c5f68e0d520.webp' },
      { title: 'Historic', image: 'subcategory-images/68c5f5661e390.webp' },
      { title: 'Scenic', image: 'subcategory-images/68c5f3987ef27.webp' },
      { title: 'Iconic', image: 'subcategory-images/68c5f31fb000f.webp' },
    ],
  },
  {
    title: 'Water Sports',
    image: 'category-images/1752517805_aNgLVQt5I4.webp',
    children: [
      { title: 'House Boating', image: 'subcategory-images/6987915e10039.webp' },
      { title: 'Other Water Sports', image: 'subcategory-images/68bf1cd756824.webp' },
      { title: 'Paddleboarding', image: 'subcategory-images/68756b9c8fdc8.webp' },
      { title: 'Free Diving', image: 'subcategory-images/68757088cb9cc.webp' },
      { title: 'Scuba Diving', image: 'subcategory-images/687563664f6a3.webp' },
      { title: 'Kite Surfing', image: 'subcategory-images/687562a42f5d8.webp' },
      { title: 'Snorkeling', image: 'subcategory-images/6875630cd066d.webp' },
      { title: 'Canoeing', image: 'subcategory-images/687562cdb08d0.webp' },
      { title: 'Whale Watching', image: 'subcategory-images/68755ea6a383a.webp' },
      { title: 'Parasailing', image: 'subcategory-images/68755e4ea13af.webp' },
      { title: 'Fishing', image: 'subcategory-images/68755dbd5a68a.webp' },
      { title: 'River Rafting', image: 'subcategory-images/68755d7924ec6.webp' },
      { title: 'Kayaking', image: 'subcategory-images/687557a70828a.webp' },
      { title: 'Tubing', image: 'subcategory-images/687552d27a911.webp' },
      { title: 'Water Skiing', image: 'subcategory-images/68755119e954f.webp' },
      { title: 'Wakeboarding', image: 'subcategory-images/68755245aa22d.webp' },
      { title: 'Seadooing', image: 'subcategory-images/68754f54b8243.webp' },
      { title: 'Boating', image: 'subcategory-images/6875518f5e9ce.webp' },
    ],
  },
  {
    title: 'Outdoor',
    image: 'category-images/1752524496_TASsd0c5LM.webp',
    children: [
      { title: 'Spelunking / Caving', image: 'subcategory-images/69878f746f346.webp' },
      { title: 'Hot Springs', image: 'subcategory-images/696408948c7fa.webp' },
      { title: 'Other Outdoor', image: 'subcategory-images/68bf1c88f4080.webp' },
      { title: 'Tubogganing', image: 'subcategory-images/68a7453b30339.webp' },
      { title: 'Zoo', image: 'subcategory-images/68b87c75b900b.webp' },
      { title: 'Peddle Pub', image: 'subcategory-images/6875704c1e362.webp' },
      { title: 'Canyoning', image: 'subcategory-images/68756e7b8ee5a.webp' },
      { title: 'Ice Climbing', image: 'subcategory-images/68756ccbc97d8.webp' },
      { title: 'Slacklining', image: 'subcategory-images/68756cb764f21.webp' },
      { title: 'Skating', image: 'subcategory-images/68757000df558.webp' },
      { title: 'Hockey', image: 'subcategory-images/68756c3c4a798.webp' },
      { title: 'Tobogganing', image: 'subcategory-images/687568bbd0b5a.webp' },
      { title: 'Cross Country Skiing', image: 'subcategory-images/687568550874d.webp' },
      { title: 'Snowboarding/Skiing', image: 'subcategory-images/68756836a8699.webp' },
      { title: 'Skateboarding', image: 'subcategory-images/687567ecd0e41.webp' },
      { title: 'Hiking/Walking', image: 'subcategory-images/6963fa909ddab.webp' },
      { title: 'Rock Climbing', image: 'subcategory-images/687568dbd8cd9.webp' },
      { title: 'Golfing', image: 'subcategory-images/687570200354f.webp' },
      { title: 'Horseback Riding', image: 'subcategory-images/6875672c7e567.webp' },
      { title: 'Mountain/Fat Biking', image: 'subcategory-images/687569f5be29d.webp' },
    ],
  },
  {
    title: 'Entertainment and Festivals',
    image: 'category-images/1752536876_VGqHgfSTEJ.webp',
    children: [
      { title: 'Podcasts', image: 'subcategory-images/697a6428b881f.webp' },
      { title: 'Other Entertainment and Festivals', image: 'subcategory-images/68bf1cc173d4e.webp' },
      { title: 'Movies', image: 'subcategory-images/68b8843623411.webp' },
      { title: 'Theatre', image: 'subcategory-images/69878c5ea8bc0.webp' },
      { title: 'Comedy', image: 'subcategory-images/68b882f8e74b3.webp' },
      { title: 'Festival', image: 'subcategory-images/68baee6aa870f.webp' },
      { title: 'Concert', image: 'subcategory-images/68baecf128892.webp' },
    ],
  },
  {
    title: 'Motorized',
    image: 'category-images/1752526543_JtYu5CWH8f.webp',
    children: [
      { title: 'Other Motorized Experiences', image: 'subcategory-images/697a61ab69c25.webp' },
      { title: 'Limousine & Party Bus', image: 'subcategory-images/697a5b7f6a7f3.webp' },
      { title: 'Other Motorized', image: 'subcategory-images/68bf1cec2ee8a.webp' },
      { title: 'ATVS', image: 'subcategory-images/68756fbd5c259.webp' },
      { title: 'Trucks', image: 'subcategory-images/68756f6c04480.webp' },
      { title: 'Cars', image: 'subcategory-images/68756f0960559.webp' },
    ],
  },
  {
    title: 'Singles Events',
    image: 'category-images/1768261094_1En44yUYgc.webp',
    children: [
      { title: 'Single Event', image: 'subcategory-images/69658857e4395.webp' },
      { title: 'Singles Events Other', image: 'subcategory-images/696587bb52559.webp' },
      { title: 'LGBTQIA+', image: 'subcategory-images/6965873b30197.webp' },
    ],
  },
  {
    title: 'Venues & Spaces',
    image: 'category-images/1767987765_jQL2rMsoqL.webp',
    children: [
      { title: 'Other Venues', image: 'subcategory-images/69616297eae8d.webp' },
      { title: 'Event Venues', image: 'subcategory-images/696161481eed8.webp' },
      { title: 'Pool / Hot Tub', image: 'subcategory-images/69616049d34af.webp' },
    ],
  },
  {
    title: 'Indoor',
    image: 'category-images/1752528116_A4qvUDy673.webp',
    children: [
      { title: 'Museums & Exhibits', image: 'subcategory-images/696163d2e71a6.webp' },
      { title: 'Other Indoor', image: 'subcategory-images/68bf1c88f4080.webp' },
      { title: 'Mini Golf', image: 'subcategory-images/68baeb5d64c50.webp' },
      { title: 'Arcade', image: 'subcategory-images/6875b87dc91e7.webp' },
      { title: 'Lazer Tag', image: 'subcategory-images/68757a6d2d501.webp' },
      { title: 'Trampoline Park', image: 'subcategory-images/68757a340a4e8.webp' },
      { title: 'Smash Room', image: 'subcategory-images/68757a1471ab4.webp' },
      { title: 'Murder Mystery', image: 'subcategory-images/687579e17cf01.webp' },
      { title: 'Rock Climbing.', image: 'subcategory-images/68757705183f2.webp' },
      { title: 'Axe Throwing', image: 'subcategory-images/687576076f5cf.webp' },
      { title: 'Bowling', image: 'subcategory-images/687575cf41cd0.webp' },
      { title: 'Escape Room', image: 'subcategory-images/68bf1386b082e.webp' },
    ],
  },
  {
    title: 'For The EXTREME',
    image: 'category-images/1752537038_0Pnv8bbPya.webp',
    children: [
      { title: 'Other For The EXTREME', image: 'subcategory-images/68bf1d714f5c8.webp' },
      { title: 'Hot Air Balloon', image: 'subcategory-images/68759f6fb536a.webp' },
      { title: 'BMX', image: 'subcategory-images/6875b7143a7cc.webp' },
      { title: 'Hang Gliding', image: 'subcategory-images/68759f7b3fcc0.webp' },
      { title: 'Coasteering', image: 'subcategory-images/68759ce3aab2b.webp' },
      { title: 'Abseiling', image: 'subcategory-images/6875b7a4d35fb.webp' },
      { title: 'Zorbing', image: 'subcategory-images/6875b7cfa8099.webp' },
      { title: 'Volcano Boarding', image: 'subcategory-images/68759b3f1701c.webp' },
      { title: 'Base Jumping', image: 'subcategory-images/68759a0443715.webp' },
      { title: 'Archery', image: 'subcategory-images/687599663155d.webp' },
      { title: 'Helicopter', image: 'subcategory-images/687599373166c.webp' },
      { title: 'Cat Skiing', image: 'subcategory-images/687598a21b0fb.webp' },
      { title: 'HeliSking/Snow', image: 'subcategory-images/6875986dc063f.webp' },
      { title: 'Bungee Jumping', image: 'subcategory-images/6875b785bbede.webp' },
      { title: 'Skydiving', image: 'subcategory-images/68759823f2716.webp' },
    ],
  },
  {
    title: 'Gaming',
    image: 'category-images/1755720513_1rPSTi5uMb.webp',
    children: [
      { title: 'Other Gaming', image: 'subcategory-images/68bf1d0a90505.webp' },
      { title: 'Board Games', image: 'subcategory-images/6875958442691.webp' },
      { title: 'Video Game', image: 'subcategory-images/687594b529d81.webp' },
    ],
  },
  {
    title: 'Classes',
    image: 'category-images/1752527085_dTr3CkkjS9.webp',
    children: [
      { title: 'Other Classes', image: 'subcategory-images/68bf1cfba5fe1.webp' },
      { title: 'Cooking', image: 'subcategory-images/68b87b82ac438.webp' },
      { title: 'Lessons', image: 'subcategory-images/687573f997727.webp' },
      { title: 'Art.', image: 'subcategory-images/687573467e696.webp' },
      { title: 'Sports', image: 'subcategory-images/687572be0b8ab.webp' },
      { title: 'Mixology', image: 'subcategory-images/6875722c7188c.webp' },
      { title: 'Music', image: 'subcategory-images/687571f55a46b.webp' },
      { title: 'Martial Arts', image: 'subcategory-images/687571c951222.webp' },
      { title: 'Fitness', image: 'subcategory-images/687571912d44f.webp' },
      { title: 'Yoga', image: 'subcategory-images/687571710efe6.webp' },
      { title: 'Dance', image: 'subcategory-images/6875713b76f78.webp' },
    ],
  },
  {
    title: 'Races/Challenges',
    image: 'category-images/1752536734_P9wJFNG0Z4.webp',
    children: [
      { title: 'Other Races/Challenges', image: 'subcategory-images/68bf1c9e60e0c.webp' },
      { title: 'Multisport', image: 'subcategory-images/68bf1bce9acd5.webp' },
      { title: 'Specialty & Fun', image: 'subcategory-images/68bf1a1a1d718.webp' },
      { title: 'Adventure & Water', image: 'subcategory-images/68bf19c535cde.webp' },
      { title: 'Horse Racing', image: 'subcategory-images/68bf1932db831.webp' },
      { title: 'Winter Races', image: 'subcategory-images/68bf18f8f28a9.webp' },
      { title: 'Obstacle & Endurance', image: 'subcategory-images/68bf188a667d2.webp' },
      { title: 'Biking races', image: 'subcategory-images/68bf17a761961.webp' },
      { title: 'Motor & Car Racing', image: 'subcategory-images/68bf193e5f5f0.webp' },
      { title: 'Running', image: 'subcategory-images/68bf16ead3478.webp' },
    ],
  },
  {
    title: 'Other',
    image: 'category-images/1752536979_PRvzNInFzz.webp',
    children: [{ title: 'Other', image: 'subcategory-images/68bf1239ed29c.webp' }],
  },
];

/** Mirrors InterestSeeder.php — top-level categories, each with their sub-interests. */
async function seedInterests() {
  let count = 0;
  for (const category of CATEGORIES) {
    const parent = await Interest.findOneAndUpdate(
      { title: category.title, parent_id: null },
      { title: category.title, image: category.image, parent_id: null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    count++;

    for (const child of category.children) {
      await Interest.findOneAndUpdate(
        { title: child.title, parent_id: parent._id },
        { title: child.title, image: child.image, parent_id: parent._id },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      count++;
    }
  }

  console.log(`  Interests: ${count} seeded (${CATEGORIES.length} categories + ${count - CATEGORIES.length} sub-interests)`);
}

module.exports = seedInterests;
