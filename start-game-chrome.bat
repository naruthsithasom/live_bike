@echo off
rem Open MTB Endless Ride in its own Chrome window for TikTok LIVE Studio window capture.
rem - Separate profile folder so the flags below always apply (even if normal Chrome is open)
rem - Flags stop Chrome from slowing the game when the window is covered or not focused
rem   (that throttling makes the captured stream stutter)
rem - --app = clean window without address bar / tabs, sized for 9:16
set URL=http://localhost:3000
start "" chrome --user-data-dir="%LOCALAPPDATA%\mtb-live-chrome" --app=%URL% --window-size=620,1100 ^
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling ^
  --autoplay-policy=no-user-gesture-required
