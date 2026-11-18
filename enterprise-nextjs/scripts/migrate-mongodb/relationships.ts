import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

const uri=process.env.LEGACY_MONGODB_URI;
const databaseName=process.env.LEGACY_MONGODB_DATABASE;
if(!uri||!databaseName)throw new Error("Missing required environment variable names: LEGACY_MONGODB_URI, LEGACY_MONGODB_DATABASE");
const client=new MongoClient(uri,{readPreference:"secondaryPreferred",retryReads:true,serverSelectionTimeoutMS:15_000});
const scalar=async(db:ReturnType<MongoClient["db"]>,collection:string,pipeline:object[])=>Number((await db.collection(collection).aggregate([...pipeline,{$count:"count"}]).next())?.count??0);

async function main(){await client.connect();const db=client.db(databaseName);const collections=new Set((await db.listCollections({}, {nameOnly:true}).toArray()).map(x=>x.name));const has=(name:string)=>collections.has(name);const checks:Record<string,number>={};
  if(has("clientpermissions")){
    checks.clientPermissionDuplicatePairs=await scalar(db,"clientpermissions",[{$group:{_id:{userId:"$userId",clientId:"$clientId"},count:{$sum:1}}},{$match:{count:{$gt:1}}}]);
    checks.clientPermissionOrphanUsers=await scalar(db,"clientpermissions",[{$lookup:{from:"users",localField:"userId",foreignField:"_id",as:"target"}},{$match:{target:{$size:0}}}]);
    checks.clientPermissionOrphanClients=await scalar(db,"clientpermissions",[{$lookup:{from:"clientdatas",localField:"clientId",foreignField:"_id",as:"target"}},{$match:{target:{$size:0}}}]);
  }
  if(has("clientdatas"))checks.embeddedAssignmentOrphanUsers=await scalar(db,"clientdatas",[{$unwind:"$assignedTo"},{$lookup:{from:"users",localField:"assignedTo.user._id",foreignField:"_id",as:"target"}},{$match:{target:{$size:0}}}]);
  if(has("comments"))checks.commentOrphanBlogs=await scalar(db,"comments",[{$lookup:{from:"blogs",localField:"blogId",foreignField:"_id",as:"target"}},{$match:{target:{$size:0}}}]);
  if(has("quotations"))checks.quotationOrphanUsers=await scalar(db,"quotations",[{$lookup:{from:"users",localField:"user",foreignField:"_id",as:"target"}},{$match:{target:{$size:0}}}]);
  if(has("products")){
    checks.productMissingCategoryCodes=await scalar(db,"products",[{$lookup:{from:"categories",localField:"cat_id",foreignField:"cat_id",as:"target"}},{$match:{target:{$size:0}}}]);
    checks.productOrphanCreators=await scalar(db,"products",[{$match:{createdBy:{$type:"objectId"}}},{$lookup:{from:"users",localField:"createdBy",foreignField:"_id",as:"target"}},{$match:{target:{$size:0}}}]);
    checks.productOrphanUpdaters=await scalar(db,"products",[{$match:{updatedBy:{$type:"objectId"}}},{$lookup:{from:"users",localField:"updatedBy",foreignField:"_id",as:"target"}},{$match:{target:{$size:0}}}]);
  }
  if(has("activitylogs"))checks.activityUnknownUserCodes=await scalar(db,"activitylogs",[{$lookup:{from:"users",localField:"userId",foreignField:"userId",as:"target"}},{$match:{target:{$size:0}}}]);
  if(has("careerapplications"))checks.careerApplicationOrphanJobs=await scalar(db,"careerapplications",[{$lookup:{from:"careerjobs",localField:"jobId",foreignField:"_id",as:"target"}},{$match:{target:{$size:0}}}]);
  const report={generatedAt:new Date().toISOString(),mode:"read-only-relationship-audit",checks};const directory=resolve(process.env.MIGRATION_REPORT_DIR??"./migration-reports");await mkdir(directory,{recursive:true});const output=resolve(directory,"mongodb-relationship-audit.json");await writeFile(output,JSON.stringify(report,null,2),"utf8");console.log(JSON.stringify({output,checks},null,2));
}
main().finally(()=>client.close());
