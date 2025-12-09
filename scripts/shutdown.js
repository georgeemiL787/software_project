// Simple shutdown helper that POSTs to /__shutdown with token from env
const http = require('http');
const port = process.env.PORT || 5000;
const token = process.env.SHUTDOWN_TOKEN || '';

if (!token) {
  console.error('Please set SHUTDOWN_TOKEN in environment to use this script');
  process.exit(1);
}

const data = JSON.stringify({ token });

const options = {
  hostname: 'localhost',
  port: port,
  path: '/__shutdown',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Shutdown response:', res.statusCode, body);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Error requesting shutdown:', err.message);
  process.exit(1);
});

req.write(data);
req.end();
