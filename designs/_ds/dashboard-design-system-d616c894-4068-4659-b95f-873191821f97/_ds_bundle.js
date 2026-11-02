/* @ds-bundle: {"format":4,"namespace":"DashboardDesignSystem_d616c8","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"AreaChart","sourcePath":"components/charts/AreaChart.jsx"},{"name":"Sparkline","sourcePath":"components/charts/Sparkline.jsx"},{"name":"ListRow","sourcePath":"components/data/ListRow.jsx"},{"name":"StatGrid","sourcePath":"components/data/StatGrid.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Avatar","sourcePath":"components/display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Hatch","sourcePath":"components/display/Hatch.jsx"},{"name":"Icon","sourcePath":"components/display/Icon.jsx"},{"name":"StatusBadge","sourcePath":"components/display/StatusBadge.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"AmountInput","sourcePath":"components/forms/AmountInput.jsx"},{"name":"AmountPair","sourcePath":"components/forms/AmountInput.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"SelectField","sourcePath":"components/forms/SelectField.jsx"},{"name":"BottomNav","sourcePath":"components/navigation/BottomNav.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"ContentPanel","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Stepper","sourcePath":"components/navigation/Stepper.jsx"},{"name":"Dialog","sourcePath":"components/overlays/Dialog.jsx"},{"name":"Sheet","sourcePath":"components/overlays/Sheet.jsx"},{"name":"Checkbox","sourcePath":"components/selection/Checkbox.jsx"},{"name":"Chip","sourcePath":"components/selection/Chip.jsx"},{"name":"ChipGroup","sourcePath":"components/selection/Chip.jsx"},{"name":"OptionTile","sourcePath":"components/selection/OptionTile.jsx"},{"name":"SegmentedControl","sourcePath":"components/selection/SegmentedControl.jsx"},{"name":"Tabs","sourcePath":"components/selection/Tabs.jsx"},{"name":"Banner","sourcePath":"components/surfaces/Banner.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"CardRow","sourcePath":"components/surfaces/Card.jsx"},{"name":"ExploreCard","sourcePath":"components/surfaces/ExploreCard.jsx"},{"name":"ReviewRow","sourcePath":"components/surfaces/ReviewRow.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"4c71f1beda83","components/actions/IconButton.jsx":"ec6964b6d107","components/charts/AreaChart.jsx":"139c4ff4d4ec","components/charts/Sparkline.jsx":"f22b6bcab5b1","components/data/ListRow.jsx":"aa2b7f92ccc3","components/data/StatGrid.jsx":"1f4ef6ab1dd8","components/data/Table.jsx":"c8ce163d328f","components/display/Avatar.jsx":"0f7a3652ac4f","components/display/Badge.jsx":"526aae589882","components/display/Hatch.jsx":"19d890700c77","components/display/Icon.jsx":"ba81ff1e3e33","components/display/StatusBadge.jsx":"78cb39a9d87b","components/feedback/EmptyState.jsx":"6d84639a8673","components/feedback/Skeleton.jsx":"a8aed48f4f0d","components/forms/AmountInput.jsx":"760c95067884","components/forms/Input.jsx":"c37969e596a4","components/forms/Select.jsx":"c0a3e2887011","components/forms/SelectField.jsx":"f43a7d6ab3c0","components/navigation/BottomNav.jsx":"28356d91e802","components/navigation/Sidebar.jsx":"d0a5f7dc7569","components/navigation/Stepper.jsx":"4d357efa9d30","components/overlays/Dialog.jsx":"fac69e5c1643","components/overlays/Sheet.jsx":"1204fdd36ad9","components/selection/Checkbox.jsx":"5d4e6807875b","components/selection/Chip.jsx":"078ed491fab2","components/selection/OptionTile.jsx":"77faf41f7f7c","components/selection/SegmentedControl.jsx":"4a590578bbab","components/selection/Tabs.jsx":"027d55847d55","components/surfaces/Banner.jsx":"0b7f52f200a6","components/surfaces/Card.jsx":"648cdee38452","components/surfaces/ExploreCard.jsx":"b5c7e7c58a72","components/surfaces/ReviewRow.jsx":"dc664dfa6133","ui_kits/dashboard/Auth.jsx":"3b59d77da7af","ui_kits/dashboard/Detail.jsx":"e3dcc7f1dea7","ui_kits/dashboard/Flows.jsx":"575fba3bf629","ui_kits/dashboard/Overview.jsx":"37bd7dc3a449","ui_kits/dashboard/Reports.jsx":"9ffbe5f5ceb2","ui_kits/dashboard/Settings.jsx":"5083fa4196f2","ui_kits/dashboard/Shell.jsx":"5f1ad4174388","ui_kits/dashboard/data.js":"c03da676493a"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DashboardDesignSystem_d616c8 = window.DashboardDesignSystem_d616c8 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/charts/Sparkline.jsx
try { (() => {
/** Inline 96×36 trend, colored by direction. */
function Sparkline({
  data = [],
  tone,
  width = 96,
  height = 36,
  className = '',
  style
}) {
  const id = React.useId().replace(/:/g, '');
  const n = data.length;
  if (!n) return null;
  const min = Math.min(...data),
    max = Math.max(...data);
  const pts = data.map((v, i) => [i / (n - 1 || 1) * 160, 4 + (1 - (v - min) / (max - min || 1)) * 56]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const t = tone || (data[n - 1] >= data[0] ? 'up' : 'down');
  return /*#__PURE__*/React.createElement("span", {
    className: ('ds-spark ' + className).trim(),
    "data-tone": t,
    style: {
      width,
      height,
      display: 'inline-block',
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 160 64",
    preserveAspectRatio: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: 's' + id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "currentColor",
    stopOpacity: ".24"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "currentColor",
    stopOpacity: ".05"
  }))), /*#__PURE__*/React.createElement("path", {
    d: d + ' L160 64 L0 64 Z',
    fill: 'url(#s' + id + ')'
  }), /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke"
  })));
}
Object.assign(__ds_scope, { Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/charts/Sparkline.jsx", error: String((e && e.message) || e) }); }

// components/data/StatGrid.jsx
try { (() => {
const TONE = {
  positive: 'var(--positive)',
  negative: 'var(--negative)'
};
/** Key-figure grid (dt/dd pairs) or a label/value details list. */
function StatGrid({
  items = [],
  columns = 3,
  layout = 'grid',
  className = '',
  style
}) {
  const cls = layout === 'list' ? 'ds-details' : 'ds-stats';
  return /*#__PURE__*/React.createElement("dl", {
    className: (cls + ' ' + className).trim(),
    style: {
      '--cols': columns,
      ...style
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("dt", null, it.label), /*#__PURE__*/React.createElement("dd", {
    style: it.tone ? {
      color: TONE[it.tone]
    } : undefined
  }, it.value))));
}
Object.assign(__ds_scope, { StatGrid });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatGrid.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
/** Data table: header on a tinted band, body as a rounded card inside it. */
function Table({
  columns = [],
  rows = [],
  rowKey,
  onRowClick,
  className = '',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ('ds-table ' + className).trim(),
    style: style
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    "data-align": c.align,
    style: c.width ? {
      width: c.width
    } : undefined
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: rowKey ? r[rowKey] : i,
    "data-clickable": onRowClick ? '' : undefined,
    onClick: onRowClick ? () => onRowClick(r, i) : undefined
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    "data-align": c.align
  }, c.render ? c.render(r, i) : r[c.key])))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
/** Small status label. */
function Badge({
  variant = 'info',
  size = 'sm',
  children,
  className = '',
  style
}) {
  const cls = variant === 'code' ? 'ds-code' : variant === 'text' ? 'ds-badge ds-badge--text' : 'ds-badge' + (size === 'md' ? ' ds-badge--md' : '');
  return /*#__PURE__*/React.createElement("span", {
    className: (cls + ' ' + className).trim(),
    style: style
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Hatch.jsx
try { (() => {
/** The 6px diagonal hatch motif as an absolutely positioned layer. Color = currentColor. */
function Hatch({
  color,
  opacity = 1,
  fade = false,
  style,
  className = ''
}) {
  const fadeMask = fade ? {
    WebkitMaskImage: 'linear-gradient(#fff 0%, #fff 40%, transparent 100%)'
  } : null;
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      opacity,
      ...fadeMask,
      ...style
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-hatch",
    style: color ? {
      color
    } : undefined
  }));
}
Object.assign(__ds_scope, { Hatch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Hatch.jsx", error: String((e && e.message) || e) }); }

// components/display/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const pascal = n => String(n).replace(/(^|[-_ ])([a-z0-9])/g, (_, __, c) => c.toUpperCase());
/** Outline icon (Lucide glyph set, 1.5px stroke). Requires the Lucide UMD script on the page. */
function Icon({
  name,
  size = 20,
  strokeWidth = 1.5,
  className = '',
  style,
  title,
  ...rest
}) {
  const lib = typeof window !== 'undefined' ? window.lucide : null;
  let node = lib && lib.icons ? lib.icons[pascal(name)] || lib.icons[name] : null;
  if (node && node[0] === 'svg') node = node[2];
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: ('ds-ico ' + className).trim(),
    style: {
      width: size,
      height: size,
      ...style
    },
    "aria-hidden": title ? undefined : true,
    role: title ? 'img' : undefined
  }, rest), title ? /*#__PURE__*/React.createElement("title", null, title) : null, (node || []).map(([tag, attrs], i) => React.createElement(tag, {
    ...attrs,
    key: i
  })));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Icon.jsx", error: String((e && e.message) || e) }); }

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Rounded-rectangle button whose radius grows with its height. */
function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  block = false,
  children,
  className = '',
  type = 'button',
  as,
  ...rest
}) {
  const cls = ['ds-btn', 'ds-btn--' + size, variant !== 'secondary' && 'ds-btn--' + variant, block && 'ds-btn--block', className].filter(Boolean).join(' ');
  const is = size === 'lg' || size === 'tile' ? 20 : 16;
  const Tag = as || 'button';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    type: Tag === 'button' ? type : undefined,
    className: cls
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: is
  }), children, iconEnd && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconEnd,
    size: is
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const KIND = {
  square: 'ds-icon-btn ds-icon-btn--md',
  ghost: 'ds-icon-btn ds-icon-btn--ghost',
  sidebar: 'ds-icon-btn ds-icon-btn--sidebar',
  inline: 'ds-icon-btn ds-icon-btn--inline',
  switch: 'ds-icon-btn ds-icon-btn--switch',
  float: 'ds-float',
  support: 'ds-support'
};
const SIZE = {
  inline: 16,
  float: 22,
  support: 24
};
/** Icon-only control. Always pass a label. */
function IconButton({
  icon,
  label,
  kind = 'square',
  iconSize,
  className = '',
  type = 'button',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    "aria-label": label,
    title: label,
    className: (KIND[kind] + ' ' + className).trim()
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize || SIZE[kind] || 20
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data/ListRow.jsx
try { (() => {
/** Rows outside tables: 72px item rows, palette rows (search/pickers) and menu rows. */
function ListRow({
  variant = 'item',
  leading,
  title,
  subtitle,
  value,
  subvalue,
  trailing,
  chevron,
  highlighted = false,
  onClick,
  onMouseEnter,
  className = '',
  style
}) {
  if (variant === 'menu') {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: ('ds-menu-row ' + className).trim(),
      onClick: onClick,
      style: style
    }, leading, /*#__PURE__*/React.createElement("span", null, title), trailing, chevron !== false && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "chevron-right",
      size: 20
    }));
  }
  const cls = 'ds-row' + (variant === 'palette' ? ' ds-row--palette' : '');
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: (cls + ' ' + className).trim(),
    "data-highlighted": highlighted ? '' : undefined,
    onClick: onClick,
    onMouseEnter: onMouseEnter,
    style: style
  }, leading, /*#__PURE__*/React.createElement("div", {
    className: "ds-row__txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: variant === 'palette' ? 'ds-t-title' : 'ds-t-strong'
  }, title), subtitle && /*#__PURE__*/React.createElement("span", {
    className: "ds-t-sub",
    style: {
      lineHeight: '16px'
    }
  }, subtitle)), (value != null || subvalue != null) && /*#__PURE__*/React.createElement("div", {
    className: "ds-row__end"
  }, value != null && /*#__PURE__*/React.createElement("span", {
    className: "ds-t-money"
  }, value), subvalue != null && /*#__PURE__*/React.createElement("span", {
    className: "ds-t-sub"
  }, subvalue)), trailing, chevron && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 20,
    style: {
      color: 'var(--text-muted)'
    }
  }));
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/display/Avatar.jsx
try { (() => {
/** Round identity marks and icon tiles. */
function Avatar({
  kind = 'contact',
  size,
  src,
  alt = '',
  initials,
  icon,
  color,
  badge,
  badgeColor,
  className = '',
  style
}) {
  const s = {
    ...style
  };
  let cls = 'ds-avatar';
  let iconSize = 20;
  if (kind === 'contact') {
    cls += ' ds-avatar--contact';
    icon = icon || (initials ? null : 'user');
  }
  if (kind === 'entity') {
    cls += ' ds-avatar--token';
    if (color) s.background = color;
  }
  if (kind === 'category') {
    cls += ' ds-avatar--tx';
    s.background = color || 'var(--cat-violet)';
    iconSize = 14;
  }
  if (kind === 'tile') {
    cls = 'ds-tile-ico';
  }
  if (kind === 'disc') {
    cls = 'ds-disc';
  }
  if (kind === 'account') {
    cls += ' ds-avatar--account';
    icon = icon || 'user';
    iconSize = 24;
  }
  if (size) {
    s.width = size;
    s.height = size;
    if (size <= 32) {
      s.fontSize = Math.round(size * 0.42);
      iconSize = Math.min(iconSize, Math.round(size * 0.55));
    }
  }
  return /*#__PURE__*/React.createElement("span", {
    className: (cls + ' ' + className).trim(),
    style: s
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt
  }) : icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize
  }) : initials, badge != null && /*#__PURE__*/React.createElement("span", {
    className: "ds-avatar__net",
    style: badgeColor ? {
      background: badgeColor
    } : undefined
  }, badge));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/display/StatusBadge.jsx
try { (() => {
/** Live status pill with a trailing dot, e.g. "Live" or "Online". */
function StatusBadge({
  children = 'Live',
  pulse = true,
  className = '',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: ('ds-status ' + className).trim(),
    "data-pulse": pulse ? '' : undefined,
    style: style
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      paddingRight: 2
    }
  }, children), /*#__PURE__*/React.createElement("span", {
    className: "ds-status__dot"
  }, /*#__PURE__*/React.createElement("i", null)));
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
/** What a list shows when it has nothing: title, one line, one action. */
function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ('ds-empty ' + className).trim(),
    style: style
  }, /*#__PURE__*/React.createElement("h3", null, title), description && /*#__PURE__*/React.createElement("p", null, description), actionLabel && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "md",
    icon: actionIcon,
    onClick: onAction
  }, actionLabel));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
