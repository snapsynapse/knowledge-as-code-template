/**
 * Knowledge-as-Code — Sortable & Filterable Tables
 * Zero dependencies. Auto-initializes on DOMContentLoaded.
 * Targets all table.data-table elements; skips table.matrix-table.
 * Syncs filter/sort state with URL query parameters.
 */
(function () {
    'use strict';

    function initTables() {
        var tables = document.querySelectorAll('table.data-table');
        for (var i = 0; i < tables.length; i++) {
            initTable(tables[i]);
        }
    }

    function initTable(table) {
        var thead = table.querySelector('thead');
        var tbody = table.querySelector('tbody');
        if (!thead || !tbody) return;

        var rows = tbody.querySelectorAll('tr');
        if (rows.length === 0) return;

        // Store original row order for sort reset
        for (var i = 0; i < rows.length; i++) {
            rows[i].setAttribute('data-original-index', i);
        }

        var ths = thead.querySelectorAll('th[data-sortable]');
        var filterSelects = [];
        var sortHandlers = {};

        for (var j = 0; j < ths.length; j++) {
            initHeader(ths[j], j, table, tbody, filterSelects, sortHandlers);
        }

        // Apply URL state after all headers are initialized
        applyUrlState(table, ths, filterSelects, sortHandlers, tbody);
    }

    function initHeader(th, colIndex, table, tbody, filterSelects, sortHandlers) {
        var label = th.textContent.trim();
        var sortType = th.getAttribute('data-sort-type') || 'text';
        var colKey = th.getAttribute('data-col') || label.toLowerCase();
        var filterKey = th.getAttribute('data-filter-key');

        // Build header inner structure
        var content = document.createElement('div');
        content.className = 'th-content';

        var labelEl = document.createElement('span');
        labelEl.className = 'th-label';
        labelEl.textContent = label;

        var arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        labelEl.appendChild(arrow);

        content.appendChild(labelEl);

        // Sort state: 0=none, 1=asc, 2=desc
        var sortState = 0;
        th.setAttribute('aria-sort', 'none');

        function doSort(newState) {
            // Reset all other headers in this table
            var allThs = table.querySelectorAll('thead th[data-sortable]');
            for (var k = 0; k < allThs.length; k++) {
                if (allThs[k] !== th) {
                    allThs[k].setAttribute('aria-sort', 'none');
                    allThs[k]._sortState = 0;
                }
            }

            sortState = newState;
            th._sortState = sortState;

            if (sortState === 0) {
                th.setAttribute('aria-sort', 'none');
                restoreOriginalOrder(tbody);
            } else if (sortState === 1) {
                th.setAttribute('aria-sort', 'ascending');
                sortColumn(tbody, colIndex, sortType, false);
            } else {
                th.setAttribute('aria-sort', 'descending');
                sortColumn(tbody, colIndex, sortType, true);
            }
        }

        labelEl.addEventListener('click', function (e) {
            e.stopPropagation();
            doSort((sortState + 1) % 3);
            updateUrl(table, filterSelects);
        });

        // Store sort handler for URL state restoration
        sortHandlers[colKey] = doSort;

        // Filter dropdown
        if (filterKey) {
            var tableRows = tbody.querySelectorAll('tr');
            if (tableRows.length >= 3) {
                var select = buildFilter(tableRows, colIndex, tbody, filterSelects, filterKey);
                if (select) {
                    content.appendChild(select);
                    filterSelects.push({ select: select, colIndex: colIndex, key: filterKey });
                }
            }
        }

        th.textContent = '';
        th.appendChild(content);
    }

    function buildFilter(rows, colIndex, tbody, filterSelects, filterKey) {
        var values = {}; // value -> display label
        for (var i = 0; i < rows.length; i++) {
            var td = rows[i].children[colIndex];
            if (!td) continue;
            var sortVal = td.getAttribute('data-sort-value');
            var displayVal = td.textContent.trim();
            var val = (sortVal || displayVal).trim();
            if (val && val !== '—') {
                // Use display text as label, canonical value as key
                if (!values[val]) values[val] = displayVal || val.replace(/-/g, ' ');
            }
        }

        var keys = Object.keys(values).sort();
        if (keys.length < 2) return null;

        var select = document.createElement('select');
        select.className = 'th-filter';
        select.setAttribute('aria-label', 'Filter by ' + filterKey);

        var allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = 'All';
        select.appendChild(allOpt);

        for (var j = 0; j < keys.length; j++) {
            var opt = document.createElement('option');
            opt.value = keys[j];
            opt.textContent = values[keys[j]];
            select.appendChild(opt);
        }

        select.addEventListener('change', function () {
            applyFilters(tbody, filterSelects);
            updateUrl(select.closest('table'), filterSelects);
        });

        select.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        return select;
    }

    function applyFilters(tbody, filterSelects) {
        var rows = tbody.querySelectorAll('tr');
        var visibleCount = 0;

        for (var i = 0; i < rows.length; i++) {
            var show = true;
            for (var f = 0; f < filterSelects.length; f++) {
                var filterVal = filterSelects[f].select.value;
                if (!filterVal) continue;

                var td = rows[i].children[filterSelects[f].colIndex];
                if (!td) { show = false; break; }

                var cellVal = (td.getAttribute('data-sort-value') || td.textContent).trim();
                if (cellVal !== filterVal) {
                    show = false;
                    break;
                }
            }
            rows[i].style.display = show ? '' : 'none';
            if (show) visibleCount++;
        }

        var countEl = tbody.closest('table').parentElement.querySelector('.table-result-count');
        if (countEl) {
            countEl.innerHTML = '<strong>' + visibleCount + '</strong> of ' + rows.length;
        }
    }

    // --- URL state sync ---

    function updateUrl(table, filterSelects) {
        var params = new URLSearchParams(window.location.search);

        // Clear old filter/sort params
        params.delete('sort');
        params.delete('dir');
        for (var f = 0; f < filterSelects.length; f++) {
            params.delete(filterSelects[f].key);
        }

        // Set active filters
        for (var g = 0; g < filterSelects.length; g++) {
            var val = filterSelects[g].select.value;
            if (val) params.set(filterSelects[g].key, val);
        }

        // Set active sort
        var sortedTh = table.querySelector('th[aria-sort="ascending"], th[aria-sort="descending"]');
        if (sortedTh) {
            var colKey = sortedTh.getAttribute('data-col') || '';
            var dir = sortedTh.getAttribute('aria-sort') === 'ascending' ? 'asc' : 'desc';
            params.set('sort', colKey);
            params.set('dir', dir);
        }

        var qs = params.toString();
        var newUrl = window.location.pathname + (qs ? '?' + qs : '');
        history.replaceState(null, '', newUrl);
    }

    function applyUrlState(table, ths, filterSelects, sortHandlers, tbody) {
        var params = new URLSearchParams(window.location.search);

        // Apply filters from URL
        var hasFilter = false;
        for (var f = 0; f < filterSelects.length; f++) {
            var urlVal = params.get(filterSelects[f].key);
            if (urlVal) {
                filterSelects[f].select.value = urlVal;
                hasFilter = true;
            }
        }
        if (hasFilter) {
            applyFilters(tbody, filterSelects);
        }

        // Apply sort from URL
        var sortCol = params.get('sort');
        var sortDir = params.get('dir');
        if (sortCol && sortHandlers[sortCol]) {
            var state = sortDir === 'desc' ? 2 : 1;
            sortHandlers[sortCol](state);
        }
    }

    // --- Sorting ---

    function sortColumn(tbody, colIndex, sortType, descending) {
        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));

        rows.sort(function (a, b) {
            var aVal = getSortValue(a.children[colIndex], sortType);
            var bVal = getSortValue(b.children[colIndex], sortType);

            var aEmpty = aVal === '' || aVal === null || aVal === undefined;
            var bEmpty = bVal === '' || bVal === null || bVal === undefined;
            if (aEmpty && bEmpty) return 0;
            if (aEmpty) return 1;
            if (bEmpty) return -1;

            var result;
            if (sortType === 'number') {
                result = aVal - bVal;
            } else {
                result = String(aVal).localeCompare(String(bVal));
            }
            return descending ? -result : result;
        });

        for (var i = 0; i < rows.length; i++) {
            tbody.appendChild(rows[i]);
        }
    }

    function getSortValue(td, type) {
        if (!td) return '';
        var raw = td.getAttribute('data-sort-value');
        if (raw !== null && raw !== '') {
            if (type === 'number') return parseFloat(raw) || 0;
            return raw.toLowerCase();
        }
        var text = td.textContent.trim();
        if (text === '—' || text === '') return '';
        if (type === 'number') return parseFloat(text) || 0;
        return text.toLowerCase();
    }

    function restoreOriginalOrder(tbody) {
        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
        rows.sort(function (a, b) {
            return parseInt(a.getAttribute('data-original-index'), 10) -
                   parseInt(b.getAttribute('data-original-index'), 10);
        });
        for (var i = 0; i < rows.length; i++) {
            tbody.appendChild(rows[i]);
        }
    }

    // --- Anchor links + auto-expand provisions ---

    function initAnchors() {
        // Copy anchor URL on click
        document.addEventListener('click', function (e) {
            var link = e.target.closest('.anchor-link');
            if (!link) return;
            e.preventDefault();
            var url = window.location.origin + window.location.pathname + link.getAttribute('href');
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
            }
            // Brief visual feedback
            var orig = link.textContent;
            link.textContent = '\u2713';
            setTimeout(function () { link.textContent = orig; }, 1200);
        });

        // Auto-expand <details> provision card if URL hash matches
        var hash = window.location.hash;
        if (hash) {
            var target = document.querySelector(hash);
            if (target && target.tagName === 'DETAILS') {
                target.setAttribute('open', '');
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    function initAll() {
        initTables();
        initAnchors();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
