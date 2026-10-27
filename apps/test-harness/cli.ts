/**
 * SP530E Hardware Driver Test Harness CLI
 * 
 * Safe, controlled diagnostic tool for validating SP530E controllers over
 * local Wi-Fi (TCP 8587) or Bluetooth Low Energy (GATT 0xFFE0 / 0xFFE1).
 * 
 * DRY-RUN MODE IS ENABLED BY DEFAULT FOR SAFETY.
 */

import { Sp530eDriver, type Sp530eDriverOptions } from '../../packages/adapters/src/sp530e/sp530e-driver.ts';
import { Sp530eWiFiTransport } from '../../packages/adapters/src/sp530e/sp530e-wifi-transport.ts';
import { Sp530eWindowsBleTransport } from '../../packages/adapters/src/sp530e/sp530e-windows-ble-transport.ts';

function parseArgs(): {
  transport: 'wifi' | 'ble';
  host: string;
  port: number;
  dryRun: boolean;
  action: string;
  bleAddress: string;
} {
  const args = process.argv.slice(2);
  let transport: 'wifi' | 'ble' = 'wifi';
  let host = '192.168.86.34';
  let port = 8587;
  let dryRun = true; // Safe default
  let action = 'all';
  let bleAddress = '';

  for (const arg of args) {
    if (arg === '--live') dryRun = false;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--transport=')) {
      const val = arg.split('=')[1]?.toLowerCase();
      if (val === 'ble' || val === 'wifi') transport = val;
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1] || host;
    } else if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1] || '8587', 10);
    } else if (arg.startsWith('--action=')) {
      action = arg.split('=')[1]?.toLowerCase() || 'all';
    } else if (arg.startsWith('--ble-address=')) {
      bleAddress = arg.split('=')[1] || '';
    }
  }

  return { transport, host, port, dryRun, action, bleAddress };
}

function printBanner(opts: ReturnType<typeof parseArgs>): void {
  console.log('================================================================');
  console.log('       SP530E CONTROLLER HARDWARE DIAGNOSTIC HARNESS            ');
  console.log('================================================================');
  console.log(` Transport Mode     : ${opts.transport.toUpperCase()}`);
  if (opts.transport === 'wifi') {
    console.log(` Target IP:Port     : ${opts.host}:${opts.port}`);
  } else {
    console.log(` Target BLE Address : ${opts.bleAddress || 'Auto-scan / default'}`);
  }
  console.log(` Mode               : ${opts.dryRun ? 'DRY-RUN (SIMULATED - NO PHYSICAL WRITES)' : '*** LIVE HARDWARE TRANSMISSION ***'}`);
  console.log(` Safety Limit       : 20% Brightness Cap Enforced`);
  console.log('================================================================\n');
}

function hexDump(bytes: Uint8Array | null): string {
  if (!bytes || bytes.length === 0) return '(none)';
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
}

