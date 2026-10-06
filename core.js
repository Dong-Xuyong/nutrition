(function () {
  "use strict";

  var MEALS = ["breakfast", "lunch", "dinner", "snacks"];

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function parseKey(key) {
    var parts = key.split("-");
    return {
      y: Number(parts[0]),
      m: Number(parts[1]),
      d: Number(parts[2])
    };
  }

  function formatUTC(date) {
    return (
      date.getUTCFullYear() +
      "-" +
      pad2(date.getUTCMonth() + 1) +
      "-" +
      pad2(date.getUTCDate())
    );
  }

  function utcFromKey(key) {
    var p = parseKey(key);
    return new Date(Date.UTC(p.y, p.m - 1, p.d));
  }

  function num(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  function formatInt(n) {
    var rounded = Math.round(n);
    var sign = rounded < 0 ? "-" : "";
    var body = String(Math.abs(rounded));
    return sign + body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function emptyMacros() {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }

  function isLogged(day) {
    if (!day || typeof day !== "object") return false;
    var meals = day.meals;
    if (meals && typeof meals === "object") {
      for (var i = 0; i < MEALS.length; i++) {
        var list = meals[MEALS[i]];
        if (Array.isArray(list) && list.length > 0) return true;
      }
    }
    return Array.isArray(day.exercise) && day.exercise.length > 0;
  }

  function keysEnding(endKey, n) {
    var keys = [];
    var key = shift(endKey, -(n - 1));
    for (var i = 0; i < n; i++) {
      keys.push(key);
      key = shift(key, 1);
    }
    return keys;
  }

  function positiveWeight(day) {
    if (!day || typeof day.weight !== "number") return null;
    if (!Number.isFinite(day.weight) || day.weight <= 0) return null;
    return day.weight;
  }

  function daySpan(earlier, later) {
    var ms = utcFromKey(later).getTime() - utcFromKey(earlier).getTime();
    return Math.round(ms / 86400000);
  }

  function blankStore() {
    return {
      version: 1,
      goals: {
        updatedAt: "",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        weight: 0,
        startWeight: 0
      },
      days: {}
    };
  }

  function dayKey(date) {
    return (
      date.getFullYear() +
      "-" +
      pad2(date.getMonth() + 1) +
      "-" +
      pad2(date.getDate())
    );
  }

  function shift(key, delta) {
    var p = parseKey(key);
    return formatUTC(new Date(Date.UTC(p.y, p.m - 1, p.d + delta)));
  }

  function label(key) {
    var date = utcFromKey(key);
    var weekdayName = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      timeZone: "UTC"
    }).format(date);
    var dayNum = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      timeZone: "UTC"
    }).format(date);
    var monthName = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      timeZone: "UTC"
    }).format(date);
    return weekdayName + ", " + dayNum + " " + monthName;
  }

  function weekday(key) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "UTC"
    }).format(utcFromKey(key));
  }

  function monthGrid(key) {
    var p = parseKey(key);
    var first = new Date(Date.UTC(p.y, p.m - 1, 1));
    var title = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(first);
    var lead = first.getUTCDay();
    var daysInMonth = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
    var count = Math.ceil((lead + daysInMonth) / 7) * 7;
    var cells = [];
    for (var i = 0; i < count; i++) {
      var date = new Date(Date.UTC(p.y, p.m - 1, 1 - lead + i));
      cells.push({
        key: formatUTC(date),
        inMonth: date.getUTCFullYear() === p.y && date.getUTCMonth() === p.m - 1
      });
    }
    return { title: title, cells: cells };
  }

  function totals(day) {
    var byMeal = {
      breakfast: emptyMacros(),
      lunch: emptyMacros(),
      dinner: emptyMacros(),
      snacks: emptyMacros()
    };
    var meals = day && day.meals && typeof day.meals === "object" ? day.meals : {};
    for (var i = 0; i < MEALS.length; i++) {
      var meal = MEALS[i];
      var items = Array.isArray(meals[meal]) ? meals[meal] : [];
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        if (!item || typeof item !== "object") continue;
        byMeal[meal].kcal += num(item.kcal);
        byMeal[meal].protein += num(item.protein);
        byMeal[meal].carbs += num(item.carbs);
        byMeal[meal].fat += num(item.fat);
      }
    }
    var kcal = 0;
    var protein = 0;
    var carbs = 0;
    var fat = 0;
    for (var k = 0; k < MEALS.length; k++) {
      kcal += byMeal[MEALS[k]].kcal;
      protein += byMeal[MEALS[k]].protein;
      carbs += byMeal[MEALS[k]].carbs;
      fat += byMeal[MEALS[k]].fat;
    }
    var exercise = 0;
    var burned = day && Array.isArray(day.exercise) ? day.exercise : [];
    for (var e = 0; e < burned.length; e++) {
      if (burned[e] && typeof burned[e] === "object") exercise += num(burned[e].kcal);
    }
    return {
      kcal: kcal,
      protein: protein,
      carbs: carbs,
      fat: fat,
      exercise: exercise,
      net: kcal - exercise,
      byMeal: byMeal
    };
  }

  function score(day, goals) {
    if (!isLogged(day)) return "grey";
    var g = goals || {};
    var t = totals(day);
    var calOn = g.calories > 0;
    var proOn = g.protein > 0;
    var ratio = calOn ? t.net / g.calories : 1;
    var band10 = ratio >= 0.9 && ratio <= 1.1;
    var band20 = ratio >= 0.8 && ratio <= 1.2;
    var pOk = !proOn || t.protein >= g.protein * 0.9;
    if (band10 && pOk) return "green";
    if (band20) return "yellow";
    return "red";
  }

  function streak(days, goals, todayKey) {
    var map = days || {};
    var key = todayKey;
    if (score(map[key], goals) === "grey") key = shift(key, -1);
    var count = 0;
    for (var i = 0; i < 400; i++) {
      if (score(map[key], goals) !== "green") break;
      count += 1;
      key = shift(key, -1);
    }
    return count;
  }

  function series(days, goals, endKey, n) {
    var map = days || {};
    var keys = keysEnding(endKey, n);
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var day = map[key];
      var t = totals(day);
      out.push({
        key: key,
        weekday: weekday(key),
        kcal: t.kcal,
        protein: t.protein,
        carbs: t.carbs,
        fat: t.fat,
        exercise: t.exercise,
        net: t.net,
        score: score(day, goals),
        weight: positiveWeight(day)
      });
    }
    return out;
  }

  function insights(days, goals, endKey) {
    var map = days || {};
    var g = goals || {};
    var keys = keysEnding(endKey, 7);
    var logged = [];
    for (var i = 0; i < keys.length; i++) {
      if (score(map[keys[i]], g) !== "grey") logged.push(keys[i]);
    }
    if (logged.length === 0) return [];

    var lines = [];
    var kcalSum = 0;
    for (var a = 0; a < logged.length; a++) {
      kcalSum += totals(map[logged[a]]).kcal;
    }
    var avg = Math.round(kcalSum / logged.length);
    if (g.calories > 0) {
      lines.push("Averaging " + formatInt(avg) + " kcal vs " + formatInt(g.calories) + " goal");
    } else {
      lines.push("Averaging " + formatInt(avg) + " kcal");
    }

    if (g.protein > 0) {
      var under = 0;
      for (var p = 0; p < logged.length; p++) {
        if (totals(map[logged[p]]).protein < g.protein) under += 1;
      }
      lines.push("Protein under goal on " + under + " of " + logged.length + " logged days");
    }

    var foods = new Map();
    var seq = 0;
    for (var d = 0; d < keys.length; d++) {
      var day = map[keys[d]];
      var meals = day && day.meals && typeof day.meals === "object" ? day.meals : null;
      if (!meals) continue;
      for (var m = 0; m < MEALS.length; m++) {
        var items = Array.isArray(meals[MEALS[m]]) ? meals[MEALS[m]] : [];
        for (var j = 0; j < items.length; j++) {
          var item = items[j];
          if (!item || typeof item.name !== "string") continue;
          var name = item.name.trim();
          if (!name) continue;
          var id = name.toLowerCase();
          var found = foods.get(id);
          if (!found) {
            foods.set(id, { name: name, kcal: num(item.kcal), seq: seq });
            seq += 1;
          } else {
            found.kcal += num(item.kcal);
          }
        }
      }
    }
    var ranked = Array.from(foods.values()).filter(function (food) {
      return food.kcal > 0;
    });
    ranked.sort(function (a, b) {
      if (b.kcal !== a.kcal) return b.kcal - a.kcal;
      return a.seq - b.seq;
    });
    ranked = ranked.slice(0, 3);
    if (ranked.length > 0) {
      var parts = ranked.map(function (food) {
        return food.name + " (" + formatInt(food.kcal) + " kcal)";
      });
      lines.push("Top foods: " + parts.join(", "));
    }

    var weights = [];
    for (var w = 0; w < keys.length; w++) {
      var weight = positiveWeight(map[keys[w]]);
      if (weight !== null) weights.push(weight);
    }
    if (weights.length >= 2) {
      var change = weights[weights.length - 1] - weights[0];
      var absText = Math.abs(change).toFixed(1);
      if (absText === "0.0") lines.push("Weight steady");
      else if (change > 0) lines.push("Weight up " + absText + " kg");
      else lines.push("Weight down " + absText + " kg");
    }

    return lines;
  }

  function weightTrend(days, goals, endKey, n) {
    var map = days || {};
    var keys = keysEnding(endKey, n);
    var points = [];
    for (var i = 0; i < keys.length; i++) {
      var weight = positiveWeight(map[keys[i]]);
      if (weight !== null) points.push({ key: keys[i], weight: weight });
    }

    var weeklyKg = null;
    if (points.length >= 2) {
      var span = daySpan(points[0].key, points[points.length - 1].key);
      if (span !== 0) {
        var raw =
          (points[points.length - 1].weight - points[0].weight) / span * 7;
        weeklyKg = Number(raw.toFixed(10));
      }
    }

    var etaDays = null;
    var goalWeight = goals && goals.weight > 0 ? goals.weight : 0;
    if (weeklyKg !== null && weeklyKg !== 0 && goalWeight > 0) {
      var delta = goalWeight - points[points.length - 1].weight;
      if (delta === 0) etaDays = 0;
      else if (delta * weeklyKg < 0) etaDays = null;
      else etaDays = Math.round(Math.abs(delta) / Math.abs(weeklyKg) * 7);
    }

    return { points: points, weeklyKg: weeklyKg, etaDays: etaDays };
  }

  function copyFinite(bucket, source, dateKey) {
    if (!source || typeof source !== "object") return;
    var names = Object.keys(source);
    for (var i = 0; i < names.length; i++) {
      var value = source[names[i]];
      if (value !== null && typeof value === "object") continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      bucket[names[i]] = { value: value, key: dateKey };
    }
  }

  function latestHealth(days, endKey) {
    var out = {
      body: {},
      skinfolds: {},
      circ: {},
      vitals: {},
      labs: {}
    };
    if (!days || typeof days !== "object") return out;

    var keys = [];
    var all = Object.keys(days);
    for (var i = 0; i < all.length; i++) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(all[i])) continue;
      if (all[i] <= endKey) keys.push(all[i]);
    }
    keys.sort();

    for (var d = 0; d < keys.length; d++) {
      var dateKey = keys[d];
      var day = days[dateKey];
      if (!day || typeof day !== "object") continue;
      var body = day.body;
      if (body && typeof body === "object") {
        copyFinite(out.body, body, dateKey);
        copyFinite(out.skinfolds, body.skinfolds, dateKey);
        copyFinite(out.circ, body.circ, dateKey);
      }
      copyFinite(out.vitals, day.vitals, dateKey);
      copyFinite(out.labs, day.labs, dateKey);
    }

    return out;
  }

  var NutritionCore = {
    MEALS: MEALS,
    blankStore: blankStore,
    dayKey: dayKey,
    shift: shift,
    label: label,
    weekday: weekday,
    monthGrid: monthGrid,
    totals: totals,
    score: score,
    streak: streak,
    series: series,
    insights: insights,
    weightTrend: weightTrend,
    latestHealth: latestHealth
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = NutritionCore;
  }
  if (typeof window !== "undefined") {
    window.NutritionCore = NutritionCore;
  }
})();

