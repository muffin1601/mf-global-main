import "dotenv/config";
import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { Binary, MongoClient, ObjectId, type Document } from "mongodb";

type FieldStats={types:Record<string,number>;observed:number;nulls:number;emptyStrings:number;objectIdSamples:string[]};
type DuplicateCheck={fields:string[];duplicateGroups:number;documentsInDuplicateGroups:number;truncated:boolean};
type FileStats={observed:number;binary:number;stringPaths:number;localExisting:number;localMissing:number;remoteUrls:number;unverifiable:number};
const uri=process.env.LEGACY_MONGODB_URI;
const databaseName=process.env.LEGACY_MONGODB_DATABASE;
if(!uri||!databaseName)throw new Error("Missing required environment variable names: LEGACY_MONGODB_URI, LEGACY_MONGODB_DATABASE");
const sampleLimit=Math.min(1000,Math.max(50,Number(process.env.MIGRATION_INVENTORY_SAMPLE_SIZE??500)));
const outputDirectory=resolve(process.env.MIGRATION_REPORT_DIR??"./migration-reports");
const client=new MongoClient(uri,{readPreference:"secondaryPreferred",retryReads:true,serverSelectionTimeoutMS:15_000});

function bsonType(value:unknown){if(value===null)return"null";if(value instanceof ObjectId)return"objectId";if(value instanceof Date)return"date";if(value instanceof Binary||Buffer.isBuffer(value))return"binary";if(Array.isArray(value))return"array";return typeof value;}
function recordField(map:Map<string,FieldStats>,path:string,value:unknown){const stats=map.get(path)??{types:{},observed:0,nulls:0,emptyStrings:0,objectIdSamples:[]};const type=bsonType(value);stats.types[type]=(stats.types[type]??0)+1;stats.observed++;if(value===null)stats.nulls++;if(value==="")stats.emptyStrings++;if(value instanceof ObjectId&&stats.objectIdSamples.length<25)stats.objectIdSamples.push(value.toHexString());map.set(path,stats);if(Array.isArray(value)){for(const item of value.slice(0,25)){recordField(map,`${path}[]`,item);if(item&&typeof item==="object"&&!(item instanceof Date)&&!(item instanceof ObjectId)&&!(item instanceof Binary)&&!Buffer.isBuffer(item))walk(map,item as Document,`${path}[]`)}}else if(value&&typeof value==="object"&&!(value instanceof Date)&&!(value instanceof ObjectId)&&!(value instanceof Binary)&&!Buffer.isBuffer(value))walk(map,value as Document,path)}
function walk(map:Map<string,FieldStats>,doc:Document,prefix=""){for(const [key,value] of Object.entries(doc)){const path=prefix?`${prefix}.${key}`:key;recordField(map,path,value)}}
function safeIndex(index:Document){return{name:index.name,key:index.key,unique:Boolean(index.unique),sparse:Boolean(index.sparse),partial:Boolean(index.partialFilterExpression),expireAfterSeconds:index.expireAfterSeconds??null};}
async function duplicateCheck(collection:ReturnType<ReturnType<MongoClient["db"]>["collection"]>,fields:string[]):Promise<DuplicateCheck>{const id=fields.map(field=>`$${field}`);const rows=await collection.aggregate([{$match:{$and:fields.map(field=>({[field]:{$exists:true,$nin:[null,""]}}))}},{$group:{_id:id.length===1?id[0]:id,count:{$sum:1}}},{$match:{count:{$gt:1}}},{$limit:101}]).toArray();const shown=rows.slice(0,100);return{fields,duplicateGroups:shown.length,documentsInDuplicateGroups:shown.reduce((sum,row)=>sum+Number(row.count),0),truncated:rows.length>100};}
function isFileField(path:string){return/(^|[._])(file|filename|storedname|originalname|image|media|resume|document|path|url)s?([._]|$)/i.test(path);}
async function inspectFiles(samples:Document[],fieldPaths:string[]){
  const result:Record<string,FileStats>={};
  for(const path of fieldPaths.filter(isFileField)){
    const stats:FileStats={observed:0,binary:0,stringPaths:0,localExisting:0,localMissing:0,remoteUrls:0,unverifiable:0};
    const parts=path.replace(/\[\]/g,"").split(".");
    for(const doc of samples){
      let values:unknown[]=[doc];
      for(const part of parts){
        values=values.flatMap(value=>{
          if(Array.isArray(value))return value.flatMap(item=>item&&typeof item==="object"?[(item as Document)[part]]:[]);
          return value&&typeof value==="object"?[(value as Document)[part]]:[];
        }).filter(value=>value!==undefined&&value!==null);
      }
      for(const value of values){
        stats.observed++;
        if(value instanceof Binary||Buffer.isBuffer(value)){stats.binary++;continue;}
        if(typeof value!=="string"||!value.trim()){stats.unverifiable++;continue;}
        if(/^https?:\/\//i.test(value)){stats.remoteUrls++;continue;}
        stats.stringPaths++;
        const normalized=value.replace(/^[/\\]+/,"");
        const candidates=isAbsolute(value)?[value]:[resolve("../backend",normalized),resolve("../frontend/public",normalized),resolve("../frontend",normalized)];
        let exists=false;
        for(const candidate of candidates){try{await access(candidate);exists=true;break;}catch{}}
        if(exists)stats.localExisting++;else stats.localMissing++;
      }
    }
    if(stats.observed)result[path]=stats;
  }
  return result;
}

async function main(){await client.connect();const db=client.db(databaseName);const infos=await db.listCollections({}, {nameOnly:true}).toArray();const inventory=[];let totalDocuments=0;for(const info of infos.sort((a,b)=>a.name.localeCompare(b.name))){const collection=db.collection(info.name);const count=await collection.countDocuments({});totalDocuments+=count;const head=await collection.find({}).sort({_id:1}).limit(Math.ceil(sampleLimit/2)).toArray();const tail=await collection.find({}).sort({_id:-1}).limit(Math.floor(sampleLimit/2)).toArray();const byId=new Map([...head,...tail].map(doc=>[String(doc._id),doc]));const samples=[...byId.values()];const fields=new Map<string,FieldStats>();for(const doc of samples)walk(fields,doc);const indexes=(await collection.indexes()).map(safeIndex);const checks:string[][]=[];for(const index of indexes){if(index.unique&&index.key&&typeof index.key==="object"){const names=Object.keys(index.key);if(names.length)checks.push(names)}}for(const candidate of ["email","username","phone","contact","vendorCode","p_code","cat_id","submissionKey"]){if(fields.has(candidate)&&!checks.some(check=>check.length===1&&check[0]===candidate))checks.push([candidate])}const duplicates=[];for(const check of checks.slice(0,20)){try{duplicates.push(await duplicateCheck(collection,check))}catch{duplicates.push({fields:check,duplicateGroups:0,documentsInDuplicateGroups:0,truncated:false,error:"check_failed"})}}const fieldRows=[...fields.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([path,stats])=>({path,types:stats.types,observedInSample:stats.observed,nullsInSample:stats.nulls,emptyStringsInSample:stats.emptyStrings,objectIdReferenceCandidate:stats.objectIdSamples.length>0}));inventory.push({collection:info.name,documentCount:count,sampleSize:samples.length,sampleCoverage:count?Math.min(1,samples.length/count):1,indexes,fields:fieldRows,duplicateChecks:duplicates,fileReferences:await inspectFiles(samples,fieldRows.map(field=>field.path)),canonicalSampleDigest:createHash("sha256").update(JSON.stringify(samples,(_key,value)=>value instanceof ObjectId?value.toHexString():value instanceof Binary?`<binary:${value.length()}>`:value)).digest("hex")})}const report={generatedAt:new Date().toISOString(),databaseName,mode:"read-only-bounded-inventory",sampleLimit,totalCollections:inventory.length,totalDocuments,collections:inventory};await mkdir(outputDirectory,{recursive:true});const output=resolve(outputDirectory,"mongodb-complete-inventory.json");await writeFile(output,JSON.stringify(report,null,2),"utf8");console.log(JSON.stringify({output,totalCollections:inventory.length,totalDocuments,collections:inventory.map(row=>({name:row.collection,count:row.documentCount,fields:row.fields.length,indexes:row.indexes.length}))},null,2))}
main().finally(()=>client.close());
