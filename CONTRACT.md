# Nutrition writer contract

Write the user's nutrition log into the private GitHub repo `Dong-Xuyong/progress-sync`, file `nutrition.json`, with the GitHub Contents API. The website reads this file itself. The website is read-only. It does not edit meals, goals, notes, or weight. Grok is the only writer.

## File shape

Version 1. The numbers below are an example. Ask the user for real targets. Never invent the user's goals or foods.

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
    "startWeight": 82.0
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
      "exercise": [ { "name": "Run 5k", "kcal": 350 } ],
      "weight": 79.4,
      "note": "Short coach tip for this day."
    }
  }
}
```

## Fields

- `goals.calories`, `goals.protein`, `goals.carbs`, and `goals.fat` are daily targets. `goals.weight` is the goal body weight in kg. `goals.startWeight` is the starting weight in kg.
- Day keys are local calendar dates `YYYY-MM-DD`.
- `meals` keys are exactly `breakfast`, `lunch`, `dinner`, and `snacks`. Each item: `name` (string), `qty` (string, optional), `kcal`, `protein`, `carbs`, `fat` (numbers, grams except kcal).
- `exercise` items: `name`, and `kcal` burned.
- `weight` is that day's body weight in kg (optional).
- `note` is one coach sentence Grok writes (optional).

## Write rules

- Set `updatedAt` to the current UTC ISO-8601 time on `goals` when goals change, and on each day you change.
- Read the file first, modify it, then PUT with the `sha` from the GET so two bot writes do not clobber each other. On 409, GET again and retry once.
- Never delete a day you did not intend to change. Preserve every other key.
- Repo: `Dong-Xuyong/progress-sync`. Path: `nutrition.json`. API: `PUT https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/nutrition.json` with `Authorization: Bearer <token>`, `message` `"Save nutrition log"`, `content` as base64 of the full JSON, and `sha`.
- Token: a fine-grained PAT with Contents read and write on `Dong-Xuyong/progress-sync` only. Do not put the token in the repo.
- The website is read-only. It does not edit meals, goals, notes, or weight. Grok is the only writer.
