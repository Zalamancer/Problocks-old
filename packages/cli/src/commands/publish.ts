import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

const API_BASE = process.env.PROBLOCKS_API ?? 'http://localhost:5001/api';

export async function publishCommand(options: { patch?: string; minor?: string; major?: string }) {
  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'manifest.json');

  if (!(await fs.pathExists(manifestPath))) {
    console.error(chalk.red('Error: No manifest.json found. Run this from a Problocks simulation directory.'));
    process.exit(1);
  }

  const manifest = await fs.readJSON(manifestPath);

  // Determine version bump
  const [major, minor, patch] = manifest.version.split('.').map(Number);
  let newVersion: string;
  let changeMessage: string;

  if (options.major) {
    newVersion = `${major + 1}.0.0`;
    changeMessage = options.major;
  } else if (options.minor) {
    newVersion = `${major}.${minor + 1}.0`;
    changeMessage = options.minor;
  } else if (options.patch) {
    newVersion = `${major}.${minor}.${patch + 1}`;
    changeMessage = options.patch;
  } else {
    newVersion = manifest.version === '1.0.0' ? '1.0.0' : `${major}.${minor}.${patch + 1}`;
    changeMessage = 'Initial release';
  }

  // Read source code
  const entryPath = path.join(cwd, manifest.entry ?? 'src/index.ts');
  if (!(await fs.pathExists(entryPath))) {
    console.error(chalk.red(`Error: Entry file "${manifest.entry ?? 'src/index.ts'}" not found.`));
    process.exit(1);
  }
  const sourceCode = await fs.readFile(entryPath, 'utf-8');

  const spinner = ora(`Publishing "${manifest.name}" v${newVersion} to marketplace...`).start();

  try {
    // Update version in manifest
    manifest.version = newVersion;
    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });

    // Upload to API
    const res = await fetch(`${API_BASE}/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: manifest.name,
        description: manifest.description ?? '',
        category: manifest.category ?? 'general',
        version: newVersion,
        source_code: sourceCode,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error ?? `API returned ${res.status}`);
    }

    const data = await res.json();

    // Check capabilities tier
    const capabilities = manifest.capabilities ?? ['basic'];
    const needsReview = capabilities.some((c: string) =>
      ['multiplayer', 'storage', 'network'].includes(c),
    );

    spinner.succeed(chalk.green(`Published "${manifest.name}" v${newVersion}`));
    console.log();

    if (needsReview) {
      console.log(chalk.yellow('  ⚠  Advanced capabilities detected. Entering review queue.'));
    } else {
      console.log(chalk.green('  ✓  Basic capabilities — published instantly!'));
    }

    console.log();
    console.log(`  ${chalk.cyan('Marketplace:')} http://localhost:4001/play/${data.slug}`);
    console.log(`  ${chalk.cyan('Version:')}     ${newVersion}`);
    if (changeMessage !== 'Initial release') {
      console.log(`  ${chalk.cyan('Changelog:')}   ${changeMessage}`);
    }
    console.log();
  } catch (err: any) {
    spinner.fail(chalk.red(`Publish failed: ${err.message}`));
    process.exit(1);
  }
}
