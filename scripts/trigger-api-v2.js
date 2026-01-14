const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/update-live-scores',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('🚀 Triggering API V2 (api-sports.io)...');
console.log('📡 Calling POST http://localhost:3000/api/update-live-scores');
console.log('');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`📊 Response Status: ${res.statusCode}`);
    console.log('');
    
    try {
      const json = JSON.parse(data);
      console.log('📄 Response Body:');
      console.log(JSON.stringify(json, null, 2));
      
      if (res.statusCode === 200) {
        console.log('');
        console.log('✅ API V2 triggered successfully!');
        if (json.apiVersion) {
          console.log(`   Using: ${json.apiVersion}`);
        }
        if (json.updatedGames && json.updatedGames.length > 0) {
          console.log(`   Updated ${json.updatedGames.length} game(s)`);
        }
      } else {
        console.log('');
        console.log('❌ API V2 trigger failed');
        console.log('');
        console.log('💡 Make sure:');
        console.log('   1. Server is running (npm run dev)');
        console.log('   2. USE_API_V2=true in .env');
        console.log('   3. API-FOOTBALL key is set in .env');
      }
    } catch (e) {
      console.log('📄 Response Body (raw):');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error triggering API:', error.message);
  console.log('');
  console.log('💡 Make sure the server is running:');
  console.log('   npm run dev');
});

req.end();

