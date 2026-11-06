const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const Job = require('../../models/CareerJob');
const Application = require('../../models/CareerApplication');
const Session = require('../../models/CareerSession');
const Attempt = require('../../models/CareerLoginAttempt');
const Settings = require('../../models/CareerSettings');
const { notifyCareerApplication } = require('../../services/careersNotification');

const router = express.Router();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const cookieName = 'career_admin';
const sessionMs = 30 * 60 * 1000;
const statuses = ['New', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'Hired'];
const jobFields = ['title', 'department', 'location', 'employmentType', 'workMode', 'experience', 'salaryRange', 'vacancies', 'displayOrder', 'description', 'responsibilities', 'qualifications', 'skills', 'benefits', 'opensAt', 'deadline', 'status', 'isPublished'];
const stringFields = ['fullName', 'email', 'phone', 'location', 'experience', 'currentCompany', 'designation', 'expectedSalary', 'noticePeriod', 'coverLetter', 'comments'];
const applicationLimits = { fullName:120, email:254, phone:30, location:120, experience:80, currentCompany:120, designation:120, expectedSalary:100, noticePeriod:100, coverLetter:3000, comments:3000 };
const allowedExtensions = new Set(['pdf', 'doc', 'docx']);
const allowedMimeTypes = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 15, fieldSize: 5000 } });
const limiter = (max, windowMs) => rateLimit({ windowMs, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, handler: (_req, res) => res.status(429).json({ message: 'Too many requests. Please try again later.' }) });
const readCookie = req => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.CAREERS_COOKIE_SAMESITE === 'none' ? 'none' : 'lax', path: '/api/careers/admin', maxAge: sessionMs });
const audit = (req, action, detail = '') => console.info(JSON.stringify({ event: 'careers_admin', action, detail, ip: req.ip, at: new Date().toISOString() }));
const invalidId = id => !mongoose.isValidObjectId(id);
const pageOptions = req => ({ page: Math.max(1, Math.min(10000, Number(req.query.page) || 1)), limit: Math.max(1, Math.min(100, Number(req.query.limit) || 20)) });
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const sendError = (res, error) => res.status(400).json({ message: error.message || 'Invalid request.' });

async function requireAdmin(req, res, next) {
  try {
    const token = readCookie(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ message: 'Admin session required.' });
    const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
    if (!session) return res.status(401).json({ message: 'Admin session expired.' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrf = req.get('x-csrf-token') || '';
      if (!/^[a-f0-9]{64}$/.test(csrf) || hash(csrf) !== session.csrfHash) return res.status(403).json({ message: 'Invalid CSRF token.' });
      const origin = req.get('origin');
      const allowed = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(v => v.trim());
      if (origin && !allowed.includes(origin)) return res.status(403).json({ message: 'Origin rejected.' });
    }
    session.expiresAt = new Date(Date.now() + sessionMs);
    await session.save();
    res.cookie(cookieName, token, cookieOptions());
    req.careerSession = session;
    next();
  } catch (error) { next(error); }
}

