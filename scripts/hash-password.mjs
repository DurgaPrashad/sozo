// Prints a SOZO_WORKSPACE_PASSWORD_HASH verifier for lib/auth/crypto.ts.
// The password is read without echo and never written anywhere.
//
//   npm run auth:hash-password
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { stdin, stdout, stderr } from "node:process";

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      let input = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (input += chunk));
      stdin.on("end", () => resolve(input.replace(/\r?\n$/, "")));
      stdin.on("error", reject);
      return;
    }
    stderr.write(prompt);
    let input = "";
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    const onData = (key) => {
      if (key === "\u0003") process.exit(130);
      if (key === "\r" || key === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stderr.write("\n");
        resolve(input);
      } else if (key === "\u007f") input = input.slice(0, -1);
      else input += key;
    };
    stdin.on("data", onData);
  });
}

const password = await readHidden("Workspace password: ");
if (password.length < 12) {
  stderr.write("Use at least 12 characters.\n");
  process.exit(1);
}
if (stdin.isTTY && (await readHidden("Repeat password: ")) !== password) {
  stderr.write("The passwords do not match.\n");
  process.exit(1);
}
const salt = randomBytes(16);
const key = pbkdf2Sync(password, salt, 100000, 32, "sha256");
stdout.write(`pbkdf2-sha256$100000$${salt.toString("hex")}$${key.toString("hex")}\n`);
