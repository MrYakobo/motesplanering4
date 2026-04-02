// ── UI Component Helpers ──────────────────────────────────────────────────────
// Static methods returning HTML strings. No framework, just less copy-paste.

class UI {
  static badge(text, style) {
    return `<span class="badge" style="${style || ''};font-size:11px;white-space:nowrap">${esc(text)}</span>`;
  }

  static catBadge(catName) {
    return UI.badge(catName || '—', catBadgeStyle(catName));
  }

  static field(label, inputHtml) {
    return `<div class="field-group"><label>${label}</label>${inputHtml}</div>`;
  }

  static input(id, value, opts) {
    const type = opts?.type || 'text';
    const placeholder = opts?.placeholder ? ` placeholder="${opts.placeholder}"` : '';
    const readonly = opts?.readonly ? ' readonly' : '';
    const extra = opts?.style ? ` style="${opts.style}"` : '';
    return `<input type="${type}" id="${id}" value="${escAttr(value || '')}"${placeholder}${readonly}${extra}>`;
  }

  static textarea(id, value, rows) {
    return `<textarea id="${id}" rows="${rows || 2}">${esc(value || '')}</textarea>`;
  }

  static select(id, options, selected) {
    const opts = options.map(o => {
      const val = typeof o === 'string' ? o : o.value;
      const label = typeof o === 'string' ? o : o.label;
      return `<option value="${escAttr(val)}"${val === selected ? ' selected' : ''}>${esc(label)}</option>`;
    }).join('');
    return `<select id="${id}">${opts}</select>`;
  }

  static checkbox(id, checked, label) {
    return `<div class="checkbox-row"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><label for="${id}" style="text-transform:none;font-size:13px;color:#374151">${label}</label></div>`;
  }

  static button(label, onclick, opts) {
    const cls = opts?.danger ? 'btn-danger' : opts?.ghost ? 'btn-ghost' : 'btn';
    const style = opts?.style || '';
    const icon = opts?.icon ? `<i data-lucide="${opts.icon}" style="width:${opts.iconSize||14}px;height:${opts.iconSize||14}px"></i> ` : '';
    const tip = opts?.tip ? ` data-tip="${escAttr(opts.tip)}"` : '';
    return `<button class="${cls}" onclick="${onclick}" style="${style}"${tip}>${icon}${label}</button>`;
  }

  static iconButton(icon, onclick, opts) {
    const style = opts?.style || 'background:none;border:none;color:#9ca3af;cursor:pointer;padding:2px;border-radius:4px;display:inline-flex;align-items:center';
    const tip = opts?.tip ? ` data-tip="${escAttr(opts.tip)}"` : '';
    return `<button onclick="${onclick}" style="${style}"${tip}><i data-lucide="${icon}" style="width:${opts?.size||12}px;height:${opts?.size||12}px"></i></button>`;
  }

  static card(content, opts) {
    const style = opts?.style || '';
    return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;${style}">${content}</div>`;
  }

  static section(title, content) {
    return `<div class="sb-section"><h4>${title}</h4>${content}</div>`;
  }

  static modal(title, body, footer) {
    return `<div class="sidebar-header"><h3>${esc(title)}</h3><button class="sidebar-close" onclick="closeDetailModal()">×</button></div>` +
      `<div class="sidebar-body" style="overflow-y:auto">${body}</div>` +
      (footer ? `<div class="sidebar-footer">${footer}</div>` : '');
  }

  static openModal(title, body, footer) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('detail-modal-content').innerHTML = UI.modal(title, body, footer);
    requestAnimationFrame(() => modal.classList.add('open'));
    initSidebarTracking();
    lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  }

  static openModalRaw(html) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('detail-modal-content').innerHTML = html;
    requestAnimationFrame(() => modal.classList.add('open'));
    initSidebarTracking();
    lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  }

  static emptyState(icon, text) {
    return `<div class="empty-sidebar"><i data-lucide="${icon}" style="width:40px;height:40px;opacity:.3"></i><p style="font-size:13px">${text}</p></div>`;
  }

  static miniList(items) {
    if (!items || items.length === 0) return '<p style="color:#9ca3af;font-size:13px">—</p>';
    return `<ul class="mini-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  }

  static stat(label, value) {
    return `<span class="stat">${label}: <strong>${value}</strong></span>`;
  }

  static avatar(name, size) {
    const s = size || 32;
    const parts = (name || '').split(' ').filter(Boolean);
    const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : (parts[0] || '?').slice(0,2).toUpperCase();
    return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:var(--accent);color:#fff;font-size:${Math.round(s*0.4)}px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>`;
  }

  static toast(msg, type) {
    showToast(msg, type);
  }
}
