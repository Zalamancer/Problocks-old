/**
 * PTY Host — runs as a regular Node.js child process (NOT inside Electron).
 * Communicates with the Electron main process via stdin/stdout JSON messages.
 * This avoids all Electron ABI / native module issues.
 */
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const shell = process.env.SHELL || '/bin/zsh';
const cwd = process.argv[2] || os.homedir();
const cols = parseInt(process.argv[3]) || 80;
const rows = parseInt(process.argv[4]) || 24;

// Spawn shell using script(1) for PTY allocation
// -q = quiet, -F = flush after each write (macOS)
const args = process.platform === 'darwin'
  ? ['-q', '/dev/null', shell, '--login']
  : ['-qfc', `${shell} --login`, '/dev/null'];

const child = spawn('/usr/bin/script', args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd,
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    COLUMNS: String(cols),
    LINES: String(rows),
  },
});

// Forward shell output to parent (Electron) via stdout
child.stdout.on('data', (data) => {
  // Write raw bytes prefixed with 'D' for data
  const msg = JSON.stringify({ type: 'data', data: data.toString('base64') });
  process.stdout.write(msg + '\n');
});

child.stderr.on('data', (data) => {
  const msg = JSON.stringify({ type: 'data', data: data.toString('base64') });
  process.stdout.write(msg + '\n');
});

child.on('exit', (code) => {
  const msg = JSON.stringify({ type: 'exit', code: code || 0 });
  process.stdout.write(msg + '\n');
  process.exit(0);
});

// Receive input from parent (Electron) via stdin
process.stdin.setEncoding('utf8');
let inputBuffer = '';
process.stdin.on('data', (chunk) => {
  inputBuffer += chunk;
  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'input') {
        child.stdin.write(Buffer.from(msg.data, 'base64'));
      } else if (msg.type === 'resize') {
        // Send resize escape sequence
        child.stdin.write(`\x1b[8;${msg.rows};${msg.cols}t`);
      } else if (msg.type === 'kill') {
        child.kill('SIGTERM');
      }
    } catch {}
  }
});

process.stdin.on('end', () => {
  child.kill('SIGTERM');
});

// Signal ready
process.stdout.write(JSON.stringify({ type: 'ready' }) + '\n');