/** Loading placeholder: a block, or a full row (disc + title + subtitle + value). */
function Skeleton({
  variant = 'block',
  width = '100%',
  height = 16,
  radius,
  rows = 1,
  className = '',
  style
}) {
  if (variant === 'row') {
    return /*#__PURE__*/React.createElement("div", {
      className: className,
      style: {
        display: 'flex',
        flexDirection: 'column',
        ...style
      },
      "aria-hidden": "true"
    }, Array.from({
      length: rows
    }).map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 72,
        padding: '0 16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ds-skel",
      style: {
        width: 40,
        height: 40,
        borderRadius: 9999,
        flex: 'none'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ds-skel",
      style: {
        width: '40%',
        height: 16
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "ds-skel",
      style: {
        width: '25%',
        height: 12
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "ds-skel",
      style: {
        width: 64,
        height: 16
      }
    }))));
  }
  const r = radius ?? (variant === 'circle' ? 9999 : 4);
  return /*#__PURE__*/React.createElement("div", {
    className: ('ds-skel ' + className).trim(),
    "aria-hidden": "true",
    style: {
      width: variant === 'circle' ? height : width,
      height,
      borderRadius: r,
      ...style
    }
  });
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/forms/AmountInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Big-number entry box with a unit pill and a meta row. */
function AmountInput({
  label,
  value,
  defaultValue,
  onChange,
  placeholder = '0',
  unit,
  onUnitClick,
  meta,
  metaEnd,
  onMetaClick,
  position = 'single',
  size = 'md',
  className = '',
  style,
  inputProps
}) {
  const cls = ['ds-amount', position !== 'single' && 'ds-amount--' + position, size === 'xl' && 'ds-amount--xl', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    style: style
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "ds-amount__label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "ds-amount__row"
  }, /*#__PURE__*/React.createElement("input", _extends({
    inputMode: "decimal",
    placeholder: placeholder,
    value: value,
    defaultValue: defaultValue,
    onChange: e => onChange && onChange(e.target.value),
    "aria-label": typeof label === 'string' ? label : 'Amount'
  }, inputProps)), unit && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ds-token",
    onClick: onUnitClick
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    kind: "entity",
    size: 24,
    initials: unit.initials || String(unit.label).slice(0, 1),
    color: unit.color,
    src: unit.src
  }), unit.label, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 16
  }))), (meta || metaEnd) && /*#__PURE__*/React.createElement("div", {
    className: "ds-amount__meta"
  }, meta ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ds-btn ds-btn--text",
    onClick: onMetaClick
  }, meta) : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null, metaEnd)));
}
/** Two stacked AmountInputs with the round switch button on the seam. */
function AmountPair({
  top,
  bottom,
  onSwitch,
  switchLabel = 'Switch'
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ds-amount-pair"
  }, /*#__PURE__*/React.createElement(AmountInput, _extends({}, top, {
    position: "top"
  })), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    kind: "switch",
    icon: "arrow-down-up",
    label: switchLabel,
    onClick: onSwitch
  }), /*#__PURE__*/React.createElement(AmountInput, _extends({}, bottom, {
    position: "bottom"
  })));
}
Object.assign(__ds_scope, { AmountInput, AmountPair });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/AmountInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Text field on a faint ground with a 1px outline. */
function Input({
  label,
  error,
  icon,
  trailingIcon,
  trailingLabel,
  onTrailingClick,
  size = 'md',
  disabled = false,
  id,
  className = '',
  style,
  ...rest
}) {
  const auto = React.useId();
  const fid = id || 'f' + auto.replace(/:/g, '');
  const cls = ['ds-input', size === 'sm' && 'ds-input--sm', trailingIcon && 'ds-input--trail'].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: style
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "ds-label",
    htmlFor: fid
  }, label), /*#__PURE__*/React.createElement("div", {
    className: cls,
    "data-invalid": error ? '' : undefined,
    "data-disabled": disabled ? '' : undefined
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }), /*#__PURE__*/React.createElement("input", _extends({
    id: fid,
    disabled: disabled,
    "aria-invalid": error ? true : undefined
  }, rest)), trailingIcon && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    kind: "inline",
    icon: trailingIcon,
    label: trailingLabel || trailingIcon,
    onClick: onTrailingClick
  })), error && /*#__PURE__*/React.createElement("div", {
    className: "ds-error",
    role: "alert"
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
/** Select box: native <select> when options are given, otherwise a trigger button (open a Sheet from onClick). */
function Select({
  label,
  value,
  defaultValue,
  placeholder = 'Select',
  options,
  onChange,
  onClick,
  size = 'md',
  id,
  className = '',
  style
}) {
  const auto = React.useId();
  const fid = id || 's' + auto.replace(/:/g, '');
  const cs = size === 'sm' ? 16 : 20;
  const opts = options && options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: style
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "ds-label",
    htmlFor: fid
  }, label), opts ? /*#__PURE__*/React.createElement("div", {
    className: 'ds-select ds-select--native' + (size === 'sm' ? ' ds-select--sm' : '')
  }, /*#__PURE__*/React.createElement("select", {
    id: fid,
    value: value,
    defaultValue: value === undefined ? defaultValue : undefined,
    onChange: e => onChange && onChange(e.target.value)
  }, opts.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: cs,
    style: {
      zIndex: 2
    }
  })) : /*#__PURE__*/React.createElement("button", {
    id: fid,
    type: "button",
    className: 'ds-select' + (size === 'sm' ? ' ds-select--sm' : ''),
    onClick: onClick
  }, /*#__PURE__*/React.createElement("span", {
    className: value ? '' : 'ds-ph'
  }, value || placeholder), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: cs
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/SelectField.jsx
try { (() => {
/** Large two-line trigger (72px, r24) with a leading avatar. */
function SelectField({
  label,
  value,
  placeholder = 'Select',
  leading,
  onClick,
  className = '',
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: ('ds-field ' + className).trim(),
    onClick: onClick,
    style: style
  }, leading, /*#__PURE__*/React.createElement("span", {
    className: "ds-field__txt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-field__label"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "ds-field__value",
    style: value ? undefined : {
      color: 'var(--text-subtle)'
    }
  }, value || placeholder)), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 20
  }));
}
Object.assign(__ds_scope, { SelectField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SelectField.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BottomNav.jsx
try { (() => {
/** Floating inverted nav pill for <1280px, with optional Back/Search satellites. */
function BottomNav({
  items = [],
  active,
  onSelect,
  onBack,
  onSearch,
  className = '',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ('ds-bnav ' + className).trim(),
    style: style
  }, onBack && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    kind: "float",
    icon: "arrow-left",
    label: "Back",
    onClick: onBack
  }), /*#__PURE__*/React.createElement("nav", {
    className: "ds-nav"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    type: "button",
    "aria-label": it.label,
    title: it.label,
    "data-active": it.id === active ? '' : undefined,
    onClick: () => onSelect && onSelect(it.id)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.icon,
    size: 22
  })))), onSearch && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    kind: "float",
    icon: "search",
    label: "Search",
    onClick: onSearch
  }));
}
Object.assign(__ds_scope, { BottomNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BottomNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
/** Desktop navigation (≥1280px). Always dark in both themes. */
function Sidebar({
  brand = 'Workspace',
  sections = [],
  active,
  onSelect,
  footer = [],
  accountLabel = 'Account',
  onAccountClick,
  onSearch,
  searchLabel = 'Search',
  kbd = '⌘K',
  onCollapse,
  className = '',
  style
}) {
  const item = it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    type: "button",
    className: "ds-sidebar__item",
    "data-active": it.id === active ? '' : undefined,
    onClick: () => onSelect && onSelect(it.id)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.icon,
    size: 20
  }), /*#__PURE__*/React.createElement("span", null, it.label), it.badge);
  return /*#__PURE__*/React.createElement("aside", {
    className: ('ds-sidebar ' + className).trim(),
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-sidebar__head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-sidebar__brand"
  }, brand), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    kind: "sidebar",
    icon: "panel-left",
    label: "Collapse sidebar",
    onClick: onCollapse
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ds-sidebar__search",
    onClick: onSearch
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 20
  }), /*#__PURE__*/React.createElement("span", null, searchLabel), /*#__PURE__*/React.createElement("kbd", {
    className: "ds-kbd"
  }, kbd)), /*#__PURE__*/React.createElement("nav", {
    className: "ds-sidebar__nav ds-scroll",
    style: {
      scrollbarGutter: 'auto'
    }
  }, sections.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, s.label && /*#__PURE__*/React.createElement("div", {
    className: "ds-sidebar__label"
  }, s.label), s.items.map(item)))), /*#__PURE__*/React.createElement("div", {
    className: "ds-sidebar__foot"
  }, footer.map(item), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ds-account",
    onClick: onAccountClick
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-account__tile"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "user",
    size: 18
  })), /*#__PURE__*/React.createElement("span", null, accountLabel), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-up",
    size: 16
  }))));
}
/** Rounded content panel beside the Sidebar. A fixed header stays put; only the body scrolls. */
function ContentPanel({
  header,
  children,
  className = '',
  style,
  bodyStyle,
  bodyRef
}) {
  const [scrolled, setScrolled] = React.useState(false);
  const onScroll = e => {
    const s = e.currentTarget.scrollTop > 0;
    if (s !== scrolled) setScrolled(s);
  };
  return /*#__PURE__*/React.createElement("main", {
    className: ('ds-panel ' + className).trim(),
    style: style,
    "data-scrolled": scrolled ? '' : undefined
  }, header != null && /*#__PURE__*/React.createElement("div", {
    className: "ds-panel__head"
  }, header), /*#__PURE__*/React.createElement("div", {
    className: "ds-panel__body ds-scroll",
    style: bodyStyle,
    ref: bodyRef,
    onScroll: onScroll
  }, children));
}
Object.assign(__ds_scope, { Sidebar, ContentPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Stepper.jsx
try { (() => {
/** Progress through a short flow. */
function Stepper({
  steps = [],
  current = 0,
  className = '',
  style
}) {
  return /*#__PURE__*/React.createElement("ol", {
    className: ('ds-steps ' + className).trim(),
    style: {
      '--n': steps.length,
      padding: 0,
      margin: 0,
      listStyle: 'none',
      ...style
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "ds-step",
    "data-active": i === current ? '' : undefined,
    "data-done": i < current ? '' : undefined,
    "aria-current": i === current ? 'step' : undefined
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-step__dot"
  }), /*#__PURE__*/React.createElement("span", null, s))));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Sheet.jsx
try { (() => {
/** Bottom drawer (side panel at ≥1280px) — the main modal surface. */
function Sheet({
  open = true,
  onClose,
  title,
  titleSize = 'sheet',
  action,
  inline = false,
  children,
  className = '',
  style
}) {
  React.useEffect(() => {
    if (!open || inline || !onClose) return;
    const k = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, inline, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: 'ds-layer' + (inline ? ' ds-layer--inline' : ''),
    onClick: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": inline ? undefined : true,
    className: ('ds-sheet ds-scroll ' + className).trim(),
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-handle"
  }), /*#__PURE__*/React.createElement("div", {
    className: "ds-sheet__body"
  }, (title || onClose || action) && /*#__PURE__*/React.createElement("div", {
    className: "ds-sheet__head"
  }, /*#__PURE__*/React.createElement("h2", {
    className: 'ds-sheet__title' + (titleSize === 'card' ? ' ds-sheet__title--card' : '')
  }, title), action || onClose && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    kind: "ghost",
    icon: "x",
    label: "Close",
    onClick: onClose
  })), children)));
}
Object.assign(__ds_scope, { Sheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Sheet.jsx", error: String((e && e.message) || e) }); }

// components/selection/Checkbox.jsx
try { (() => {
/** Checkbox for acknowledgements. */
function Checkbox({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  children,
  className = '',
  style
}) {
  const [inner, setInner] = React.useState(defaultChecked);
  const on = checked !== undefined ? checked : inner;
  return /*#__PURE__*/React.createElement("label", {
    className: ('ds-check ' + className).trim(),
    "data-checked": on ? '' : undefined,
    "data-disabled": disabled ? '' : undefined,
    style: style
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: on,
    disabled: disabled,
    onChange: e => {
      setInner(e.target.checked);
      onChange && onChange(e.target.checked);
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "ds-check__box"
  }, on && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 12,
    strokeWidth: 3
  })), children && /*#__PURE__*/React.createElement("span", null, children));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/selection/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CLS = {
  pill: 'ds-chip',
  filter: 'ds-filter',
  range: 'ds-filter ds-filter--range'
};
/** A single toggle chip. */
function Chip({
  variant = 'pill',
  checked = false,
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-pressed": checked,
    "data-checked": checked ? '' : undefined,
    className: (CLS[variant] + ' ' + className).trim()
  }, rest), children);
}
/** Single-select group of chips. options: string[] or {value,label}[] */
function ChipGroup({
  options = [],
  value,
  defaultValue,
  onChange,
  variant = 'pill',
  className = '',
  style
}) {
  const opts = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  const [inner, setInner] = React.useState(defaultValue ?? (opts[0] && opts[0].value));
  const cur = value !== undefined ? value : inner;
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    className: ('ds-chips' + (variant === 'pill' ? ' ds-chips--pill' : '') + ' ' + className).trim(),
    style: style
  }, opts.map(o => /*#__PURE__*/React.createElement(Chip, {
    key: o.value,
    variant: variant,
    checked: o.value === cur,
    onClick: () => {
      setInner(o.value);
      onChange && onChange(o.value);
    }
  }, o.label)));
}
Object.assign(__ds_scope, { Chip, ChipGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/Chip.jsx", error: String((e && e.message) || e) }); }

// components/charts/AreaChart.jsx
try { (() => {
function useAreaWidth(ref, fallback) {
  const [w, setW] = React.useState(fallback);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || fallback);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}
const fmtDefault = v => v.toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
/** Gridless area chart with the hatch overlay. The header is the legend: hover rewrites value, change and label. */
function AreaChart({
  data = [],
  labels = [],
  height = 240,
  title,
  formatValue = fmtDefault,
  prefix = '',
  suffix = '',
  restLabel = 'Past week',
  ranges,
  range,
  defaultRange,
  onRangeChange,
  status,
  tone,
  className = '',
  style
}) {
  const ref = React.useRef(null);
  const w = useAreaWidth(ref, 600);
  const [hi, setHi] = React.useState(null);
  const uid = React.useId().replace(/:/g, '');
  const vals = data.map(d => typeof d === 'number' ? d : d.value);
  const n = vals.length;
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const top = 8,
    span = height * 0.72;
  const x = i => n < 2 ? 0 : i * w / (n - 1);
  const y = v => top + (1 - (v - min) / (max - min || 1)) * span;
  const line = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = line + ' L' + w + ' ' + height + ' L0 ' + height + ' Z';
  const cur = hi != null ? vals[hi] : vals[n - 1];
  const diff = cur - vals[0];
  const pct = vals[0] ? diff / vals[0] * 100 : 0;
  const up = diff >= 0;
  const t = tone || 'up';
  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left) / r.width * (n - 1));
    setHi(Math.max(0, Math.min(n - 1, i)));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: ('ds-chart ' + className).trim(),
    "data-tone": t,
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-chart__top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-chart__head"
  }, title && /*#__PURE__*/React.createElement("span", {
    className: "ds-chart__label"
  }, title), /*#__PURE__*/React.createElement("span", {
    className: "ds-chart__price"
  }, prefix, n ? formatValue(cur) : '—', suffix), /*#__PURE__*/React.createElement("span", {
    className: "ds-chart__delta"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: up ? 'var(--positive)' : 'var(--negative)'
    }
  }, up ? '▲' : '▼', " ", prefix, formatValue(Math.abs(diff)), suffix, " (", Math.abs(pct).toFixed(2), "%)"), /*#__PURE__*/React.createElement("span", null, hi != null ? labels[hi] || '' : restLabel))), status), /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: height,
    onMouseMove: onMove,
    onMouseLeave: () => setHi(null),
    style: {
      cursor: 'crosshair'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: 'g' + uid,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "currentColor",
    stopOpacity: ".25"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "currentColor",
    stopOpacity: ".04"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: 'p' + uid,
    width: "6",
    height: "6",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 0h1L0 6V5zM6 5v1H5z",
    fill: "currentColor"
  })), /*#__PURE__*/React.createElement("clipPath", {
    id: 'c' + uid
  }, /*#__PURE__*/React.createElement("path", {
    d: area
  })), /*#__PURE__*/React.createElement("linearGradient", {
    id: 'mg' + uid,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "#fff"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: ".4",
    stopColor: "#fff"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "#000"
  })), /*#__PURE__*/React.createElement("mask", {
    id: 'm' + uid
  }, /*#__PURE__*/React.createElement("rect", {
    width: w,
    height: height,
    fill: 'url(#mg' + uid + ')'
  }))), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: 'url(#g' + uid + ')'
  }), /*#__PURE__*/React.createElement("g", {
    clipPath: 'url(#c' + uid + ')',
    mask: 'url(#m' + uid + ')'
  }, /*#__PURE__*/React.createElement("rect", {
    width: w,
    height: height,
    fill: 'url(#p' + uid + ')',
    opacity: ".28"
  })), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), hi != null && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: x(hi),
    x2: x(hi),
    y1: "0",
    y2: height,
    style: {
      stroke: 'var(--chart-crosshair)'
    },
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: x(hi),
    cy: y(vals[hi]),
    r: "4.5",
    fill: "currentColor",
    style: {
      stroke: 'var(--bg-app)'
    },
    strokeWidth: "2"
  })))), ranges && /*#__PURE__*/React.createElement("div", {
    className: "ds-chart__controls"
  }, /*#__PURE__*/React.createElement(__ds_scope.ChipGroup, {
    variant: "range",
    options: ranges,
    value: range,
    defaultValue: defaultRange,
    onChange: onRangeChange
  })));
}
Object.assign(__ds_scope, { AreaChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/charts/AreaChart.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Dialog.jsx
try { (() => {
/** Centered command/search palette (⌘K). groups: [{label, items:[{id,title,subtitle,leading,filter}]}] */
function Dialog({
  open = true,
  onClose,
  placeholder = 'Search',
  filters,
  groups = [],
  onSelect,
  inline = false,
  emptyText = 'No results',
  className = '',
  style
}) {
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState(filters ? filters[0] : null);
  const [hi, setHi] = React.useState(0);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (open && !inline && inputRef.current) inputRef.current.focus();
  }, [open, inline]);
  const ql = q.trim().toLowerCase();
  const shown = groups.map(g => ({
    ...g,
    items: g.items.filter(it => (!ql || String(it.title).toLowerCase().includes(ql) || String(it.subtitle || '').toLowerCase().includes(ql)) && (!filters || filter === filters[0] || it.filter === filter))
  })).filter(g => g.items.length);
  const flat = shown.flatMap(g => g.items);
  React.useEffect(() => setHi(0), [q, filter]);
  if (!open) return null;
  const onKey = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi(h => Math.min(flat.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter' && flat[hi]) {
      onSelect && onSelect(flat[hi]);
    } else if (e.key === 'Escape' && onClose) onClose();
  };
  let k = -1;
  return /*#__PURE__*/React.createElement("div", {
    className: 'ds-dlayer' + (inline ? ' ds-dlayer--inline' : ''),
    onClick: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": inline ? undefined : true,
    className: ('ds-dialog ' + className).trim(),
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-dialog__search"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 20
  }), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    placeholder: placeholder,
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: onKey,
    "aria-label": placeholder
  })), filters && /*#__PURE__*/React.createElement("div", {
    className: "ds-dialog__filters"
  }, /*#__PURE__*/React.createElement(__ds_scope.ChipGroup, {
    variant: "filter",
    options: filters,
    value: filter,
    onChange: setFilter
  })), /*#__PURE__*/React.createElement("div", {
    className: "ds-dialog__list ds-scroll",
    role: "listbox"
  }, shown.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.label
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-dialog__group"
  }, g.label), g.items.map(it => {
    k += 1;
    const idx = k;
    return /*#__PURE__*/React.createElement(__ds_scope.ListRow, {
      key: it.id || it.title,
      variant: "palette",
      leading: it.leading,
      title: it.title,
      subtitle: it.subtitle,
      value: it.value,
      subvalue: it.subvalue,
      highlighted: idx === hi,
      onMouseEnter: () => setHi(idx),
      onClick: () => onSelect && onSelect(it)
    });
  }))), !flat.length && /*#__PURE__*/React.createElement("div", {
    className: "ds-dialog__empty"
  }, emptyText))));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/selection/OptionTile.jsx
