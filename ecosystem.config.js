module.exports = {
  apps: [
    {
      name: "spark-drive-autos",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
