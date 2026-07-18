/**
 * Test Upload API Script - Simple version
 * Run: node test-upload.js <image_path>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'https://api.ximangtaydo.vn';
const TEST_API = '/api/images/test-upload';

const imagePath = process.argv[2] || './test.jpg';

if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    console.log('Usage: node test-upload.js <image_path>');
    process.exit(1);
}

const imageBuffer = fs.readFileSync(imagePath);
const imageName = path.basename(imagePath);

console.log(`Image: ${imageName} (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

// Get real current time
const now = new Date();
const currentTimestamp = now.toISOString();
const currentTimezoneOffset = now.getTimezoneOffset();

console.log(`Timestamp: ${currentTimestamp}`);
console.log(`Timezone offset: ${currentTimezoneOffset} (${-currentTimezoneOffset/60} from UTC)`);

// Build multipart form data
const boundary = '----FormBoundary' + Math.random().toString(36).substring(2, 15);

const parts = [];

// Text fields
const fields = {
    latitude: '10.823100',
    longitude: '106.629400',
    timestamp: currentTimestamp,
    timezoneOffset: currentTimezoneOffset.toString()
};

for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
        `${value}\r\n`
    ));
}

// File field
parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="image"; filename="${imageName}"\r\n` +
    `Content-Type: image/jpeg\r\n\r\n`
));
parts.push(imageBuffer);
parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

const body = Buffer.concat(parts);
const urlObj = new URL(API_URL + TEST_API);

const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
    }
};

console.log(`\nUploading to: ${API_URL}${TEST_API}...\n`);

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            console.log('\nResponse:');
            console.log(JSON.stringify(json, null, 2));
            if (json.success && json.data) {
                console.log(`\n>>> Image URL: ${json.data.url}`);
                console.log('>>> Open in browser to check watermark!');
            }
        } catch (e) {
            console.log('Raw:', data);
        }
    });
});

req.on('error', e => console.error(`Error: ${e.message}`));
req.write(body);
req.end();
