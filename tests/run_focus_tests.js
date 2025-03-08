#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration for test scenarios
const TEST_SCENARIOS = [
  {
    name: 'YouTube Distraction Test',
    description: 'Testing if YouTube is detected as distraction during job search',
    filter: 'should detect YouTube as distraction'
  },
  {
    name: 'LinkedIn Allowed Test',
    description: 'Testing if LinkedIn is allowed during job search',
    filter: 'should allow job-related sites'
  },
  {
    name: 'Focus Stats Test',
    description: 'Testing if focus stats are updated correctly',
    filter: 'should update focus stats correctly'
  },
  {
    name: 'Scroll Behavior Test',
    description: 'Testing if excessive scrolling is detected as distraction',
    filter: 'should detect high-scroll low-click behavior'
  }
];

async function runTests() {
  console.log('🧪 Starting Focus Mode Tests\n');

  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Running Scenario: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    
    const jest = spawn('jest', [
      'focus_mode.test.js',
      '-t',
      scenario.filter,
      '--colors'
    ], {
      cwd: join(__dirname),
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });

    await new Promise((resolve, reject) => {
      jest.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${scenario.name} passed\n`);
          resolve();
        } else {
          console.log(`❌ ${scenario.name} failed\n`);
          reject();
        }
      });
    });
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 