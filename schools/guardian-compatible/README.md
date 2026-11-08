Shared guardian 3.3.2 uses the user-supplied working launcher. The main UI and launcher code are preserved; routing selects private or schools and keeps the shared Chrome workspace in front. Build verification checks gzip roundtrip and that every byte outside the embedded payload is unchanged. Actual Windows behavior still requires the user test.
Original uploaded launcher SHA256: f1cd0d52986176d1a26ab64c73894eaff43aa17b54f4309906fe99eb1b59b001

3.3.2 keeps the controls visible and minimizes to the taskbar; START-VISIBLE.cmd displays direct PowerShell startup errors.

3.3.2 creates the control panel before Chrome profile lookup; lookup failures stay visible in its status.
