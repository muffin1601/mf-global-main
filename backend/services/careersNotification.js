const { Resend } = require('resend');

const defaultRecipients = 'sales@mfglobalservices.com,faruk@mfglobalservices.com';

async function notifyCareerApplication(application) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Careers email notification skipped: RESEND_API_KEY is not configured.');
    return false;
  }

  const recipients = [...new Set((process.env.CAREERS_NOTIFICATION_EMAILS || defaultRecipients)
    .split(',').map(address => address.trim()).filter(Boolean))];
  if (!recipients.length) {
    console.warn('Careers email notification skipped: no recipients configured.');
    return false;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const text = [
    'A new careers application was submitted.',
    '',
    `Application ID: ${application.id}`,
    `Job: ${application.jobTitle}`,
    `Department: ${application.department}`,
    `Submitted: ${application.createdAt.toISOString()}`,
    '',
    `Name: ${application.fullName}`,
    `Email: ${application.email}`,
    `Phone: ${application.phone}`,
    `Current location: ${application.location}`,
    `Job designation: ${application.jobDesignation}`,
    `Highest qualification: ${application.qualification}`,
    `Stream / subject: ${application.stream || 'Not provided'}`,
    `Total experience: ${application.experience}`,
    `Previous company key responsibilities: ${application.keyResponsibilities || 'Not provided'}`,
    `Current company: ${application.currentCompany || 'Not provided'}`,
    `Current designation: ${application.designation || 'Not provided'}`,
    `Expected salary: ${application.expectedSalary || 'Not provided'}`,
    `Notice period: ${application.noticePeriod}`,
    `Cover letter: ${application.coverLetter || 'Not provided'}`,
    `Additional comments: ${application.comments || 'Not provided'}`,
    '',
    'Open the Careers Admin dashboard to review the application and resume.',
  ].join('\n');

  const results = await Promise.allSettled(recipients.map(to => resend.emails.send({
    from: process.env.CAREERS_NOTIFICATION_FROM || 'no-reply@mfglobalservices.com',
    to,
    reply_to: application.email,
    subject: `New careers application: ${application.jobTitle.replace(/[\r\n]/g, ' ')}`,
    text,
  })));
  const delivered = results.every(result => result.status === 'fulfilled' && !result.value.error);
  if (!delivered) console.error('Careers email notification failed for one or more recipients.', results.map(result => result.status === 'rejected' ? result.reason?.message : result.value.error?.message || null));
  return delivered;
}

module.exports = { notifyCareerApplication };
