#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import { scanTestSuite } from './scanner.js';
import { generateTests } from './generator.js';
import { writeGeneratedFile } from './writer.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const program = new Command();

program
  .name('qa-gen')
  .description(
    chalk.bold('QA with Ilesh — AI Playwright Test Generator\n') +
    'Scans your existing test suite, learns your patterns, and generates\n' +
    'tests that match your codebase conventions using Claude AI.\n'
  )
  .version('0.1.0');

// ── generate command ──────────────────────────────────────────────────────────
program
  .command('generate')
  .alias('g')
  .description('Generate Playwright tests for a feature or user story')
  .requiredOption(
    '-f, --feature <description>',
    'Feature description or user story (e.g. "User login with email and password")'
  )
  .option('-u, --url <url>', 'URL the tests should navigate to')
  .option(
    '-d, --test-dir <path>',
    'Root directory of your existing Playwright tests',
    'tests'
  )
  .option(
    '-o, --output <path>',
    'Output directory for generated test files',
    'tests/generated'
  )
  .option(
    '-m, --model <model>',
    `Claude model to use (default: ${DEFAULT_MODEL})`,
    DEFAULT_MODEL
  )
  .option('--verbose', 'Print the raw Claude response before writing', false)
  .action(async (opts) => {
    printBanner();

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        chalk.red('\n✗ Missing ANTHROPIC_API_KEY environment variable.\n') +
        chalk.gray('  Set it with: export ANTHROPIC_API_KEY=sk-ant-...\n')
      );
      process.exit(1);
    }

    const testDir = path.resolve(opts.testDir);
    const outputDir = path.resolve(opts.output);

    // ── Step 1: Scan ────────────────────────────────────────────────────────
    const scanSpinner = ora('Scanning existing tests for patterns…').start();
    let profile;
    try {
      profile = await scanTestSuite(testDir);
      const exCount = profile.exampleTests.length;
      const fxCount = profile.fixtures.length;

      if (exCount > 0) {
        scanSpinner.succeed(
          `Found ${exCount} example spec${exCount > 1 ? 's' : ''} and ${fxCount} fixture file${fxCount !== 1 ? 's' : ''}.` +
          chalk.gray(` (selector strategy: ${profile.selectorStrategy})`)
        );
      } else {
        scanSpinner.warn(
          chalk.yellow('No existing tests found — generating from Playwright best practices.')
        );
      }
    } catch (err) {
      scanSpinner.fail('Failed to scan test directory.');
      console.error(err);
      process.exit(1);
    }

    // ── Step 2: Generate ────────────────────────────────────────────────────
    const genSpinner = ora(
      `Generating tests for "${chalk.bold(opts.feature)}"…`
    ).start();

    let generated;
    try {
      generated = await generateTests(
        {
          feature: opts.feature,
          url: opts.url,
          testDir,
          outputDir,
          model: opts.model,
          verbose: opts.verbose,
        },
        profile
      );
      genSpinner.succeed(
        `Generated ${chalk.bold(generated.filename)} ` +
        chalk.gray(`(${generated.tokensUsed.toLocaleString()} tokens used)`)
      );
    } catch (err) {
      genSpinner.fail('Claude API call failed.');
      console.error(err);
      process.exit(1);
    }

    // ── Step 3: Write ───────────────────────────────────────────────────────
    let writtenPath;
    try {
      writtenPath = writeGeneratedFile(generated, outputDir);
    } catch (err) {
      console.error(chalk.red('\n✗ Failed to write output file:'), err);
      process.exit(1);
    }

    // ── Done ────────────────────────────────────────────────────────────────
    console.log(`
${chalk.green('✔ Done!')}

  File:   ${chalk.cyan(writtenPath)}
  Model:  ${chalk.gray(opts.model)}

${chalk.yellow('⚠  AI-generated tests require human review before committing.')}
    Review the selectors, assertions, and test data carefully.

${chalk.gray('Next steps:')}
  1. Open ${chalk.cyan(writtenPath)} and review every line
  2. Run: ${chalk.bold(`npx playwright test ${writtenPath}`)}
  3. Fix any failing assertions or broken selectors
  4. Commit when satisfied
`);
  });

// ── scan command (standalone diagnostics) ─────────────────────────────────────
program
  .command('scan')
  .description('Show what patterns qa-gen detected in your test suite (no generation)')
  .option('-d, --test-dir <path>', 'Root directory of your Playwright tests', 'tests')
  .action(async (opts) => {
    printBanner();
    const spinner = ora('Scanning…').start();
    const profile = await scanTestSuite(opts.testDir);
    spinner.stop();

    console.log('\n── Scan Results ──────────────────────────────────────────\n');
    console.log(`  Spec files found:     ${chalk.bold(profile.exampleTests.length)}`);
    console.log(`  Fixture files found:  ${chalk.bold(profile.fixtures.length)}`);
    console.log(`  Page objects:         ${chalk.bold(profile.hasPageObjects ? 'yes' : 'no')}`);
    console.log(`  Selector strategy:    ${chalk.bold(profile.selectorStrategy)}`);
    console.log(`  Test import path:     ${chalk.cyan(profile.testImportPath)}`);

    if (profile.commonImports.length > 0) {
      console.log('\n── Common Imports Detected ───────────────────────────────\n');
      profile.commonImports.forEach(i => console.log(`  ${chalk.gray(i)}`));
    }
    console.log();
  });

program.parse();

// ── Helpers ──────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log(
    '\n' +
    chalk.blue('  ██████╗  █████╗        ██████╗ ███████╗███╗  ██╗\n') +
    chalk.blue('  ██╔═══██╗██╔══██╗      ██╔════╝ ██╔════╝████╗ ██║\n') +
    chalk.blue('  ██║   ██║███████║█████╗██║  ███╗█████╗  ██╔██╗██║\n') +
    chalk.blue('  ██║▄▄ ██║██╔══██║╚════╝██║   ██║██╔══╝  ██║╚████║\n') +
    chalk.blue('  ╚██████╔╝██║  ██║      ╚██████╔╝███████╗██║ ╚███║\n') +
    chalk.blue('   ╚══▀▀═╝ ╚═╝  ╚═╝       ╚═════╝ ╚══════╝╚═╝  ╚══╝\n') +
    chalk.gray('  AI Playwright Test Generator · ileshdarji.com\n')
  );
}
