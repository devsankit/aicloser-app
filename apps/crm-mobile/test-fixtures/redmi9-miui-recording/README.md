# Redmi 9 recording-route fixture

This fixture captures the non-sensitive device conditions observed on the connected Redmi 9:

- Xiaomi manufacturer, Redmi brand, model `M2004J19C`, device `lancelot`
- Android 12 / API 31
- native dialer recording directory: `/sdcard/MIUI/sound_recorder/call_rec`
- shared audio access granted
- Accessibility Share disabled in the observed state
- microphone fallback enabled in preferences

The expected behavior after the routing fix is:

1. Do not start the microphone recorder when the native shared recording source is available.
2. Import the completed Xiaomi recording from the native folder.
3. If that source is unavailable or the specific recording is not found, use the visible Accessibility Share flow when enabled.
4. Use microphone capture only when neither native import nor Accessibility Share is available.

The emulator cannot become a real MIUI dialer. Use the profile for route-selection and importer tests, then perform the final call/audio verification on the physical Redmi 9.
