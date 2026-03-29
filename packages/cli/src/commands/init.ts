import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getTemplate } from '../templates/index.js';

export async function initCommand(name: string, options: { template: string }) {
  const targetDir = path.resolve(process.cwd(), name);

  if (await fs.pathExists(targetDir)) {
    console.error(chalk.red(`Error: Directory "${name}" already exists.`));
    process.exit(1);
  }

  const spinner = ora(`Creating simulation "${name}" with ${options.template} template...`).start();

  try {
    await fs.ensureDir(targetDir);
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'assets'));

    const template = getTemplate(options.template);

    // manifest.json
    await fs.writeJSON(
      path.join(targetDir, 'manifest.json'),
      {
        name,
        version: '1.0.0',
        description: `${name} — a Problocks simulation`,
        author: '',
        category: options.template === 'blank' ? 'general' : options.template,
        capabilities: ['basic', options.template === 'blank' ? undefined : options.template].filter(Boolean),
        engine: '>=0.0.1',
        entry: 'src/index.ts',
        thumbnail: 'assets/preview.png',
      },
      { spaces: 2 },
    );

    // package.json
    await fs.writeJSON(
      path.join(targetDir, 'package.json'),
      {
        name: `@problocks-sim/${name}`,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'problocks dev',
          build: 'problocks build',
          publish: 'problocks publish',
        },
        dependencies: {
          '@problocks/sdk': '^0.0.1',
        },
      },
      { spaces: 2 },
    );

    // tsconfig.json
    await fs.writeJSON(
      path.join(targetDir, 'tsconfig.json'),
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: 'dist',
          rootDir: 'src',
        },
        include: ['src'],
      },
      { spaces: 2 },
    );

    // src/index.ts — the simulation entry point
    await fs.writeFile(
      path.join(targetDir, 'src', 'index.ts'),
      template.entryCode,
    );

    // README.md
    await fs.writeFile(
      path.join(targetDir, 'README.md'),
      `# ${name}\n\nA Problocks simulation (${options.template} template).\n\n## Development\n\n\`\`\`bash\nnpm install\nproblocks dev    # local preview\nproblocks build  # compile\nproblocks publish # upload to marketplace\n\`\`\`\n`,
    );

    spinner.succeed(chalk.green(`Created "${name}" simulation!`));
    console.log();
    console.log(`  ${chalk.cyan('cd')} ${name}`);
    console.log(`  ${chalk.cyan('npm install')}`);
    console.log(`  ${chalk.cyan('problocks dev')}    — start local preview`);
    console.log();
    console.log(chalk.dim('  Tip: Use Claude Code to vibecode your simulation!'));
    console.log();
  } catch (err) {
    spinner.fail(chalk.red('Failed to create simulation.'));
    console.error(err);
    process.exit(1);
  }
}
