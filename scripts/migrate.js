
const { execSync } = require('child_process');
try {
    console.log("Running prisma db push...");
    const output = execSync('npx prisma db push --accept-data-loss', { encoding: 'utf-8' });
    console.log(output);
} catch (e) {
    console.error("Error during db push:");
    console.error(e.stdout || e.message);
}
