import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

const API_BASE = process.env.PROBLOCKS_API ?? 'http://localhost:5001/api';

export async function cloneCommand(slug: string) {
  const spinner = ora(`Downloading "${slug}" from marketplace...`).start();

  try {
    const res = await fetch(`${API_BASE}/simulations/${slug}/download`);
    if (!res.ok) {
      spinner.fail(chalk.red(`Simulation "${slug}" not found.`));
      process.exit(1);
    }

    const project = await res.json();
    const dirName = slug;
    const targetDir = path.resolve(process.cwd(), dirName);

    if (await fs.pathExists(targetDir)) {
      spinner.fail(chalk.red(`Directory "${dirName}" already exists.`));
      process.exit(1);
    }

    await fs.ensureDir(targetDir);
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'assets'));

    // Write manifest.json
    await fs.writeJSON(path.join(targetDir, 'manifest.json'), project.manifest, { spaces: 2 });

    // Write source files
    for (const [filePath, content] of Object.entries(project.files)) {
      const fullPath = path.join(targetDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content as string);
    }

    // Write package.json
    await fs.writeJSON(path.join(targetDir, 'package.json'), {
      name: `@problocks-sim/${slug}`,
      version: project.manifest.version,
      private: true,
      type: 'module',
      scripts: {
        dev: 'problocks dev',
        build: 'problocks build',
        publish: 'problocks publish',
      },
      dependencies: { '@problocks/sdk': '^0.0.1' },
    }, { spaces: 2 });

    // Write tsconfig.json
    await fs.writeJSON(path.join(targetDir, 'tsconfig.json'), {
      compilerOptions: {
        target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
        strict: true, esModuleInterop: true, skipLibCheck: true,
        outDir: 'dist', rootDir: 'src',
      },
      include: ['src'],
    }, { spaces: 2 });

    // Write README
    let readme = `# ${project.manifest.name}\n\n${project.manifest.description}\n\n`;
    if (project.manifest.forkedFrom) {
      readme += `> Forked from [${project.manifest.forkedFrom.name}](https://marketplace-sigma-ebon.vercel.app/sim/${project.manifest.forkedFrom.slug})\n\n`;
    }
    readme += `## Development\n\n\`\`\`bash\nproblocks dev    # local preview\nproblocks build  # compile\nproblocks publish # upload to marketplace\n\`\`\`\n`;
    await fs.writeFile(path.join(targetDir, 'README.md'), readme);

    spinner.succeed(chalk.green(`Cloned "${project.manifest.name}" to ./${dirName}`));
    console.log();
    console.log(`  ${chalk.cyan('cd')} ${dirName}`);
    console.log(`  ${chalk.cyan('problocks dev')}    — preview locally`);
    console.log(`  ${chalk.dim('Edit src/index.ts, then:')}  ${chalk.cyan('problocks publish')}`);

    if (project.manifest.forkedFrom) {
      console.log();
      console.log(chalk.dim(`  Forked from: ${project.manifest.forkedFrom.name} by ${project.manifest.forkedFrom.author}`));
    }
    console.log();
  } catch (err: any) {
    spinner.fail(chalk.red(`Clone failed: ${err.message}`));
    process.exit(1);
  }
}
