// Using global fetch


async function testEndpoint(url) {
    console.log(`Testing ${url}...`);
    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Body: ${text}`);
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

(async () => {
    await testEndpoint('http://localhost:3001/api/football/leagues/popular');
    await testEndpoint('http://localhost:3001/api/football/fixtures?live=all');
})();
