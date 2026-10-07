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
    "sleepHours": 8,
    "restDay": { "calories": 1650, "protein": 150, "carbs": 130, "fat": 60 }
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

- `goals.calories`, `goals.protein`, `goals.carbs`, and `goals.fat` are the training-day eating targets. `goals.weight` is the goal body weight in kg. `goals.startWeight` is the starting weight in kg.
- `goals.sleepHours` is the nightly sleep target in hours. Set it only when the user states a target. The `8` in the example JSON above is one example target, not the only possible value.
- Day keys are local calendar dates `YYYY-MM-DD`.
- `meals` keys are exactly `breakfast`, `lunch`, `dinner`, and `snacks`. Each item: `name` (string), `qty` (string, optional), `kcal`, `protein`, `carbs`, `fat` (numbers, grams except kcal).
- `exercise` is optional, and only for work that is not a streetlifting session (runs, walks, mobility, shifts). See Exercise calories and Optional workout fields.
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
- A day counts toward averages only when it has a real meal log. No meals, under 500 kcal, or a single main meal under 1,000 kcal is left out. Exercise with no meals is not a logged day.

## Optional workout fields

Omit any of these when they are unknown. Never invent them. The website still renders today's file when they are absent.

- `goals.restDay` (object, optional): eating targets for a rest day, `{ "calories": 1650, "protein": 150, "carbs": 130, "fat": 60 }`. When `restDay` is missing, or a number inside it is missing, the website uses those four defaults for the missing numbers. Do not leave protein or fat to fall through to the training targets.
- Training-day eating targets stay `goals.calories`, `goals.protein`, `goals.carbs`, and `goals.fat` (2,050 kcal, 150 g protein, 225 g carbs, 60 g fat). When one of those numbers is missing, the website uses that default for the missing number only.
- That day's eating target, the calorie ring, the colour score, "left" / "over", and averages all compare **gross calories eaten** with the matching target set. Workout kcal is information only. Never subtract exercise from eaten (no eat-back).
- `goals.bmr` (number, optional): basal metabolic rate in kcal/day. Default 1,610 when missing.
- `goals.neatFactor` (number, optional): multiplier on BMR for the day before exercise. Default 1.3 when missing. Daily base = `bmr × neatFactor` (default 1,610 × 1.3, about 2,100 kcal). If the website shows an estimated deficit, it is `(base + that day's workout kcal) − calories eaten`. Never use 2,400 plus exercise. The deficit does not change the eating target, the left/over line, or the ring.
- `days[YYYY-MM-DD].dayType` (string, optional): `"training"` or `"rest"`. When it is present, it overrides the website's guess. Omit it and the website decides: a date is training when `streetlifting.json` has a session that day, or when the day has a run of 30 minutes or more. Otherwise it is a rest day. A run under 30 minutes is a rest day. Walks, mobility, jump rope, bikes, and work shifts do not make a training day on their own.
- On an `exercise` item, `durationMin` (number, minutes) and `source` (string, for example `"manual"`) are optional. Keep `name` and `kcal`. Omit `durationMin` and `source` when the user did not give them. `kcal` on the item, when present, is the workout energy for that entry.

`streetlifting.json` sessions stay `{ bw, note, lifts: { squat: [{ kg, reps, rpe? }], ... }, activities: [{ type, kcal?, durationMin?, km? }] }`. `durationMin` on a session is optional. When it is missing, the website assumes 2.5 minutes per set. `liftKcal` on a session is optional and, when present with no sets, is shown as a lifting range of about ±25%. The website does not write that file.

## Exercise calories

Lifting calories are not stored in this file. The website estimates them from `streetlifting.json`. Use `activities[].kcal` or an `exercise` item's `kcal` when that number is present. Otherwise estimate gross kcal as MET × bodyweight kg × hours. Weighted calisthenics and other resistance work use about 5.5 METs and are shown as a range of about ±25%. Jump rope uses about 11 METs. Running uses pace when distance and duration are both present, otherwise about 9.8 METs. Hours come from `durationMin` (or `minutes`). When a lifting session has no duration, each working set counts as 2.5 minutes, and the session total is split across lifts by set count. Bodyweight is the session `bw`, otherwise the latest weigh-in on or before that day, otherwise 67.6 kg. Do not subtract the resting 1 MET. The ±25% range is for lifting estimates. A kcal that was written down is shown as that number.

Write `exercise` here only when the user reports work that is not in that session: runs, walks, mobility, shifts, jump rope, and similar. Each item is `name`, `kcal`, and the optional `durationMin` and `source` above. Do not copy lifting kcal into `exercise` on a day that already has a streetlifting session. Do not invent entries. Leave an existing `exercise` array in place when you are editing other fields on that day. Grok writes meals, weight, goals, these optional workout fields, and any given profile, body, vitals, or labs here, and the lifting sets in streetlifting.json. The website does not write `streetlifting.json`.
