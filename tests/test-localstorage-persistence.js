const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log('=== LOCALSTORAGE PERSISTENCE TEST RESULTS ===\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Helper function to wait
  async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Helper function to wait and take screenshot
  async function takeScreenshot(name, description) {
    const filename = `test-${name}.png`;
    await page.screenshot({ path: filename });
    console.log(`   📸 Screenshot saved: ${filename} (${description})\n`);
  }
  
  // Helper function to get stopwatch count
  async function getStopwatchCount() {
    return await page.evaluate(() => {
      const stopwatches = Array.from(document.querySelectorAll('.stopwatch-divider'));
      // Filter out the template and final divider
      return stopwatches.filter(sw => 
        sw.id !== 'template' && sw.id !== '0'
      ).length;
    });
  }
  
  // Helper function to get stopwatch data
  async function getStopwatchData() {
    return await page.evaluate(() => {
      const stopwatches = Array.from(document.querySelectorAll('.stopwatch-divider'));
      // Filter out the template and final divider
      const realStopwatches = stopwatches.filter(sw => 
        sw.id !== 'template' && sw.id !== '0'
      );
      return realStopwatches.map(sw => {
        const nameInput = sw.querySelector('input.name');
        const timeButton = sw.querySelector('.time button');
        return {
          name: nameInput ? nameInput.value : '',
          time: timeButton ? timeButton.textContent : ''
        };
      });
    });
  }
  
  try {
    // ============================================================
    // TEST 1: Basic persistence across refresh
    // ============================================================
    console.log('=== TEST 1: Basic persistence across refresh ===\n');
    
    // Step 1: Navigate to the page
    console.log('1. Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    console.log('✓ Page loaded successfully\n');
    
    // Step 2: Take a snapshot to see the initial state
    console.log('2. Taking snapshot of initial state...');
    await takeScreenshot('01-initial-state', 'Initial page load');
    
    // Step 3: Verify there is 1 default stopwatch
    console.log('3. Verifying default stopwatch...');
    let stopwatchCount = await getStopwatchCount();
    let stopwatchData = await getStopwatchData();
    console.log(`   Found ${stopwatchCount} stopwatch(es)`);
    console.log(`   Stopwatch data:`, stopwatchData);
    
    if (stopwatchCount === 1 && stopwatchData[0].name === 'Stopwatch 1') {
      console.log('✓ TEST PASSED: Default stopwatch "Stopwatch 1" exists\n');
      testsPassed++;
    } else {
      console.log('✗ TEST FAILED: Expected 1 stopwatch named "Stopwatch 1"\n');
      testsFailed++;
    }
    
    // Step 4: Click the time button to start the first stopwatch
    console.log('4. Starting the first stopwatch...');
    // Get the first real stopwatch (not template or final)
    await page.evaluate(() => {
      const stopwatches = Array.from(document.querySelectorAll('.stopwatch-divider'));
      const firstReal = stopwatches.find(sw => sw.id !== 'template' && sw.id !== '0');
      const timeButton = firstReal.querySelector('.time button');
      timeButton.click();
    });
    console.log('✓ Clicked time button to start\n');
    
    // Step 5: Wait 3 seconds
    console.log('5. Waiting 3 seconds...');
    await wait(3000);
    console.log('✓ Waited 3 seconds\n');
    
    // Step 6: Click the time button again to stop it
    console.log('6. Stopping the stopwatch...');
    const stoppedTime = await page.evaluate(() => {
      const stopwatches = Array.from(document.querySelectorAll('.stopwatch-divider'));
      const firstReal = stopwatches.find(sw => sw.id !== 'template' && sw.id !== '0');
      const timeButton = firstReal.querySelector('.time button');
      timeButton.click();
      return timeButton.textContent;
    });
    console.log(`✓ Stopped at: ${stoppedTime}\n`);
    
    // Step 7: Take a snapshot to see the stopped time
    console.log('7. Taking snapshot of stopped time...');
    await takeScreenshot('02-stopped-time', `Stopwatch stopped at ${stoppedTime}`);
    
    // Verify the time is not 0.00
    if (stoppedTime !== '0.00' && parseFloat(stoppedTime) >= 2.9) {
      console.log(`✓ TEST PASSED: Stopwatch shows elapsed time (${stoppedTime})\n`);
      testsPassed++;
    } else {
      console.log(`✗ TEST FAILED: Expected time >= 2.9 seconds, got ${stoppedTime}\n`);
      testsFailed++;
    }
    
    // Step 8: Click "Add a Stopwatch" button
    console.log('8. Adding a second stopwatch...');
    await page.click('#add-stopwatch');
    await wait(500); // Wait for animation
    stopwatchCount = await getStopwatchCount();
    console.log(`✓ Now have ${stopwatchCount} stopwatches\n`);
    
    if (stopwatchCount === 2) {
      console.log('✓ TEST PASSED: Second stopwatch added\n');
      testsPassed++;
    } else {
      console.log('✗ TEST FAILED: Expected 2 stopwatches\n');
      testsFailed++;
    }
    
    // Step 9: Change the name of the second stopwatch to "My Timer"
    console.log('9. Renaming second stopwatch to "My Timer"...');
    await page.evaluate(() => {
      const stopwatches = Array.from(document.querySelectorAll('.stopwatch-divider'));
      const realStopwatches = stopwatches.filter(sw => sw.id !== 'template' && sw.id !== '0');
      const secondStopwatch = realStopwatches[1];
      const nameInput = secondStopwatch.querySelector('input.name');
      nameInput.value = 'My Timer';
      // Trigger change event
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    console.log('✓ Renamed to "My Timer"\n');
    
    await takeScreenshot('03-before-refresh', 'Two stopwatches before refresh');
    
    // Store the first stopwatch's time for comparison after refresh
    const timeBeforeRefresh = stoppedTime;
    
    // Step 10: Navigate to http://localhost:3000 (refresh the page)
    console.log('10. Refreshing the page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await wait(500); // Wait for any initialization
    console.log('✓ Page refreshed\n');
    
    // Step 11: Take a snapshot
    console.log('11. Taking snapshot after refresh...');
    await takeScreenshot('04-after-refresh', 'State after page refresh');
    
    // Step 12: Verify persistence
    console.log('12. Verifying persistence after refresh...');
    stopwatchCount = await getStopwatchCount();
    stopwatchData = await getStopwatchData();
    console.log(`   Found ${stopwatchCount} stopwatch(es)`);
    console.log(`   Stopwatch data:`, stopwatchData);
    
    let persistenceTestPassed = true;
    
    if (stopwatchCount !== 2) {
      console.log(`✗ Expected 2 stopwatches, found ${stopwatchCount}`);
      persistenceTestPassed = false;
    }
    
    if (stopwatchData[0].time !== timeBeforeRefresh) {
      console.log(`✗ First stopwatch time changed: expected ${timeBeforeRefresh}, got ${stopwatchData[0].time}`);
      persistenceTestPassed = false;
    }
    
    if (stopwatchData[1].name !== 'My Timer') {
      console.log(`✗ Second stopwatch name incorrect: expected "My Timer", got "${stopwatchData[1].name}"`);
      persistenceTestPassed = false;
    }
    
    if (persistenceTestPassed) {
      console.log('✓ TEST PASSED: All data persisted correctly after refresh\n');
      testsPassed++;
    } else {
      console.log('✗ TEST FAILED: Data did not persist correctly\n');
      testsFailed++;
    }
    
    // ============================================================
    // TEST 2: Clear and Remove persist
    // ============================================================
    console.log('\n=== TEST 2: Clear and Remove persist ===\n');
    
    // Step 13: Click "Clear All" button
    console.log('13. Clicking "Clear All" button...');
    await page.click('#clear-all');
    await wait(500);
    console.log('✓ Clicked "Clear All"\n');
    
    // Step 14: Verify first stopwatch time is reset to 0.00
    console.log('14. Verifying stopwatch times are reset...');
    stopwatchData = await getStopwatchData();
    console.log(`   Stopwatch data after clear:`, stopwatchData);
    
    if (stopwatchData[0].time === '0.00') {
      console.log('✓ TEST PASSED: First stopwatch time reset to 0.00\n');
      testsPassed++;
    } else {
      console.log(`✗ TEST FAILED: Expected 0.00, got ${stopwatchData[0].time}\n`);
      testsFailed++;
    }
    
    await takeScreenshot('05-after-clear', 'After clicking Clear All');
    
    // Step 15: Navigate to http://localhost:3000 (refresh)
    console.log('15. Refreshing the page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await wait(500);
    console.log('✓ Page refreshed\n');
    
    // Step 16: Verify times are still 0.00 after refresh
    console.log('16. Verifying clear persisted after refresh...');
    stopwatchData = await getStopwatchData();
    console.log(`   Stopwatch data after refresh:`, stopwatchData);
    
    if (stopwatchData[0].time === '0.00' && stopwatchData[1].time === '0.00') {
      console.log('✓ TEST PASSED: Clear persisted after refresh\n');
      testsPassed++;
    } else {
      console.log('✗ TEST FAILED: Clear did not persist\n');
      testsFailed++;
    }
    
    await takeScreenshot('06-after-refresh-clear', 'After refresh following Clear All');
    
    // ============================================================
    // TEST 3: Remove All clears localStorage
    // ============================================================
    console.log('\n=== TEST 3: Remove All clears localStorage ===\n');
    
    // Step 17: Click "Remove All" button
    console.log('17. Clicking "Remove All" button...');
    await page.click('#remove-all');
    await wait(500);
    console.log('✓ Clicked "Remove All"\n');
    
    // Step 18: Verify all stopwatches are removed
    console.log('18. Verifying all stopwatches are removed...');
    stopwatchCount = await getStopwatchCount();
    console.log(`   Found ${stopwatchCount} stopwatch(es)`);
    
    if (stopwatchCount === 0) {
      console.log('✓ TEST PASSED: All stopwatches removed\n');
      testsPassed++;
    } else {
      console.log(`✗ TEST FAILED: Expected 0 stopwatches, found ${stopwatchCount}\n`);
      testsFailed++;
    }
    
    await takeScreenshot('07-after-remove-all', 'After clicking Remove All');
    
    // Step 19: Navigate to http://localhost:3000 (refresh)
    console.log('19. Refreshing the page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await wait(500);
    console.log('✓ Page refreshed\n');
    
    // Step 20: Verify empty state persists (no stopwatches)
    console.log('20. Verifying empty state persists...');
    stopwatchCount = await getStopwatchCount();
    stopwatchData = await getStopwatchData();
    console.log(`   Found ${stopwatchCount} stopwatch(es)`);
    console.log(`   Stopwatch data:`, stopwatchData);
    
    if (stopwatchCount === 0) {
      console.log('✓ TEST PASSED: Empty state persisted after Remove All + refresh\n');
      testsPassed++;
    } else {
      console.log(`✗ TEST FAILED: Expected 0 stopwatches, found ${stopwatchCount}\n`);
      testsFailed++;
    }
    
    await takeScreenshot('08-after-refresh-remove-all', 'After refresh following Remove All');
    
  } catch (error) {
    console.error('\n✗ TEST ERROR:', error.message);
    console.error(error.stack);
    testsFailed++;
  }
  
  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log('\n=== FINAL TEST SUMMARY ===');
  console.log(`Total Tests Passed: ${testsPassed}`);
  console.log(`Total Tests Failed: ${testsFailed}`);
  console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED ⚠️');
  }
  
  console.log('\nScreenshots saved:');
  console.log('  - test-01-initial-state.png');
  console.log('  - test-02-stopped-time.png');
  console.log('  - test-03-before-refresh.png');
  console.log('  - test-04-after-refresh.png');
  console.log('  - test-05-after-clear.png');
  console.log('  - test-06-after-refresh-clear.png');
  console.log('  - test-07-after-remove-all.png');
  console.log('  - test-08-after-refresh-remove-all.png');
  
  await browser.close();
  
  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
})();
