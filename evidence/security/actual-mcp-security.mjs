import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This acceptance harness lives outside the candidate source and never uses the
// original Codex home. The sibling fixture is deliberately outside /tmp: the
// official workspace sandbox may allow /tmp writes.
// Public copy only: future reproduction output does not overwrite preserved evidence.
const out = path.resolve(process.env.CODEXLESS_ACCEPTANCE_OUTPUT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'reproduction-output'));
await mkdir(out, { recursive: true });
const source = path.resolve(process.env.CODEXLESS_ACCEPTANCE_SOURCE);
const codexBin = path.resolve(process.env.CODEXLESS_ACCEPTANCE_CODEX_BIN);
const require = createRequire(path.join(source, 'package.json'));
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const expectedTree = '3f44470de142222788f8f6e22e7926684062ad97';
const tree = () => execFileSync('git', ['write-tree'], { cwd: source, encoding: 'utf8' }).trim();
assert.equal(tree(), expectedTree);
execFileSync('git', ['diff', '--exit-code', '--quiet'], {cwd:source});
const fixture = await mkdtemp(path.join(out, 'fixture-'));
const project = path.join(fixture, 'trusted project');
const untrusted = path.join(fixture, 'untrusted-sibling');
const codexHome = path.join(fixture, 'codex-home');
const isolatedHome = path.join(fixture, 'home');
const sibling = path.join(fixture, 'outside-project.txt');
const blockedSiblingWrite = path.join(fixture, 'outside-write-rejected.txt');
for (const dir of [project, untrusted, codexHome, isolatedHome]) await mkdir(dir);
const config = `approval_policy = "on-request"\nsandbox_mode = "workspace-write"\n[projects.${JSON.stringify(project)}]\ntrust_level = "trusted"\n`;
await writeFile(path.join(codexHome, 'config.toml'), config, {mode:0o600});
await writeFile(path.join(project, 'AGENTS.md'), 'Synthetic security acceptance only. No model turn; no credentials.\n');
await writeFile(sibling, 'original outside marker\n');
await symlink(sibling, path.join(project, 'escape.txt'));
execFileSync('git', ['init', '--quiet'], {cwd:project});
execFileSync('git', ['init', '--quiet'], {cwd:untrusted});
const env = {...process.env};
for(const key of Object.keys(env)) {
  if (/^(?:CODEXLESS_|CODEX_TOOLBOX_|CODEX_HOME$|NODE_PATH$)/.test(key) || /(?:TOKEN|API_KEY|PASSWORD|SECRET|CREDENTIAL)/i.test(key)) delete env[key];
}
Object.assign(env, {
 HOME:isolatedHome, CODEX_HOME:codexHome, CODEX_BIN:codexBin,
 XDG_CONFIG_HOME:path.join(isolatedHome,'.config'), XDG_DATA_HOME:path.join(isolatedHome,'.local/share'), XDG_STATE_HOME:path.join(isolatedHome,'.local/state'),
 CODEXLESS_CODEX_RUNTIME:'existing', CODEXLESS_SERVER_NAME:'codexless-linux', CODEXLESS_DEFAULT_CWD:project,
 CODEXLESS_STATE_ROOT:path.join(fixture,'state'), CODEXLESS_AGENT_TASK_STATE_FILE:path.join(fixture,'state','tasks.json')
});
const report = {
 sourceTree:expectedTree, platform:process.platform, architecture:process.arch, nodeVersion:process.version,
 codexVersion:execFileSync(codexBin,['--version'],{env,encoding:'utf8'}).trim(),
 launchArgv:['<NODE22>','<SOURCE>/scripts/launch.mjs','stdio'],
 isolation:{codexHome:'<FIXTURE>/codex-home',home:'<FIXTURE>/home',sandbox_mode:'workspace-write',approval_policy:'on-request',trustedProject:'<FIXTURE>/trusted project',fixtureOutsideTmp:true,sourceUnchanged:null},
 checks:[], modelTurnStarted:false
};
const redact = text => String(text).replaceAll(fixture,'<FIXTURE>').replaceAll(source,'<SOURCE>').replaceAll(codexBin,'<CODEX_CLI>').replaceAll(process.env.HOME ?? '\0','<USER_HOME>');
const pass = (check,detail={}) => {report.checks.push({check,status:'pass',...detail});console.log(`PASS ${check}`);};
const exists = async f => {try{await access(f);return true;}catch{return false;}};
const payload = r => { if (r.structuredContent !== undefined) return r.structuredContent; const text = r.content.find(c=>c.type==='text')?.text ?? ''; try { return JSON.parse(text); } catch { return {message:text}; } };
const client = new Client({name:'isolated-linux-security-acceptance',version:'1.0.0'});
const transport = new StdioClientTransport({command:process.execPath,args:[path.join(source,'scripts/launch.mjs'),'stdio'],cwd:source,env,stderr:'pipe'});
let stderr=''; transport.stderr?.on('data',c=>{stderr+=redact(c);stderr=stderr.slice(-12000);});
let failure;
async function call(args,name='codex.command_exec') {return await client.callTool({name,arguments:args});}
async function command(argv,{access='inherit',cwd=project}={}) {const r=await call({command:argv,cwd,access,timeoutMs:5000});return {r,data:payload(r)};}
try {
 await client.connect(transport);
 assert.equal(client.getServerVersion().name,'codexless-linux'); assert.equal((await client.listTools()).tools.length,45);
 pass('actual stdio MCP initialize and 45-tool discovery');
 let result=await command(['pwd']);assert.equal(result.data.exitCode,0,JSON.stringify(result.data));assert.equal(result.data.permissionProfile,':workspace');assert.equal(result.data.permissionCeiling,':workspace');assert.equal(result.data.stdout.trim(),project);
 pass('legacy workspace/on-request inherit resolves actual :workspace',{exitCode:result.data.exitCode,permissionProfile:result.data.permissionProfile,permissionCeiling:result.data.permissionCeiling});
 result=await command(['pwd'],{access:'readOnly'});assert.equal(result.data.exitCode,0);assert.equal(result.data.permissionProfile,':read-only');assert.equal(result.data.permissionCeiling,':workspace');
 pass('explicit readOnly downscopes official profile',{exitCode:result.data.exitCode,permissionProfile:result.data.permissionProfile});
 result=await command([process.execPath,'-e',"require('node:fs').writeFileSync('allowed.txt','inside marker\\n')"]);assert.equal(result.data.exitCode,0,JSON.stringify(result.data));assert.equal(await readFile(path.join(project,'allowed.txt'),'utf8'),'inside marker\n');
 pass('inherit write in trusted workspace succeeds',{exitCode:result.data.exitCode});
 result=await command([process.execPath,'-e',"require('node:fs').writeFileSync(process.argv[1],'must not appear')",blockedSiblingWrite]);
 assert.notEqual(result.data.exitCode,0,JSON.stringify(result.data));assert.equal(await exists(blockedSiblingWrite),false);assert.equal(result.data.permissionProfile,':workspace');
 pass('inherit write to sibling outside workspace denied with no mutation',{exitCode:result.data.exitCode,permissionProfile:result.data.permissionProfile,stderr:redact(result.data.stderr)});
 result=await command([process.execPath,'-e',"require('node:fs').writeFileSync('readonly-denied.txt','must not appear')"],{access:'readOnly'});
 assert.notEqual(result.data.exitCode,0,JSON.stringify(result.data));assert.equal(await exists(path.join(project,'readonly-denied.txt')),false);
 pass('readOnly write inside workspace denied with no mutation',{exitCode:result.data.exitCode,permissionProfile:result.data.permissionProfile,stderr:redact(result.data.stderr)});
 result=await command(['pwd'],{cwd:untrusted});assert.equal(result.r.isError,true,JSON.stringify(result));assert.match(JSON.stringify(result.data),/trust/i);
 pass('inherit request from untrusted sibling cwd rejected',{error:redact(JSON.stringify(result.data))});
 for (const [parameter,value] of [['permissionProfile',':danger-full-access'],['permissions',':danger-full-access'],['sandbox_mode','danger-full-access'],['approval_policy','never'],['trust_level','trusted']]) {
   let error;try{const r=await call({command:['pwd'],cwd:project,access:'inherit',[parameter]:value});assert.equal(r.isError,true,JSON.stringify(r));error=JSON.stringify(payload(r));}catch(e){error=String(e);}
   assert.match(error,/unrecognized|unknown|invalid.*argument|validation|additional/i,redact(error));
   pass(`remote ${parameter} override rejected by public schema`,{attemptedValue:value,error:redact(error)});
 }
 for (const target of [sibling,'escape.txt']) {
   const r=await call({cwd:project,paths:[target]},'codex.read_many');assert.equal(r.isError,true,JSON.stringify(r));
   pass(target===sibling?'read_many absolute outside-root path rejected':'read_many symlink escape rejected',{error:redact(JSON.stringify(payload(r)))});
 }
 const edit=await call({cwd:project,path:'escape.txt',expectedText:'original',replacementText:'modified'},'codex.precise_edit');
 assert.equal(edit.isError,true,JSON.stringify(edit));assert.equal(await readFile(sibling,'utf8'),'original outside marker\n');
 pass('precise_edit symlink escape rejected and sibling unchanged',{error:redact(JSON.stringify(payload(edit)))});
 const startArgs={cwd:project,prompt:'Prepare-only security acceptance. Never start a model.',requestId:'security-prepare-only-20261020',invocationRationale:'Check metered approval without any model turn'};
 const task=payload(await call(startArgs,'codex.agent_start'));assert.equal(task.status,'consent_required');assert.equal(task.turnId,null);
 const replay=payload(await call(startArgs,'codex.agent_start'));assert.equal(replay.taskId,task.taskId);assert.equal(replay.turnId,null);
 const decline=payload(await call({taskId:task.taskId},'codex.agent_decline'));assert.equal(decline.status,'rejected');assert.equal(decline.turnId,null);
 pass('metered prepare, duplicate suppression and decline without model turn',{preparedStatus:task.status,duplicateTaskIdPreserved:true,turnId:null,declinedStatus:decline.status});
 assert.equal(await readFile(path.join(codexHome,'config.toml'),'utf8'),config);
 assert.equal((await readdir(codexHome)).some(n=>/auth|credential|token/i.test(n)),false);
 pass('isolated Codex config unchanged and no credential files created');
 report.status='pass';
} catch(error) {failure=error;report.status='fail';report.failure=redact(error.stack??error);report.serverStderr=stderr;console.error(redact(error.stack??error));}
finally {
 await client.close().catch(()=>{});await transport.close().catch(()=>{});
 let workingTreeMatchesIndex=true;try{execFileSync('git',['diff','--exit-code','--quiet'],{cwd:source});}catch{workingTreeMatchesIndex=false;}
 report.isolation.sourceUnchanged=tree()===expectedTree && workingTreeMatchesIndex;
 if(!report.isolation.sourceUnchanged){report.status='fail';failure??=new Error('candidate source tree changed');}
 await rm(fixture,{recursive:true,force:true});report.fixtureRemoved=!(await exists(fixture));
 await writeFile(path.join(out,'security-report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(`Actual MCP security acceptance ${report.status.toUpperCase()} (${report.checks.length} checks)`);
if(failure) process.exitCode=1;