try { (() => {
/** Large radio tile with an icon over a label (e.g. theme picker). */
function OptionTile({
  icon,
  label,
  checked = false,
  onClick,
  className = '',
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "radio",
    "aria-checked": checked,
    className: ('ds-option ' + className).trim(),
    "data-checked": checked ? '' : undefined,
    onClick: onClick,
    style: style
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 20
  }), /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { OptionTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/OptionTile.jsx", error: String((e && e.message) || e) }); }

// components/selection/SegmentedControl.jsx
try { (() => {
/** Tinted track with an indicator thumb for switching modes inside a panel. */
function SegmentedControl({
  options = [],
  value,
  defaultValue,
  onChange,
  size = 'lg',
  block = false,
  className = '',
  style
}) {
  const opts = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  const [inner, setInner] = React.useState(defaultValue ?? (opts[0] && opts[0].value));
  const cur = value !== undefined ? value : inner;
  const cls = ['ds-seg', size !== 'lg' && 'ds-seg--' + size, block && 'ds-seg--block', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    className: cls,
    style: style
  }, opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "tab",
    "aria-selected": o.value === cur,
    "aria-label": o.ariaLabel,
    "data-active": o.value === cur ? '' : undefined,
    onClick: () => {
      setInner(o.value);
      onChange && onChange(o.value);
    }
  }, o.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: o.icon,
    size: 16
  }), o.label)));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/selection/Tabs.jsx
try { (() => {
/** Underlined text tabs for sub-views in a section. */
function Tabs({
  options = [],
  value,
  defaultValue,
  onChange,
  className = '',
  style
}) {
  const opts = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  const [inner, setInner] = React.useState(defaultValue ?? (opts[0] && opts[0].value));
  const cur = value !== undefined ? value : inner;
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    className: ('ds-tabs ' + className).trim(),
    style: style
  }, opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "tab",
    "aria-selected": o.value === cur,
    className: "ds-tab",
    "data-active": o.value === cur ? '' : undefined,
    onClick: () => {
      setInner(o.value);
      onChange && onChange(o.value);
    }
  }, o.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Banner.jsx
try { (() => {
/** Inline info message for the current flow. */
function Banner({
  icon = 'info',
  children,
  className = '',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    className: ('ds-banner ' + className).trim(),
    style: style
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 20
  }), /*#__PURE__*/React.createElement("div", null, children));
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Banner.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Flat panel. No shadow: separation comes from surface steps and 1px outlines. */
function Card({
  variant = 'plain',
  title,
  action,
  children,
  className = '',
  style,
  ...rest
}) {
  if (variant === 'group') {
    return /*#__PURE__*/React.createElement("div", _extends({
      className: ('ds-group ' + className).trim(),
      style: style
    }, rest), (title || action) && /*#__PURE__*/React.createElement("div", {
      className: "ds-group__head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ds-t-title"
    }, title), action), /*#__PURE__*/React.createElement("div", {
      className: "ds-group__list"
    }, children));
  }
  const cls = 'ds-card' + (variant !== 'plain' ? ' ds-card--' + variant : '');
  const head = (title || action) && variant !== 'list' ? /*#__PURE__*/React.createElement("div", {
    className: "ds-card__head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "ds-t-card"
  }, title), action) : null;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: (cls + ' ' + className).trim(),
    style: style
  }, rest), head, children);
}
/** Padded row for list cards (20×24px), with an optional trailing block. */
function CardRow({
  leading,
  title,
  subtitle,
  value,
  subvalue,
  children,
  onClick,
  className = '',
  style
}) {
  const Tag = onClick ? 'button' : 'div';
  return /*#__PURE__*/React.createElement(Tag, {
    type: onClick ? 'button' : undefined,
    onClick: onClick,
    className: ('ds-card__row ' + (onClick ? 'ds-row ds-row--card ' : '') + className).trim(),
    style: style
  }, leading, /*#__PURE__*/React.createElement("div", {
    className: "ds-row__txt"
  }, title && /*#__PURE__*/React.createElement("span", {
    className: "ds-t-title"
  }, title), subtitle && /*#__PURE__*/React.createElement("span", {
    className: "ds-t-sub"
  }, subtitle)), (value != null || subvalue != null) && /*#__PURE__*/React.createElement("div", {
    className: "ds-row__end"
  }, value != null && /*#__PURE__*/React.createElement("span", {
    className: "ds-t-money"
  }, value), subvalue != null && /*#__PURE__*/React.createElement("span", {
    className: "ds-t-sub"
  }, subvalue)), children);
}
Object.assign(__ds_scope, { Card, CardRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/ExploreCard.jsx
try { (() => {
function GrowthArt() {
  const id = React.useId().replace(/:/g, '');
  const d = 'M0 84 C60 80 90 70 130 58 S210 30 291 14';
  return /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "96",
    viewBox: "0 0 291 96",
    preserveAspectRatio: "none",
    style: {
      position: 'absolute',
      inset: 0
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: 'g' + id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "currentColor",
    stopOpacity: ".24"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "currentColor",
    stopOpacity: ".04"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: 'p' + id,
    width: "6",
    height: "6",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 0h1L0 6V5zM6 5v1H5z",
    fill: "currentColor"
  })), /*#__PURE__*/React.createElement("clipPath", {
    id: 'c' + id
  }, /*#__PURE__*/React.createElement("path", {
    d: d + ' V96 H0Z'
  })), /*#__PURE__*/React.createElement("linearGradient", {
    id: 'mg' + id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "#fff"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: ".4",
    stopColor: "#fff"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "#000"
  })), /*#__PURE__*/React.createElement("mask", {
    id: 'm' + id
  }, /*#__PURE__*/React.createElement("rect", {
    width: "291",
    height: "96",
    fill: 'url(#mg' + id + ')'
  }))), /*#__PURE__*/React.createElement("path", {
    d: d + ' V96 H0Z',
    fill: 'url(#g' + id + ')'
  }), /*#__PURE__*/React.createElement("g", {
    clipPath: 'url(#c' + id + ')',
    mask: 'url(#m' + id + ')'
  }, /*#__PURE__*/React.createElement("rect", {
    width: "291",
    height: "96",
    fill: 'url(#p' + id + ')',
    opacity: ".28"
  })), /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "3",
    strokeLinecap: "round"
  }));
}
function MiniChartArt() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '16px 24px 0',
      background: '#0a0a0a',
      borderRadius: '12px 12px 0 0',
      outline: '1px solid rgba(255,255,255,.05)',
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 10px/1 var(--font-sans)',
      padding: '4px 6px',
      borderRadius: 4,
      background: 'rgba(119,100,216,.2)',
      color: '#b9b0f0'
    }
  }, "+12.4%"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 10px/1 var(--font-sans)',
      padding: '4px 6px',
      borderRadius: 4,
      background: 'rgba(255,102,127,.15)',
      color: '#ff667f'
    }
  }, "\u22123.1%")), /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "36",
    viewBox: "0 0 200 36",
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 30 L25 26 L50 28 L75 18 L100 22 L125 12 L150 15 L175 6 L200 9",
    fill: "none",
    stroke: "#9d91e8",
    strokeWidth: "1.5",
    vectorEffect: "non-scaling-stroke"
  })));
}
function SliderArt() {
  const Track = ({
    at,
    w
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 4,
      borderRadius: 4,
      background: 'rgba(255,255,255,.1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: w + '%',
      borderRadius: 4,
      background: 'currentColor'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 'calc(' + at + '% - 2px)',
      top: -4,
      width: 4,
      height: 12,
      borderRadius: 2,
      background: '#fff'
    }
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '20px 40px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      padding: '8px 16px',
      background: '#262626',
      borderRadius: 12,
      outline: '1px solid rgba(255,255,255,.05)'
    }
  }, /*#__PURE__*/React.createElement(Track, {
    at: 64,
    w: 64
  }), /*#__PURE__*/React.createElement(Track, {
    at: 32,
    w: 32
  }));
}
const ART = {
  growth: GrowthArt,
  chart: MiniChartArt,
  slider: SliderArt
};
/** Promo tile: always-dark 96px art panel over a title + description. */
function ExploreCard({
  title,
  description,
  art = 'growth',
  tone = 'dark',
  href,
  onClick,
  className = '',
  style
}) {
  const Art = typeof art === 'string' ? ART[art] : null;
  const Tag = href ? 'a' : 'button';
  return /*#__PURE__*/React.createElement(Tag, {
    href: href,
    type: href ? undefined : 'button',
    onClick: onClick,
    className: ('ds-explore ' + className).trim(),
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: 'ds-explore__art' + (tone === 'brand' ? ' ds-explore__art--brand' : ''),
    "data-theme": "dark"
  }, Art ? /*#__PURE__*/React.createElement(Art, null) : art), /*#__PURE__*/React.createElement("div", {
    className: "ds-explore__body"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-explore__title"
  }, title), description && /*#__PURE__*/React.createElement("span", {
    className: "ds-explore__desc"
  }, description)));
}
Object.assign(__ds_scope, { ExploreCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/ExploreCard.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/ReviewRow.jsx
try { (() => {
/** Row that needs attention: fuchsia wash from the bottom with the hatch cut out of it. */
function ReviewRow({
  children,
  className = '',
  style,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ('ds-review ' + className).trim(),
    style: style,
    onClick: onClick,
    tabIndex: onClick ? 0 : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "ds-hatch",
    "aria-hidden": "true"
  }), children);
}
Object.assign(__ds_scope, { ReviewRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/ReviewRow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Auth.jsx
try { (() => {
(() => {
  const {
    Button,
    Input,
    Checkbox,
    SegmentedControl,
    Banner,
    IconButton,
    AreaChart,
    StatusBadge,
    Icon
  } = window.DashboardDesignSystem_d616c8;
  function CodeInput({
    length = 6,
    value,
    onChange,
    error
  }) {
    const refs = React.useRef([]);
    const set = (i, ch) => {
      const arr = value.padEnd(length, ' ').split('');
      arr[i] = ch || ' ';
      onChange(arr.join('').trimEnd());
      if (ch && i < length - 1) refs.current[i + 1].focus();
    };
    const onKey = (i, e) => {
      if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1].focus();
      if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1].focus();
      if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1].focus();
    };
    const onPaste = e => {
      const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (t) {
        e.preventDefault();
        onChange(t);
        refs.current[Math.min(t.length, length - 1)].focus();
      }
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: `repeat(${length}, minmax(0,1fr))`,
        gap: 8
      },
      onPaste: onPaste
    }, Array.from({
      length
    }).map((_, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "ds-input",
      "data-invalid": error ? '' : undefined,
      style: {
        height: 56,
        padding: 0,
        justifyContent: 'center',
        borderRadius: 'var(--radius-xl)'
      }
    }, /*#__PURE__*/React.createElement("input", {
      ref: el => refs.current[i] = el,
      inputMode: "numeric",
      maxLength: 1,
      "aria-label": 'Digit ' + (i + 1),
      value: (value[i] || '').trim(),
      onChange: e => set(i, e.target.value.replace(/\D/g, '').slice(-1)),
      onKeyDown: e => onKey(i, e),
      style: {
        textAlign: 'center',
        font: 'var(--type-amount)',
        letterSpacing: 'var(--tracking-tight)'
      }
    }))));
  }
  function Divider({
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: 'var(--text-subtle)',
        font: 'var(--type-label)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1,
        background: 'var(--divider)'
      }
    }), children, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 1,
        background: 'var(--divider)'
      }
    }));
  }
  function Header({
    title,
    sub,
    onBack
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 32
      }
    }, onBack && /*#__PURE__*/React.createElement(IconButton, {
      icon: "arrow-left",
      label: "Back",
      onClick: onBack,
      style: {
        marginBottom: 16
      }
    }), /*#__PURE__*/React.createElement("h1", {
      className: "t-title-lg",
      style: {
        margin: 0
      }
    }, title), sub && /*#__PURE__*/React.createElement("p", {
      className: "t-body t-muted",
      style: {
        margin: 0,
        textWrap: 'pretty'
      }
    }, sub));
  }
  const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  function AuthForm() {
    const [view, setView] = React.useState('signin');
    const [email, setEmail] = React.useState('');
    const [pw, setPw] = React.useState('');
    const [name, setName] = React.useState('');
    const [show, setShow] = React.useState(false);
    const [terms, setTerms] = React.useState(false);
    const [code, setCode] = React.useState('');
    const [err, setErr] = React.useState({});
    const [busy, setBusy] = React.useState(false);
    const go = v => {
      setErr({});
      setView(v);
    };
    const wait = fn => {
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        fn();
      }, 700);
    };
    const submit = e => {
      e && e.preventDefault();
      const er = {};
      if (view === 'signup' && !name.trim()) er.name = 'Enter your name.';
      if (!validEmail(email)) er.email = 'Enter a valid email address.';
      if (view !== 'forgot' && pw.length < 8) er.pw = view === 'signup' ? 'Use at least 8 characters.' : 'Enter your password.';
      setErr(er);
      if (Object.keys(er).length) return;
      if (view === 'forgot') return wait(() => go('sent'));
      wait(() => go('verify'));
    };
    const verify = () => {
      if (code.length < 6) return setErr({
        code: 'Enter the 6-digit code.'
      });
      if (code !== '123456') return setErr({
        code: 'That code is wrong. Try again or resend it.'
      });
      wait(() => go('done'));
    };
    const pwField = label => /*#__PURE__*/React.createElement(Input, {
      label: label,
      type: show ? 'text' : 'password',
      placeholder: view === 'signup' ? 'At least 8 characters' : 'Password',
      value: pw,
      error: err.pw,
      onChange: e => {
        setPw(e.target.value);
        setErr({
          ...err,
          pw: null
        });
      },
      trailingIcon: show ? 'eye-off' : 'eye',
      trailingLabel: show ? 'Hide password' : 'Show password',
      onTrailingClick: () => setShow(!show)
    });
    if (view === 'verify') return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Header, {
      onBack: () => go('signin'),
      title: "Check your email",
      sub: /*#__PURE__*/React.createElement(React.Fragment, null, "We sent a 6-digit code to ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--text)'
        }
      }, email), ".")
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(CodeInput, {
      value: code,
      onChange: v => {
        setCode(v);
        setErr({});
      },
      error: err.code
    }), err.code && /*#__PURE__*/React.createElement("div", {
      className: "ds-error",
      style: {
        paddingTop: 0
      }
    }, err.code), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      disabled: busy || code.length < 6,
      onClick: verify
    }, busy ? 'Verifying…' : code.length < 6 ? 'Enter the code' : 'Verify'), /*#__PURE__*/React.createElement("div", {
      className: "t-label t-muted",
      style: {
        textAlign: 'center'
      }
    }, "Didn't get it? ", /*#__PURE__*/React.createElement(Button, {
      size: "text",
      style: {
        color: 'var(--text)'
      },
      onClick: () => setCode('')
    }, "Resend code")), /*#__PURE__*/React.createElement(Banner, null, "Prototype: use 123456.")));
    if (view === 'sent') return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Header, {
      onBack: () => go('signin'),
      title: "Check your email",
      sub: /*#__PURE__*/React.createElement(React.Fragment, null, "If an account exists for ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--text)'
        }
      }, email), ", you'll get a link to reset your password.")
    }), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      block: true,
      onClick: () => go('signin')
    }, "Back to sign in"));
    if (view === 'done') return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 24
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "ds-disc",
      style: {
        width: 52,
        height: 52
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 24
    })), /*#__PURE__*/React.createElement(Header, {
      title: "You're in",
      sub: "Your workspace is ready."
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      as: "a",
      href: "index.html",
      iconEnd: "arrow-right",
      style: {
        marginTop: -24
      }
    }, "Go to dashboard"));
    const isUp = view === 'signup';
    return /*#__PURE__*/React.createElement("form", {
      onSubmit: submit,
      noValidate: true
    }, view === 'forgot' ? /*#__PURE__*/React.createElement(Header, {
      onBack: () => go('signin'),
      title: "Reset your password",
      sub: "Enter your email and we'll send you a reset link."
    }) : /*#__PURE__*/React.createElement(Header, {
      title: isUp ? 'Create your account' : 'Welcome back',
      sub: isUp ? 'Start tracking your metrics in minutes.' : 'Sign in to your workspace.'
    }), view !== 'forgot' && /*#__PURE__*/React.createElement(SegmentedControl, {
      block: true,
      value: view,
      onChange: go,
      options: [{
        value: 'signin',
        label: 'Sign in'
      }, {
        value: 'signup',
        label: 'Create account'
      }],
      style: {
        marginBottom: 24
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, view !== 'forgot' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      icon: "globe",
      onClick: () => wait(() => go('done'))
    }, "Google"), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      icon: "key-round",
      onClick: () => wait(() => go('done'))
    }, "SSO")), /*#__PURE__*/React.createElement(Divider, null, "or")), isUp && /*#__PURE__*/React.createElement(Input, {
      label: "Name",
      placeholder: "Your name",
      autoComplete: "name",
      value: name,
      error: err.name,
      onChange: e => {
        setName(e.target.value);
        setErr({
          ...err,
          name: null
        });
      }
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Email",
      type: "email",
      placeholder: "you@company.com",
      autoComplete: "email",
      value: email,
      error: err.email,
      onChange: e => {
        setEmail(e.target.value);
        setErr({
          ...err,
          email: null
        });
      }
    }), view !== 'forgot' && /*#__PURE__*/React.createElement("div", null, pwField('Password'), !isUp && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 4,
        marginRight: -8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "text",
      onClick: () => go('forgot')
    }, "Forgot password?"))), isUp && /*#__PURE__*/React.createElement(Checkbox, {
      checked: terms,
      onChange: setTerms
    }, "I agree to the Terms and Privacy Policy"), /*#__PURE__*/React.createElement(Button, {
      type: "submit",
      variant: "primary",
      size: "lg",
      block: true,
      disabled: busy || isUp && !terms,
      style: {
        marginTop: 8
      }
    }, busy ? 'One moment…' : view === 'forgot' ? 'Send reset link' : isUp ? terms ? 'Create account' : 'Accept the terms to continue' : 'Sign in')));
  }
  function ArtPanel() {
    const D = window.KIT_DATA;
    return /*#__PURE__*/React.createElement("div", {
      "data-theme": "dark",
      style: {
        flex: 1,
        minWidth: 0,
        background: 'var(--bg-frame)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(32px, 4vw, 64px)',
        color: '#fff'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 520,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 32
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ds-card",
      style: {
        padding: 24
      }
    }, /*#__PURE__*/React.createElement(AreaChart, {
      title: "Revenue",
      prefix: "$",
      formatValue: v => v.toLocaleString(undefined, {
        maximumFractionDigits: 0
      }),
      data: D.revenue,
      labels: D.days,
      restLabel: "Past 30 days",
      height: 160,
      status: /*#__PURE__*/React.createElement(StatusBadge, null, "Live")
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "t-title-lg"
    }, "Every number that matters, in one calm place."), /*#__PURE__*/React.createElement("div", {
      className: "t-body t-muted",
      style: {
        marginTop: 8
      }
    }, "Charts, reports and alerts for your whole team."))));
  }
  function AuthScreen() {
    const [wide, setWide] = React.useState(window.innerWidth >= 1024);
    React.useEffect(() => {
      const f = () => setWide(window.innerWidth >= 1024);
      window.addEventListener('resize', f);
      return () => window.removeEventListener('resize', f);
    }, []);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        minHeight: '100dvh',
        background: 'var(--bg-app)',
        color: 'var(--text)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: wide ? '0 0 min(560px, 45%)' : 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px var(--page-gutter)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '700 18px/1 var(--font-sans)',
        letterSpacing: 'var(--tracking-tighter)'
      }
    }, "Workspace"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 0'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        maxWidth: 400
      }
    }, /*#__PURE__*/React.createElement(AuthForm, null))), /*#__PURE__*/React.createElement("div", {
      className: "t-label t-subtle",
      style: {
        display: 'flex',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Workspace"), /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        color: 'inherit'
      }
    }, "Privacy"), /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        color: 'inherit'
      }
    }, "Terms"))), wide && /*#__PURE__*/React.createElement(ArtPanel, null));
  }
  window.AuthScreen = AuthScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Auth.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Detail.jsx
