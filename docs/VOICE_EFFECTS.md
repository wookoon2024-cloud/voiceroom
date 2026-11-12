# Microphone voice effects

Settings offers original, low (-4 semitones), high (+4 semitones), and robot modes. The default preserves the existing microphone path. Changed voices are processed locally with an AudioWorklet before LiveKit publishes them; sample counts and speech speed stay unchanged. Preview connects a separate local monitor only while enabled, and stops on mute, leaving, or closing settings. Headphones are recommended for preview.

The worklet uses overlapping variable-delay grains for pitch and 60 Hz ring modulation for robot. Track processor teardown stops the processed output, leaving microphone ownership with LiveKit. Speech recognition continues using the browser's original microphone input. Effects are session settings; they do not enable a muted microphone.

Validation: `node scripts/check-voice-effects.mjs` checks exact original output, pitch, sample counts, robot sidebands, bounded output, and silence. Browser QA also used a synthetic oscillator through the actual AudioWorklet/MediaStream graph and verified output cleanup without stopping the input. Physical microphone sound quality depends on the device and was not evaluated with a live room call.

The separate “내 캐릭터 클릭” switch defaults ON and persists locally. OFF removes the local sprite from alpha picking and disables its nameplate/seat menu. Other participants remain selectable, including behind the local sprite. Character controls remain accessible from the toolbar.
