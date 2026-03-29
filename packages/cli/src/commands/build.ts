import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export async function buildCommand() {
  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'manifest.json');

  if (!(await fs.pathExists(manifestPath))) {
    console.error(chalk.red('Error: No manifest.json found. Run this from a Problocks simulation directory.'));
    process.exit(1);
  }

  const manifest = await fs.readJSON(manifestPath);
  const spinner = ora(`Building "${manifest.name}"...`).start();

  try {
    const distDir = path.join(cwd, 'dist');
    await fs.ensureDir(distDir);

    // Copy src to dist (in production, this would compile TS → JS)
    const srcDir = path.join(cwd, 'src');
    if (await fs.pathExists(srcDir)) {
      await fs.copy(srcDir, path.join(distDir, 'src'));
    }

    // Copy assets
    const assetsDir = path.join(cwd, 'assets');
    if (await fs.pathExists(assetsDir)) {
      await fs.copy(assetsDir, path.join(distDir, 'assets'));
    }

    // Copy manifest
    await fs.copy(manifestPath, path.join(distDir, 'manifest.json'));

    // Copy README if exists
    const readmePath = path.join(cwd, 'README.md');
    if (await fs.pathExists(readmePath)) {
      await fs.copy(readmePath, path.join(distDir, 'README.md'));
    }

    spinner.succeed(chalk.green(`Built "${manifest.name}" → dist/`));
  } catch (err) {
    spinner.fail(chalk.red('Build failed.'));
    console.error(err);
    process.exit(1);
  }
}