try { (() => {
(() => {
  const {
    AreaChart,
    StatGrid,
    Card,
    Avatar,
    StatusBadge,
    Tabs,
    ListRow,
    Button
  } = window.DashboardDesignSystem_d616c8;
  function Detail({
    id,
    onBack,
    onNewAlert
  }) {
    const D = window.KIT_DATA;
    const m = D.metrics.find(x => x.id === id) || D.metrics[2];
    const [tab, setTab] = React.useState('Watchers');
    const series = D.seriesFor(m);
    const fmt = v => v.toLocaleString(undefined, {
      minimumFractionDigits: m.dec,
      maximumFractionDigits: m.dec
    });
    return /*#__PURE__*/React.createElement(Page, {
      header: /*#__PURE__*/React.createElement(TopBar, {
        title: m.name,
        onBack: onBack
      }, /*#__PURE__*/React.createElement(Button, {
        size: "md",
        icon: "bell-plus",
        onClick: onNewAlert
      }, "Create alert"))
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      kind: "entity",
      initials: m.name[0],
      color: m.color,
      badge: m.group[0]
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "t-body-strong"
    }, m.name), /*#__PURE__*/React.createElement("div", {
      className: "t-label t-muted"
    }, m.group))), /*#__PURE__*/React.createElement(AreaChart, {
      data: series,
      labels: D.hours,
      prefix: m.prefix,
      suffix: m.suffix,
      formatValue: fmt,
      restLabel: "Past day",
      height: 260,
      status: /*#__PURE__*/React.createElement(StatusBadge, null, "Live"),
      ranges: ['1H', '4H', '1D', '1W', '1M'],
      defaultRange: "1D"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '28px 0'
      }
    }, /*#__PURE__*/React.createElement(StatGrid, {
      items: [{
        label: m.stats[0],
        value: m.stats[1]
      }, {
        label: m.stats[2],
        value: m.stats[3]
      }, {
        label: '7d change',
        value: (m.change >= 0 ? '+' : '−') + Math.abs(m.change).toFixed(1) + '%',
        tone: m.id === 'lat' || m.id === 'churn' || m.id === 'tickets' ? m.change <= 0 ? 'positive' : 'negative' : m.change >= 0 ? 'positive' : 'negative'
      }]
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Card, {
      variant: "detail"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "t-card-title",
      style: {
        margin: '0 0 16px'
      }
    }, "Details"), /*#__PURE__*/React.createElement(StatGrid, {
      layout: "list",
      items: [{
        label: 'Owner',
        value: m.group + ' team'
      }, {
        label: 'Source',
        value: 'Warehouse'
      }, {
        label: 'Refresh',
        value: 'Every minute'
      }, {
        label: 'Created',
        value: 'Mar 4, 2026'
      }]
    })), /*#__PURE__*/React.createElement(Card, {
      variant: "detail"
    }, /*#__PURE__*/React.createElement(Tabs, {
      options: ['Watchers', 'History'],
      value: tab,
      onChange: setTab,
      style: {
        marginBottom: 8
      }
    }), tab === 'Watchers' ? D.people.map(p => /*#__PURE__*/React.createElement(ListRow, {
      key: p.name,
      leading: /*#__PURE__*/React.createElement(Avatar, {
        kind: "contact"
      }),
      title: p.name,
      subtitle: p.role,
      style: {
        padding: '0 4px'
      }
    })) : [['Threshold raised', 'Oct 9', 'repeat', 'var(--cat-violet)'], ['Alert sent', 'Oct 7', 'arrow-up-right', 'var(--cat-sky)']].map(([t, d, ic, c]) => /*#__PURE__*/React.createElement(ListRow, {
      key: t,
      leading: /*#__PURE__*/React.createElement(Avatar, {
        kind: "category",
        icon: ic,
        color: c
      }),
      title: t,
      subtitle: d,
      style: {
        padding: '0 4px'
      }
    })))));
  }
  window.Detail = Detail;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Detail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Flows.jsx
try { (() => {
(() => {
  const {
    Sheet,
    Dialog,
    Stepper,
    Input,
    SelectField,
    AmountInput,
    Checkbox,
    Button,
    Banner,
    Avatar,
    ListRow
  } = window.DashboardDesignSystem_d616c8;
  function CreateAlertSheet({
    open,
    onClose
  }) {
    const D = window.KIT_DATA;
    const [step, setStep] = React.useState(0);
    const [name, setName] = React.useState('');
    const [nameErr, setNameErr] = React.useState('');
    const [metric, setMetric] = React.useState(null);
    const [picker, setPicker] = React.useState(false);
    const [amt, setAmt] = React.useState('');
    const [ack, setAck] = React.useState(false);
    React.useEffect(() => {
      if (open) {
        setStep(0);
        setName('');
        setMetric(null);
        setAmt('');
        setAck(false);
        setNameErr('');
      }
    }, [open]);
    if (!open) return null;
    const next = () => {
      if (step === 0) {
        if (!name.trim()) return setNameErr('Enter a name for the alert.');
        if (!metric) return;
      }
      if (step < 2) setStep(step + 1);else onClose(true);
    };
    const cta = step === 0 ? !metric ? 'Select a metric' : 'Continue' : step === 1 ? amt ? 'Continue' : 'Enter a threshold' : 'Create alert';
    const disabled = step === 0 && !metric || step === 1 && !amt || step === 2 && !ack;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Sheet, {
      open: true,
      onClose: () => onClose(false),
      title: "New alert"
    }, /*#__PURE__*/React.createElement(Stepper, {
      steps: ['Details', 'Condition', 'Confirm'],
      current: step,
      style: {
        marginBottom: 24
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        marginBottom: 24
      }
    }, step === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Input, {
      label: "Name",
      placeholder: "e.g. Latency spike",
      value: name,
      error: nameErr,
      onChange: e => {
        setName(e.target.value);
        setNameErr('');
      }
    }), /*#__PURE__*/React.createElement(SelectField, {
      label: "Metric",
      value: metric && metric.name,
      placeholder: "Select metric",
      onClick: () => setPicker(true),
      leading: metric ? /*#__PURE__*/React.createElement(Avatar, {
        kind: "entity",
        initials: metric.name[0],
        color: metric.color
      }) : /*#__PURE__*/React.createElement(Avatar, {
        kind: "contact",
        icon: "chart-line"
      })
    })), step === 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AmountInput, {
      size: "xl",
      label: "Alert when above",
      value: amt,
      onChange: v => setAmt(v.replace(/[^0-9.]/g, '')),
      meta: metric ? metric.value : '',
      metaEnd: "Current"
    }), /*#__PURE__*/React.createElement(Banner, null, "Alerts check every minute and notify watchers by email.")), step === 2 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "ds-card ds-card--detail"
    }, /*#__PURE__*/React.createElement("div", {
      className: "t-label t-muted"
    }, "Summary"), /*#__PURE__*/React.createElement("div", {
      className: "t-body-lg"
    }, name, " \u2014 ", metric && metric.name, " above ", amt)), /*#__PURE__*/React.createElement(Checkbox, {
      checked: ack,
      onChange: setAck
    }, "Notify everyone watching this metric"))), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      disabled: disabled,
      onClick: next
    }, cta)), picker && /*#__PURE__*/React.createElement(Sheet, {
      open: true,
      titleSize: "card",
      title: "Select metric",
      onClose: () => setPicker(false)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '0 -16px'
      }
    }, D.metrics.map(m => /*#__PURE__*/React.createElement(ListRow, {
      key: m.id,
      variant: "palette",
      leading: /*#__PURE__*/React.createElement(Avatar, {
        kind: "entity",
        initials: m.name[0],
        color: m.color
      }),
      title: m.name,
      subtitle: m.group,
      value: m.value,
      onClick: () => {
        setMetric(m);
        setPicker(false);
      }
    })))));
  }
  function SearchDialog({
    open,
    onClose,
    onGo
  }) {
    const D = window.KIT_DATA;
    const groups = [{
      label: 'Pages',
      items: [['overview', 'Overview', 'house'], ['reports', 'Reports', 'chart-line'], ['settings', 'Settings', 'settings']].map(([id, t, ic]) => ({
        id,
        title: t,
        subtitle: 'Page',
        filter: 'Pages',
        leading: /*#__PURE__*/React.createElement(Avatar, {
          kind: "tile",
          icon: ic
        })
      }))
    }, {
      label: 'Metrics',
      items: D.metrics.map(m => ({
        id: 'm:' + m.id,
        title: m.name,
        subtitle: m.group,
        value: m.value,
        filter: 'Metrics',
        leading: /*#__PURE__*/React.createElement(Avatar, {
          kind: "entity",
          initials: m.name[0],
          color: m.color
        })
      }))
    }];
    return /*#__PURE__*/React.createElement(Dialog, {
      open: open,
      onClose: onClose,
      placeholder: "Search pages and metrics",
      filters: ['All', 'Pages', 'Metrics'],
      groups: groups,
      onSelect: it => {
        onGo(it.id);
        onClose();
      }
    });
  }
  Object.assign(window, {
    CreateAlertSheet,
    SearchDialog
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Flows.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Overview.jsx
try { (() => {
(() => {
  const {
    AreaChart,
    Card,
    CardRow,
    ChipGroup,
    Button,
    IconButton,
    Avatar,
    StatusBadge,
    ExploreCard,
    ReviewRow,
    Badge,
    EmptyState,
    Skeleton,
    Icon
  } = window.DashboardDesignSystem_d616c8;
  function Overview({
    onNewReport,
    onOpenMetric,
    hidden,
    onToggleHidden
  }) {
    const D = window.KIT_DATA;
    const [tab, setTab] = React.useState('Summary');
    const mask = s => hidden ? '••••' : s;
    return /*#__PURE__*/React.createElement(Page, {
      header: /*#__PURE__*/React.createElement(TopBar, {
        title: "Overview"
      }, /*#__PURE__*/React.createElement(IconButton, {
        kind: "ghost",
        icon: hidden ? 'eye' : 'eye-off',
        label: hidden ? 'Show values' : 'Hide values',
        onClick: onToggleHidden
      }), /*#__PURE__*/React.createElement(IconButton, {
        kind: "ghost",
        icon: "bell",
        label: "Notifications"
      }))
    }, /*#__PURE__*/React.createElement("section", {
      style: {
        marginBottom: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "t-label t-muted"
    }, "Total revenue"), /*#__PURE__*/React.createElement("div", {
      className: "t-balance",
      style: {
        height: 40
      }
    }, mask('$48,210.62')), /*#__PURE__*/React.createElement("div", {
      className: "t-body-lg",
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "t-up"
    }, "\u25B2 $1,942.10 (4.20%)"), /*#__PURE__*/React.createElement("span", {
      className: "t-muted"
    }, "Past 30 days")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        marginTop: 20
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: "plus",
      onClick: onNewReport
    }, "New alert"), /*#__PURE__*/React.createElement(Button, {
      icon: "download"
    }, "Export"), /*#__PURE__*/React.createElement(Button, {
      icon: "share-2"
    }, "Share"))), /*#__PURE__*/React.createElement(ChipGroup, {
      options: ['Summary', 'Channels', 'Explore'],
      value: tab,
      onChange: setTab,
      style: {
        marginBottom: 20
      }
    }), tab === 'Summary' && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }
    }, /*#__PURE__*/React.createElement(AreaChart, {
      title: "Revenue",
      prefix: "$",
      formatValue: v => hidden ? '••••' : v.toLocaleString(undefined, {
        maximumFractionDigits: 0
      }),
      data: D.revenue,
      labels: D.days,
      restLabel: "Past 30 days",
      height: 220,
      ranges: ['1W', '1M', '3M', '1Y', 'All'],
      defaultRange: "1M",
      status: /*#__PURE__*/React.createElement(StatusBadge, null, "Live")
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
      className: "t-section",
      style: {
        margin: '0 0 12px'
      }
    }, "Top channels"), /*#__PURE__*/React.createElement(Card, {
      variant: "list"
    }, D.channels.map(c => /*#__PURE__*/React.createElement(CardRow, {
      key: c.name,
      onClick: () => onOpenMetric('rev'),
      leading: /*#__PURE__*/React.createElement(Avatar, {
        kind: "entity",
        initials: c.name[0],
        color: c.color
      }),
      title: c.name,
      subtitle: c.sub,
      value: mask(c.value),
      subvalue: /*#__PURE__*/React.createElement("span", {
        className: c.change >= 0 ? 't-up' : 't-down'
      }, c.change >= 0 ? '+' : '−', Math.abs(c.change), "%")
    }))))), tab === 'Channels' && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Card, {
      variant: "group",
      title: "Needs attention",
      action: /*#__PURE__*/React.createElement(Button, {
        size: "xs"
      }, "Resolve all")
    }, /*#__PURE__*/React.createElement(ReviewRow, null, /*#__PURE__*/React.createElement(CardRow, {
      onClick: () => {},
      leading: /*#__PURE__*/React.createElement(Avatar, {
        kind: "entity",
        initials: "L",
        color: "#525252"
      }),
      title: "Legacy webhook",
      subtitle: /*#__PURE__*/React.createElement(React.Fragment, null, "3 failures \xB7 ", /*#__PURE__*/React.createElement(Badge, {
        variant: "text"
      }, "Needs review")),
      value: "Since Oct 9"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 20,
      style: {
        color: 'var(--text-muted)'
      }
    }))), /*#__PURE__*/React.createElement(CardRow, {
      onClick: () => {},
      leading: /*#__PURE__*/React.createElement(Avatar, {
        kind: "entity",
        initials: "E",
        color: "#0284c7"
      }),
      title: "Email digest",
      subtitle: "Healthy",
      value: "Daily"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 20,
      style: {
        color: 'var(--text-muted)'
      }
    }))), /*#__PURE__*/React.createElement(Card, {
      style: {
        position: 'relative',
        overflow: 'hidden',
        padding: '32px 0'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        opacity: 0.35
      }
    }, /*#__PURE__*/React.createElement(Skeleton, {
      variant: "row",
      rows: 3
    })), /*#__PURE__*/React.createElement(EmptyState, {
      style: {
        position: 'relative'
      },
      title: "No custom channels",
      description: "Connect a source to see its numbers here.",
      actionLabel: "Connect source"
    }))), tab === 'Explore' && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(ExploreCard, {
      style: {
        width: 'auto'
      },
      art: "growth",
      title: "Forecasts",
      description: "Project the next 90 days from your history."
    }), /*#__PURE__*/React.createElement(ExploreCard, {
      style: {
        width: 'auto'
      },
      art: "chart",
      title: "Live metrics",
      description: "Watch key numbers update in real time."
    }), /*#__PURE__*/React.createElement(ExploreCard, {
      style: {
        width: 'auto'
      },
      art: "slider",
      tone: "brand",
      title: "Goals",
      description: "Set targets and track progress."
    })));
  }
  window.Overview = Overview;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Overview.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Reports.jsx
