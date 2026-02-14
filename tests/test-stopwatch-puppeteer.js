const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log('=== STOPWATCH TEST RESULTS ===\n');
  
  // Step 1: Navigate to the page
  console.log('1. Navigating to http://localhost:3847/index.html...');
  try {
    await page.goto('http://localhost:3847/index.html', { waitUntil: 'networkidle2' });
    console.log('✓ Page loaded successfully\n');
  } catch (error) {
    console.log('✗ Failed to load page:', error.message);
    await browser.close();
    return;
  }
  
  // Step 2: Take a snapshot and verify initial state
  console.log('2. Checking initial state...');
  const initialTime = await page.$eval('.time button', el => el.textContent);
  console.log(`   Initial time display: "${initialTime}"`);
  if (initialTime === '0.00') {
    console.log('✓ Initial state correct: shows "0.00"\n');
  } else {
    console.log('✗ Initial state incorrect: expected "0.00"\n');
  }
  
  // Take screenshot of initial state
  await page.screenshot({ path: 'test-initial-state.png' });
  console.log('   Screenshot saved: test-initial-state.png\n');
  
  // Step 3: Click the time button to start the stopwatch
  console.log('3. Starting the stopwatch...');
  await page.click('.time button');
  console.log('✓ Clicked time button\n');
  
  // Step 4: Wait 3 seconds
  console.log('4. Waiting 3 seconds...');
  await page.waitForTimeout(3000);
  console.log('✓ Waited 3 seconds\n');
  
  // Step 5: Check the display
  console.log('5. Checking time display after 3 seconds...');
  const timeAfter3Sec = await page.$eval('.time button', el => el.textContent);
  console.log(`   Time display: "${timeAfter3Sec}"`);
  
  // Check if it matches the format SS.ss (e.g., 3.XX)
  const secondsFormat = /^\d+\.\d{2}$/;
  if (secondsFormat.test(timeAfter3Sec)) {
    const seconds = parseFloat(timeAfter3Sec);
    if (seconds >= 2.9 && seconds <= 3.5) {
      console.log('✓ Time format correct: shows seconds with 2 decimal places\n');
    } else {
      console.log(`✗ Time value unexpected: expected ~3.XX, got ${timeAfter3Sec}\n`);
    }
  } else {
    console.log('✗ Time format incorrect: expected SS.ss format\n');
  }
  
  // Take screenshot after 3 seconds
  await page.screenshot({ path: 'test-after-3-seconds.png' });
  console.log('   Screenshot saved: test-after-3-seconds.png\n');
  
  // Step 6: Stop the timer
  console.log('6. Stopping the timer...');
  await page.click('.time button');
  console.log('✓ Clicked time button to stop\n');
  
  // Step 7: Test formatTime function
  console.log('7. Testing formatTime function...');
  const formatTimeTests = await page.evaluate(() => {
    const tests = [
      { input: 0, expected: '0.00' },
      { input: 30.5, expected: '30.50' },
      { input: 59.99, expected: '59.99' },
      { input: 60, expected: '1:00' },
      { input: 61, expected: '1:01' },
      { input: 125, expected: '2:05' },
      { input: 3599, expected: '59:59' },
      { input: 3600, expected: '1:00:00' },
      { input: 3661, expected: '1:01:01' },
      { input: 7200, expected: '2:00:00' }
    ];
    
    return tests.map(test => ({
      input: test.input,
      expected: test.expected,
      actual: formatTime(test.input),
      passed: formatTime(test.input) === test.expected
    }));
  });
  
  console.log('\n   formatTime() test results:');
  let formatTimeAllPassed = true;
  formatTimeTests.forEach(test => {
    const status = test.passed ? '✓' : '✗';
    console.log(`   ${status} formatTime(${test.input}) → "${test.actual}" (expected: "${test.expected}")`);
    if (!test.passed) formatTimeAllPassed = false;
  });
  
  if (formatTimeAllPassed) {
    console.log('\n✓ All formatTime tests passed!\n');
  } else {
    console.log('\n✗ Some formatTime tests failed\n');
  }
  
  // Step 8: Test parseTimeToSeconds function
  console.log('8. Testing parseTimeToSeconds function...');
  const parseTimeTests = await page.evaluate(() => {
    const tests = [
      { input: '0.00', expected: 0 },
      { input: '30.50', expected: 30.5 },
      { input: '1:05', expected: 65 },
      { input: '59:59', expected: 3599 },
      { input: '1:00:00', expected: 3600 },
      { input: '1:05:23', expected: 3923 }
    ];
    
    return tests.map(test => ({
      input: test.input,
      expected: test.expected,
      actual: parseTimeToSeconds(test.input),
      passed: parseTimeToSeconds(test.input) === test.expected
    }));
  });
  
  console.log('\n   parseTimeToSeconds() test results:');
  let parseTimeAllPassed = true;
  parseTimeTests.forEach(test => {
    const status = test.passed ? '✓' : '✗';
    console.log(`   ${status} parseTimeToSeconds("${test.input}") → ${test.actual} (expected: ${test.expected})`);
    if (!test.passed) parseTimeAllPassed = false;
  });
  
  if (parseTimeAllPassed) {
    console.log('\n✓ All parseTimeToSeconds tests passed!\n');
  } else {
    console.log('\n✗ Some parseTimeToSeconds tests failed\n');
  }
  
  // Summary
  console.log('=== TEST SUMMARY ===');
  console.log(`Page loaded: ✓`);
  console.log(`Initial state (0.00): ${initialTime === '0.00' ? '✓' : '✗'}`);
  console.log(`Timer started and displayed correctly: ${secondsFormat.test(timeAfter3Sec) ? '✓' : '✗'}`);
  console.log(`formatTime tests: ${formatTimeAllPassed ? '✓' : '✗'}`);
  console.log(`parseTimeToSeconds tests: ${parseTimeAllPassed ? '✓' : '✗'}`);
  console.log('\nScreenshots saved:');
  console.log('  - test-initial-state.png');
  console.log('  - test-after-3-seconds.png');
  
  await browser.close();
})();
