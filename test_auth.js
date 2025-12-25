const API_URL = 'http://127.0.0.1:3001/api/auth';
const testUser = {
    username: 'testuser_' + Date.now(),
    password: 'password123',
    name: 'Test User'
};

async function testAuth() {
    try {
        console.log('Testing Register...');
        const regRes = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        const regData = await regRes.json();
        console.log('Register Response:', regData);

        if (!regRes.ok) throw new Error(regData.error || 'Register failed');

        console.log('Testing Login...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: testUser.username,
                password: testUser.password
            })
        });
        const loginData = await loginRes.json();
        console.log('Login Response:', loginData);

        if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');

        if (loginData.user.name === testUser.name) {
            console.log('SUCCESS: Name field verified.');
        } else {
            console.error('FAILURE: Name field missing or incorrect.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testAuth();
