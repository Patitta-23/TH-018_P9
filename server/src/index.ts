import { app } from "./app";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.listen(PORT, () => {
  console.log(`🚀 Queue Service API running at http://localhost:${PORT}`);
  console.log(`   Auth    : http://localhost:${PORT}/api/auth/login`);
  console.log(`   Board   : http://localhost:${PORT}/api/board`);
  console.log(`   Queues  : http://localhost:${PORT}/api/queues/my-ticket`);
  console.log(`   Counters: http://localhost:${PORT}/api/counters/:id/status`);
});

