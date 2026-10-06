/* Read-only nutrition log. A GitHub load replaces the copy on this device. */
(function () {
  "use strict";

  var STORE_KEY = "nutrition-v1";
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var SCORE = { green: "🟢 On target", yellow: "🟡 Close", red: "🔴 Off target", grey: "⚪ No log" };
  var SVGNS = "http://www.w3.org/2000/svg";
  var GREEN = "hsl(152 55% 40%)";
  var RED = "hsl(4 80% 56%)";

  var syncEl = document.getElementById("sync-label");
  if (
    typeof NutritionCore === "undefined" ||
    typeof GhSync === "undefined" ||
    typeof GhSync.load !== "function"
  ) {
    if (syncEl) syncEl.textContent = "Not synced";
    return;
  }

  var els = {
    sync: syncEl,
    ring: document.getElementById("ring"),
    period: document.getElementById("period-label"),
    remain: document.getElementById("remain-line"),
    score: document.getElementById("score-line"),
    prev: document.getElementById("prev"),
    today: document.getElementById("today"),
    next: document.getElementById("next"),
    main: document.getElementById("main"),
    connect: document.getElementById("connect"),
    connectBtn: document.getElementById("btn-connect")
  };

  var store = readStore();
  var range = 7;
  var loading = false;

  function fmt(n) {
    return Math.round(Number(n) || 0).toLocaleString("en-GB");
  }

  function kgText(n) {
    var v = Math.round(Math.abs(n) * 10) / 10;
    return v.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  }

  function hhmm() {
    var now = new Date();
    return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  }

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function button(className, text) {
    var el = node("button", className, text);
    el.type = "button";
    return el;
  }

  function svg(tag) {
    return document.createElementNS(SVGNS, tag);
  }

  function card(title, extra) {
    var section = node("section", extra ? "card " + extra : "card");
    section.appendChild(node("h3", "", title));
    return section;
  }

  function cap(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function hashKey() {
    var raw = location.hash.replace(/^#/, "");
    try {
      raw = decodeURIComponent(raw);
    } catch (e) {}
    return raw;
  }

  function isDayKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    var y = +key.slice(0, 4);
    var m = +key.slice(5, 7);
    var d = +key.slice(8, 10);
    var date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  function readStore() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (data && data.version === 1 && data.days && typeof data.days === "object") {
        if (!data.goals) data.goals = NutritionCore.blankStore().goals;
        return data;
      }
    } catch (e) {}
    return NutritionCore.blankStore();
  }

  function persist() {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  function hasToken() {
    try {
      var cfg = JSON.parse(localStorage.getItem("dong-gh-sync") || "null");
      return !!(cfg && cfg.token);
    } catch (e) {
      return false;
    }
  }

  function showConnect() {
    els.connect.hidden = hasToken();
  }

  function guide(y) {
    var line = svg("line");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", "300");
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("class", "guide");
    line.setAttribute("stroke-dasharray", "4 3");
    line.setAttribute("stroke-width", "1.5");
    return line;
  }

  function calorieChart(series, goalCal) {
    var wrap = node("div", "chart");
    var board = svg("svg");
    var maxK = 0;
    var n = series.length;
    var gap = n > 10 ? 2 : 4;
    var bw = n ? (300 - gap * (n - 1)) / n : 0;
    var maxScale;
    board.setAttribute("viewBox", "0 0 300 120");
    series.forEach(function (day) {
      var k = day && typeof day.kcal === "number" ? day.kcal : 0;
      if (k > maxK) maxK = k;
    });
    maxScale = Math.max(goalCal > 0 ? goalCal : 0, maxK, 1);
    series.forEach(function (day, idx) {
      var kcal = day && typeof day.kcal === "number" ? day.kcal : 0;
      var h = (Math.max(kcal, 0) / maxScale) * 120;
      var rect = svg("rect");
      var title = svg("title");
      rect.setAttribute("x", String(idx * (bw + gap)));
      rect.setAttribute("y", String(120 - h));
      rect.setAttribute("width", String(bw));
      rect.setAttribute("height", String(h));
      rect.setAttribute("fill", goalCal > 0 && kcal > goalCal ? RED : GREEN);
      title.textContent = (day && day.key ? day.key + " " : "") + fmt(kcal) + " kcal";
      rect.appendChild(title);
      board.appendChild(rect);
    });
    if (goalCal > 0) board.appendChild(guide(120 - (goalCal / maxScale) * 120));
    wrap.appendChild(board);
    return wrap;
  }

  function weightChart(series, points, goalW) {
    var vals = [];
    var slot = {};
    var min;
    var max;
    var coords = [];
    var wrap = node("div", "chart");
    var board = svg("svg");
    var poly = svg("polyline");
    points.forEach(function (point) {
      if (point && typeof point.weight === "number") vals.push(point.weight);
    });
    if (vals.length < 2) return null;
    min = vals[0];
    max = vals[0];
    vals.forEach(function (w) {
      if (w < min) min = w;
      if (w > max) max = w;
    });
    if (goalW > 0) {
      if (goalW < min) min = goalW;
      if (goalW > max) max = goalW;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    series.forEach(function (day, i) {
      if (day && day.key) slot[day.key] = i;
    });
    function yOf(w) {
      return 8 + (1 - (w - min) / (max - min)) * 84;
    }
    function xOf(i, count) {
      return count <= 1 ? 150 : 6 + (i / (count - 1)) * 288;
    }
    points.forEach(function (point, i) {
      var at;
      if (!point || typeof point.weight !== "number") return;
      at = point.key != null && slot[point.key] != null ? slot[point.key] : i;
      coords.push(xOf(at, series.length || points.length).toFixed(1) + "," + yOf(point.weight).toFixed(1));
    });
    board.setAttribute("viewBox", "0 0 300 100");
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", GREEN);
    poly.setAttribute("stroke-width", "2");
    poly.setAttribute("stroke-linejoin", "round");
    poly.setAttribute("stroke-linecap", "round");
    poly.setAttribute("points", coords.join(" "));
    board.appendChild(poly);
    if (goalW > 0) board.appendChild(guide(yOf(goalW)));
    wrap.appendChild(board);
    return wrap;
  }

  function trendText(trend) {
    var text = "";
    if (!trend) return "";
    if (typeof trend.weeklyKg === "number" && isFinite(trend.weeklyKg)) {
      text = (trend.weeklyKg < 0 ? "losing" : "gaining") + " " + kgText(trend.weeklyKg) + " kg/week";
    }
    if (typeof trend.etaDays === "number" && trend.etaDays > 0) {
      text += (text ? " · " : "") + "about " + fmt(trend.etaDays) + " days to goal";
    } else if (trend.etaDays === 0) {
      text += (text ? " · " : "") + "at goal";
    }
    return text;
  }

  function macroRow(label, total, goal) {
    var row = node("div", goal > 0 && total > goal ? "macro over" : "macro");
    var nums = node("div", "nums");
    var bar = node("div", "bar");
    var fill = document.createElement("i");
    row.appendChild(node("span", "name", label));
    nums.appendChild(node("span", "", goal > 0 ? fmt(total) + " / " + fmt(goal) + " g" : fmt(total) + " g"));
    row.appendChild(nums);
    fill.style.width = (goal > 0 ? Math.min(100, (total / goal) * 100) : 0) + "%";
    bar.appendChild(fill);
    row.appendChild(bar);
    return row;
  }

  function render() {
    var key = hashKey();
    var today = NutritionCore.dayKey(new Date());
    var goals;
    var day;
    var totals;
    var band;
    var streak;
    var remaining;
    var eaten;
    var net;
    var macros;
    var anyMacro;
    var meals;
    var series;
    var trend;
    var points;
    var weighed;
    var lines;
    var grid;
    var heat;
    if (!isDayKey(key)) return;
    goals = store.goals || {};
    day = store.days[key] || {};
    totals = NutritionCore.totals(store.days[key]) || {};
    band = NutritionCore.score(store.days[key], goals);
    streak = NutritionCore.streak(store.days, goals, today);
    eaten = Number(totals.kcal) || 0;
    net = typeof totals.net === "number" ? totals.net : eaten;
    remaining = goals.calories > 0 ? goals.calories - net : null;

    els.period.textContent = NutritionCore.label(key) || "";
    els.today.hidden = key === today;
    els.ring.style.setProperty(
      "--p",
      String(goals.calories > 0 ? Math.min(100, Math.round((eaten / goals.calories) * 100)) : 0)
    );
    els.ring.classList.toggle("over", goals.calories > 0 && net > goals.calories);
    if (remaining == null) els.remain.textContent = fmt(eaten) + " eaten";
    else els.remain.textContent = fmt(Math.abs(remaining)) + (remaining < 0 ? " over" : " left");
    els.score.textContent = (SCORE[band] || "⚪ No log") + " · " + streak + " day streak";

    els.main.textContent = "";
    if (band === "grey") {
      els.main.appendChild(node("section", "card empty", "Nothing logged for this day yet."));
    }

    macros = node("div", "macros");
    anyMacro = false;
    [
      ["Protein", totals.protein, goals.protein],
      ["Carbs", totals.carbs, goals.carbs],
      ["Fat", totals.fat, goals.fat]
    ].forEach(function (spec) {
      var total = typeof spec[1] === "number" ? spec[1] : 0;
      var goal = typeof spec[2] === "number" ? spec[2] : 0;
      if (!(goal > 0 || total > 0)) return;
      anyMacro = true;
      macros.appendChild(macroRow(spec[0], total, goal));
    });
    if (anyMacro) {
      var macroCard = card("Macros");
      macroCard.appendChild(macros);
      els.main.appendChild(macroCard);
    }

    if (typeof day.note === "string" && day.note.trim()) {
      var note = card("Coach", "note");
      note.appendChild(node("p", "", day.note.trim()));
      els.main.appendChild(note);
    }

    meals = day.meals || {};
    NutritionCore.MEALS.forEach(function (name) {
      var items = meals[name];
      var section;
      var head;
      var sub;
      var mealKcal;
      if (!Array.isArray(items) || !items.length) return;
      sub = totals.byMeal && totals.byMeal[name];
      mealKcal = sub && typeof sub === "object" ? sub.kcal : 0;
      section = node("section", "card");
      head = node("div", "meal-head");
      head.appendChild(node("h4", "", cap(name)));
      head.appendChild(node("span", "", fmt(mealKcal) + " kcal"));
      section.appendChild(head);
      items.forEach(function (item) {
        var row;
        if (!item || typeof item !== "object") return;
        row = node("div", "item");
        row.appendChild(node("span", "", item.name || ""));
        row.appendChild(node("span", "qty", item.qty == null ? "" : String(item.qty)));
        row.appendChild(node("span", "kcal", fmt(item.kcal) + " kcal"));
        section.appendChild(row);
      });
      els.main.appendChild(section);
    });

    if (Array.isArray(day.exercise) && day.exercise.length) {
      var exercise = card("Exercise");
      day.exercise.forEach(function (entry) {
        var row;
        var burned;
        if (!entry || typeof entry !== "object") return;
        row = node("div", "ex-row");
        burned = node("span", "kcal", fmt(entry.kcal) + " kcal");
        burned.style.gridColumn = "3";
        row.appendChild(node("span", "", entry.name || ""));
        row.appendChild(burned);
        exercise.appendChild(row);
      });
      els.main.appendChild(exercise);
    }

    series = NutritionCore.series(store.days, goals, key, range);
    if (!Array.isArray(series)) series = [];
    trend = NutritionCore.weightTrend(store.days, goals, key, range) || {};
    points = Array.isArray(trend.points) ? trend.points : [];
    weighed = 0;
    series.forEach(function (dayRow) {
      if (dayRow && dayRow.weight != null) weighed += 1;
    });
    (function () {
      var trends = card("Trends");
      var toggle = node("div", "toggle");
      [7, 30].forEach(function (days) {
        var choice = button(range === days ? "on" : "", days + " days");
        choice.addEventListener("click", function () {
          if (range === days) return;
          range = days;
          render();
        });
        toggle.appendChild(choice);
      });
      trends.appendChild(toggle);
      trends.appendChild(node("p", "chart-label", "Calories"));
      trends.appendChild(calorieChart(series, goals.calories > 0 ? goals.calories : 0));
      if (weighed >= 2 || points.length >= 2) {
        var plot = points.length >= 2 ? points : series.filter(function (dayRow) {
          return dayRow && typeof dayRow.weight === "number";
        });
        var chart = weightChart(series, plot, goals.weight > 0 ? goals.weight : 0);
        var caption = trendText(trend);
        if (chart) {
          trends.appendChild(node("p", "chart-label", "Weight"));
          trends.appendChild(chart);
        }
        if (caption) trends.appendChild(node("p", "", caption));
      }
      els.main.appendChild(trends);
    })();

    lines = NutritionCore.insights(store.days, goals, key) || [];
    if (lines.length) {
      var insightCard = card("Insights");
      var list = node("ul", "insights");
      lines.forEach(function (line) {
        list.appendChild(node("li", "", String(line)));
      });
      insightCard.appendChild(list);
      els.main.appendChild(insightCard);
    }

    grid = NutritionCore.monthGrid(key);
    (function () {
      var month = card(grid.title || "");
      var head = node("div", "heat-head");
      heat = node("div", "heat");
      WEEKDAYS.forEach(function (name) {
        head.appendChild(node("span", "", name));
      });
      month.appendChild(head);
      (grid.cells || []).forEach(function (cell) {
        var mark = NutritionCore.score(store.days[cell.key], goals);
        var link = document.createElement("a");
        link.href = "#" + cell.key;
        link.textContent = String(parseInt(cell.key.slice(8), 10));
        link.className = mark + (cell.inMonth ? "" : " out") + (cell.key === today ? " today" : "");
        link.title = cell.key + " " + mark;
        heat.appendChild(link);
      });
      month.appendChild(heat);
      els.main.appendChild(month);
    })();
  }

  function apply(remote) {
    if (!(remote && remote.version === 1 && remote.days && typeof remote.days === "object")) return;
    if (!remote.goals) remote.goals = NutritionCore.blankStore().goals;
    store = remote;
    persist();
    render();
  }

  function pull() {
    loading = true;
    GhSync.load("nutrition", apply).then(function () {
      loading = false;
      showConnect();
      els.sync.textContent = "Synced " + hhmm();
    }, function (err) {
      loading = false;
      showConnect();
      els.sync.textContent = err && err.message ? err.message : String(err);
    });
  }

  function autoLoad() {
    showConnect();
    if (!hasToken()) {
      els.sync.textContent = "Not synced";
      return;
    }
    if (loading) return;
    pull();
  }

  function go(delta) {
    var key = hashKey();
    if (!isDayKey(key)) return;
    location.hash = "#" + NutritionCore.shift(key, delta);
  }

  function onHash() {
    if (!isDayKey(hashKey())) location.replace("#" + NutritionCore.dayKey(new Date()));
    else render();
  }

  els.prev.addEventListener("click", function () { go(-1); });
  els.next.addEventListener("click", function () { go(1); });
  els.today.addEventListener("click", function () {
    location.hash = "#" + NutritionCore.dayKey(new Date());
  });
  els.connectBtn.addEventListener("click", function () {
    if (!loading) pull();
  });
  window.addEventListener("hashchange", onHash);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") autoLoad();
  });

  if (!isDayKey(hashKey())) location.replace("#" + NutritionCore.dayKey(new Date()));
  else render();
  setInterval(autoLoad, 60000);
  autoLoad();
})();
