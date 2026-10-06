# Nutrition

A read-only nutrition log for meals, exercise, weight, and daily targets. The Workout page charts weight, estimates session burn, and shows the daily deficit.

Live: https://dong-xuyong.github.io/nutrition/

Data lives in Dong-Xuyong/progress-sync, files nutrition.json and streetlifting.json. The pages only read those files.

nutrition.json also holds a profile (height) plus per-day body composition, skinfolds, circumferences, vitals, and labs. Data stays in Dong-Xuyong/progress-sync.

The log and workout pages auto-load those files on open, on focus, and every 60 seconds.

Nothing on the page is editable. Grok writes the file.

CONTRACT.md is the writer spec for updating nutrition.json.
