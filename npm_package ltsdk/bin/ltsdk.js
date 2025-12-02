#!/usr/bin/env node
/**
 * Learning Tokens SDK CLI
 * Main entry point for the ltsdk command
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const AUTH_PORT = process.env.LTSDK_AUTH_PORT || 5002;

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
  log('   • Frontend UI (port 3002)', 'green');
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
  
  // Start Frontend (port 3002)
  const frontendPath = path.join(packagePath, 'frontend');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const frontend = spawn(npmCmd, ['start'], {
    cwd: frontendPath,
    stdio: 'inherit',
    env: { ...process.env, PORT: '3002' },
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
      require('child_process').exec(`${openBrowser} http://localhost:3002`, (err) => {
        if (err) {
          log('\n🌐 Please open your browser and navigate to: http://localhost:3002', 'cyan');
        } else {
          log('\n🌐 Opening browser to http://localhost:3002...', 'cyan');
        }
      });
    } catch (e) {
      log('\n🌐 Please open your browser and navigate to: http://localhost:3002', 'cyan');
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
    
    log('\n🚀 Initializing SDK...', 'cyan');
    
    // Small delay before starting services
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Start services
    startServices();
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

