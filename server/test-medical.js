const http = require('http');

const loginOpts = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

const req = http.request(loginOpts, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Login response:', data);
    const body = JSON.parse(data);
    if (body.token) {
      console.log('Token obtained');
      // Agora chama a API de medical_records
      const medicalOpts = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/medical_records',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + body.token }
      };
      
      const req2 = http.request(medicalOpts, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          console.log('Medical records response:', data2.substring(0, 500));
          const body2 = JSON.parse(data2);
          if (body2 && Array.isArray(body2) && body2.length > 0) {
            console.log('First record keys:', Object.keys(body2[0]).join(', '));
            console.log('Has student_name?', 'student_name' in body2[0]);
            console.log('Has student_id?', 'student_id' in body2[0]);
            if (body2[0].student_name) {
              console.log('First student_name:', body2[0].student_name);
            }
          }
        });
      });
      
      req2.on('error', (e) => console.error(e));
      req2.end();
    } else {
      console.log('No token in response');
    }
  });
});

req.on('error', (e) => console.error(e));
req.write(JSON.stringify({ login: 'admin', password: 'recrescer' }));
req.end();