if (typeof module !== "undefined" && require.main === module) {
  var assert = require("assert");
  var NutritionCore = module.exports;

  var days = {
    "2026-08-20": { body: { bodyFat: 10.8, skinfolds: { abdominal: 17 }, circ: { waist: 79.5 } } },
    "2026-09-01": { body: { bodyFat: 11 } },
    "2026-10-01": { body: { bodyFat: 12 } }
  };
  var health = NutritionCore.latestHealth(days, "2026-09-15");
  assert.strictEqual(health.body.bodyFat.value, 11);
  assert.strictEqual(health.body.bodyFat.key, "2026-09-01");
  assert.strictEqual(health.skinfolds.abdominal.value, 17);
  assert.strictEqual(health.skinfolds.abdominal.key, "2026-08-20");
  assert.strictEqual(health.circ.waist.value, 79.5);
  assert.strictEqual(health.circ.waist.key, "2026-08-20");
  assert.deepStrictEqual(health.vitals, {});
  assert.deepStrictEqual(health.labs, {});
  var groups = ["body", "skinfolds", "circ", "vitals", "labs"];
  var g;
  var names;
  var n;
  for (g = 0; g < groups.length; g++) {
    names = Object.keys(health[groups[g]]);
    for (n = 0; n < names.length; n++) {
      assert.notStrictEqual(health[groups[g]][names[n]].key, "2026-10-01");
    }
  }
}
