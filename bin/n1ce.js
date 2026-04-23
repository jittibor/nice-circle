#!/usr/bin/env node
/**
 * n1ce — one-command CLI for the N1CE Circle email system.
 *
 * Usage:   npx n1ce <command> [args]
 *    or    node bin/n1ce.js <command> [args]
 *
 * Commands are intentionally short. Full list: `n1ce help`.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

// ─── ANSI colours (no deps) ────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  cyan:   '\x1b[36m',
  orange: '\x1b[38;5;208m',
  pink:   '\x1b[38;5;205m',
};
const c = (col, s) => `${C[col] || ''}${s}${C.reset}`;

// Print the N1CE wordmark banner
function banner() {
  console.log(`
${c('pink', '  N')}${c('orange', '1')}${c('pink', 'CE')}${c('dim', ' · email system CLI')}
${c('dim', '  ──────────────────────────────')}`);
}

// ─── Commands ──────────────────────────────────────────────
const commands = {

  help() {
    banner();
    const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
    console.log(`
${c('bold', 'USAGE')}
  ${c('cyan', 'n1ce')} ${c('yellow', '<command>')} ${c('dim', '[args]')}

${c('bold', 'SERVER')}
  ${pad(c('cyan', 'start'), 22)}      start the dev server on :${PORT}
  ${pad(c('cyan', 'stop'), 22)}      stop the dev server
  ${pad(c('cyan', 'status'), 22)}      show server + config status

${c('bold', 'PREVIEW')}
  ${pad(c('cyan', 'preview'), 22)}      open the client pitch page
  ${pad(c('cyan', 'operator'), 22)}      open internal margin dashboard (cost vs charge)
  ${pad(c('cyan', 'gallery'), 22)}      open the 8-variant gallery
  ${pad(c('cyan', 'join'), 22)}      open the signup demo
  ${pad(c('cyan', 'flavor') + ' ' + c('yellow', '<name>'), 22)}      open a specific variant (melon, peach, etc.)

${c('bold', 'EMAIL')}
  ${pad(c('cyan', 'send') + ' ' + c('yellow', '<email> [flav] [name]'), 22)}      fire a live welcome email
  ${pad(c('cyan', 'test'), 22)}      send test email to yourself (uses SMTP_USER)
  ${pad(c('cyan', 'build'), 22)}      regenerate all 8 variants + production HTMLs

${c('bold', 'DEPLOY / SHARE')}
  ${pad(c('cyan', 'share'), 22)}      expose local server publicly via tunnel (no signup)
  ${pad(c('cyan', 'deploy'), 22)}      deploy to Netlify production
  ${pad(c('cyan', 'setup'), 22)}      interactive setup wizard (.env)

${c('bold', 'EXAMPLES')}
  ${c('dim', '$')} n1ce start
  ${c('dim', '$')} n1ce send flowtryx@gmail.com melon Alex
  ${c('dim', '$')} n1ce flavor wintergreen
  ${c('dim', '$')} n1ce build && n1ce deploy
`);
  },

  // ─── SERVER ─────────────────────────────────────────────
  async start() {
    banner();
    if (await isServerUp()) {
      console.log(c('yellow', '  ● server already running at ' + BASE));
      return;
    }
    console.log(c('green', '  ▶ starting server on ' + BASE + '...'));
    const child = spawn('node', ['server.js'], {
      cwd: ROOT,
      detached: true,
      stdio: ['ignore', fs.openSync(path.join(ROOT, '.n1ce-server.log'), 'a'), fs.openSync(path.join(ROOT, '.n1ce-server.log'), 'a')]
    });
    child.unref();
    fs.writeFileSync(path.join(ROOT, '.n1ce-server.pid'), String(child.pid));
    // Wait briefly for boot
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      if (await isServerUp()) {
        console.log(c('green', '  ● up. PID ' + child.pid));
        console.log(c('dim', '  log: .n1ce-server.log'));
        return;
      }
    }
    console.log(c('red', '  ✗ server did not come up — check .n1ce-server.log'));
  },

  async stop() {
    banner();
    const pidFile = path.join(ROOT, '.n1ce-server.pid');
    if (!fs.existsSync(pidFile)) {
      console.log(c('dim', '  no server PID on file — nothing to stop'));
      return;
    }
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
    try {
      process.kill(pid);
      console.log(c('green', '  ● stopped PID ' + pid));
    } catch (e) {
      console.log(c('dim', '  process already gone'));
    }
    fs.unlinkSync(pidFile);
  },

  async status() {
    banner();
    const up = await isServerUp();
    console.log(`  server     : ${up ? c('green', '● up') : c('dim', '○ down')}  ${c('dim', BASE)}`);

    const env = readEnv();
    const has = k => env[k] && env[k].trim() && !env[k].includes('your-') && !env[k].includes('YOUR-');
    console.log(`  SMTP_USER  : ${has('SMTP_USER') ? c('green', '✓ ' + env.SMTP_USER) : c('red', '✗ not set — run `n1ce setup`')}`);
    console.log(`  SMTP_PASS  : ${has('SMTP_PASS') ? c('green', '✓ set') : c('red', '✗ not set')}`);
    console.log(`  BASE_URL   : ${has('BASE_URL') ? c('green', '✓ ' + env.BASE_URL) : c('yellow', '○ defaults to localhost')}`);
    console.log(`  WEBHOOK SEC: ${has('SHOPIFY_WEBHOOK_SECRET') ? c('green', '✓ set') : c('yellow', '○ not set — Shopify webhooks disabled')}`);
  },

  // ─── PREVIEW ────────────────────────────────────────────
  preview()  { openUrl(BASE + '/presentation'); },
  pitch()    { openUrl(BASE + '/presentation'); },
  gallery()  { openUrl(BASE + '/preview/variants'); },
  variants() { openUrl(BASE + '/preview/variants'); },
  join()     { openUrl(BASE + '/join'); },
  demo()     { openUrl(BASE + '/join'); },
  operator() { openUrl(BASE + '/operator'); },
  margin()   { openUrl(BASE + '/operator'); },
  internal() { openUrl(BASE + '/operator'); },

  flavor(name) {
    if (!name) {
      console.log(c('red', '  usage: n1ce flavor <berry|peach|wintergreen|melon|mango|mint|cafe|blue>'));
      return;
    }
    openUrl(`${BASE}/emails/mocks/gmail-welcome-${name.toLowerCase()}.html`);
  },

  // ─── EMAIL ──────────────────────────────────────────────
  async send(email, flavor = 'melon', ...nameParts) {
    banner();
    if (!email) {
      console.log(c('red', '  usage: n1ce send <email> [flavor] [name]'));
      console.log(c('dim', '  e.g.   n1ce send flowtryx@gmail.com melon Alex'));
      return;
    }
    if (!(await isServerUp())) {
      console.log(c('yellow', '  server not running — start it first: n1ce start'));
      return;
    }
    const firstName = nameParts.join(' ') || email.split('@')[0];
    console.log(`  → sending ${c('orange', flavor)} welcome to ${c('cyan', email)} as "${c('pink', firstName)}"`);
    const result = await postJson('/webhook/test', { email, firstName, flavor });
    if (result.ok) {
      console.log(c('green', '  ✓ sent · messageId: ' + (result.sent?.messageId || 'n/a')));
    } else {
      console.log(c('red', '  ✗ ' + (result.error || 'failed')));
      console.log(c('dim', '  check SMTP creds: n1ce status'));
    }
  },

  async test() {
    const env = readEnv();
    const to = env.SMTP_USER;
    if (!to) {
      console.log(c('red', '  SMTP_USER not set. Run: n1ce setup'));
      return;
    }
    return commands.send(to, 'melon', 'Tester');
  },

  build() {
    banner();
    console.log(c('cyan', '  building variants...'));
    try {
      execSync('node scripts/build-variants.js', { cwd: ROOT, stdio: 'inherit' });
      execSync('node scripts/build-production-emails.js', { cwd: ROOT, stdio: 'inherit' });
      console.log(c('green', '\n  ✓ build complete'));
    } catch (e) {
      console.log(c('red', '  ✗ build failed: ' + e.message));
    }
  },

  // ─── DEPLOY ─────────────────────────────────────────────
  deploy() {
    banner();
    console.log(c('cyan', '  deploying to Netlify...'));
    try {
      execSync('netlify deploy --prod', { cwd: ROOT, stdio: 'inherit' });
      console.log(c('green', '\n  ✓ deployed'));
    } catch (e) {
      console.log(c('yellow', '\n  netlify-cli missing? install: npm i -g netlify-cli'));
    }
  },

  share() {
    banner();
    console.log(c('cyan', '  starting public tunnel via Cloudflare (no signup, no splash page)...'));
    const cf = path.join(
      ROOT, 'node_modules', 'cloudflared', 'bin',
      process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
    );
    if (!fs.existsSync(cf)) {
      console.log(c('red', '  ✗ cloudflared not installed — run: npm i -D cloudflared'));
      return;
    }
    console.log(c('dim', '  Watch for the trycloudflare.com URL below.'));
    console.log(c('dim', '  Leave this terminal running. Ctrl+C to stop the tunnel.\n'));
    const child = spawn(cf, ['tunnel', '--url', `http://localhost:${PORT}`], {
      cwd: ROOT,
      stdio: 'inherit'
    });
    child.on('exit', code => process.exit(code || 0));
  },

  setup() {
    banner();
    console.log(c('cyan', '  interactive setup wizard'));
    console.log(c('dim', '  (creates/updates .env with SMTP + webhook config)\n'));
    const envPath = path.join(ROOT, '.env');
    const examplePath = path.join(ROOT, '.env.example');
    if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log(c('green', '  ✓ created .env from .env.example'));
    }
    console.log(c('yellow', '\n  Open .env and fill in:'));
    console.log('    ' + c('cyan', 'SMTP_USER') + '              your.name@gmail.com');
    console.log('    ' + c('cyan', 'SMTP_PASS') + '              16-char Gmail app password');
    console.log('    ' + c('cyan', 'SHOPIFY_WEBHOOK_SECRET') + ' secret from Shopify admin');
    console.log('    ' + c('cyan', 'BASE_URL') + '               https://your-site.netlify.app');
    console.log(c('dim', '\n  Gmail app password: https://myaccount.google.com/apppasswords'));
    console.log(c('dim', '  After editing .env, run: n1ce status\n'));
  },
};

// ─── HELPERS ────────────────────────────────────────────────
function readEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
  return out;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isServerUp() {
  return new Promise(resolve => {
    const req = http.get(BASE + '/', { timeout: 500 }, res => { res.destroy(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function openUrl(url) {
  console.log(c('cyan', '  → ' + url));
  const cmd = process.platform === 'win32' ? 'start ""'
            : process.platform === 'darwin' ? 'open'
            : 'xdg-open';
  try {
    execSync(`${cmd} "${url}"`, { stdio: 'ignore' });
  } catch { /* ignore — user can click the printed URL */ }
}

function postJson(pathname, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: 'localhost', port: PORT, path: pathname,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let raw = '';
      res.on('data', ch => raw += ch);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ ok: false, error: raw }); } });
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.write(data); req.end();
  });
}

// ─── ENTRY ─────────────────────────────────────────────────
(async () => {
  const [, , cmdName, ...args] = process.argv;
  const cmd = commands[cmdName] || (cmdName ? null : commands.help);
  if (!cmd) {
    console.log(c('red', `  unknown command: ${cmdName}`));
    console.log(c('dim', `  run: n1ce help`));
    process.exit(1);
  }
  try {
    await cmd(...args);
  } catch (e) {
    console.error(c('red', '  ✗ ' + e.message));
    process.exit(1);
  }
})();
