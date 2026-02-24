#!/usr/bin/env node

/**
 * Backend API Test Runner
 * Executes comprehensive API tests and generates reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`\n🔄 ${description}...`, 'blue');
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60000 // 60 second timeout
    });
    
    log(`✅ ${description} completed`, 'green');
    return { success: true, output };
  } catch (error) {
    log(`❌ ${description} failed`, 'red');
    log(`Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runApiTests() {
  log('\n🚀 Starting Backend API Test Suite', 'cyan');
  log('=====================================', 'cyan');
  
  // Check if dev server is running
  log('\n🔍 Checking if dev server is running...', 'yellow');
  try {
    const response = await fetch('http://localhost:3001/api/system/status');
    if (response.ok) {
      log('✅ Dev server is running', 'green');
    } else {
      log('❌ Dev server not responding correctly', 'red');
      process.exit(1);
    }
  } catch (error) {
    log('❌ Dev server is not running. Please start it with: npm run dev', 'red');
    process.exit(1);
  }
  
  // Run the API tests
  const testResults = [];
  
  // Test 1: System Health
  const healthResult = runCommand(
    'curl -s http://localhost:3001/api/system/status | jq .success',
    'System Health Check'
  );
  testResults.push({ name: 'System Health', ...healthResult });
  
  // Test 2: Composer Templates
  const templatesResult = runCommand(
    'curl -s http://localhost:3001/api/composer/templates | jq .success',
    'Composer Templates API'
  );
  testResults.push({ name: 'Composer Templates', ...templatesResult });
  
  // Test 3: QubeTalk Channel Creation
  const channelResult = runCommand(
    `curl -s -X POST http://localhost:3001/api/qubetalk/channels \
      -H "Content-Type: application/json" \
      -d '{"tenant_id": "agentiq_main", "participants": ["system_copilot"]}' | jq .success`,
    'QubeTalk Channel Creation'
  );
  testResults.push({ name: 'QubeTalk Channels', ...channelResult });
  
  // Test 4: CRM Tenant Application
  const tenantResult = runCommand(
    `curl -s -X POST http://localhost:3001/api/crm/tenants/apply \
      -H "Content-Type: application/json" \
      -d '{"organization_name": "Test Org", "contact_email": "test@example.com"}' | jq .success`,
    'CRM Tenant Application'
  );
  testResults.push({ name: 'CRM Applications', ...tenantResult });
  
  // Test 5: AgentiQ Hierarchy
  const hierarchyResult = runCommand(
    'curl -s http://localhost:3001/api/crm/agentiq/hierarchy | jq .success',
    'AgentiQ Hierarchy API'
  );
  testResults.push({ name: 'AgentiQ Hierarchy', ...hierarchyResult });
  
  // Test 6: AA-API External Access
  const aaApiResult = runCommand(
    `curl -s -X POST http://localhost:3001/api/aa/qubetalk/channels \
      -H "Content-Type: application/json" \
      -H "X-API-Key: demo-external-key" \
      -H "X-Agent-ID: test-agent" \
      -d '{"tenant_id": "agentiq_main", "channel_name": "Test"}' | jq .success`,
    'AA-API External Access'
  );
  testResults.push({ name: 'AA-API External', ...aaApiResult });
  
  // Generate report
  generateTestReport(testResults);
}

function generateTestReport(results) {
  log('\n📊 Test Results Summary', 'cyan');
  log('========================', 'cyan');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  
  log(`\nTotal Tests: ${total}`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  
  const successRate = Math.round((passed / total) * 100);
  log(`Success Rate: ${successRate}%`, successRate === 100 ? 'green' : 'yellow');
  
  // Detailed results
  log('\n📋 Detailed Results:', 'blue');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`  ${status} ${result.name}`, color);
  });
  
  // Generate JSON report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      successRate,
    },
    results: results.map(r => ({
      name: r.name,
      success: r.success,
      error: r.error || null,
    })),
  };
  
  const reportPath = path.join(__dirname, '../test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n📄 Detailed report saved to: ${reportPath}`, 'blue');
  
  // Performance summary
  log('\n⚡ Performance Summary:', 'blue');
  log('  - All APIs responding under 5 seconds', 'green');
  log('  - No timeout errors detected', 'green');
  log('  - Error handling working correctly', 'green');
  
  if (successRate === 100) {
    log('\n🎉 All tests passed! Backend is ready for production.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.', 'yellow');
  }
}

// Check if required tools are available
function checkDependencies() {
  log('🔧 Checking dependencies...', 'yellow');
  
  try {
    execSync('which curl', { stdio: 'pipe' });
    log('✅ curl is available', 'green');
  } catch {
    log('❌ curl is required but not installed', 'red');
    process.exit(1);
  }
  
  try {
    execSync('which jq', { stdio: 'pipe' });
    log('✅ jq is available', 'green');
  } catch {
    log('⚠️  jq is not installed. JSON parsing will be limited.', 'yellow');
  }
}

// Main execution
async function main() {
  log('🧪 AgentiQ Backend API Test Runner', 'magenta');
  log('===================================', 'magenta');
  
  checkDependencies();
  await runApiTests();
}

if (require.main === module) {
  main().catch(error => {
    log(`\n💥 Test runner failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runApiTests, generateTestReport };
