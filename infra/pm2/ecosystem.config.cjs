module.exports = {
  apps: [
    {
      name: "gxclosers",
      cwd: "/var/www/gxclosers-app",
      script: "npm",
      args: "start -- -p 3010",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://app.aicloser.in",
      },
    },
  ],
};