try { (() => {
(() => {
  const {
    Table,
    Sparkline,
    Avatar,
    ChipGroup,
    Input,
    Select,
    Skeleton,
    Card,
    Badge
  } = window.DashboardDesignSystem_d616c8;
  function Reports({
    onOpenMetric
  }) {
    const D = window.KIT_DATA;
    const [loading, setLoading] = React.useState(true);
    const [q, setQ] = React.useState('');
    const [grp, setGrp] = React.useState('All');
    const [sort, setSort] = React.useState('Name');
    const num = v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
    React.useEffect(() => {
      const t = setTimeout(() => setLoading(false), 700);
      return () => clearTimeout(t);
    }, []);
    const rows = D.metrics.filter(m => (grp === 'All' || m.group === grp) && m.name.toLowerCase().includes(q.toLowerCase())).slice().sort((a, b) => sort === 'Name' ? a.name.localeCompare(b.name) : sort === 'Change' ? b.change - a.change : num(b.value) - num(a.value));
    return /*#__PURE__*/React.createElement(Page, {
      header: /*#__PURE__*/React.createElement(TopBar, {
        title: "Reports"
      })
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement(ChipGroup, {
      variant: "filter",
      options: ['All', 'Finance', 'Product', 'Platform', 'Growth'],
      value: grp,
      onChange: setGrp,
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Input, {
      size: "sm",
      icon: "search",
      placeholder: "Search metrics",
      value: q,
      onChange: e => setQ(e.target.value),
      style: {
        width: 220
      }
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      options: ['Name', 'Change', 'Value'],
      value: sort,
      onChange: setSort,
      style: {
        width: 140
      }
    })), loading ? /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Skeleton, {
      variant: "row",
      rows: 5
    })) : /*#__PURE__*/React.createElement(Table, {
      rowKey: "id",
      onRowClick: r => onOpenMetric(r.id),
      rows: rows,
      columns: [{
        key: 'name',
        label: 'Metric',
        render: r => /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }
        }, /*#__PURE__*/React.createElement(Avatar, {
          kind: "entity",
          initials: r.name[0],
          color: r.color
        }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            gap: 8,
            alignItems: 'center'
          }
        }, r.name, r.id === 'lat' && /*#__PURE__*/React.createElement(Badge, null, "Beta")), /*#__PURE__*/React.createElement("div", {
          className: "t-label t-muted",
          style: {
            letterSpacing: 0
          }
        }, r.group)))
      }, {
        key: 'value',
        label: 'Value',
        align: 'right'
      }, {
        key: 'change',
        label: '7d',
        align: 'right',
        render: r => /*#__PURE__*/React.createElement("span", {
          className: r.change >= 0 ? 't-up' : 't-down'
        }, r.change >= 0 ? '▲' : '▼', " ", Math.abs(r.change).toFixed(1), "%")
      }, {
        key: 'spark',
        label: 'Chart',
        align: 'right',
        width: 120,
        render: r => /*#__PURE__*/React.createElement(Sparkline, {
          data: r.spark,
          tone: r.change >= 0 ? 'up' : 'down'
        })
      }]
    }));
  }
  window.Reports = Reports;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Reports.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Settings.jsx
