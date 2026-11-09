/**
 * Automated Test Suite for ZunoTwin Calibration & AI Disease Detection
 * Verifies persistent coefficients, multi-point calibration, temperature compensation,
 * model status honest response, image validation, and error handling.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('==================================================================');
  console.log('  ZunoTwin Calibration & AI Disease Detection Test Suite');
  console.log('==================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         Reason: ${err.message}`);
    }
  }

  // 1. Initial Calibration Status
  await test('GET /api/calibration returns baseline configuration for all sensors', async () => {
    const res = await fetch(`${BASE_URL}/api/calibration`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.ph);
    assert.ok(json.data.tds);
    assert.ok(json.data.turbidity);
  });

  // 2. pH 2-Point Buffer Calibration
  await test('POST /api/calibration/ph computes slope & offset and saves to SQLite', async () => {
    const payload = {
      points: [
        { standard: 7.00, voltage: 1.65, label: 'pH 7.00' },
        { standard: 4.00, voltage: 1.98, label: 'pH 4.00' }
      ],
      user: 'Test Operator',
      notes: 'Automated Test Calibration'
    };

    const res = await fetch(`${BASE_URL}/api/calibration/ph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.isCalibrated, true);
    assert.strictEqual(json.data.method, 'TWO_POINT');
    assert.ok(json.data.slope < 0); // pH decreases as voltage increases on standard probe
    assert.ok(json.data.offset > 0);
  });

  // 3. TDS Single-Point Reference Calibration with Temp Compensation
  await test('POST /api/calibration/tds computes slope at reference temperature', async () => {
    const payload = {
      standardPpm: 342,
      voltage: 1.42,
      waterTempC: 28.5, // Non-25 temp to verify temp compensation
      user: 'Test Operator',
      notes: '342 ppm NaCl Standard'
    };

    const res = await fetch(`${BASE_URL}/api/calibration/tds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.isCalibrated, true);
    assert.ok(json.data.slope > 0);
  });

  // 4. Turbidity 2-Point Calibration
  await test('POST /api/calibration/turbidity computes NTU slope & offset', async () => {
    const payload = {
      points: [
        { standard: 0, voltage: 3.85, label: '0 NTU Standard' },
        { standard: 100, voltage: 2.90, label: '100 NTU Standard' }
      ],
      user: 'Test Operator',
      notes: 'Formazin 100 NTU Standard'
    };

    const res = await fetch(`${BASE_URL}/api/calibration/turbidity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.isCalibrated, true);
    assert.strictEqual(json.data.method, 'TWO_POINT_NTU');
  });

  // 5. Verification of Persistent Profile Retrieval
  await test('GET /api/calibration/ph confirms persistent SQLite storage', async () => {
    const res = await fetch(`${BASE_URL}/api/calibration/ph`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.isCalibrated, true);
    assert.strictEqual(json.data.method, 'TWO_POINT');
  });

  // 6. Reset Calibration Endpoint
  await test('DELETE /api/calibration/ph resets sensor to uncalibrated raw mode', async () => {
    const res = await fetch(`${BASE_URL}/api/calibration/ph`, { method: 'DELETE' });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.isCalibrated, false);
    assert.strictEqual(json.data.slope, null);
  });

  // 7. AI Disease Model Status
  await test('GET /api/disease/status reports honest training state (Zero Fake Predictions)', async () => {
    const res = await fetch(`${BASE_URL}/api/disease/status`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.ready, false); // Honest report: weights not trained yet
    assert.strictEqual(json.data.modelVersion, 'MobileNetV3-Aquaculture-v1.0');
  });

  // 8. AI Disease Image Upload & Inference
  await test('POST /api/disease/analyze validates image and returns structured MODEL_NOT_READY', async () => {
    const validImgPath = path.resolve(__dirname, 'valid_test_shrimp.png');
    const pngBuffer = fs.readFileSync(validImgPath);

    const formData = new FormData();
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    formData.append('image', blob, 'test_specimen.png');

    const res = await fetch(`${BASE_URL}/api/disease/analyze`, {
      method: 'POST',
      body: formData
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.analysis);
    assert.strictEqual(json.analysis.status, 'MODEL_NOT_READY');
    assert.ok(json.analysis.supportedDatasets.length >= 2);
  });

  // 9. AI Disease Image Rejection of Non-Image File
  await test('POST /api/disease/analyze rejects non-image file types (Text/Executable)', async () => {
    const formData = new FormData();
    const blob = new Blob(['Not an image file'], { type: 'text/plain' });
    formData.append('image', blob, 'malicious_script.txt');

    const res = await fetch(`${BASE_URL}/api/disease/analyze`, {
      method: 'POST',
      body: formData
    });

    // Multer or fileFilter should reject with 500/400
    assert.ok(res.status >= 400);
  });

  // 10. AI Disease History
  await test('GET /api/disease/history retrieves logged inspection records from SQLite', async () => {
    const res = await fetch(`${BASE_URL}/api/disease/history`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 1); // From previous test upload
  });

  console.log(`\n==================================================================`);
  console.log(`  Tests Completed: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`==================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[TEST SUITE CRASH]', err);
  process.exit(1);
});