router.post('/careers/admin/login', limiter(10, 15 * 60 * 1000), async (req, res, next) => {
  try {
    const ipHash = hash(req.ip || 'unknown');
    const attempt = await Attempt.findOne({ ipHash });
    if (attempt?.lockedUntil > new Date()) return res.status(429).json({ message: 'PIN access is temporarily locked. Try again later.' });
    const pin = req.body?.pin;
    const configuredHash = (await Settings.findOne({ key: 'admin' }))?.pinHash || process.env.CAREERS_ADMIN_PIN_HASH;
    if (!configuredHash) return res.status(503).json({ message: 'Careers admin PIN is not configured.' });
    const valid = typeof pin === 'string' && /^\d{6}$/.test(pin) && await bcrypt.compare(pin, configuredHash);
    if (!valid) {
      const failures = (attempt?.failures || 0) + 1;
      await Attempt.findOneAndUpdate({ ipHash }, { failures, lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null, updatedAt: new Date() }, { upsert: true });
      audit(req, 'login_failed');
      return res.status(failures >= 5 ? 429 : 401).json({ message: failures >= 5 ? 'PIN access is temporarily locked. Try again later.' : 'Invalid PIN.' });
    }
    await Attempt.deleteOne({ ipHash });
    const token = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(32).toString('hex');
    await Session.create({ tokenHash: hash(token), csrfHash: hash(csrf), expiresAt: new Date(Date.now() + sessionMs) });
    res.cookie(cookieName, token, cookieOptions());
    audit(req, 'login_success');
    res.json({ authenticated: true, csrfToken: csrf });
  } catch (error) { next(error); }
});
router.get('/careers/admin/session', requireAdmin, async (req, res, next) => {
  try { const csrf = crypto.randomBytes(32).toString('hex'); req.careerSession.csrfHash = hash(csrf); await req.careerSession.save(); res.json({ authenticated: true, csrfToken: csrf }); } catch (error) { next(error); }
});
router.post('/careers/admin/logout', requireAdmin, async (req, res, next) => {
  try { await req.careerSession.deleteOne(); res.clearCookie(cookieName, cookieOptions()); audit(req, 'logout'); res.json({ success: true }); } catch (error) { next(error); }
});
router.post('/careers/admin/csrf', requireAdmin, async (req, res, next) => {
  try { const csrf = crypto.randomBytes(32).toString('hex'); req.careerSession.csrfHash = hash(csrf); await req.careerSession.save(); res.json({ csrfToken: csrf }); } catch (error) { next(error); }
});
router.post('/careers/admin/change-pin', requireAdmin, async (req, res, next) => {
  try {
    const { currentPin, newPin } = req.body || {};
    const currentHash = (await Settings.findOne({ key: 'admin' }))?.pinHash || process.env.CAREERS_ADMIN_PIN_HASH;
    if (!/^\d{6}$/.test(currentPin || '') || !/^\d{6}$/.test(newPin || '') || !currentHash || !await bcrypt.compare(currentPin, currentHash) || currentPin === newPin) return res.status(400).json({ message: 'Invalid current or new PIN.' });
    await Settings.findOneAndUpdate({ key: 'admin' }, { pinHash: await bcrypt.hash(newPin, 12), updatedAt: new Date() }, { upsert: true });
    await Session.deleteMany({ _id: { $ne: req.careerSession._id } });
    audit(req, 'pin_changed');
    res.json({ success: true });
  } catch (error) { next(error); }
});

const publicFilter = () => ({ status: 'Active', isPublished: true, archivedAt: null, deadline: { $gte: new Date() } });
router.get('/careers/jobs', async (req, res, next) => {
  try { const { page, limit } = pageOptions(req); const filter = publicFilter(); const search = text(req.query.search, 100); if (search) filter.title = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); for (const key of ['department', 'location', 'employmentType']) if (req.query[key]) filter[key] = text(req.query[key], 120); const [jobs, total] = await Promise.all([Job.find(filter).select('-__v').sort({ displayOrder: 1, publishedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Job.countDocuments(filter)]); res.json({ jobs, total, page, pages: Math.ceil(total / limit) }); } catch (error) { next(error); }
});
router.get('/careers/jobs/:id', async (req, res, next) => {
  try { if (invalidId(req.params.id)) return res.sendStatus(404); const job = await Job.findOne({ _id: req.params.id, ...publicFilter() }).lean(); if (!job) return res.sendStatus(404); res.json(job); } catch (error) { next(error); }
});
const signatureValid = (file, ext) => ext === 'pdf' ? file.buffer.subarray(0, 5).toString() === '%PDF-' : ext === 'doc' ? file.buffer.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])) : file.buffer.subarray(0, 4).equals(Buffer.from([0x50,0x4b,0x03,0x04])) && file.buffer.includes(Buffer.from('[Content_Types].xml')) && file.buffer.includes(Buffer.from('word/document.xml'));
router.post('/careers/apply', limiter(5, 60 * 1000), (req, res, next) => upload.single('resume')(req, res, error => error ? res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: 'Invalid resume upload.' }) : next()), async (req, res, next) => {
  try {
    if (stringFields.some(key => typeof req.body?.[key] === 'string' && req.body[key].length > applicationLimits[key])) return res.status(400).json({ message: 'Application field is too long.' });
    const data = Object.fromEntries(stringFields.map(key => [key, text(req.body?.[key], applicationLimits[key])]));
    const { jobId, submissionKey } = req.body || {};
    if (invalidId(jobId) || !data.fullName || data.fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254 || data.phone.replace(/\D/g, '').length < 10 || data.phone.replace(/\D/g, '').length > 15 || !data.location || data.location.length > 120 || !data.experience || data.experience.length > 80 || !data.noticePeriod || data.noticePeriod.length > 100 || req.body?.consent !== 'true') return res.status(400).json({ message: 'Please complete all required application fields.' });
    if (!/^[a-f0-9-]{20,80}$/i.test(submissionKey || '')) return res.status(400).json({ message: 'Invalid submission key.' });
    const ext = req.file?.originalname.split('.').pop()?.toLowerCase();
    if (!req.file || !allowedExtensions.has(ext) || ![allowedMimeTypes[ext], 'application/octet-stream'].includes(req.file.mimetype) || !signatureValid(req.file, ext)) return res.status(400).json({ message: 'Upload a valid PDF, DOC, or DOCX resume.' });
    const job = await Job.findOne({ _id: jobId, ...publicFilter() });
    if (!job) return res.status(409).json({ message: 'This job is no longer accepting applications.' });
    if (job.opensAt && job.opensAt > new Date()) return res.status(409).json({ message: 'Applications for this job have not opened yet.' });
    const existing = await Application.findOne({ submissionKey }).select('_id');
    if (existing) return res.json({ success: true, applicationId: existing.id, message: 'Application already received.' });
    const application = await Application.create({ ...data, jobId: job.id, jobTitle: job.title, department: job.department, consent: true, submissionKey, resume: { data: req.file.buffer, contentType: allowedMimeTypes[ext], filename: `resume.${ext}` } });
    try { await notifyCareerApplication(application); }
    catch (error) { console.error('Careers email notification failed:', error.message); }
    res.status(201).json({ success: true, applicationId: application.id, message: 'Your application has been submitted.' });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ message: 'Application already received.' }); next(error); }
});

