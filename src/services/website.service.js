const ContactUs = require('../models/ContactUs');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const ParkStayLead = require('../models/ParkStayLead');
const { sendEmailViaMailgun } = require('../integrations/mailgun');

const TYPE_LABELS = {
  host: ['host', 'i have a place to rent'],
  guest: ['guest', 'traveler', 'traveller', 'guest / traveler', 'guest/traveler', 'guest / traveller', 'guest/traveller', 'i am looking for place to stay'],
};

function normalizeType(type) {
  const key = String(type || '').trim().toLowerCase();
  if (TYPE_LABELS.host.includes(key)) return 'host';
  if (TYPE_LABELS.guest.includes(key)) return 'guest';
  return null;
}

async function subscribeNewsletter({ email, source }) {
  const existing = await NewsletterSubscriber.findOne({ email });
  await NewsletterSubscriber.updateOne(
    { email },
    { is_active: true, subscribed_at: new Date(), unsubscribed_at: null, source: source || 'website-footer' },
    { upsert: true }
  );

  return existing ? "You're already subscribed - welcome back!" : 'Thank you for subscribing!';
}

async function contact({ first_name, last_name, email, phone, message }) {
  const contactRecord = await ContactUs.create({ first_name, last_name, email, phone: phone || null, message });

  sendEmailViaMailgun(
    process.env.MAIL_CONTACT_TO || 'addventureclassifieds@gmail.com',
    'New contact form submission',
    `<p><strong>From:</strong> ${first_name} ${last_name} (${email})</p><p><strong>Phone:</strong> ${phone || '-'}</p><p>${message}</p>`
  ).catch(() => {});

  return { id: contactRecord.id };
}

async function parkStayLead({ type, name, email, phone, description }) {
  const normalizedType = normalizeType(type);

  const existing = await ParkStayLead.findOne({ email, type: normalizedType });
  const lead = await ParkStayLead.findOneAndUpdate(
    { email, type: normalizedType },
    { name, phone: phone || null, description: description || null },
    { upsert: true, new: true }
  );

  return {
    message: existing ? "You're already on the list — we've updated your details." : "You're on the list! We'll be in touch soon.",
    data: { id: lead.id, type: normalizedType },
  };
}

module.exports = { normalizeType, subscribeNewsletter, contact, parkStayLead };
