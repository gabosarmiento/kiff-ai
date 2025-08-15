"use client";
import React from "react";
import ReactDOM from "react-dom";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmMatch?: string; // when provided, user must type this exact text to enable confirm
  confirmPlaceholder?: string;
};

export function ConfirmModal({ open, title = "Are you sure?", message, confirmText = "Confirm", cancelText = "Cancel", onConfirm, onCancel, confirmMatch, confirmPlaceholder, }: Props) {
  const [value, setValue] = React.useState("");
  // Reset input whenever modal opens or the required match text changes
  React.useEffect(() => {
    if (open) setValue("");
  }, [open, confirmMatch]);
  const matchOk = confirmMatch ? value === confirmMatch : true;
  if (!open) return null;
  const content = (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">{title}</div>
        <div className="modal-body">
          {message ? <div style={{ marginBottom: confirmMatch ? 10 : 0 }}>{message}</div> : null}
          {confirmMatch ? (
            <div className="field">
              <label className="label">Type to confirm</label>
              <input
                className="input"
                placeholder={confirmPlaceholder || confirmMatch}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
              />
            </div>
          ) : null}
        </div>
        <div className="modal-actions">
          <button className="button" onClick={onCancel}>{cancelText}</button>
          <button className="button danger" onClick={onConfirm} disabled={!matchOk}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
  // Render in a portal attached to body to avoid transformed ancestors affecting fixed positioning
  if (typeof document !== 'undefined' && document.body) {
    return ReactDOM.createPortal(content, document.body);
  }
  return content;
}
