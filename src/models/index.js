// Central registration point — required once at startup so every model is
// registered with Mongoose before any populate()/ref resolution happens,
// regardless of which module is built/wired up first.
require('../config/mongoosePlugins'); // ensure the id-transform plugin is active even if db.js wasn't required first

module.exports = {
  User: require('./User'),
  Admin: require('./Admin'),
  AuthToken: require('./AuthToken'),
  CompanyCategory: require('./CompanyCategory'),
  LoginHistory: require('./LoginHistory'),
  Interest: require('./Interest'),

  Event: require('./Event'),
  EventVisit: require('./EventVisit'),
  EventReview: require('./EventReview'),
  TicketCategory: require('./TicketCategory'),

  TicketBooking: require('./TicketBooking'),
  Payment: require('./Payment'),
  Payout: require('./Payout'),
  WalletTransaction: require('./WalletTransaction'),

  PaymentPlan: require('./PaymentPlan'),
  FeatureCatalog: require('./FeatureCatalog'),
  ServiceModuleMapping: require('./ServiceModuleMapping'),
  TaxRate: require('./TaxRate'),
  UserSubscription: require('./UserSubscription'),

  Post: require('./Post'),
  PostComment: require('./PostComment'),
  Group: require('./Group'),
  Report: require('./Report'),
  PostView: require('./PostView'),
  RewardRule: require('./RewardRule'),
  RewardTransaction: require('./RewardTransaction'),

  Conversation: require('./Conversation'),
  Message: require('./Message'),
  Connection: require('./Connection'),

  Notification: require('./Notification'),
  ContactUs: require('./ContactUs'),
  NewsletterSubscriber: require('./NewsletterSubscriber'),
  ParkStayLead: require('./ParkStayLead'),
};
