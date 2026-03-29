import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { createServer } from 'http';

export async function devCommand(options: { port: string }) {
  const port = parseInt(options.port, 10);
  const cwd = process.cwd();

  // Check for manifest.json
  const manifestPath = path.join(cwd, 'manifest.json');
  if (!(await fs.pathExists(manifestPath))) {
    console.error(chalk.red('Error: No manifest.json found. Run this from a Problocks simulation directory.'));
    console.error(chalk.dim('  Use `problocks init <name>` to create a new simulation.'));
    process.exit(1);
  }

  const manifest = await fs.readJSON(manifestPath);
  const entryPath = path.join(cwd, manifest.entry ?? 'src/index.ts');

  if (!(await fs.pathExists(entryPath))) {
    console.error(chalk.red(`Error: Entry file "${manifest.entry}" not found.`));
    process.exit(1);
  }

  const entryCode = await fs.readFile(entryPath, 'utf-8');

  // Generate an HTML page that loads the engine + sandbox + student code
  const html = generateDevHtml(manifest.name, entryCode);

  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  server.listen(port, () => {
    console.log();
    console.log(chalk.green(`  Problocks Dev Server`));
    console.log();
    console.log(`  Simulation: ${chalk.cyan(manifest.name)}`);
    console.log(`  Local:      ${chalk.cyan(`http://localhost:${port}`)}`);
    console.log();
    console.log(chalk.dim('  Press Ctrl+C to stop.'));
    console.log();
  });
}

function generateDevHtml(name: string, studentCode: string): string {
  // Escape the student code for embedding in a script tag
  const escapedCode = studentCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Problocks Dev</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #111; font-family: system-ui, sans-serif; }
    #canvas { width: 100vw; height: 100vh; display: block; }
    #dev-bar {
      position: fixed; top: 0; left: 0; right: 0;
      background: rgba(0,100,0,0.85); color: #fff;
      padding: 8px 16px; font-size: 13px; z-index: 100;
      display: flex; justify-content: space-between; align-items: center;
    }
    #dev-bar .name { font-weight: bold; }
    #dev-bar .badge { background: #0a0; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  </style>
</head>
<body>
  <div id="dev-bar">
    <span><span class="name">${name}</span> — Problocks Dev Preview</span>
    <span class="badge">SANDBOX</span>
  </div>
  <canvas id="canvas"></canvas>
  <script>
    // Student code will be loaded by the engine once we have
    // the full dev server with Vite integration.
    // For now, this is a placeholder that shows the dev environment.
    document.getElementById('canvas').style.marginTop = '36px';
    document.getElementById('canvas').style.height = 'calc(100vh - 36px)';

    console.log('[problocks dev] Simulation: ${name}');
    console.log('[problocks dev] Student code loaded (${studentCode.split('\n').length} lines)');
    console.log('[problocks dev] Full engine integration coming in next sprint.');
  </script>
</body>
</html>`;
}
