const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');

/** Mirrors AdminSeeder.php — the two baseline admin accounts. */
async function seedAdmins() {
  const admins = [
    { name: 'AddVenture', email: 'addventureclassifieds@gmail.com', password: 'AddVenture@12345', role: 'super_admin' },
    { name: 'Super Admin', email: 'admin@admin.com', password: 'Admin@12345', role: 'super_admin' },
  ];

  for (const admin of admins) {
    await Admin.findOneAndUpdate(
      { email: admin.email },
      { name: admin.name, email: admin.email, password: await bcrypt.hash(admin.password, 10), role: admin.role, is_active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`  Admins: ${admins.length} seeded (${admins.map((a) => a.email).join(', ')})`);
}

module.exports = seedAdmins;