try { (() => {
(() => {
  const {
    Card,
    Avatar,
    OptionTile,
    Checkbox,
    ListRow,
    Banner
  } = window.DashboardDesignSystem_d616c8;
  function Settings({
    theme,
    setTheme,
    accent,
    setAccent
  }) {
    const Section = ({
      icon,
      title,
      sub,
      children
    }) => /*#__PURE__*/React.createElement(Card, {
      variant: "section"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        marginBottom: children ? 16 : 0
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      kind: "disc",
      icon: icon
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "t-body-strong"
    }, title), /*#__PURE__*/React.createElement("div", {
      className: "t-label t-muted"
    }, sub))), children);
    return /*#__PURE__*/React.createElement(Page, {
      header: /*#__PURE__*/React.createElement(TopBar, {
        title: "Settings"
      })
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 512
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Section, {
      icon: "palette",
      title: "Appearance",
      sub: "Theme and brand color"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      },
      role: "radiogroup"
    }, /*#__PURE__*/React.createElement(OptionTile, {
      icon: "moon",
      label: "Dark",
      checked: theme === 'dark',
      onClick: () => setTheme('dark')
    }), /*#__PURE__*/React.createElement(OptionTile, {
      icon: "sun",
      label: "Light",
      checked: theme === 'light',
      onClick: () => setTheme('light')
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 8
      },
      role: "radiogroup"
    }, /*#__PURE__*/React.createElement(OptionTile, {
      icon: "circle-dot",
      label: "Purple",
      checked: accent === 'purple',
      onClick: () => setAccent('purple')
    }), /*#__PURE__*/React.createElement(OptionTile, {
      icon: "circle",
      label: "Green",
      checked: accent === 'green',
      onClick: () => setAccent('green')
    }))), /*#__PURE__*/React.createElement(Section, {
      icon: "bell",
      title: "Notifications",
      sub: "Choose what reaches your inbox"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Checkbox, {
      defaultChecked: true
    }, "Weekly summary"), /*#__PURE__*/React.createElement(Checkbox, {
      defaultChecked: true
    }, "Alert triggers"), /*#__PURE__*/React.createElement(Checkbox, null, "Product updates"))), /*#__PURE__*/React.createElement(Section, {
      icon: "shield-check",
      title: "Security",
      sub: "Two-step verification is on"
    }), /*#__PURE__*/React.createElement(Banner, null, "Changes save automatically."))));
  }
  window.Settings = Settings;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Settings.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Shell.jsx
