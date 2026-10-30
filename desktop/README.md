# Burger Budds Merchant for Windows

## Edge launcher (recommended current build)

`release/Burger-Budds-Merchant.exe` opens the live merchant page in a separate Microsoft Edge app window. Copy the EXE to a Windows 10/11 PC with Microsoft Edge and .NET Framework 4.x, then double-click it. No Node.js, Electron download or local server is needed. Internet is required; offline orders are not supported.

Build with `npm run desktop:build:edge`. Node.js is needed only on the build PC. The Windows .NET Framework compiler is used; no new build dependencies are installed.

Sign in with your existing merchant account. The app uses its own Edge profile at `%LOCALAPPDATA%/BurgerBudds/Merchant/EdgeProfile`, separate from your normal browser. Sign out on shared computers. Receipt printing and sound controls use the existing merchant page; the printer and live-order flow need manual verification. Edge manages browser security, permissions and navigation; Electron-specific origin restrictions below do not apply to this launcher. The EXE is unsigned, so Windows may show an unknown publisher warning. It uses the default Windows application icon. Website changes appear on reload, and Edge updates through its normal updater.

## Optional Electron build (runtime download pending)

Portable Windows x64 Electron app for https://www.burgerbudds.in/merchant.
The hosted merchant interface runs inside a native desktop window and requires internet.
This does not bundle the Next.js server or provide offline order processing.

From the project root:

Build prerequisite: Node.js 22.12 or newer (Node 24 recommended).

1. `npm run desktop:install`
2. `npm run desktop:start` for local launch.
3. `npm run desktop:build` to create `desktop/release/Burger-Budds-Merchant-1.0.0-x64.exe`.

Copy the portable EXE to a Windows x64 computer and double-click it. No Node.js or local server is required on the destination PC. Sign in with an existing merchant account. Login is stored in the app's own persistent browser profile; use the merchant Sign out button on shared computers.

Receipt printing uses the existing merchant Print action and the Windows print dialog. Enable sound using the merchant page's existing controls. If disconnected, use App > Open Merchant / Retry Connection. Ctrl+R reloads the page.

Only the exact HTTPS website origin can navigate in the desktop window. Popups to other sites, downloads, embedded webviews and device permissions are blocked. No preload, native IPC, service keys or environment files are packaged. Authentication and business rules remain on the hosted website.

This first build is unsigned and uses Electron's default icon; Windows may show an unknown publisher warning. Code signing, automatic updates, custom branding, external telephone links and offline orders are not included. Rebuild and redistribute the app for Electron security updates; website updates appear on reload.
