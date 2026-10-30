const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const windowsDirectory = process.env.WINDIR || "C:\\Windows";
const compilerPath = ["Framework64", "Framework"]
  .map((folder) => path.join(windowsDirectory, "Microsoft.NET", folder, "v4.0.30319", "csc.exe"))
  .find((candidate) => fs.existsSync(candidate));
if (!compilerPath) throw new Error("The Windows .NET Framework C# compiler is required.");

const outputDirectory = path.join(__dirname, "release");
const outputPath = path.join(outputDirectory, "Burger-Budds-Merchant.exe");
fs.mkdirSync(outputDirectory, { recursive: true });
const result = spawnSync(compilerPath, [
  "/nologo", "/target:winexe", "/platform:anycpu", "/optimize+",
  "/reference:System.Windows.Forms.dll", `/out:${outputPath}`,
  "/reference:System.Drawing.dll", "/reference:System.Management.dll",
  `/win32icon:${path.join(__dirname, "merchant.ico")}`,
  path.join(__dirname, "MerchantLauncher.cs")
], { stdio: "inherit", windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Built: ${outputPath}`);