try { (() => {
(() => {
  const {
    Sidebar,
    ContentPanel,
    BottomNav,
    IconButton,
    Button
  } = window.DashboardDesignSystem_d616c8;
  const NAV = [{
    id: 'overview',
    label: 'Overview',
    icon: 'house'
  }, {
    id: 'reports',
    label: 'Reports',
    icon: 'chart-line'
  }, {
    id: 'settings',
    label: 'Settings',
    icon: 'settings'
  }];
  function useWide() {
    const [w, setW] = React.useState(window.innerWidth >= 1280);
    React.useEffect(() => {
      const f = () => setW(window.innerWidth >= 1280);
      window.addEventListener('resize', f);
      return () => window.removeEventListener('resize', f);
    }, []);
    return w;
  }
  const WideCtx = React.createContext(true);
  function TopBar({
    title,
    onBack,
    children
  }) {
    return /*#__PURE__*/React.createElement("header", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 72
      }
    }, onBack && /*#__PURE__*/React.createElement(IconButton, {
      icon: "arrow-left",
      label: "Back",
      onClick: onBack
    }), /*#__PURE__*/React.createElement("h1", {
      className: "t-page-title",
      style: {
        margin: 0,
        flex: 1
      }
    }, title), children);
  }
  function Shell({
    page,
    onNav,
    onSearch,
    onAccount,
    children
  }) {
    const wide = useWide();
    const navId = page === 'detail' ? 'reports' : page;
    if (wide) {
      return /*#__PURE__*/React.createElement("div", {
        className: "ds-frame"
      }, /*#__PURE__*/React.createElement(Sidebar, {
        brand: "Workspace",
        active: navId,
        onSelect: onNav,
        onSearch: onSearch,
        onAccountClick: onAccount,
        sections: [{
          items: NAV
        }, {
          label: 'Manage',
          items: [{
            id: 'people',
            label: 'People',
            icon: 'users'
          }, {
            id: 'billing',
            label: 'Billing',
            icon: 'credit-card'
          }]
        }],
        footer: [{
          id: 'feedback',
          label: 'Give feedback',
          icon: 'message-square'
        }]
      }), /*#__PURE__*/React.createElement(WideCtx.Provider, {
        value: true
      }, children));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: '100vh',
        background: 'var(--bg-app)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        paddingBottom: 120
      }
    }, /*#__PURE__*/React.createElement(WideCtx.Provider, {
      value: false
    }, children)), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 20,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 20
      }
    }, /*#__PURE__*/React.createElement(BottomNav, {
      items: NAV,
      active: navId,
      onSelect: onNav,
      onSearch: onSearch,
      onBack: page === 'detail' ? () => onNav('reports') : undefined
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        right: 20,
        bottom: 16,
        zIndex: 21
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      kind: "support",
      icon: "message-circle",
      label: "Get help"
    })));
  }
  function Page({
    header,
    children
  }) {
    const wide = React.useContext(WideCtx);
    if (wide) return /*#__PURE__*/React.createElement(ContentPanel, {
      header: /*#__PURE__*/React.createElement("div", {
        className: "ds-container"
      }, header)
    }, /*#__PURE__*/React.createElement("div", {
      className: "ds-container",
      style: {
        paddingBottom: 48,
        paddingTop: 8
      }
    }, children));
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "ds-container",
      style: {
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-app)'
      }
    }, header), /*#__PURE__*/React.createElement("div", {
      className: "ds-container"
    }, children));
  }
  Object.assign(window, {
    Shell,
    TopBar,
    Page
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/data.js
try { (() => {
window.KIT_DATA = (() => {
  const days = Array.from({
    length: 30
  }, (_, i) => i + 12 > 30 ? 'Oct ' + (i - 18) : 'Sep ' + (i + 12));
  const revenue = [38.2, 38.9, 38.4, 39.6, 40.1, 39.8, 41.2, 41.9, 41.1, 42.6, 43.4, 42.8, 44.1, 43.6, 44.9, 45.6, 45.1, 46.2, 45.7, 46.9, 47.4, 46.8, 47.9, 47.2, 48.6, 48.1, 48.9, 49.4, 48.7, 48.21].map(v => v * 1000);
  const metrics = [{
    id: 'rev',
    name: 'Revenue',
    group: 'Finance',
    prefix: '$',
    suffix: '',
    base: 48210,
    dec: 0,
    stats: ['Daily avg', '$1,607', 'Best day', '$2,114'],
    value: '$48,210',
    change: 4.2,
    color: '#7764d8',
    spark: [38, 39, 41, 40, 43, 45, 46, 48]
  }, {
    id: 'users',
    name: 'Active users',
    group: 'Product',
    prefix: '',
    suffix: '',
    base: 3204,
    dec: 0,
    stats: ['Daily avg', '3,050', 'Peak', '3,412'],
    value: '3,204',
    change: 2.8,
    color: '#3080ff',
    spark: [28, 29, 30, 30, 31, 31, 32, 32]
  }, {
    id: 'lat',
    name: 'API latency',
    group: 'Platform',
    prefix: '',
    suffix: ' ms',
    base: 184,
    dec: 0,
    stats: ['p50', '142 ms', 'p99', '612 ms'],
    value: '184 ms',
    change: -6.1,
    color: '#7c3aed',
    spark: [210, 205, 198, 200, 192, 190, 186, 184]
  }, {
    id: 'conv',
    name: 'Conversion',
    group: 'Growth',
    prefix: '',
    suffix: '%',
    base: 3.42,
    dec: 2,
    stats: ['Daily avg', '3.48%', 'Best day', '3.71%'],
    value: '3.42%',
    change: -0.6,
    color: '#0284c7',
    spark: [3.5, 3.6, 3.5, 3.4, 3.5, 3.4, 3.4, 3.42]
  }, {
    id: 'churn',
    name: 'Churn',
    group: 'Finance',
    prefix: '',
    suffix: '%',
    base: 1.9,
    dec: 2,
    stats: ['Monthly avg', '1.86%', 'Worst month', '2.10%'],
    value: '1.9%',
    change: 0.3,
    color: '#e70044',
    spark: [1.8, 1.8, 1.9, 1.8, 1.9, 1.9, 1.9, 1.9]
  }, {
    id: 'tickets',
    name: 'Open tickets',
    group: 'Support',
    prefix: '',
    suffix: '',
    base: 87,
    dec: 0,
    stats: ['Opened today', '24', 'Closed today', '31'],
    value: '87',
    change: -12.4,
    color: '#404040',
    spark: [110, 104, 99, 97, 94, 90, 88, 87]
  }];
  let p = 190;
  const base = Array.from({
    length: 40
  }, (_, i) => p = p + Math.sin(i * 0.9) * 6 + (i * 7 % 5 - 2.4));
  const hours = base.map((_, i) => String(i % 24).padStart(2, '0') + ':00');
  const channels = [{
    name: 'Web',
    sub: '12,480 visits',
    value: '$24,204.10',
    change: 4.2,
    color: '#3080ff'
  }, {
    name: 'Mobile app',
    sub: '6,112 visits',
    value: '$15,920.00',
    change: -1.8,
    color: '#7c3aed'
  }, {
    name: 'Partners',
    sub: '1,034 referrals',
    value: '$8,086.52',
    change: 0.6,
    color: '#0284c7'
  }];
  const people = [{
    name: 'Ana Ruiz',
    role: 'Admin'
  }, {
    name: 'Jon Park',
    role: 'Editor'
  }, {
    name: 'Mia Chen',
    role: 'Viewer'
  }];
  const seriesFor = m => {
    const k = m.base / base[base.length - 1];
    return base.map(v => v * k);
  };
  return {
    days,
    revenue,
    metrics,
    hours,
    channels,
    people,
    seriesFor
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.AreaChart = __ds_scope.AreaChart;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.StatGrid = __ds_scope.StatGrid;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Hatch = __ds_scope.Hatch;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.AmountInput = __ds_scope.AmountInput;

__ds_ns.AmountPair = __ds_scope.AmountPair;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.SelectField = __ds_scope.SelectField;

__ds_ns.BottomNav = __ds_scope.BottomNav;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.ContentPanel = __ds_scope.ContentPanel;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Sheet = __ds_scope.Sheet;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.ChipGroup = __ds_scope.ChipGroup;

__ds_ns.OptionTile = __ds_scope.OptionTile;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardRow = __ds_scope.CardRow;

__ds_ns.ExploreCard = __ds_scope.ExploreCard;

__ds_ns.ReviewRow = __ds_scope.ReviewRow;

})();
