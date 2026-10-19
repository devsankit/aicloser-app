import fs from 'fs';

const filePath = 'D:/new aicloser UI/src/lib/api-client.ts';
let code = fs.readFileSync(filePath, 'utf8');

const targetFunction = `function handleCentralAuthFailure(status: number, message: string) {
  if (typeof window === 'undefined') return;

  if (status === 401) {
    setStoredToken(null);
    const path = window.location.pathname;
    if (
      !path.startsWith('/login') &&
      !path.startsWith('/signup') &&
      !path.startsWith('/super-admin/login')
    ) {
      const current = \`\${window.location.pathname}\${window.location.search}\`;
      window.location.assign(\`/login?redirectTo=\${encodeURIComponent(current)}\`);
    }
    return;
  }

  if (status === 403) {
    window.dispatchEvent(new CustomEvent('aicloser:api-error', {
      detail: { status, message: message || 'You do not have permission to perform this action.' },
    }));
  }
}`;

const replacement = `function handleCentralAuthFailure(status: number, message: string) {
  if (typeof window === 'undefined') return;

  if (status === 401) {
    setStoredToken(null);
    window.dispatchEvent(new CustomEvent('aicloser:auth-unauthorized', {
      detail: { status, message: message || 'Authentication token missing or invalid. Running in local mode.' },
    }));
    return;
  }

  if (status === 403) {
    window.dispatchEvent(new CustomEvent('aicloser:api-error', {
      detail: { status, message: message || 'You do not have permission to perform this action.' },
    }));
  }
}`;

// Normalize line endings for replacement
const normalizedCode = code.replace(/\r\n/g, '\n');
const normalizedTarget = targetFunction.replace(/\r\n/g, '\n');
const normalizedReplacement = replacement.replace(/\r\n/g, '\n');

if (normalizedCode.includes(normalizedTarget)) {
  const result = normalizedCode.replace(normalizedTarget, normalizedReplacement);
  fs.writeFileSync(filePath, result, 'utf8');
  console.log('✅ Successfully patched handleCentralAuthFailure in api-client.ts!');
} else {
  console.log('❌ Target function not found in api-client.ts');
}
