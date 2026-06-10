/**
 * Quick API smoke test — run: node scripts/test-api.js
 * Requires backend on PORT (default 3000) with MongoDB + MySQL reachable.
 */
const BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';

async function request(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  const stamp = Date.now();
  const results = [];

  const log = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    const health = await request('GET', '/health');
    log('GET /health', health.status === 200, `status ${health.status}`);

    const reg = await request('POST', '/auth/register', {
      name: 'API Test Client',
      email: `client_${stamp}@test.local`,
      password: 'testpass123',
      role: 'CLIENT',
    });
    const clientToken = reg.data?.token;
    log('POST /auth/register (client)', reg.status === 201 && !!clientToken, reg.data?.message);

    const regF = await request('POST', '/auth/register', {
      name: 'API Test Freelancer',
      email: `freelancer_${stamp}@test.local`,
      password: 'testpass123',
      role: 'FREELANCER',
    });
    const freelancerToken = regF.data?.token;
    log('POST /auth/register (freelancer)', regF.status === 201 && !!freelancerToken);

    const login = await request('POST', '/auth/login', {
      email: `client_${stamp}@test.local`,
      password: 'testpass123',
    });
    log('POST /auth/login', login.status === 200 && !!login.data?.token);

    const me = await request('GET', '/auth/me', null, clientToken);
    log('GET /auth/me', me.status === 200 && !!me.data?.data?.id);

    const profile = await request('GET', '/profile/me', null, clientToken);
    log('GET /profile/me', profile.status === 200);

    const createJob = await request(
      'POST',
      '/jobs',
      {
        title: 'Test Plumbing Job',
        description: 'Need urgent plumbing repair at home within 2 days.',
        category: 'Home Services',
        minBudget: 1000,
        maxBudget: 5000,
        location: { type: 'Point', coordinates: [77.209, 28.6139], address: 'Delhi' },
      },
      clientToken
    );
    const jobId = createJob.data?.data?._id;
    log('POST /jobs', createJob.status === 201 && !!jobId);

    const listJobs = await request('GET', '/jobs');
    log('GET /jobs', listJobs.status === 200 && Array.isArray(listJobs.data?.data));

    const myJobs = await request('GET', '/jobs/my-jobs', null, clientToken);
    log('GET /jobs/my-jobs', myJobs.status === 200);

    const dashClient = await request('GET', '/dashboard/client', null, clientToken);
    log('GET /dashboard/client', dashClient.status === 200);

    const dashFree = await request('GET', '/dashboard/freelancer', null, freelancerToken);
    log('GET /dashboard/freelancer', dashFree.status === 200);

    if (jobId) {
      const proposal = await request(
        'POST',
        `/proposals/${jobId}`,
        { coverLetter: 'I can start today.', bidAmount: 3500, estimatedDays: 3 },
        freelancerToken
      );
      log('POST /proposals/:jobId', proposal.status === 201, proposal.data?.message);

      const msg = await request(
        'POST',
        '/messages',
        {
          jobId,
          receiverId: me.data?.data?.id,
          text: 'Hello from API test',
        },
        freelancerToken
      );
      log('POST /messages', msg.status === 201);
    }

    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  } catch (err) {
    console.error('Test runner error:', err.message);
    process.exit(1);
  }
}

run();
