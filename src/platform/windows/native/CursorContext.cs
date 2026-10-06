using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
public static class AnimeCursorSemantics {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int x; public int y; }
  [StructLayout(LayoutKind.Sequential)] public struct CursorInfo { public int size; public int flags; public IntPtr cursor; public Point position; }
  [DllImport("user32.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] static extern bool GetCursorInfo(ref CursorInfo info);
  [DllImport("user32.dll", EntryPoint="LoadCursorW")] static extern IntPtr LoadCursor(IntPtr instance, IntPtr resource);
  public static int Main(string[] args) {
    try {
      int parent = int.Parse(args[0]); int[] resources = new int[args.Length - 1];
      for (int i = 1; i < args.Length; i++) resources[i - 1] = int.Parse(args[i]);
      int last = -1; bool lastOk = false; var clock = Stopwatch.StartNew(); long emitted = -1000;
      using (var owner = Process.GetProcessById(parent)) {
        while (!owner.HasExited) {
          var info = new CursorInfo(); info.size = Marshal.SizeOf(typeof(CursorInfo));
          bool ok = GetCursorInfo(ref info); int id = 0;
          // Coordinates in CURSORINFO are intentionally discarded: Electron is the sole position source.
          if (ok && (info.flags & 1) != 0 && info.cursor != IntPtr.Zero) {
            foreach (int resource in resources) {
              IntPtr standard = LoadCursor(IntPtr.Zero, new IntPtr(resource));
              if (standard != IntPtr.Zero && standard == info.cursor) {
                // An ambiguous theme/shared handle is not enough to infer semantics.
                if (id != 0) { id = 0; break; }
                id = resource;
              }
            }
          }
          if (id != last || ok != lastOk || clock.ElapsedMilliseconds - emitted >= 1000) {
            Console.WriteLine("{\"id\":" + id + ",\"ok\":" + (ok ? "true" : "false") + "}"); Console.Out.Flush();
            last = id; lastOk = ok; emitted = clock.ElapsedMilliseconds;
          }
          Thread.Sleep(50);
        }
      }
      return 0;
    } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
  }
}
