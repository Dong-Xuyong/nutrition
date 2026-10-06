# Nutrition writer contract

Write the user's nutrition log into the private GitHub repo `Dong-Xuyong/progress-sync`, file `nutrition.json`, with the GitHub Contents API. The website reads this file itself. The website is read-only. It does not edit meals, goals, notes, or weight. Grok is the only writer.

## File shape

Version 1. Optional `profile`, `body`, `vitals`, and `labs` stay on version 1. The numbers below are an example. Ask the user for real targets. Never invent the user's goals or foods.

```json
{
  "version": 1,
  "goals": {
    "updatedAt": "<ISO-8601>",
    "calories": 2200,
    "protein": 160,
    "carbs": 220,
    "fat": 70,
    "weight": 75.0,
    "startWeight": 82.0,
    "sleepHours": 8
  },
  "days": {
    "YYYY-MM-DD": {
      "updatedAt": "<ISO-8601>",
      "meals": {
        "breakfast": [ { "name": "Oats", "qty": "80 g", "kcal": 300, "protein": 10, "carbs": 54, "fat": 5 } ],
        "lunch": [],
        "dinner": [],
        "snacks": []
      },
      "weight": 79.4,
      "note": "Short coach tip for this day."
    }
  }
}
```

Optional `profile` and day measurements. Fake numbers. Omit any key the user did not give. `birthYear`, `sex`, and `activity` stay out unless the user stated them.

```json
{
  "profile": { "updatedAt": "<ISO-8601>", "heightCm": 180 },
  "days": {
    "YYYY-MM-DD": {
      "weight": 80.0,
      "body": {
        "bodyFat": 18, "fatMassKg": 15, "leanMassKg": 65, "muscleMassKg": 35,
        "metabolicAge": 30, "visceralFat": 6, "waterPct": 55,
        "skinfolds": { "triceps": 10, "biceps": 5, "subscapular": 12, "suprailiac": 11, "abdominal": 14, "supraspinal": 9, "thigh": 16, "calf": 8 },
        "circ": { "armRelaxedR": 32, "armRelaxedL": 31, "armFlexedR": 35, "armFlexedL": 34, "thighR": 55, "thighL": 54, "calfR": 37, "calfL": 36, "waist": 80, "glutes": 96 }
      },
      "vitals": { "restingHr": 60, "bpSys": 120, "bpDia": 80, "sleepHours": 7.5 },
      "labs": { "glucose": 5.0, "ldl": 2.5, "hdl": 1.4, "triglycerides": 1.0, "hba1c": 5.2, "alt": 20, "ast": 22 }
    }
  }
}
```

## Fields

- `goals.calories`, `goals.protein`, `goals.carbs`, and `goals.fat` are daily targets. `goals.weight` is the goal body weight in kg. `goals.startWeight` is the starting weight in kg.
- `goals.sleepHours` is the nightly sleep target in hours. Set it only when the user states a target. The `8` in the example JSON above is one example target, not the only possible value.
- Day keys are local calendar dates `YYYY-MM-DD`.
- `meals` keys are exactly `breakfast`, `lunch`, `dinner`, and `snacks`. Each item: `name` (string), `qty` (string, optional), `kcal`, `protein`, `carbs`, `fat` (numbers, grams except kcal).
- `exercise` may still sit on old days (`name`, `kcal`). Do not add it to a new day. See Exercise calories.
- `weight` is that day's body weight in kg (optional). Streetlifting already falls back to it. Do not duplicate weight inside `body`.
- `note` is one coach sentence Grok writes (optional).
- Optional top-level `profile`: `updatedAt` (ISO-8601 UTC, set when the profile changes), `heightCm` (number, cm). `birthYear`, `sex`, and `activity` are optional; omit them unless the user stated them.
- On a day, optional `body`, `vitals`, and `labs`. Omit any key the user did not give. Never invent values. Preserve every other key on the file and on that day. Units are fixed. Do not store a unit field.
- `body` numbers: `bodyFat` (%), `fatMassKg`, `leanMassKg`, `muscleMassKg` (kg), `metabolicAge` (years), `visceralFat` (unitless level), `waterPct` (%). `skinfolds` in mm: `triceps`, `biceps`, `subscapular`, `suprailiac`, `abdominal`, `supraspinal`, `thigh`, `calf`. `circ` in cm. An unmarked limb is right; E/esquerda is left: `armRelaxedR`, `armRelaxedL`, `armFlexedR`, `armFlexedL`, `thighR`, `thighL`, `calfR`, `calfL`, `waist`, `glutes`.
- `vitals`: `restingHr` (bpm), `bpSys`, `bpDia` (mmHg), `sleepHours` (hours). `days["YYYY-MM-DD"].vitals.sleepHours` is hours slept. The date key is the morning you woke up, so a Tuesday entry covers Monday night.
- `labs`: `glucose`, `ldl`, `hdl`, `triglycerides` (mmol/L), `hba1c` (%), `alt`, `ast` (U/L).

## Write rules

- Set `updatedAt` to the current UTC ISO-8601 time on `goals` when goals change, on `profile` when profile changes, and on each day you change.
- Read the file first, modify it, then PUT with the `sha` from the GET so two bot writes do not clobber each other. On 409, GET again and retry once.
- Never delete a day you did not intend to change. Preserve every other key on the file and on that day.
- Never invent `profile`, `body`, `vitals`, or `labs`. Omit missing keys. On update, GET, merge, PUT with `sha`.
- Never invent a sleep number. Omit `goals.sleepHours` or `days["YYYY-MM-DD"].vitals.sleepHours` when the user did not give one.
- Repo: `Dong-Xuyong/progress-sync`. Path: `nutrition.json`. API: `PUT https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/nutrition.json` with `Authorization: Bearer <token>`, `message` `"Save nutrition log"`, `content` as base64 of the full JSON, and `sha`.
- Token: a fine-grained PAT with Contents read and write on `Dong-Xuyong/progress-sync` only. Do not put the token in the repo.
- The website is read-only. It does not edit meals, goals, notes, or weight. Grok is the only writer.

## Exercise calories

Exercise calories are no longer written to nutrition.json. The Nutrition page reads burned calories from streetlifting.json. Grok still writes meals, weight, and goals here, and any profile, body, vitals, or labs the user gave. Do not add `exercise` on a new day. Leave an existing `day.exercise` array alone rather than deleting history. The page ignores that old array on dates that have calories in streetlifting.json. Training goes in streetlifting.json.
