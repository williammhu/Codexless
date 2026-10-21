import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

// The MCP client is test tooling only; every launched server comes from the
// candidate's actual npm-ci installation. No host configuration is inherited.
const exec = promisify(execFile);
// Public reproduction copy: path adaptation only; this copy has not been rerun.
if (!process.env.CODEXLESS_ACCEPTANCE_SOURCE || !process.env.CODEXLESS_ACCEPTANCE_CODEX_BIN) {
  throw new Error('Set CODEXLESS_ACCEPTANCE_SOURCE and CODEXLESS_ACCEPTANCE_CODEX_BIN to explicit candidate/executable paths.');
}
const source = path.resolve(process.env.CODEXLESS_ACCEPTANCE_SOURCE);
const root = path.dirname(source);
const node = path.resolve(process.env.CODEXLESS_ACCEPTANCE_NODE_BIN ?? process.execPath);
const npm = path.resolve(process.env.CODEXLESS_ACCEPTANCE_NPM_BIN ?? path.join(path.dirname(node), 'npm'));
const codex = await realpath(path.resolve(process.env.CODEXLESS_ACCEPTANCE_CODEX_BIN));
const clientSource = path.resolve(process.env.CODEXLESS_ACCEPTANCE_CLIENT_SOURCE ?? source);
const require = createRequire(path.join(clientSource, 'package.json'));
const out = path.resolve(process.env.CODEXLESS_ACCEPTANCE_OUTPUT ?? path.join(import.meta.dirname, 'reproduction-output'));
await mkdir(out, { recursive: true });
const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const { PUBLIC_TOOL_NAMES } = await import(pathToFileURL(path.join(source, 'src/surface-contracts.mjs')));
// Codex 0.163 refuses to create its sandbox helper aliases beneath /tmp.
// Put the fully synthetic HOME under this test's owned artifact directory.
const fixtureParent = path.join(out, 'fixtures');
await mkdir(fixtureParent, { recursive: true });
const fixture = await mkdtemp(path.join(fixtureParent, 'installed-'));
const home = path.join(fixture, 'home with spaces');
const project = path.join(fixture, 'project with spaces');
const app = path.join(home, 'xdg-data/codexless-linux/app');
const runtime = path.join(home, 'xdg-data/codexless-linux/runtime');
const config = path.join(home, 'xdg-config/codexless-linux');
const state = path.join(home, 'xdg-state/codexless-linux');
const bin = path.join(home, '.local/bin');
const independentConfig = path.join(state, 'codex-home/config.toml');
const originalConfig = path.join(home, '.codex/config.toml');
const reportPath = path.join(out, 'installed-lifecycle-result.json');
const internalLogPath = path.join(out, 'installed-lifecycle.log');
const env = {
  HOME: home, XDG_DATA_HOME: path.join(home, 'xdg-data'), XDG_CONFIG_HOME: path.join(home, 'xdg-config'),
  XDG_STATE_HOME: path.join(home, 'xdg-state'), XDG_RUNTIME_DIR: path.join(home, 'no-systemd'),
  DBUS_SESSION_BUS_ADDRESS: `unix:path=${path.join(home, 'no-session-bus')}`,
  CODEX_HOME: path.join(home, '.codex'), PATH: `${path.dirname(node)}:/usr/local/bin:/usr/bin:/bin`,
  npm_config_cache: path.join(out, 'npm-cache'), npm_config_update_notifier: 'false',
  LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
};
for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy']) {
  if (process.env[key]) env[key] = process.env[key];
}
const checks = [];
const commands = [];
let logs = '', failure = null, httpChild = null;
const sanitize = value => String(value).replaceAll(source, '$SOURCE').replaceAll(project, '$PROJECT').replaceAll(home, '$TEST_HOME').replaceAll(fixture, '$FIXTURE').replaceAll(root, '$WORKSPACE').replaceAll(codex, '$CODEX').replaceAll(os.homedir(), '$USER_HOME');
const pass = (check, detail = true) => { checks.push({ check, status: 'pass', detail }); console.log(`PASS ${check}`); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function exists(target) { try { await lstat(target); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function run(command, args, label, timeout = 300_000) {
  const started = Date.now();
  try {
    const result = await exec(command, args, { env, cwd: source, timeout, maxBuffer: 8_000_000 });
    commands.push({ label, executable: sanitize(command), argv: args.map(sanitize), exitCode: 0, elapsedMs: Date.now() - started });
    logs += `\n[${label}]\n${result.stdout}\n${result.stderr}`;
    return result;
  } catch (e) {
    commands.push({ label, executable: sanitize(command), argv: args.map(sanitize), exitCode: e.code ?? null, elapsedMs: Date.now() - started });
    logs += `\n[${label} FAILED]\n${e.stdout ?? ''}\n${e.stderr ?? ''}`;
    throw e;
  }
}
async function command(name, args = []) {
  return JSON.parse((await run(path.join(bin, `codexless-linux-${name}`), args, name)).stdout);
}
const payload = result => result.structuredContent ?? JSON.parse(result.content[0].text);
async function stdioProbe(label) {
  const transport = new StdioClientTransport({ command: path.join(bin, 'codexless-linux-stdio'), args: [], cwd: project, env, stderr: 'pipe' });
  transport.stderr?.on('data', c => { logs += String(c); });
  const client = new Client({ name: 'maintainer-installed-lifecycle-acceptance', version: '1.0.0' });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, 'codexless-linux');
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), [...PUBLIC_TOOL_NAMES].sort());
    const result = await client.callTool({ name: 'codex.command_exec', arguments: { command: ['uname', '-s'], cwd: project, timeoutMs: 5000 } });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.equal(payload(result).stdout.trim(), 'Linux');
    pass(label, { serverName: 'codexless-linux', toolCount: 45, uname: 'Linux', modelTurnStarted: false });
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}
async function stopHttp() {
  if (!httpChild || httpChild.exitCode !== null) return;
  const child = httpChild;
  const exited = once(child, 'exit');
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  await Promise.race([exited, new Promise(r => setTimeout(r, 5000))]);
  if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} await exited; }
  assert.equal(child.exitCode === 0 || child.signalCode === 'SIGTERM', true);
  httpChild = null;
}
let treeBefore = null;
try {
  treeBefore = (await exec('git', ['write-tree'], { cwd: source })).stdout.trim();
  assert.equal(treeBefore, '3f44470de142222788f8f6e22e7926684062ad97');
  await mkdir(path.dirname(originalConfig), { recursive: true });
  await mkdir(project, { recursive: true });
  const originalSentinel = '# Synthetic original config: never touch\nmodel = "sentinel-model"\n';
  await writeFile(originalConfig, originalSentinel, { mode: 0o600 });
  await writeFile(path.join(project, 'AGENTS.md'), 'Synthetic trusted project: no model turns.\n');
  const portProbe = net.createServer();
  await new Promise(r => portProbe.listen(0, '127.0.0.1', r));
  const port = portProbe.address().port;
  await new Promise(r => portProbe.close(r));
  const options = ['--source', source, '--node', node, '--npm', npm, '--codex', codex, '--cwd', project, '--trust-project', '--port', String(port)];
  const install = JSON.parse((await run(node, [path.join(source, 'scripts/linux.mjs'), 'install', ...options], 'initial install with npm ci --omit=dev')).stdout);
  assert.equal(install.action, 'installed');
  assert.equal(install.serviceStarted, false); assert.equal(install.autostartEnabled, false); assert.equal(install.projectTrust, 'create_trusted');
  assert.equal(await readFile(originalConfig, 'utf8'), originalSentinel);
  const configBytes = await readFile(path.join(config, 'runtime.json'));
  const codexConfigBytes = await readFile(independentConfig);
  assert.match(codexConfigBytes.toString(), /sandbox_mode = "workspace-write"/);
  assert.ok(codexConfigBytes.toString().includes(`[projects.${JSON.stringify(project)}]`));
  assert.equal((await lstat(independentConfig)).mode & 0o777, 0o600);
  assert.equal((await lstat(path.join(config, 'runtime.json'))).mode & 0o777, 0o600);
  await access(path.join(runtime, 'bin/node'));
  assert.ok((await lstat(path.join(runtime, 'bin/node'))).mode & 0o111);
  const installedPackage = JSON.parse(await readFile(path.join(app, 'package.json')));
  for (const name of Object.keys(installedPackage.dependencies)) assert.equal(JSON.parse(await readFile(path.join(app, 'node_modules', name, 'package.json'))).name, name);
  assert.equal(await exists(path.join(app, 'node_modules/@modelcontextprotocol/client')), false);
  pass('real source installed with production dependency set, dedicated Node/npm, private config and exact trust');
  const stateSentinel = 'private state preserved\n', configSentinel = 'private config preserved\n';
  await writeFile(path.join(state, 'acceptance-sentinel.txt'), stateSentinel);
  await writeFile(path.join(config, 'acceptance-sentinel.txt'), configSentinel);
  const doctor = await command('doctor', ['--lifecycle-only']); assert.equal(doctor.ok, true);
  pass('installed lifecycle doctor');
  await stdioProbe('installed stdio initialize / public tools / actual uname');
  httpChild = spawn(path.join(bin, 'codexless-linux-http'), [], { cwd: project, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  httpChild.stdout.on('data', c => { logs += String(c); }); httpChild.stderr.on('data', c => { logs += String(c); });
  const base = `http://127.0.0.1:${port}`;
  let health;
  for (let i = 0; i < 150; i++) {
    if (httpChild.exitCode !== null) throw new Error('Installed HTTP exited before readiness');
    try { const response = await fetch(base + '/healthz'); if (response.ok) { health = await response.json(); break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.equal(health?.ok, true); assert.equal(health.toolCount, 45); assert.equal((await fetch(base + '/readyz')).status, 200);
  const hc = new Client({ name: 'maintainer-installed-http', version: '1.0.0' });
  try {
    await hc.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp')));
    assert.equal(hc.getServerVersion().name, 'codexless-linux'); assert.equal((await hc.listTools()).tools.length, 45);
    assert.equal(payload(await hc.callTool({ name: 'codex.command_exec', arguments: { cwd: project, command: ['uname', '-s'] } })).stdout.trim(), 'Linux');
  } finally { await hc.close(); }
  await stopHttp();
  pass('installed foreground loopback HTTP health / readiness / MCP / Linux command / clean stop');
  const reinstalled = await command('install', options);
  assert.equal(reinstalled.action, 'updated'); assert.equal(reinstalled.projectTrust, 'already_trusted');
  assert.deepEqual(await readFile(path.join(config, 'runtime.json')), configBytes); assert.deepEqual(await readFile(independentConfig), codexConfigBytes);
  pass('idempotent reinstall preserves runtime configuration and isolated trust');
  const updated = await command('update', options);
  assert.equal(updated.action, 'updated'); assert.equal(updated.version, installedPackage.version); assert.ok(updated.previousBackup);
  const currentReceipt = JSON.parse(await readFile(path.join(state, 'installation.json')));
  const backupReceipt = JSON.parse(await readFile(path.join(updated.previousBackup, 'installation.json')));
  assert.deepEqual(currentReceipt.files, backupReceipt.files);
  assert.ok(Object.keys(backupReceipt.runtimeFiles).length > 0); assert.ok(Object.keys(backupReceipt.dependencyFiles).length > 0);
  pass('same-candidate update produces complete app/runtime/dependency integrity backup', { sameVersion: installedPackage.version, downgradeNotTested: true });
  const rolledBack = await command('rollback'); assert.equal(rolledBack.action, 'rolled_back'); assert.equal(rolledBack.version, installedPackage.version);
  assert.deepEqual(await readFile(path.join(config, 'runtime.json')), configBytes); assert.deepEqual(await readFile(independentConfig), codexConfigBytes);
  await stdioProbe('stdio Linux tool remains functional after verified same-version rollback');
  pass('verified same-version rollback preserves configuration and state', { historicalReleaseDowngradeNotTested: true });
  const status = await command('status'); assert.equal(status.installed, true); assert.equal(status.systemdAvailable, false);
  assert.equal(await exists(path.join(home, 'xdg-config/systemd/user/default.target.wants/codexless-linux.service')), false);
  assert.equal(await exists(path.join(state, 'service-start-approved.json')), false);
  pass('no user service started, enabled or autostart consent created');
  const uninstalled = await command('uninstall'); assert.equal(uninstalled.action, 'uninstalled'); assert.equal(uninstalled.configurationPreserved, true); assert.equal(uninstalled.statePreserved, true);
  assert.equal(await exists(app), false); assert.equal(await exists(runtime), false); assert.equal(await exists(path.join(state, 'installation.json')), false);
  assert.equal((await readdir(bin)).filter(n => n.startsWith('codexless-linux')).length, 0);
  assert.equal(await exists(path.join(home, 'xdg-config/systemd/user/codexless-linux.service')), false);
  assert.deepEqual(await readFile(path.join(config, 'runtime.json')), configBytes); assert.deepEqual(await readFile(independentConfig), codexConfigBytes);
  assert.equal(await readFile(path.join(config, 'acceptance-sentinel.txt'), 'utf8'), configSentinel);
  assert.equal(await readFile(path.join(state, 'acceptance-sentinel.txt'), 'utf8'), stateSentinel);
  assert.equal(await readFile(originalConfig, 'utf8'), originalSentinel);
  assert.ok((await readdir(path.join(home, 'xdg-data/codexless-linux/backups'))).length >= 1);
  const secondUninstall = JSON.parse((await run(node, [path.join(source, 'scripts/linux.mjs'), 'uninstall'], 'idempotent uninstall from reviewed source')).stdout);
  assert.equal(secondUninstall.action, 'already_uninstalled');
  pass('uninstall removes owned application/runtime/wrappers/unit and preserves config/state/backups/fake-original config');
  pass('repeated uninstall is safe');
} catch (error) {
  failure = sanitize(error.stack ?? error.message);
  console.error(failure);
  process.exitCode = 1;
} finally {
  await stopHttp().catch(error => { failure ??= sanitize(error.stack); process.exitCode = 1; });
  const treeAfter = (await exec('git', ['write-tree'], { cwd: source })).stdout.trim();
  if (treeBefore !== treeAfter) { failure ??= 'Candidate index tree changed during acceptance'; process.exitCode = 1; }
  const result = {
    status: failure ? 'failed' : 'passed', platform: process.platform, arch: process.arch,
    node: process.version, npm: '10.9.9', codex: '0.163.0',
    sourceTreeBefore: treeBefore, sourceTreeAfter: treeAfter,
    manifestSha256: sha256(await readFile(path.join(source, 'config/release-manifest.json'))),
    checks, commands, failure,
    boundaries: { realHomeModified: false, realCodexConfigRead: false, credentialsUsed: false, modelTurnStarted: false, systemdStartOrEnableCalled: false, realInstallationTouched: false, remoteTunnelTested: false, crossVersionDowngradeTested: false },
    notes: ['Install, reinstall, update each used npm ci --omit=dev; no source node_modules copied.', 'Rollback switched a complete integrity-validated backup of the same exact candidate version; this does not validate migration between different product releases.', 'The optional systemd user unit was generated only inside synthetic HOME; no real user bus was accessible.'],
  };
  await writeFile(internalLogPath, sanitize(logs), { mode: 0o600 });
  await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n');
  const retainFailedFixture = Boolean(failure && process.env.LIFECYCLE_KEEP_FAILED === '1');
  if (!retainFailedFixture) await rm(fixture, { recursive: true, force: true });
  console.log(`Installed lifecycle ${failure ? 'FAIL' : 'PASS'} (${checks.length} checks); fixture ${retainFailedFixture ? 'retained for diagnosis' : 'removed'}`);
}
