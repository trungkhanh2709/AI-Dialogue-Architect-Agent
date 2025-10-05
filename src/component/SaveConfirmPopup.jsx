import React from "react";
// import "../styles/saveConfirmPopup.css";

export default function SaveConfirmPopup({ onConfirm, onCancel }) {
  return (
    <div className="popup-overlay">
      <div className="popup-box">
        <h3>Bạn có muốn lưu dữ liệu cuộc họp này không?</h3>
        <p>
          Dữ liệu cuộc họp sẽ được lưu vào cơ sở dữ liệu của chúng tôi. 
          Nếu sau này bạn đổi ý và muốn bật/tắt lưu, có thể chỉnh trong phần cài đặt.
        </p>
        <div className="popup-actions">
          <button className="btn-cancel" onClick={onCancel}>Không</button>
          <button className="btn-save" onClick={onConfirm}>Lưu</button>
        </div>
      </div>
    </div>
  );
}
