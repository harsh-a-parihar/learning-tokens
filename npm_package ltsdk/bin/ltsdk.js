#!/usr/bin/env node
/**
 * Learning Tokens SDK CLI
 * Main entry point for the ltsdk command
 */

const readline = require('readline');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const AUTH_PORT = process.env.LTSDK_AUTH_PORT || 5002;
const KEYS_PATH = path.join(__dirname, '..', 'local-server', 'auth', 'keys.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadKeys() {
  try {
    const keysData = fs.readFileSync(KEYS_PATH, 'utf8');
    const parsed = JSON.parse(keysData);
    return parsed.validKeys || [];
  } catch (e) {
    return [];
  }
}

function validateKey(inputKey, keys) {
  const key = keys.find(k => k.key === inputKey && k.status === 'active');
  return key ? { valid: true, university: key.university } : { valid: false };
}

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function promptKey(rl) {
  return new Promise((resolve) => {
    log('\nPlease enter your LTSDK (Learning Tokens SDK) access key:', 'cyan');
    log('   (You can get this from your institution administrator)', 'yellow');
    log('');
    
    rl.question('   Access Key: ', (answer) => {
      resolve(answer.trim());
    });
  });
}

function showVerifying() {
  log('\n⏳ Verifying access key...', 'yellow');
  return new Promise(resolve => setTimeout(resolve, 2000));
}

function showWelcome() {
  console.clear();
  log('╔══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                                                              ║', 'cyan');
  log('║          🎓 Learning Tokens SDK - LMS Connector             ║', 'cyan');
  log('║                                                              ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════╝', 'cyan');
  log('');
  log('Welcome to the Learning Tokens SDK!', 'bright');
  log('');
  log('This SDK allows you to connect and integrate with multiple LMS platforms:', 'reset');
  log('  • Canvas LMS', 'green');
  log('  • Open edX', 'green');
  log('  • Moodle', 'green');
  log('  • Google Classroom', 'green');
  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('');
}

function showGuide() {
  log('📖 Quick Start Guide:', 'bright');
  log('');
  log('1. Enter your LTSDK access key (provided by your institution)', 'reset');
  log('2. The SDK will start three services:', 'reset');
  log('   • SDK Server (port 5001)', 'green');
  log('   • Auth Server (port 5002)', 'green');
  log('   • Frontend UI (port 3000)', 'green');
  log('3. Your browser will open automatically to the dashboard', 'reset');
  log('4. Select your LMS platform and configure credentials', 'reset');
  log('5. Start managing courses and assigning Learning Tokens!', 'reset');
  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('');
}

function showPrerequisites() {
  log('📋 Prerequisites (Optional):', 'bright');
  log('');
  log('For local development/testing, you may need:', 'reset');
  log('  • Open edX: Tutor installation (for edX integration)', 'yellow');
  log('  • Moodle: Local Moodle instance (for Moodle integration)', 'yellow');
  log('');
  log('Note: These are only needed if you want to test with local instances.', 'reset');
  log('      For production, use your actual LMS credentials.', 'reset');
  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('');
}

function startServices() {
  log('\nStarting Learning Tokens SDK services...', 'green');
  log('');
  
  const packagePath = path.join(__dirname, '..');
  const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
  
  // Store child processes for cleanup
  const children = [];
  
  // Start SDK Server (port 5001)
  const sdkServer = spawn(nodeCmd, ['-r', 'dotenv/config', path.join(packagePath, 'local-server', 'server.js')], {
    cwd: packagePath,
    stdio: 'inherit',
    env: { ...process.env, PORT: '5001' },
    shell: false
  });
  children.push(sdkServer);
  
  // Start Auth Server (port 5002)
  const authServer = spawn(nodeCmd, [path.join(packagePath, 'local-server', 'auth', 'auth-server.js')], {
    cwd: packagePath,
    stdio: 'inherit',
    env: { ...process.env, LTSDK_AUTH_PORT: '5002' },
    shell: false
  });
  children.push(authServer);
  
  // Start Frontend (port 3000)
  const frontendPath = path.join(packagePath, 'frontend');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const frontend = spawn(npmCmd, ['start'], {
    cwd: frontendPath,
    stdio: 'inherit',
    shell: false
  });
  children.push(frontend);

  // Handle errors
  children.forEach((child, index) => {
    const serviceNames = ['SDK Server', 'Auth Server', 'Frontend'];
    child.on('error', (err) => {
      log(`\n❌ Error starting ${serviceNames[index]}: ${err.message}`, 'red');
      // Kill all children on error
      children.forEach(c => {
        try { c.kill(); } catch (e) {}
      });
      process.exit(1);
    });
  });

  // Wait a bit then try to open browser
  setTimeout(() => {
    const openBrowser = process.platform === 'win32' 
      ? 'start' 
      : process.platform === 'darwin' 
        ? 'open' 
        : 'xdg-open';
    
    try {
      require('child_process').exec(`${openBrowser} http://localhost:3000`, (err) => {
        if (err) {
          log('\n🌐 Please open your browser and navigate to: http://localhost:3000', 'cyan');
        } else {
          log('\n🌐 Opening browser to http://localhost:3000...', 'cyan');
        }
      });
    } catch (e) {
      log('\n🌐 Please open your browser and navigate to: http://localhost:3000', 'cyan');
    }
  }, 5000);

  // Clean shutdown handler
  const shutdown = () => {
    log('\n\n👋 Shutting down Learning Tokens SDK...', 'yellow');
    children.forEach(child => {
      try {
        child.kill('SIGTERM');
      } catch (e) {
        // Ignore errors during shutdown
      }
    });
    setTimeout(() => {
      children.forEach(child => {
        try {
          child.kill('SIGKILL');
        } catch (e) {}
      });
      process.exit(0);
    }, 2000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main() {
  const command = process.argv[2];

  if (command === 'start') {
    // Show welcome
    showWelcome();
    
    // Show prerequisites
    showPrerequisites();
    
    // Show guide
    showGuide();
    
    // Prompt for LTSDK key
    const rl = createReadlineInterface();
    const keys = loadKeys();
    
    let validated = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!validated && attempts < maxAttempts) {
      const inputKey = await promptKey(rl);
      
      if (!inputKey) {
        log('\nAccess key cannot be empty. Please try again.', 'red');
        attempts++;
        continue;
      }
      
      // Show verifying message
      await showVerifying();
      
      // Validate key
      const result = validateKey(inputKey, keys);
      
      if (result.valid) {
        log(`\n✅ Access key verified!`, 'green');
        if (result.university) {
          log(`   Institution: ${result.university}`, 'cyan');
        }
        validated = true;
        rl.close();
        
        // Small delay before starting services
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Start services
        startServices();
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          log(`\nInvalid access key. Please try again. (${attempts}/${maxAttempts} attempts)`, 'red');
          log('');
        } else {
          log(`\nMaximum attempts reached. Please contact your institution administrator.`, 'red');
          rl.close();
          process.exit(1);
        }
      }
    }
  } else {
    log('Usage: ltsdk start', 'yellow');
    log('');
    log('Commands:', 'bright');
    log('  start    Start the Learning Tokens SDK', 'reset');
    log('');
    process.exit(1);
  }
}

main().catch((err) => {
  log(`\n❌ Error: ${err.message}`, 'red');
  process.exit(1);
});