router.use('/careers/admin', requireAdmin);
router.get('/careers/admin/jobs', async (req, res, next) => { try { const {page,limit}=pageOptions(req); const filter={}; if(req.query.status) filter.status=req.query.status; if(req.query.search) filter.title=new RegExp(text(req.query.search,100).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'); const [jobs,total]=await Promise.all([Job.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),Job.countDocuments(filter)]); const ids=jobs.map(j=>j._id); const counts=await Application.aggregate([{ $match:{jobId:{$in:ids}}},{ $group:{_id:'$jobId',count:{$sum:1}}}]); const countMap=new Map(counts.map(c=>[String(c._id),c.count])); res.json({jobs:jobs.map(j=>({...j,applicationCount:countMap.get(String(j._id))||0})),total,page,pages:Math.ceil(total/limit)}); } catch(error){next(error);} });
const jobPayload = body => Object.fromEntries(jobFields.filter(key=>Object.hasOwn(body||{},key)).map(key=>[key, /^\d{4}-\d{2}-\d{2}$/.test(body[key]) && key==='deadline' ? `${body[key]}T23:59:59.999+05:30` : /^\d{4}-\d{2}-\d{2}$/.test(body[key]) && key==='opensAt' ? `${body[key]}T00:00:00+05:30` : body[key]]));
router.post('/careers/admin/jobs', async(req,res,next)=>{try{const job=await Job.create(jobPayload(req.body)); if(job.isPublished&&job.status==='Active') job.publishedAt=new Date(); await job.save(); audit(req,'job_created',job.id); res.status(201).json(job);}catch(error){sendError(res,error);}});
router.put('/careers/admin/jobs/:id', async(req,res,next)=>{try{if(invalidId(req.params.id))return res.sendStatus(404); const job=await Job.findById(req.params.id); if(!job)return res.sendStatus(404); const wasPublished=job.isPublished; Object.assign(job,jobPayload(req.body)); if(job.isPublished&&!wasPublished)job.publishedAt=new Date(); await job.save(); audit(req,'job_updated',job.id); res.json(job);}catch(error){sendError(res,error);}});
router.delete('/careers/admin/jobs/:id', async(req,res,next)=>{try{if(invalidId(req.params.id))return res.sendStatus(404); const job=await Job.findByIdAndUpdate(req.params.id,{archivedAt:new Date(),status:'Closed',isPublished:false},{new:true}); if(!job)return res.sendStatus(404); audit(req,'job_archived',job.id); res.json({success:true});}catch(error){next(error);}});
const applicationFilter=req=>{const f={};if(req.query.jobId&&mongoose.isValidObjectId(req.query.jobId))f.jobId=req.query.jobId;if(req.query.department)f.department=text(req.query.department,100);if(req.query.status)f.status=req.query.status;if(req.query.from||req.query.to){f.createdAt={};if(req.query.from)f.createdAt.$gte=new Date(req.query.from);if(req.query.to)f.createdAt.$lte=new Date(req.query.to);}if(req.query.search){const q=new RegExp(text(req.query.search,100).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');f.$or=[{fullName:q},{email:q},{phone:q},{jobTitle:q}];if(mongoose.isValidObjectId(req.query.search))f.$or.push({_id:req.query.search});}return f;};
router.get('/careers/admin/applications',async(req,res,next)=>{try{const {page,limit}=pageOptions(req);const filter=applicationFilter(req);const [items,total]=await Promise.all([Application.find(filter).select('-resume -submissionKey').sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),Application.countDocuments(filter)]);res.json({applications:items,total,page,pages:Math.ceil(total/limit)});}catch(error){next(error);}});
router.get('/careers/admin/applications/:id/resume',async(req,res,next)=>{try{if(invalidId(req.params.id))return res.sendStatus(404);const item=await Application.findById(req.params.id).select('resume');if(!item?.resume?.data)return res.sendStatus(404);res.set('Content-Type',item.resume.contentType).set('Content-Disposition',`${req.query.download==='1'?'attachment':'inline'}; filename="${item.resume.filename}"`).set('Cache-Control','no-store').send(item.resume.data);}catch(error){next(error);}});
router.get('/careers/admin/applications/:id',async(req,res,next)=>{try{if(invalidId(req.params.id))return res.sendStatus(404);const item=await Application.findById(req.params.id).select('-resume -submissionKey');if(!item)return res.sendStatus(404);res.json(item);}catch(error){next(error);}});
router.patch('/careers/admin/applications/:id',async(req,res,next)=>{try{if(invalidId(req.params.id))return res.sendStatus(404);const update={};if(Object.hasOwn(req.body,'status')){if(!statuses.includes(req.body.status))return res.status(400).json({message:'Invalid status.'});update.status=req.body.status;}if(Object.hasOwn(req.body,'adminNotes'))update.adminNotes=text(req.body.adminNotes,5000);const item=await Application.findByIdAndUpdate(req.params.id,update,{new:true,runValidators:true}).select('-resume -submissionKey');if(!item)return res.sendStatus(404);audit(req,'application_updated',item.id);res.json(item);}catch(error){next(error);}});
router.delete('/careers/admin/applications/:id',async(req,res,next)=>{try{if(invalidId(req.params.id))return res.sendStatus(404);const item=await Application.findByIdAndDelete(req.params.id);if(!item)return res.sendStatus(404);audit(req,'application_deleted',item.id);res.json({success:true});}catch(error){next(error);}});
router.get('/careers/admin/export',async(req,res,next)=>{try{const items=await Application.find(applicationFilter(req)).select('-resume -submissionKey -__v').sort({createdAt:-1}).lean();const safeCell=value=>typeof value==='string' && /^[=+@\-\t\r]/.test(value) ? `\u0027${value}` : value;const rows=items.map(({_id,jobId,...rest})=>Object.fromEntries(Object.entries({applicationId:String(_id),jobId:String(jobId),...rest}).map(([key,value])=>[key,safeCell(value)])));const csv=new Parser({fields:['applicationId','jobId','jobTitle','department','fullName','email','phone','location','experience','currentCompany','designation','expectedSalary','noticePeriod','coverLetter','comments','consent','status','adminNotes','createdAt','updatedAt'],withBOM:true}).parse(rows);res.set('Content-Type','text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="career-applications.csv"').send(csv);}catch(error){next(error);}});
router.get('/careers/admin/stats',async(req,res,next)=>{try{const [totalJobs,activeJobs,draftJobs,closedJobs,totalApplications,newApplications,shortlistedCandidates,hiredCandidates,recentApplications,recentJobs,byJob,byStatus]=await Promise.all([Job.countDocuments({}),Job.countDocuments({status:'Active'}),Job.countDocuments({status:'Draft'}),Job.countDocuments({status:'Closed'}),Application.countDocuments({}),Application.countDocuments({status:'New'}),Application.countDocuments({status:'Shortlisted'}),Application.countDocuments({status:'Hired'}),Application.find().select('-resume -submissionKey').sort({createdAt:-1}).limit(5).lean(),Job.find({isPublished:true}).sort({publishedAt:-1}).limit(5).lean(),Application.aggregate([{$group:{_id:'$jobTitle',count:{$sum:1}}},{$sort:{count:-1}},{$limit:10}]),Application.aggregate([{$group:{_id:'$status',count:{$sum:1}}}])]);res.json({totalJobs,activeJobs,draftJobs,closedJobs,totalApplications,newApplications,shortlistedCandidates,hiredCandidates,recentApplications,recentJobs,byJob,byStatus});}catch(error){next(error);}});
module.exports=router;