async function runSequence(): Promise<void> {
  const opts = parseArgs();
  printBanner(opts);

  const driverOptions: Sp530eDriverOptions = {
    transportKind: opts.transport === 'ble' ? 'ble' : 'wifi-tcp',
    dryRun: opts.dryRun,
    host: opts.host,
    port: opts.port,
    safetyBrightnessLimit: 20,
    commandTimeoutMs: 3500,
  };

  const driver = new Sp530eDriver(driverOptions);

  driver.onLog((entry) => {
    const time = new Date(entry.timestamp).toISOString().substring(11, 23);
    console.log(`[${time}] [${entry.level.padEnd(5)}] ${entry.message}`);
  });

  const results: Array<{ step: string; status: 'PASS' | 'FAIL' | 'SKIPPED'; details: string; bytes?: string }> = [];

  try {
    // Step 1: Connect
    console.log('\n--- STEP 1: INITIALIZE & CONNECT ---');
    const connectTarget = opts.transport === 'wifi' ? `${opts.host}:${opts.port}` : opts.bleAddress;
    const connected = await driver.connect(connectTarget);
    results.push({
      step: '1. Connect Transport',
      status: connected ? 'PASS' : 'FAIL',
      details: connected ? `Connected successfully via ${opts.transport}` : 'Connection failed',
    });

    if (!connected) {
      throw new Error(`Failed to establish connection to SP530E controller.`);
    }

    // Step 2: Query Telemetry
    if (opts.action === 'all' || opts.action === 'query') {
      console.log('\n--- STEP 2: QUERY STATE TELEMETRY ---');
      const state = await driver.refreshState();
      results.push({
        step: '2. Query State',
        status: 'PASS',
        details: `Power: ${state.power}, Bri: ${state.brightness}%, Mode: ${state.mode}, Color: (${state.color.r},${state.color.g},${state.color.b})`,
      });
    }

    // Step 3: Power Command
    if (opts.action === 'all' || opts.action === 'power') {
      console.log('\n--- STEP 3: POWER ON/OFF COMMAND ---');
      await driver.setPower(true);
      results.push({
        step: '3. Set Power ON',
        status: 'PASS',
        details: `State: power=true`,
        bytes: hexDump(driver.lastEncodedFrame),
      });
      await new Promise(r => setTimeout(r, 600));
    }

    // Step 4: Brightness Command (with 20% safety limit)
    if (opts.action === 'all' || opts.action === 'brightness') {
      console.log('\n--- STEP 4: BRIGHTNESS COMMAND (20% SAFETY LIMIT) ---');
      await driver.setBrightness(20);
      results.push({
        step: '4. Set Brightness (20%)',
        status: 'PASS',
        details: `Brightness set to safe cap (20%)`,
        bytes: hexDump(driver.lastEncodedFrame),
      });
      await new Promise(r => setTimeout(r, 600));
    }

    // Step 5: Primary Color Testing
    if (opts.action === 'all' || opts.action === 'color') {
      console.log('\n--- STEP 5: RGB COLOR COMMAND SEQUENCE ---');

      // Red
      await driver.setColor(255, 0, 0);
      results.push({
        step: '5a. Color RED (255, 0, 0)',
        status: 'PASS',
        details: 'Color set to Solid Red',
        bytes: hexDump(driver.lastEncodedFrame),
      });
      await new Promise(r => setTimeout(r, 700));

      // Green
      await driver.setColor(0, 255, 0);
      results.push({
        step: '5b. Color GREEN (0, 255, 0)',
        status: 'PASS',
        details: 'Color set to Solid Green',
        bytes: hexDump(driver.lastEncodedFrame),
      });
      await new Promise(r => setTimeout(r, 700));

      // Blue
      await driver.setColor(0, 0, 255);
      results.push({
        step: '5c. Color BLUE (0, 0, 255)',
        status: 'PASS',
        details: 'Color set to Solid Blue',
        bytes: hexDump(driver.lastEncodedFrame),
      });
      await new Promise(r => setTimeout(r, 700));
    }

    // Step 6: Dynamic Effect Testing
    if (opts.action === 'all' || opts.action === 'effect') {
      console.log('\n--- STEP 6: DYNAMIC LIGHTING EFFECT ---');
      // Mode 1 = Rainbow Flow, Speed 50%
      await driver.setEffect(1, 50, false);
      results.push({
        step: '6. Effect Mode 1 (Rainbow, Speed 50%)',
        status: 'PASS',
        details: 'Dynamic effect activated',
        bytes: hexDump(driver.lastEncodedFrame),
      });
      await new Promise(r => setTimeout(r, 600));
    }

  } catch (err: any) {
    console.error(`\n[FATAL] Error executing test sequence: ${err.message}`);
    results.push({
      step: 'Execution',
      status: 'FAIL',
      details: err.message,
    });
  } finally {
    await driver.disconnect();
    console.log('\n================================================================');
    console.log('                   TEST EXECUTION SUMMARY                       ');
    console.log('================================================================');
    for (const res of results) {
      const mark = res.status === 'PASS' ? '✔' : '✖';
      console.log(`${mark} [${res.status}] ${res.step}`);
      console.log(`    Details: ${res.details}`);
      if (res.bytes) {
        console.log(`    Wire Bytes: [${res.bytes}]`);
      }
    }
    console.log('================================================================\n');
  }
}

// Execute CLI
runSequence();
