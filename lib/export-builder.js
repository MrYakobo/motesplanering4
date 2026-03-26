// ── Export HTML builder (no DOM, works in Node and browser) ────────────────────

(function (exports) {
  'use strict';

  var Shared = typeof require !== 'undefined'
    ? require('./shared')
    : window.Shared;

  var MONTH_NAMES = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
  var DAY_NAMES = ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag'];

  var CSS_BLOCK = '<style>'
    + "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400&display=swap');"
    + ' .api { margin-bottom: 2em; }'
    + " .api>p { font-family: 'Roboto', sans-serif; font-weight: 100; text-transform: none; text-align: center; font-size: 3.95em; color: #a30c0c !important; display: table; margin: 10px auto !important; padding: 10px 20px 30px 20px; }"
    + ' .api .weekday { border-top: 1px solid rgba(0, 0, 0, .2); }'
    + ' .api tr.today { background-color: rgba(255, 255, 0, .1); }'
    + " .api table { border-collapse: collapse; font-family: 'Roboto', sans-serif; font-weight: 300; margin: 10px auto; }"
    + ' .api td { padding: 0 7px 4px 8px; }'
    + ' td.holiday { text-align: center; letter-spacing: .2rem; font-weight: 200; text-transform: uppercase; font-size: 1.5em; padding-top: 10px; padding-bottom: 5px; }'
    + ' tr.holiday { border-right: 5px solid; border-left: 5px solid; border-color: #a30c0c; }'
    + '</style>';

  /**
   * Generate the export HTML for the main website.
   * @param {Object} opts
   * @param {Array}  opts.events   - full events array from db
   * @param {string} opts.startDate - YYYY-MM-DD
   * @param {number} opts.months   - number of months to include
   * @param {Date}   opts.today    - current date (for "today" and "thisweek" classes)
   * @returns {string} wrapped HTML ready for the website
   */
  function buildExportHtml(opts) {
    var events = opts.events || [];
    var startStr = opts.startDate;
    var numMonths = opts.months || 2;
    var today = opts.today || new Date();
    var todayStr = Shared.localDate(today);
    var curWeek = Shared.getCurrentWeekRange(today);

    var start = new Date(startStr + 'T00:00:00');
    var endMonth = new Date(start.getFullYear(), start.getMonth() + numMonths, 0);
    var endStr = Shared.localDate(endMonth);

    var filtered = events
      .filter(function (e) { return e.date >= startStr && e.date <= endStr; })
      .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });

    // Group by month
    var byMonth = {};
    filtered.forEach(function (ev) {
      var m = parseInt(ev.date.slice(5, 7)) - 1;
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(ev);
    });

    var exportHtml = '';

    Object.keys(byMonth).sort(function (a, b) { return a - b; }).forEach(function (m) {
      var monthEvents = byMonth[m];
      var rows = '';

      // Group events by date
      var byDate = {};
      monthEvents.forEach(function (ev) {
        if (!byDate[ev.date]) byDate[ev.date] = [];
        byDate[ev.date].push(ev);
      });
      var dates = Object.keys(byDate).sort();

      dates.forEach(function (dateStr, dateIdx) {
        var evs = byDate[dateStr];
        var d = new Date(dateStr + 'T00:00:00');
        var dayName = DAY_NAMES[d.getDay()];
        var dayNum = d.getDate();
        var isThisWeek = dateStr >= curWeek.from && dateStr <= curWeek.to;
        var isSunday = d.getDay() === 0;

        var nextDate = dates[dateIdx + 1];
        var isLastInWeek = false;
        if (isSunday) {
          isLastInWeek = true;
        } else if (nextDate) {
          var nextD = new Date(nextDate + 'T00:00:00');
          if (Shared.getWeekNumber(nextD) !== Shared.getWeekNumber(d)) isLastInWeek = true;
        } else {
          isLastInWeek = true;
        }

        evs.forEach(function (ev, evIdx) {
          var isFirst = evIdx === 0;
          var weekdayCls = isFirst ? 'weekday' : '';
          var thisweekCls = isThisWeek ? ' thisweek' : '';
          var lastCls = (isLastInWeek && evIdx === evs.length - 1) ? ' lastinweek' : '';
          var todayCls = dateStr === todayStr ? ' today' : '';
          var cls = (weekdayCls + thisweekCls + lastCls + todayCls).trim();

          var dateCell = isFirst ? dayName + '&nbsp;' + dayNum : '';
          var titleCell = ev.infoLink
            ? ev.title + ' - <a href="' + ev.infoLink + '">Läs mer här</a>'
            : ev.title;

          rows += '<tr class="' + cls + '">\n    <td>' + dateCell + '</td>\n    <td>' + (ev.time || '') + '</td>\n    <td>' + titleCell + '</td>\n</tr>\n';
        });
      });

      exportHtml += '<div class="api">\n    <p>' + MONTH_NAMES[m] + '</p>\n    <table style="border: 0;" class="dataframe">\n        <tbody>\n' + CSS_BLOCK + '\n' + rows + '        </tbody>\n    </table>\n</div>\n';
    });

    return '<div class="wpb_wrapper">\n' + exportHtml + '</div>';
  }

  exports.buildExportHtml = buildExportHtml;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.ExportBuilder = {}));
