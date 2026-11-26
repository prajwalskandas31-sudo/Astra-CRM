import React, { useState } from 'react';

/**
 * Renders long lists in steps: the first `step` items, then more on request. Thousands of lead rows
 * rendered at once make every keystroke and sync update slow. Filters, counts, select-all and exports
 * keep working on the full list; only the rows drawn on screen are limited.
 *
 *   const more = useShowMore(filteredLeads);
 *   more.visible.map(...)       // the rows to draw
 *   <ShowMoreRow more={more} /> // a table row with the "Show more" buttons (nothing when all are shown)
 */
export function useShowMore(items, step = 100) {
  const [limit, setLimit] = useState(step);
  const list = items || [];
  const visible = list.length > limit ? list.slice(0, limit) : list;
  return {
    visible,
    remaining: list.length - visible.length,
    step,
    showMore: () => setLimit(l => l + step),
    showAll: () => setLimit(list.length)
  };
}

const buttonStyle = { fontSize: '0.8rem', padding: '6px 14px' };

/** The "Show more" controls, as a full-width table row (colSpan larger than the column count spans them all). */
export function ShowMoreRow({ more, colSpan = 100 }) {
  if (!more || more.remaining <= 0) return null;
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', padding: '14px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <span style={{ marginRight: '12px' }}>{more.remaining} more not shown</span>
        <button type="button" className="btn-secondary" style={buttonStyle} onClick={more.showMore}>
          Show {Math.min(more.step, more.remaining)} more
        </button>
        {more.remaining > more.step && (
          <button type="button" className="btn-secondary" style={{ ...buttonStyle, marginLeft: '8px' }} onClick={more.showAll}>
            Show all
          </button>
        )}
      </td>
    </tr>
  );
}

/** The same controls outside a table. */
export function ShowMoreBar({ more }) {
  if (!more || more.remaining <= 0) return null;
  return (
    <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
      <span style={{ marginRight: '10px' }}>{more.remaining} more not shown</span>
      <button type="button" className="btn-secondary" style={buttonStyle} onClick={more.showMore}>
        Show {Math.min(more.step, more.remaining)} more
      </button>
    </div>
  );
}
