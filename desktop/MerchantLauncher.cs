using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Drawing;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

[assembly: AssemblyTitle("Burger Budds Merchant")]
[assembly: AssemblyDescription("Windows launcher for the Burger Budds merchant website")]
[assembly: AssemblyCompany("Burger Budds")]
[assembly: AssemblyProduct("Burger Budds Merchant")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class MerchantLauncher
{
    private const string MerchantUrl = "https://www.burgerbudds.in/merchant";

    [STAThread]
    private static void Main()
    {
        try
        {
            string edgePath = FindEdge();
            if (edgePath == null)
            {
                MessageBox.Show("Microsoft Edge is required. Install Edge, then open this app again.",
                    "Burger Budds Merchant", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            string profilePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BurgerBudds", "Merchant", "EdgeProfile");
            Directory.CreateDirectory(profilePath);

            Process.Start(new ProcessStartInfo
            {
                FileName = edgePath,
                Arguments = "--app=" + MerchantUrl + " --user-data-dir=\"" + profilePath + "\" --no-first-run",
                UseShellExecute = false,
                WorkingDirectory = Path.GetDirectoryName(edgePath)
            });
            MaintainWindowBranding(profilePath);
        }
        catch
        {
            MessageBox.Show("Unable to open the merchant app. Check that Microsoft Edge is installed and your Windows user profile is writable.",
                "Burger Budds Merchant", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void MaintainWindowBranding(string profilePath)
    {
        // Match the dedicated browser profile, never unrelated browser windows.
        using (Icon icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath))
        {
            DateTime lastWindow = DateTime.UtcNow;
            while ((DateTime.UtcNow - lastWindow).TotalSeconds < 30)
            {
                HashSet<uint> browserIds = new HashSet<uint>();
                using (ManagementObjectSearcher search = new ManagementObjectSearcher(
                    "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = 'msedge.exe'"))
                using (ManagementObjectCollection processes = search.Get())
                {
                    foreach (ManagementObject process in processes)
                    using (process)
                    {
                        string command = process["CommandLine"] as string;
                        if (command != null && command.IndexOf("--user-data-dir=\"" + profilePath + "\"", StringComparison.OrdinalIgnoreCase) >= 0)
                            browserIds.Add(Convert.ToUInt32(process["ProcessId"]));
                    }
                }
                EnumWindows(delegate(IntPtr window, IntPtr unused)
                {
                    uint processId;
                    GetWindowThreadProcessId(window, out processId);
                    if (!browserIds.Contains(processId) || !IsWindowVisible(window)) return true;
                    StringBuilder className = new StringBuilder(128);
                    GetClassName(window, className, className.Capacity);
                    if (className.ToString() != "Chrome_WidgetWin_1") return true;
                    lastWindow = DateTime.UtcNow;
                    IntPtr result;
                    SendMessageTimeout(window, 0x80, IntPtr.Zero, icon.Handle, 2, 250, out result);
                    SendMessageTimeout(window, 0x80, new IntPtr(1), icon.Handle, 2, 250, out result);
                    SetTaskbarIdentity(window);
                    return true;
                }, IntPtr.Zero);
                Thread.Sleep(2000);
            }
        }
    }

    private static void SetTaskbarIdentity(IntPtr window)
    {
        IPropertyStore store;
        Guid interfaceId = typeof(IPropertyStore).GUID;
        if (SHGetPropertyStoreForWindow(window, ref interfaceId, out store) != 0) return;
        try
        {
            SetProperty(store, 2, "\"" + Application.ExecutablePath + "\"");
            SetProperty(store, 3, Application.ExecutablePath + ",0");
            SetProperty(store, 4, "Burger Budds Merchant");
            SetProperty(store, 5, "BurgerBudds.Merchant");
            store.Commit();
        }
        finally { Marshal.ReleaseComObject(store); }
    }

    private static void SetProperty(IPropertyStore store, uint id, string text)
    {
        PropertyKey key = new PropertyKey { FormatId = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), Id = id };
        PropertyVariant value = new PropertyVariant { Type = 31, Text = Marshal.StringToCoTaskMemUni(text) };
        try { store.SetValue(ref key, ref value); }
        finally { Marshal.FreeCoTaskMem(value.Text); }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PropertyKey { public Guid FormatId; public uint Id; }
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct PropertyVariant
    {
        [FieldOffset(0)] public ushort Type;
        [FieldOffset(8)] public IntPtr Text;
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        void GetCount(out uint count);
        void GetAt(uint index, out PropertyKey key);
        void GetValue(ref PropertyKey key, out PropertyVariant value);
        void SetValue(ref PropertyKey key, ref PropertyVariant value);
        void Commit();
    }
    private delegate bool EnumWindowsCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder name, int count);
    [DllImport("user32.dll")] private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
    [DllImport("shell32.dll")] private static extern int SHGetPropertyStoreForWindow(IntPtr window, ref Guid interfaceId, [MarshalAs(UnmanagedType.Interface)] out IPropertyStore store);

    private static string FindEdge()
    {
        Environment.SpecialFolder[] folders = {
            Environment.SpecialFolder.ProgramFilesX86,
            Environment.SpecialFolder.ProgramFiles,
            Environment.SpecialFolder.LocalApplicationData
        };
        foreach (Environment.SpecialFolder folder in folders)
        {
            string root = Environment.GetFolderPath(folder);
            if (String.IsNullOrEmpty(root)) continue;
            string candidate = Path.Combine(root, "Microsoft", "Edge", "Application", "msedge.exe");
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }
}
