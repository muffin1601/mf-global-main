require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/CareerJob');

const opensAt = new Date('2026-11-06T00:00:00+05:30');
const deadline = new Date('2026-11-30T23:59:59.999+05:30');
const common = {
  location: 'New Delhi',
  employmentType: 'Full-time',
  workMode: 'On-site',
  experience: 'See job details',
  vacancies: 1,
  qualifications: 'Relevant experience and qualifications for the role.',
  skills: 'Communication and teamwork.',
  benefits: '',
  opensAt,
  deadline,
  status: 'Active',
  isPublished: true,
  publishedAt: new Date(),
};
const jobs = [
  {
    title: 'Telemarketing Executive',
    department: 'Sales & Marketing',
    description: 'Build meaningful customer conversations and help prospective customers discover the right products and services.',
    responsibilities: 'Customer calling, lead generation, explaining products/services, following up with potential customers, maintaining customer records, and achieving sales targets.',
  },
  {
    title: 'E-commerce Executive',
    department: 'E-commerce',
    description: 'Support smooth day-to-day operations across online product listings, orders, and store updates.',
    responsibilities: 'Managing online product listings, updating product information, maintaining online stores, processing orders, coordinating with internal teams, and monitoring e-commerce operations.',
  },
  {
    title: 'E-commerce Sales Executive',
    department: 'Sales & E-commerce',
    description: 'Connect with online customers, nurture enquiries, and contribute to sales growth across e-commerce channels.',
    responsibilities: 'Generating online sales, handling customer inquiries, following up on leads, managing customer relationships, promoting products, and achieving sales targets.',
  },
];

(async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  for (const [index, job] of jobs.entries()) {
    const existing = await Job.findOne({ title: job.title }).select('_id displayOrder').lean();
    if (existing) {
      if (existing.displayOrder === undefined) {
        if (process.argv.includes('--apply')) { await Job.updateOne({ _id: existing._id }, { $set: { displayOrder: index + 1 } }); console.log(`Ordered: ${job.title}`); }
        else console.log(`Would order: ${job.title}`);
      } else console.log(`Existing: ${job.title}`);
      continue;
    }
    if (process.argv.includes('--apply')) {
      await Job.create({ ...common, ...job, displayOrder: index + 1 });
      console.log(`Added: ${job.title}`);
    } else console.log(`Would add: ${job.title}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
